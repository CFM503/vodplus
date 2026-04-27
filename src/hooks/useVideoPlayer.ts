import { useState, useRef, useEffect, useCallback } from 'react';
import { CONFIG } from '@/config/config';
import { formatTime } from '@/lib/player-utils';
import { useHlsSource } from '@/hooks/player/useHlsSource';
import { useVideoEvents } from '@/hooks/player/useVideoEvents';
import { useVideoSeek } from '@/hooks/player/useVideoSeek';
import { useVideoGestures } from '@/hooks/player/useVideoGestures';
import { useVideoKeyboard } from '@/hooks/player/useVideoKeyboard';
import { useVideoSettings } from '@/hooks/player/useVideoSettings';
import { useVideoControls } from '@/hooks/player/useVideoControls';
import { usePlaybackHealth } from '@/hooks/player/usePlaybackHealth';

interface VideoPlayerProps {
    url: string;
    onEnded?: () => void;
    autoplay?: boolean;
    nextEpisodeUrl?: string;
}

interface GestureHUDState {
    icon: 'volume' | 'brightness' | 'seek';
    value: string;
    visible: boolean;
}

interface ToastState {
    message: string;
    visible: boolean;
}

export function useVideoPlayer({ url, onEnded, autoplay = false, nextEpisodeUrl }: VideoPlayerProps) {
    // ===========================
    // Shared Refs
    // ===========================
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const lastSeekEndTimeRef = useRef(0);

    // ===========================
    // Cross-cutting State (owned by orchestrator, used by multiple hooks)
    // ===========================
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [maxBufferLength, setMaxBufferLength] = useState(CONFIG.DEFAULT_BUFFER_LENGTH);
    const [videoScale, setVideoScale] = useState(1);
    const [isSpeedHolding, setIsSpeedHolding] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [gestureHUD, setGestureHUD] = useState<GestureHUDState>({
        icon: 'seek', value: '', visible: false,
    });
    const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

    const isEmbed = url ? (!url.includes('.m3u8') && !url.includes('.mp4') && !url.includes('.webm') && url.startsWith('http')) : false;

    // ===========================
    // Cross-cutting callbacks (defined before sub-hooks)
    // ===========================
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
    const showToast = useCallback((message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, visible: true });
        toastTimerRef.current = setTimeout(() => {
            setToast({ message: '', visible: false });
        }, CONFIG.TOAST_DISPLAY_TIME);
    }, []);

    const showGestureHUD = useCallback((icon: 'volume' | 'brightness' | 'seek', value: string) => {
        setGestureHUD({ icon, value, visible: true });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, []);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(muted => !muted);
    }, []);

    const handleVolumeChange = useCallback((newVolume: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = newVolume;
        setVolume(newVolume);
        if (newVolume > 0 && video.muted) {
            video.muted = false;
        }
        setIsMuted(newVolume === 0);
    }, []);

    const handleSeekRelative = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }, []);

    const handleSpeedHoldStart = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = CONFIG.LONG_PRESS_SPEED;
        setIsSpeedHolding(true);
        setGestureHUD({ icon: 'seek', value: `${CONFIG.LONG_PRESS_SPEED}x`, visible: true });
    }, []);

    const handleSpeedHoldEnd = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = playbackRate;
        setIsSpeedHolding(false);
        setGestureHUD(prev => ({ ...prev, visible: false }));
    }, [playbackRate]);

    // ===========================
    // Sub-hooks (called in dependency order)
    // ===========================

    // 1. HLS Source
    const hlsSource = useHlsSource({ url, videoRef, isEmbed, maxBufferLength });

    // 2. Settings
    const settings = useVideoSettings({
        hlsRef: hlsSource.hlsRef,
        isEmbed,
        skipIntroTimeRef: hlsSource.skipIntroTimeRef,
        videoRef,
        playbackRate,
        setPlaybackRate,
        videoScale,
        setVideoScale,
        showToast,
        maxBufferLength,
        setMaxBufferLength,
    });

    // 2.5 Playback Health (stall detection + auto-skip)
    const { resetSkipCount: resetStallSkipCount } = usePlaybackHealth({
        videoRef,
        hlsRef: hlsSource.hlsRef,
        showToast,
    });

    // Reset skip count when URL changes (new video source)
    useEffect(() => {
        resetStallSkipCount();
    }, [url, resetStallSkipCount]);

    // 3. Video Events
    const events = useVideoEvents({
        videoRef,
        onEnded,
        autoplay,
        nextEpisodeUrl,
        playbackRate,
        volume,
        isMuted,
        isLoading: hlsSource.isLoading,
        hasPrefetchedNextRef: hlsSource.hasPrefetchedNextRef,
    });

    // 4. Gestures
    const gestures = useVideoGestures({
        videoRef,
        containerRef,
        volume,
        playbackRate,
        isEmbed,
        handleVolumeChange,
        handleSpeedHoldStart,
        handleSpeedHoldEnd,
        isSpeedHolding,
    });

    // 5. Seek (uses isHovering from controls via ref to break cycle)
    const isHoveringRef = useRef(false);
    const seek = useVideoSeek({
        videoRef,
        progressBarRef,
        hlsRef: hlsSource.hlsRef,
        isHoveringRef,
        setProgress: events.setProgress,
    });

    // Toggle play (defined after events since it needs events.setIsPlaying)
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(error => {
                if (error instanceof Error && error.name !== 'AbortError') { /* ignore */ }
            });
            events.setIsPlaying(true);
        } else {
            video.pause();
            events.setIsPlaying(false);
        }
    }, []);

    // 6. Controls
    const controls = useVideoControls({
        containerRef,
        videoRef,
        isPlaying: events.isPlaying,
        isDragging: seek.isDragging,
        showSettings: settings.showSettings,
        togglePlay,
        handleSeekRelative,
        showGestureHUD,
        setShowSettings: settings.setShowSettings,
        lastSeekEndTimeRef,
    });

    // Sync isHovering to ref for Seek hook
    useEffect(() => {
        isHoveringRef.current = controls.isHovering;
    }, [controls.isHovering]);

    // 7. Keyboard
    useVideoKeyboard({
        videoRef,
        togglePlay,
        handleSeekRelative,
        handleVolumeChange,
        toggleFullscreen: controls.toggleFullscreen,
        toggleMute,
        volume,
    });

    // Skip intro effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video || hlsSource.isLoading || hlsSource.hasSkippedIntroRef.current) return;

        const target = hlsSource.skipIntroTimeRef.current;
        if (target <= 0) {
            hlsSource.hasSkippedIntroRef.current = true;
            return;
        }

        const doSkip = () => {
            if (hlsSource.hasSkippedIntroRef.current) return;
            hlsSource.hasSkippedIntroRef.current = true;
            video.currentTime = target;
            showToast(`已为您跳过片头 ${target}s`);
        };

        if (video.readyState >= 1) {
            doSkip();
        } else {
            const onLoadedMetadata = () => {
                doSkip();
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
        }
    }, [hlsSource.isLoading, showToast]);

    // Wiring: touch end → video click on tap
    const handleTouchEndWired = useCallback((e: React.TouchEvent) => {
        const wasTap = gestures.handleTouchEnd(e);
        if (wasTap) {
            if (e.cancelable) e.preventDefault();
            controls.handleVideoClick(e);
        }
        if (!wasTap) {
            controls.setIsHovering(true);
        }
    }, [gestures.handleTouchEnd, controls.handleVideoClick, controls.setIsHovering]);

    // Wiring: mouse move → show controls
    const handleMouseMoveWired = useCallback((e: React.MouseEvent) => {
        gestures.handleMouseMove(e);
        controls.setIsHovering(true);
    }, [gestures.handleMouseMove, controls.setIsHovering]);

    // Wiring: buffer change → orchestrator maxBufferLength
    const handleBufferChangeWired = useCallback((buf: number) => {
        setMaxBufferLength(buf);
        settings.handleBufferChange(buf);
    }, [settings.handleBufferChange]);

    // ===========================
    // Return merged API
    // ===========================
    return {
        videoRef,
        containerRef,
        progressBarRef,
        hlsRef: hlsSource.hlsRef,

        isPlaying: events.isPlaying,
        isMuted,
        volume,
        progress: events.progress,
        duration: events.duration,
        buffered: events.buffered,
        isHovering: controls.isHovering,
        isLoading: hlsSource.isLoading,
        isBuffering: events.isBuffering,
        showSettings: settings.showSettings,
        playbackRate,
        videoScale,
        isLocked: settings.isLocked,
        isWebFullscreen: controls.isWebFullscreen,
        isDragging: seek.isDragging,
        dragProgress: seek.dragProgress,
        brightness,
        gestureHUD,
        toast,
        levels: hlsSource.levels,
        skipIntroTime: hlsSource.skipIntroTimeRef,
        handleSkipIntroChange: settings.handleSkipIntroChange,
        currentLevel: hlsSource.currentLevel,
        activeLevelIdx: hlsSource.activeLevelIdx,
        maxBufferLength,
        isEmbed,

        setIsHovering: controls.setIsHovering,
        setShowSettings: settings.setShowSettings,

        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleSeekStart: seek.handleSeekStart,
        handleSeekMove: seek.handleSeekMove,
        handleSeekEnd: seek.handleSeekEnd,
        handleProgressClick: seek.handleProgressClick,
        toggleFullscreen: controls.toggleFullscreen,
        toggleWebFullscreen: controls.toggleWebFullscreen,
        handleResolutionChange: settings.handleResolutionChange,
        handleRateChange: settings.handleRateChange,
        handleSpeedHoldStart,
        handleSpeedHoldEnd,
        isSpeedHolding,
        handleScaleChange: settings.handleScaleChange,
        handleBufferChange: handleBufferChangeWired,
        handleLock: settings.handleLock,
        handleUnlock: settings.handleUnlock,
        handleMouseMove: handleMouseMoveWired,
        handleVideoClick: controls.handleVideoClick,
        handleTouchStart: gestures.handleTouchStart,
        handleTouchMove: gestures.handleTouchMove,
        handleTouchEnd: handleTouchEndWired,
        formatTime,
    };
}
