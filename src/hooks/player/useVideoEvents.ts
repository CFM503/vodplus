import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';

// 清洗并获取进度的唯一缓存 Key，去除动态签名等 Query 参数
const getProgressKey = (videoUrl: string) => {
    try {
        const parsed = new URL(videoUrl);
        return `VOD_PROGRESS_${parsed.origin}${parsed.pathname}`;
    } catch (e) {
        return `VOD_PROGRESS_${videoUrl}`;
    }
};

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
}

export function useVideoEvents({
    url, videoRef, onEnded, autoplay, nextEpisodeUrl,
    playbackRate, volume, isMuted, setIsMuted, isLoading, hasPrefetchedNextRef,
}: UseVideoEventsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [progress, setProgressState] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);

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

        const attemptPlay = () => {
            if (!video || video.paused === false) return;
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
            if (autoplayRef.current && video.paused) {
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

                // 自动保存播放进度（仅在大于 5s 且距离结束大于 5s 时记录，避免记录片头片尾的无效位置）到 localStorage
                if (video.currentTime > 5 && video.currentTime < video.duration - 5) {
                    const key = getProgressKey(url);
                    localStorage.setItem(key, video.currentTime.toString());
                }

                // Next Episode preload at 60% progress
                const nextUrl = nextEpisodeUrlRef.current;
                if (nextUrl && !hasPrefetchedNextRef.current && currentProgressPercent > 60) {
                    hasPrefetchedNextRef.current = true;
                    fetch(nextUrl, { mode: 'cors' }).catch(() => { /* ignore */ });

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
        };
        const handlePause = () => setIsPlaying(false);
        const handleSeeking = () => setIsBuffering(true);
        const handleSeeked = () => {
            setIsBuffering(false);
            if (!video.paused) setIsPlaying(true);
        };
        const handleEnded = () => {
            setIsPlaying(false);
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
            videoRef.current.playbackRate = playbackRate;
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [playbackRate, volume, isMuted, isLoading]);

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
