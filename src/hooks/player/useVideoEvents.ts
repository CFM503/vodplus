import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';

interface UseVideoEventsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onEnded?: () => void;
    autoplay: boolean;
    nextEpisodeUrl?: string;
    playbackRate: number;
    volume: number;
    isMuted: boolean;
    isLoading: boolean;
    hasPrefetchedNextRef: React.RefObject<boolean>;
}

export function useVideoEvents({
    videoRef, onEnded, autoplay, nextEpisodeUrl,
    playbackRate, volume, isMuted, isLoading, hasPrefetchedNextRef,
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
    useEffect(() => {
        if (autoplay && videoRef.current && !isLoading) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    if (error.name === 'AbortError') return;
                    if (videoRef.current) {
                        videoRef.current.muted = true;
                        const mutedPromise = videoRef.current.play();
                        if (mutedPromise !== undefined) {
                            mutedPromise.catch(e => {
                                if (e instanceof Error && e.name !== 'AbortError') { /* ignore */ }
                            });
                        }
                    }
                });
            }
        }
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

        const updateProgress = () => {
            if (video.duration) {
                const currentProgressPercent = (video.currentTime / video.duration) * 100;
                setProgressState(currentProgressPercent);
                updateBuffered();

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
            }
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
    }, [onEnded]);

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

    // Sync volume and muted to video element when loading completes
    useEffect(() => {
        if (!isLoading && videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [isLoading, volume, isMuted]);

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
