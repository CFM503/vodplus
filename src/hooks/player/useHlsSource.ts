import { useState, useRef, useEffect } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

// Cache the HLS constructor across URL changes to avoid re-importing
let cachedHlsConstructor: typeof Hls | null = null;
let hlsImportPromise: Promise<typeof Hls> | null = null;

async function getHlsConstructor(): Promise<typeof Hls> {
    if (cachedHlsConstructor) return cachedHlsConstructor;
    if (!hlsImportPromise) {
        hlsImportPromise = import('hls.js').then(mod => {
            cachedHlsConstructor = mod.default;
            return mod.default;
        });
    }
    return hlsImportPromise;
}

interface UseHlsSourceProps {
    url: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isEmbed: boolean;
    maxBufferLength: number;
    skipIntroTimeRef: React.RefObject<number>;
    showToast?: (message: string) => void;
}

export function useHlsSource({ url, videoRef, isEmbed, maxBufferLength, skipIntroTimeRef, showToast }: UseHlsSourceProps) {
    const hlsRef = useRef<InstanceType<typeof Hls> | null>(null);
    const hasSkippedIntroRef = useRef(false);
    const hasPrefetchedNextRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    const [activeLevelIdx, setActiveLevelIdx] = useState(-1);

    // 追踪 MEDIA_ATTACHED 状态，确保 play() 在视频源挂载后才执行
    const manifestParsedRef = useRef(false);
    const mediaAttachedRef = useRef(false);
    // 每个 URL 只提示一次致命错误，避免重试循环刷屏
    const errorNotifiedRef = useRef(false);

    // Reset flags on URL change
    useEffect(() => {
        hasPrefetchedNextRef.current = false;
        hasSkippedIntroRef.current = false;
        manifestParsedRef.current = false;
        mediaAttachedRef.current = false;
        errorNotifiedRef.current = false;
    }, [url]);

    // HLS initialization
    useEffect(() => {
        setIsLoading(true);
        setLevels([]);
        setCurrentLevel(-1);
        setActiveLevelIdx(-1);
        hasSkippedIntroRef.current = false;
        manifestParsedRef.current = false;
        mediaAttachedRef.current = false;

        const video = videoRef.current;
        if (!video || isEmbed) return;

        const initPlayer = async () => {
            if (!url) return;
            // 清理上一 URL 可能残留的原生 onerror，避免误报
            video.onerror = null;
            if (url.includes('.mp4') || url.includes('.webm')) {
                video.src = url;
                video.onerror = () => {
                    setIsLoading(false);
                    if (!errorNotifiedRef.current) {
                        errorNotifiedRef.current = true;
                        showToast?.('视频加载失败：可能是不支持的格式、网络问题或 CORS 限制');
                    }
                };
                setIsLoading(false);
                return;
            }

            // FLV 无法被 HLS.js / 原生 video 直接播放，给出明确提示
            if (/\.flv(?:[?#]|$)/i.test(url)) {
                showToast?.('该线路为 FLV 格式，暂不支持直接播放，请切换其他线路');
                setIsLoading(false);
                return;
            }

            try {
                const Hls = await getHlsConstructor();

                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();

                    // Calculate and bound maxBufferSize dynamically based on maxBufferLength:
                    // - Base minimum: 30MB, Proportional scaling: 2MB/s, Ceiling: 100MB
                    const initialCalculatedSize = maxBufferLength * 2 * 1024 * 1024;
                    const initialBoundedSize = Math.min(100 * 1024 * 1024, Math.max(30 * 1024 * 1024, initialCalculatedSize));

                    const hls = new Hls({
                        capLevelToPlayerSize: true,
                        autoStartLoad: true,
                        startLevel: -1,
                        enableWorker: true,
                        maxBufferLength: CONFIG.BUFFER_ADAPTIVE ? Math.min(maxBufferLength, CONFIG.BUFFER_HIGH_BW) : maxBufferLength,
                        maxMaxBufferLength: maxBufferLength * 2,
                        maxBufferSize: initialBoundedSize,
                        backBufferLength: 90,
                        lowLatencyMode: false,
                        manifestLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        manifestLoadingMaxRetry: 4,
                        manifestLoadingRetryDelay: 500,
                        levelLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        levelLoadingMaxRetry: 4,
                        levelLoadingRetryDelay: 500,
                        fragLoadingTimeOut: CONFIG.HLS_FRAGMENT_TRY_TIMEOUT || 10000,
                        fragLoadingMaxRetry: 6,
                        fragLoadingRetryDelay: 1000,
                        startFragPrefetch: true,
                        maxBufferHole: 0.8,
                        highBufferWatchdogPeriod: 2.0,
                        testBandwidth: false,
                        // 保守的初始带宽预估值 (1 Mbps)，防止起播阶段拉取超大分片导致起播慢
                        abrEwmaDefaultEstimate: 1000000,
                        // 加快 VoD 场景下带宽感知的灵敏度
                        abrEwmaFastVoD: 1.0,
                        abrEwmaSlowVoD: 5.0,
                        // ABR 码率保守系数，保障起播与切换稳定性
                        abrBandWidthFactor: 0.9,
                        xhrSetup: function (xhr: XMLHttpRequest) {
                            xhr.withCredentials = false;
                        },
                    });
                    hlsRef.current = hls;

                    hls.loadSource(url.trim());

                    // 辅助：两个事件都就绪后才设置 isLoading=false
                    const tryFinishLoading = () => {
                        if (manifestParsedRef.current && mediaAttachedRef.current) {
                            setIsLoading(false);
                        }
                    };

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        const availableLevels = hls.levels.map((l: { height: number }, idx: number) => ({
                            height: l.height,
                            index: idx
                        })).sort((a, b) => b.height - a.height);
                        setLevels(availableLevels);
                        manifestParsedRef.current = true;
                        tryFinishLoading();
                    });

                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        mediaAttachedRef.current = true;
                        tryFinishLoading();
                    });

                    hls.on(Hls.Events.LEVEL_SWITCHED, (_: unknown, data: { level: number }) => {
                        setActiveLevelIdx(data.level);
                    });

                    hls.attachMedia(video);

                    // v0.9.28: recoverMediaError() 内部 detach→attach 时会调用 media.load(),
                    // 按 HTML 规范 load() 会把视频置为暂停, 而 hls.js 不会自动 play() 续播。
                    // 因此恢复前若是播放中, 需要手动 resume, 否则恢复后视频会停在暂停态。
                    const recoverWithResume = (hlsInstance: InstanceType<typeof Hls>, media: HTMLVideoElement | null) => {
                        const wasPlaying = !!media && !media.paused;
                        hlsInstance.recoverMediaError();
                        if (wasPlaying && media) {
                            media.play().catch(() => { /* 自动播放策略拒绝/暂无数据时忽略, 由看门狗兜底 */ });
                        }
                    };

                    hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal: boolean; type: string }) => {
                        if (!data.fatal) return;
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                if (!errorNotifiedRef.current) {
                                    errorNotifiedRef.current = true;
                                    showToast?.('网络异常，正在重试连接…');
                                }
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                // v0.9.28: recoverMediaError() 内部会 detach→attach→media.load(),
                                // 按规范 media.load() 会把视频置为暂停, 而 hls.js 不会自动 play() 续播,
                                // 所以恢复前若是播放中, 需要手动 resume, 否则视频会停在暂停态
                                if (!errorNotifiedRef.current) {
                                    errorNotifiedRef.current = true;
                                    showToast?.('视频数据错误，正在尝试恢复…');
                                }
                                recoverWithResume(hls, video);
                                break;
                            default:
                                // v0.9.27: 其他致命错误 (如 INTERNAL_EXCEPTION) 不再直接 destroy 导致永久卡死,
                                // 改为完整重置 hls 实例, 由播放器卡顿看门狗兜底 (多次无效会自动换线)
                                logger.error('VideoPlayer', 'HLS fatal other error, attempting recovery', data);
                                if (!errorNotifiedRef.current) {
                                    errorNotifiedRef.current = true;
                                    showToast?.('播放源解析失败，请尝试切换线路');
                                }
                                try {
                                    recoverWithResume(hls, video);
                                } catch (e) {
                                    logger.error('VideoPlayer', 'HLS recovery failed, destroying', e);
                                    hls.destroy();
                                }
                                break;
                        }
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                    }, { once: true });
                }
            } catch (error: unknown) {
                logger.error('VideoPlayer', 'Failed to load Hls.js', error);
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                    }, { once: true });
                }
            }
        };

        initPlayer();

        // Visibility handling — tied to HLS lifecycle to avoid listener accumulation
        const handleVisibilityChange = () => {
            if (!hlsRef.current) return;

            if (document.visibilityState === 'visible') {
                hlsRef.current.startLoad();
            } else if (document.visibilityState === 'hidden') {
                // 如果视频处于暂停状态，切到后台时主动暂停分片下载，避免无效的后台网络消耗和请求超时积压
                if (videoRef.current?.paused) {
                    hlsRef.current.stopLoad();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [url, isEmbed]);

    // Update HLS buffer config dynamically
    useEffect(() => {
        if (!hlsRef.current || isEmbed) return;

        const hls = hlsRef.current;
        (hls.config as any).maxBufferLength = maxBufferLength;
        (hls.config as any).maxMaxBufferLength = maxBufferLength * 2;
        
        // Link maxBufferSize dynamically with maxBufferLength:
        // - Base minimum: 30MB (to ensure high-bitrate playback is smooth)
        // - Proportional scaling: 2MB per second of buffer length
        // - Safe upper ceiling: 100MB (to prevent out-of-memory crashes on mobile/low-end devices)
        const calculatedSize = maxBufferLength * 2 * 1024 * 1024;
        const boundedSize = Math.min(100 * 1024 * 1024, Math.max(30 * 1024 * 1024, calculatedSize));
        (hls.config as any).maxBufferSize = boundedSize;
    }, [maxBufferLength, isEmbed]);

    return {
        hlsRef,
        isLoading,
        levels,
        currentLevel,
        activeLevelIdx,
        isEmbed,
        maxBufferLength,
        hasSkippedIntroRef,
        hasPrefetchedNextRef,
    };
}
