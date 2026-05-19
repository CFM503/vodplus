import { useState, useRef, useEffect } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

interface UseHlsSourceProps {
    url: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isEmbed: boolean;
    maxBufferLength: number;
}

export function useHlsSource({ url, videoRef, isEmbed, maxBufferLength }: UseHlsSourceProps) {
    const hlsRef = useRef<InstanceType<typeof Hls> | null>(null);
    const hasSkippedIntroRef = useRef(false);
    const hasPrefetchedNextRef = useRef(false);
    const skipIntroTimeRef = useRef(0);

    const [isLoading, setIsLoading] = useState(true);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    const [activeLevelIdx, setActiveLevelIdx] = useState(-1);

    // 追踪 MEDIA_ATTACHED 状态，确保 play() 在视频源挂载后才执行
    const manifestParsedRef = useRef(false);
    const mediaAttachedRef = useRef(false);

    // Reset flags on URL change
    useEffect(() => {
        hasPrefetchedNextRef.current = false;
        hasSkippedIntroRef.current = false;
        manifestParsedRef.current = false;
        mediaAttachedRef.current = false;
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

        // Load skip intro time from session storage
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('VOD_SESSION_SKIP_INTRO');
            if (saved) {
                skipIntroTimeRef.current = parseInt(saved, 10);
            }
        }

        const video = videoRef.current;
        if (!video || isEmbed) return;

        const initPlayer = async () => {
            if (!url) return;
            if (url.includes('.mp4') || url.includes('.webm')) {
                video.src = url;
                setIsLoading(false);
                return;
            }

            try {
                const { default: Hls } = await import('hls.js');

                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();

                    const hls = new Hls({
                        capLevelToPlayerSize: true,
                        autoStartLoad: true,
                        startLevel: -1,
                        enableWorker: true,
                        maxBufferLength: CONFIG.BUFFER_ADAPTIVE ? Math.min(maxBufferLength, CONFIG.BUFFER_HIGH_BW) : maxBufferLength,
                        maxMaxBufferLength: maxBufferLength * 2,
                        backBufferLength: 90,
                        lowLatencyMode: false,
                        manifestLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        manifestLoadingMaxRetry: 4,
                        levelLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        levelLoadingMaxRetry: 4,
                        fragLoadingTimeOut: CONFIG.HLS_FRAGMENT_TRY_TIMEOUT || 20000,
                        fragLoadingMaxRetry: 6,
                        testBandwidth: false,
                        abrEwmaFastLive: 3.0,
                        abrEwmaSlowLive: 10.0,
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

                    hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal: boolean; type: string }) => {
                        if (!data.fatal) return;
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
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
            if (document.visibilityState === 'visible' && hlsRef.current) {
                hlsRef.current.startLoad();
                if (videoRef.current && !videoRef.current.paused) {
                    hlsRef.current.recoverMediaError();
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
    }, [maxBufferLength, isEmbed]);

    return {
        hlsRef,
        isLoading,
        levels,
        currentLevel,
        activeLevelIdx,
        isEmbed,
        maxBufferLength,
        skipIntroTimeRef,
        hasSkippedIntroRef,
        hasPrefetchedNextRef,
    };
}
