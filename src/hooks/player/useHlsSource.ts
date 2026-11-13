import { useState, useRef, useEffect } from 'react';
import type Hls from 'hls.js';
import type { LoaderStats } from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';
import { isDirectPlayableUrl } from '@/lib/vodParser';
import { createPrefetchLoaders, injectPreconnect } from '@/lib/hls-prefetch';
import {
    getAdaptiveBufferTarget,
    getInitialBandwidthEstimate,
    getNetworkSnapshot,
    recordTransferSample,
    subscribeNetworkChange,
} from '@/lib/network-monitor';

// Cache the HLS constructor across URL changes to avoid re-importing
let cachedHlsConstructor: typeof Hls | null = null;
let hlsImportPromise: Promise<typeof Hls> | null = null;

export function preloadHlsConstructor(): Promise<typeof Hls> {
    if (cachedHlsConstructor) return Promise.resolve(cachedHlsConstructor);
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
    hasUserBufferOverride?: boolean;
    initialStartPosition?: number;
    skipIntroTimeRef: React.RefObject<number>;
    showToast?: (message: string) => void;
    onFirstFrame?: () => void;
    onStartupSlow?: () => void;
}

export function useHlsSource({
    url,
    videoRef,
    isEmbed,
    maxBufferLength,
    hasUserBufferOverride = false,
    initialStartPosition,
    skipIntroTimeRef,
    showToast,
    onFirstFrame,
    onStartupSlow,
}: UseHlsSourceProps) {
    const hlsRef = useRef<InstanceType<typeof Hls> | null>(null);
    const hasSkippedIntroRef = useRef(false);
    const hasPrefetchedNextRef = useRef(false);
    const hasStartedPlayingRef = useRef(false);
    const lastNetworkActivityRef = useRef<number>(Date.now());
    const activeFragStatsRef = useRef<LoaderStats | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    const [activeLevelIdx, setActiveLevelIdx] = useState(-1);

    // 追踪 MEDIA_ATTACHED 状态，确保 play() 在视频源挂载后才执行
    const manifestParsedRef = useRef(false);
    const mediaAttachedRef = useRef(false);
    // 每个 URL 只提示一次致命错误，避免重试循环刷屏
    const errorNotifiedRef = useRef(false);

    // 保持最新回调引用，避免因外部回调重建而重跑 HLS 初始化
    const onFirstFrameRef = useRef(onFirstFrame);
    onFirstFrameRef.current = onFirstFrame;
    const onStartupSlowRef = useRef(onStartupSlow);
    onStartupSlowRef.current = onStartupSlow;
    const maxBufferLengthRef = useRef(maxBufferLength);
    maxBufferLengthRef.current = maxBufferLength;
    const hasUserBufferOverrideRef = useRef(hasUserBufferOverride);
    hasUserBufferOverrideRef.current = hasUserBufferOverride;
    const initialStartPositionRef = useRef(initialStartPosition);
    initialStartPositionRef.current = initialStartPosition;

    // Reset flags on URL change
    useEffect(() => {
        hasPrefetchedNextRef.current = false;
        hasSkippedIntroRef.current = false;
        hasStartedPlayingRef.current = false;
        manifestParsedRef.current = false;
        mediaAttachedRef.current = false;
        errorNotifiedRef.current = false;
        activeFragStatsRef.current = null;
        lastNetworkActivityRef.current = Date.now();
    }, [url]);

    // HLS initialization
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setLevels([]);
        setCurrentLevel(-1);
        setActiveLevelIdx(-1);
        hasSkippedIntroRef.current = false;
        hasStartedPlayingRef.current = false;
        manifestParsedRef.current = false;
        mediaAttachedRef.current = false;
        activeFragStatsRef.current = null;
        lastNetworkActivityRef.current = Date.now();

        const video = videoRef.current;
        if (!video || isEmbed) return;

        const applyAdaptiveBufferConfig = (hls: InstanceType<typeof Hls>) => {
            const snapshot = getNetworkSnapshot();
            const basePref = maxBufferLengthRef.current;
            const target = hasUserBufferOverrideRef.current || !CONFIG.BUFFER_ADAPTIVE
                ? (snapshot.saveData ? Math.min(basePref, 10) : basePref)
                : getAdaptiveBufferTarget(
                    basePref,
                    hasStartedPlayingRef.current,
                    snapshot,
                    CONFIG.BUFFER_HIGH_BW
                );

            hls.config.maxBufferLength = target;
            hls.config.maxMaxBufferLength = Math.max(target * 2, 30);
            const calculatedSize = target * 2 * 1024 * 1024;
            hls.config.maxBufferSize = Math.min(100 * 1024 * 1024, Math.max(30 * 1024 * 1024, calculatedSize));
        };

        const handleVideoPlaying = () => {
            if (!hasStartedPlayingRef.current) {
                hasStartedPlayingRef.current = true;
                if (hlsRef.current) {
                    applyAdaptiveBufferConfig(hlsRef.current);
                }
                onFirstFrameRef.current?.();
            }
        };
        video.addEventListener('playing', handleVideoPlaying);

        const initPlayer = async () => {
            if (!url) return;
            const cleanUrl = url.trim();
            // 清理上一 URL 可能残留的原生 onerror，避免误报
            video.onerror = null;

            // 非直链（云播/解析页/无扩展名接口）不进入 HLS，给出明确提示而不是黑屏
            if (!isDirectPlayableUrl(cleanUrl)) {
                showToast?.('该播放地址不是直链（仅支持 m3u8/mp4/webm），请切换线路');
                setIsLoading(false);
                return;
            }

            injectPreconnect(cleanUrl);

            if (cleanUrl.includes('.mp4') || cleanUrl.includes('.webm')) {
                video.src = cleanUrl;
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

            try {
                const Hls = await preloadHlsConstructor();
                if (cancelled) return;

                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();

                    const snapshot = getNetworkSnapshot();
                    const initialTargetBuf = hasUserBufferOverrideRef.current || !CONFIG.BUFFER_ADAPTIVE
                        ? (snapshot.saveData ? Math.min(maxBufferLengthRef.current, 10) : maxBufferLengthRef.current)
                        : getAdaptiveBufferTarget(maxBufferLengthRef.current, false, snapshot, CONFIG.BUFFER_HIGH_BW);
                    const initialCalculatedSize = initialTargetBuf * 2 * 1024 * 1024;
                    const initialBoundedSize = Math.min(100 * 1024 * 1024, Math.max(30 * 1024 * 1024, initialCalculatedSize));

                    const { pLoader, fLoader } = createPrefetchLoaders();
                    const startPos = initialStartPositionRef.current;

                    const hls = new Hls({
                        capLevelToPlayerSize: true,
                        autoStartLoad: true,
                        startPosition: typeof startPos === 'number' && startPos > 5 ? startPos : -1,
                        startLevel: -1,
                        enableWorker: true,
                        pLoader,
                        fLoader,
                        // 使用 FetchLoader + credentials: 'omit' 保留渐进式分片流式写入 (progressive)
                        fetchSetup: (context, initParams) => new Request(context.url, {
                            ...initParams,
                            credentials: 'omit',
                        }),
                        maxBufferLength: initialTargetBuf,
                        maxMaxBufferLength: Math.max(initialTargetBuf * 2, 30),
                        maxBufferSize: initialBoundedSize,
                        backBufferLength: snapshot.tier === 'poor' ? 30 : 60,
                        lowLatencyMode: false,
                        // 分离 TTFB 与总下载时长：坏节点 5-6s TTFB 快速失败，慢速但持续传输的分片给足 45s 完整下载
                        manifestLoadPolicy: {
                            default: {
                                maxTimeToFirstByteMs: CONFIG.HLS_TIMEOUT || 5000,
                                maxLoadTimeMs: 12000,
                                timeoutRetry: { maxNumRetry: 3, retryDelayMs: 300, maxRetryDelayMs: 2000, backoff: 'exponential' },
                                errorRetry: { maxNumRetry: 3, retryDelayMs: 400, maxRetryDelayMs: 2500, backoff: 'exponential' },
                            },
                        },
                        playlistLoadPolicy: {
                            default: {
                                maxTimeToFirstByteMs: CONFIG.HLS_TIMEOUT || 5000,
                                maxLoadTimeMs: 12000,
                                timeoutRetry: { maxNumRetry: 3, retryDelayMs: 300, maxRetryDelayMs: 2000, backoff: 'exponential' },
                                errorRetry: { maxNumRetry: 4, retryDelayMs: 400, maxRetryDelayMs: 3000, backoff: 'exponential' },
                            },
                        },
                        fragLoadPolicy: {
                            default: {
                                maxTimeToFirstByteMs: CONFIG.HLS_TTFB_TIMEOUT || 6000,
                                maxLoadTimeMs: CONFIG.HLS_FRAG_MAX_LOAD_TIME || 45000,
                                timeoutRetry: { maxNumRetry: 4, retryDelayMs: 400, maxRetryDelayMs: 4000, backoff: 'exponential' },
                                errorRetry: { maxNumRetry: 6, retryDelayMs: 500, maxRetryDelayMs: 5000, backoff: 'exponential' },
                            },
                        },
                        keyLoadPolicy: {
                            default: {
                                maxTimeToFirstByteMs: CONFIG.HLS_TTFB_TIMEOUT || 6000,
                                maxLoadTimeMs: 12000,
                                timeoutRetry: { maxNumRetry: 3, retryDelayMs: 300, maxRetryDelayMs: 2000, backoff: 'linear' },
                                errorRetry: { maxNumRetry: 5, retryDelayMs: 400, maxRetryDelayMs: 3000, backoff: 'linear' },
                            },
                        },
                        startFragPrefetch: true,
                        progressive: true,
                        maxBufferHole: 0.5,
                        nudgeOffset: 0.15,
                        nudgeMaxRetry: 5,
                        nudgeOnVideoHole: true,
                        highBufferWatchdogPeriod: 2.0,
                        testBandwidth: false,
                        // 基于历史实测与网络接口的初始带宽估计，防范首片过重导致的起播慢
                        abrEwmaDefaultEstimate: getInitialBandwidthEstimate(),
                        abrEwmaFastVoD: 1.5,
                        abrEwmaSlowVoD: 4.0,
                        abrBandWidthFactor: 0.72,
                        abrBandWidthUpFactor: 0.55,
                        abrMaxWithRealBitrate: true,
                        maxStarvationDelay: 2,
                        maxLoadingDelay: 3,
                        appendErrorMaxRetry: 4,
                        xhrSetup: function (xhr: XMLHttpRequest) {
                            xhr.withCredentials = false;
                        },
                    });
                    hlsRef.current = hls;

                    hls.loadSource(cleanUrl);

                    // 辅助：两个事件都就绪后才设置 isLoading=false
                    const tryFinishLoading = () => {
                        if (manifestParsedRef.current && mediaAttachedRef.current) {
                            setIsLoading(false);
                        }
                    };

                    hls.on(Hls.Events.MANIFEST_LOADED, () => {
                        lastNetworkActivityRef.current = Date.now();
                    });

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        lastNetworkActivityRef.current = Date.now();
                        const availableLevels = hls.levels.map((l: { height: number }, idx: number) => ({
                            height: l.height,
                            index: idx
                        })).sort((a, b) => b.height - a.height);
                        setLevels(availableLevels);
                        manifestParsedRef.current = true;
                        tryFinishLoading();
                    });

                    hls.on(Hls.Events.LEVEL_LOADED, () => {
                        lastNetworkActivityRef.current = Date.now();
                    });

                    hls.on(Hls.Events.KEY_LOADED, () => {
                        lastNetworkActivityRef.current = Date.now();
                    });

                    hls.on(Hls.Events.FRAG_LOADING, (_: unknown, data) => {
                        lastNetworkActivityRef.current = Date.now();
                        activeFragStatsRef.current = data.frag.loader?.stats || data.frag.stats || null;
                    });

                    hls.on(Hls.Events.FRAG_LOADED, (_: unknown, data) => {
                        lastNetworkActivityRef.current = Date.now();
                        const stats = data.frag.stats;
                        if (stats && stats.loaded > 0 && stats.loading.end > stats.loading.start) {
                            const durationMs = stats.loading.end - stats.loading.start;
                            const ttfbMs = stats.loading.first > stats.loading.start
                                ? stats.loading.first - stats.loading.start
                                : undefined;
                            recordTransferSample(data.frag.url || cleanUrl, stats.loaded, durationMs, ttfbMs);
                        }
                        if (hasStartedPlayingRef.current) {
                            applyAdaptiveBufferConfig(hls);
                        }
                    });

                    hls.on(Hls.Events.FRAG_BUFFERED, () => {
                        lastNetworkActivityRef.current = Date.now();
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

                    hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal: boolean; type: string; details?: string }) => {
                        if (!data.fatal) return;
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                                    onStartupSlowRef.current?.();
                                }
                                if (!errorNotifiedRef.current) {
                                    errorNotifiedRef.current = true;
                                    showToast?.('网络异常，正在重试连接…');
                                }
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
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
                    video.src = cleanUrl;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                    }, { once: true });
                }
            } catch (error: unknown) {
                logger.error('VideoPlayer', 'Failed to load Hls.js', error);
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = cleanUrl;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                    }, { once: true });
                }
            }
        };

        initPlayer();

        // 实时监听网络状态波动 (如 WiFi 切 4G 或信号变差): 动态扩容缓冲并降级自动码率上限
        const unsubscribeNet = subscribeNetworkChange(() => {
            const hls = hlsRef.current;
            if (!hls) return;
            applyAdaptiveBufferConfig(hls);
            const snap = getNetworkSnapshot();
            if (snap.tier === 'poor' && hls.currentLevel === -1 && hls.levels.length > 1) {
                hls.nextAutoLevel = Math.max(0, Math.min(hls.nextAutoLevel, 0));
            }
        });

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
            cancelled = true;
            unsubscribeNet();
            video.removeEventListener('playing', handleVideoPlaying);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [url, isEmbed]);

    // Update HLS buffer config dynamically when user changes buffer setting
    useEffect(() => {
        if (!hlsRef.current || isEmbed) return;

        const hls = hlsRef.current;
        const snapshot = getNetworkSnapshot();
        const effectiveTarget = hasUserBufferOverride || !CONFIG.BUFFER_ADAPTIVE
            ? (snapshot.saveData ? Math.min(maxBufferLength, 10) : maxBufferLength)
            : getAdaptiveBufferTarget(maxBufferLength, hasStartedPlayingRef.current, snapshot, CONFIG.BUFFER_HIGH_BW);

        hls.config.maxBufferLength = effectiveTarget;
        hls.config.maxMaxBufferLength = Math.max(effectiveTarget * 2, 30);

        const calculatedSize = effectiveTarget * 2 * 1024 * 1024;
        const boundedSize = Math.min(100 * 1024 * 1024, Math.max(30 * 1024 * 1024, calculatedSize));
        hls.config.maxBufferSize = boundedSize;
    }, [maxBufferLength, hasUserBufferOverride, isEmbed]);

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
        hasStartedPlayingRef,
        lastNetworkActivityRef,
        activeFragStatsRef,
    };
}
