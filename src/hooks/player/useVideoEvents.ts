import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { getProgressKey } from '@/lib/player-utils';

interface UseVideoEventsProps {
    url: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onEnded?: () => void;
    autoplay: boolean;
    nextEpisodeUrl?: string;
    playbackRate: number;
    volume: number;
    isMuted: boolean;
    setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
    isLoading: boolean;
    hasPrefetchedNextRef: React.RefObject<boolean>;
    onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void;
    // v0.9.27: 用户手动暂停标记 (自动续播/重试时尊重用户暂停意图)
    userPausedRef?: React.MutableRefObject<boolean>;
    // v0.9.x: 长按加速中标记 (加速中不要被同步 effect 覆盖回原倍速)
    isSpeedHolding?: boolean;
}

export function useVideoEvents({
    url, videoRef, onEnded, autoplay, nextEpisodeUrl,
    playbackRate, volume, isMuted, setIsMuted, isLoading, hasPrefetchedNextRef,
    onTimeUpdate, userPausedRef, isSpeedHolding = false
}: UseVideoEventsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [progress, setProgressState] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    const lastSavedTimeRef = useRef(0);

    // Reset lastSavedTimeRef on url change
    useEffect(() => {
        lastSavedTimeRef.current = 0;
    }, [url]);

    // Stable ref for nextEpisodeUrl to avoid stale closure in event listeners
    const nextEpisodeUrlRef = useRef(nextEpisodeUrl);

    useEffect(() => {
        nextEpisodeUrlRef.current = nextEpisodeUrl;
    }, [nextEpisodeUrl]);

    // Autoplay with muted fallback
    const autoplayRef = useRef(autoplay);
    autoplayRef.current = autoplay;

    useEffect(() => {
        const video = videoRef.current;
        if (!autoplay || !video || isLoading) return;

        // v0.9.27: autoplay 意图真正生效时清除用户暂停标记。
        // 手动选择新剧集/新线路 = 隐含播放意图 (pendingAutoplay=true);
        // 暂停后换源会走 pendingAutoplay=false, autoplay 为 false, 不会进入这里。
        if (userPausedRef) userPausedRef.current = false;

        const attemptPlay = () => {
            if (!video || video.paused === false) return;
            // v0.9.27: 用户手动暂停后不再自动续播
            if (userPausedRef?.current) return;
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    if (error.name === 'AbortError') return;
                    if (video) {
                        video.muted = true;
                        setIsMuted(true);
                        const mutedPromise = video.play();
                        if (mutedPromise !== undefined) {
                            mutedPromise.catch(e => {
                                if (e instanceof Error && e.name !== 'AbortError') { /* ignore */ }
                            });
                        }
                    }
                });
            }
        };

        // 首次尝试播放
        attemptPlay();

        // 安全网：canplay 时如果视频仍然暂停，重试播放
        // 处理 HLS 生命周期竞态（MEDIA_ATTACHED 晚于 MANIFEST_PARSED）
        const onCanPlay = () => {
            // v0.9.27: 用户手动暂停后不再被 canplay 兜底抢播
            if (autoplayRef.current && !userPausedRef?.current && video.paused) {
                attemptPlay();
            }
        };
        video.addEventListener('canplay', onCanPlay, { once: true });

        return () => {
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [autoplay, isLoading]);

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateBuffered = () => {
            if (video.duration) {
                let currentBufferedEnd = 0;
                for (let i = 0; i < video.buffered.length; i++) {
                    if (video.buffered.start(i) <= video.currentTime + 0.5 && video.buffered.end(i) >= video.currentTime) {
                        currentBufferedEnd = video.buffered.end(i);
                        break;
                    }
                }
                setBuffered((currentBufferedEnd / video.duration) * 100);
            }
        };

        // Throttle progress updates with rAF to avoid ~4 re-renders/sec from timeupdate
        let progressRafId: number | null = null;
        const updateProgress = () => {
            if (progressRafId !== null) return; // already scheduled
            progressRafId = requestAnimationFrame(() => {
                progressRafId = null;
                if (!video.duration) return;

                const currentProgressPercent = (video.currentTime / video.duration) * 100;
                setProgressState(currentProgressPercent);
                updateBuffered();

                if (onTimeUpdateRef.current) {
                    onTimeUpdateRef.current(video.currentTime, video.duration, !video.paused);
                }

                // 自动保存播放进度（仅在大于 5s 且距离结束大于 5s 时记录，每 3 秒最多写入一次磁盘，防范 micro-jank）
                if (video.currentTime > 5 && video.currentTime < video.duration - 5) {
                    if (Math.abs(video.currentTime - lastSavedTimeRef.current) >= 3) {
                        lastSavedTimeRef.current = video.currentTime;
                        const key = getProgressKey(url);
                        localStorage.setItem(key, video.currentTime.toString());
                    }
                }

                // Next Episode preload at 60% progress
                const nextUrl = nextEpisodeUrlRef.current;
                if (nextUrl && !hasPrefetchedNextRef.current && currentProgressPercent > 60) {
                    hasPrefetchedNextRef.current = true;
                    fetch(nextUrl, { mode: 'no-cors', priority: 'low' }).catch(() => { /* ignore */ });

                    if ('connection' in navigator) {
                        const conn = (navigator as { connection?: { effectiveType?: string } }).connection;
                        if (!conn || conn.effectiveType === '4g' || conn.effectiveType === '3g') {
                            const link = document.createElement('link');
                            link.rel = 'prefetch';
                            link.href = nextUrl;
                            link.as = 'fetch';
                            link.crossOrigin = 'anonymous';
                            document.head.appendChild(link);
                        }
                    }
                }
            });
        };

        const updateDuration = () => setDuration(video.duration);
        const handleWaiting = () => setIsBuffering(true);
        const handlePlaying = () => {
            setIsBuffering(false);
            setIsPlaying(true);
            // v0.9.27: 同步真实播放状态到外部 (换源时 pendingAutoplay 依赖它, 防止暂停后换源被自动续播)
            if (onTimeUpdateRef.current) onTimeUpdateRef.current(video.currentTime, video.duration, true);
        };
        const handlePause = () => {
            setIsPlaying(false);
            if (onTimeUpdateRef.current) onTimeUpdateRef.current(video.currentTime, video.duration, false);
        };
        const handleSeeking = () => setIsBuffering(true);
        const handleSeeked = () => {
            setIsBuffering(false);
            if (!video.paused) setIsPlaying(true);
            // v0.9.28: seek 后同步真实播放状态到外部 (换源时 pendingAutoplay 依赖它,
            // 覆盖看门狗跳过 seek 后立刻换源的状态陈旧窗口)
            if (onTimeUpdateRef.current) onTimeUpdateRef.current(video.currentTime, video.duration, !video.paused);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            if (onTimeUpdateRef.current) onTimeUpdateRef.current(video.currentTime, video.duration, false);
            // 播放结束，自动清除进度缓存 (localStorage)
            const key = getProgressKey(url);
            localStorage.removeItem(key);
            if (onEnded) onEnded();
        };

        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('progress', updateBuffered);
        video.addEventListener('loadedmetadata', updateDuration);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);
        video.addEventListener('play', handlePlaying);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('ended', handleEnded);

        return () => {
            if (progressRafId !== null) cancelAnimationFrame(progressRafId);
            video.removeEventListener('timeupdate', updateProgress);
            video.removeEventListener('progress', updateBuffered);
            video.removeEventListener('loadedmetadata', updateDuration);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('play', handlePlaying);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('ended', handleEnded);
        };
    }, [url, onEnded]);

    // Optimistic progress setter (for seek operations to provide instant feedback)
    const setProgress = useCallback((pct: number) => {
        setProgressState(pct);
    }, []);

    // Initial sync when video element is ready (before first paint)
    useLayoutEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        
        const applyInit = () => {
            video.volume = volume;
            video.muted = isMuted;
        };
        
        if (video.readyState >= 1) {
            applyInit();
        } else {
            video.addEventListener('loadedmetadata', applyInit, { once: true });
        }
        
        return () => {
            video.removeEventListener('loadedmetadata', applyInit);
        };
    }, []);

    // Sync playback rate, volume, mute to video element
    useEffect(() => {
        if (videoRef.current && !isLoading) {
            // 长按加速期间由 useVideoGestures 直接设置 video.playbackRate，
            // 不要用 state 中的 playbackRate 覆盖，避免 3x 被拉回 1x。
            if (!isSpeedHolding) {
                videoRef.current.playbackRate = playbackRate;
            }
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [playbackRate, volume, isMuted, isLoading, isSpeedHolding]);

    return {
        isPlaying,
        isBuffering,
        progress,
        duration,
        buffered,
        setIsPlaying,
        setProgress,
    };
}
