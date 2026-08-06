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
    initialSeekTime?: number;
    onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void;
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

export function useVideoPlayer({ url, onEnded, autoplay = false, nextEpisodeUrl, initialSeekTime, onTimeUpdate }: VideoPlayerProps) {
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
    const [playbackRate, setPlaybackRate] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("VOD_PLAYBACK_RATE");
            if (saved) return parseFloat(saved);
        }
        return 1;
    });
    const [maxBufferLength, setMaxBufferLength] = useState(() => {
        if (typeof window !== "undefined") {
            // 1. 优先检测当前网络状况是否为弱网或省流，以实施积极的主动降级（防止旧的历史大缓冲区撑爆弱网信道）
            if ('connection' in navigator) {
                const conn = (navigator as any).connection;
                if (conn) {
                    if (conn.effectiveType === '2g' || conn.effectiveType === '3g') {
                        return 8; // 弱网强制使用 8s 短缓冲，防止切片下载队列积压
                    }
                    if (conn.saveData) {
                        return 10; // 省流模式强制使用 10s 短缓冲
                    }
                }
            }

            // 2. 只有在网速良好时，才应用 localStorage 保存的历史大缓冲设置
            const saved = localStorage.getItem("VOD_MAX_BUFFER_LENGTH");
            if (saved) return parseInt(saved, 10);
        }
        return CONFIG.DEFAULT_BUFFER_LENGTH || 15;
    });
    const [videoScale, setVideoScale] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("VOD_VIDEO_SCALE");
            if (saved) return parseFloat(saved);
        }
        return 1;
    });
    const [skipIntroTime, setSkipIntroTime] = useState(() => {
        if (typeof window !== "undefined") {
            // 支持从旧版本的 VOD_SESSION_SKIP_INTRO 升级迁移
            const saved = localStorage.getItem("VOD_SKIP_INTRO") || sessionStorage.getItem("VOD_SESSION_SKIP_INTRO");
            if (saved) return parseInt(saved, 10);
        }
        return 0;
    });
    const [isSpeedHolding, setIsSpeedHolding] = useState(false);
    const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

    const isEmbed = url ? (!url.includes('.m3u8') && !url.includes('.mp4') && !url.includes('.webm') && url.startsWith('http')) : false;

    // Ref mirror of skipIntroTime for useHlsSource (which needs a ref for its effect closures)
    const skipIntroTimeRef = useRef(skipIntroTime);
    skipIntroTimeRef.current = skipIntroTime;

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
        if (!video || !video.duration) return;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }, []);

    const handleSpeedHoldStart = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = CONFIG.LONG_PRESS_SPEED;
        setIsSpeedHolding(true);
    }, []);

    const handleSpeedHoldEnd = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = playbackRate;
        setIsSpeedHolding(false);
    }, [playbackRate]);

    // ===========================
    // Sub-hooks (called in dependency order)
    // ===========================

    // 1. HLS Source
    const hlsSource = useHlsSource({ url, videoRef, isEmbed, maxBufferLength, skipIntroTimeRef });

    // 2. Settings
    const settings = useVideoSettings({
        hlsRef: hlsSource.hlsRef,
        isEmbed,
        skipIntroTime,
        setSkipIntroTime,
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
        url,
        videoRef,
        onEnded,
        autoplay,
        nextEpisodeUrl,
        playbackRate,
        volume,
        isMuted,
        setIsMuted,
        isLoading: hlsSource.isLoading,
        hasPrefetchedNextRef: hlsSource.hasPrefetchedNextRef,
        onTimeUpdate,
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
    const setIsPlaying = events.setIsPlaying;
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(error => {
                if (error instanceof Error && error.name !== 'AbortError') { /* ignore */ }
            });
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, [setIsPlaying]);

    // 6. Controls
    const controls = useVideoControls({
        containerRef,
        isPlaying: events.isPlaying,
        isDragging: seek.isDragging,
        showSettings: settings.showSettings,
        togglePlay,
        handleSeekRelative,
        showGestureHUD: gestures.showGestureHUD,
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

    // Persist player settings to localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("VOD_VIDEO_SCALE", videoScale.toString());
        }
    }, [videoScale]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("VOD_SKIP_INTRO", skipIntroTime.toString());
        }
    }, [skipIntroTime]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("VOD_PLAYBACK_RATE", playbackRate.toString());
        }
    }, [playbackRate]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("VOD_MAX_BUFFER_LENGTH", maxBufferLength.toString());
        }
    }, [maxBufferLength]);

    // Progress recovery and Skip intro effect
    const hasRestoredProgressRef = useRef(false);
    useEffect(() => {
        hasRestoredProgressRef.current = false;
    }, [url]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || hlsSource.isLoading || hasRestoredProgressRef.current) return;

        const getProgressKey = (videoUrl: string) => {
            try {
                const parsed = new URL(videoUrl);
                return `VOD_PROGRESS_${parsed.origin}${parsed.pathname}`;
            } catch (e) {
                return `VOD_PROGRESS_${videoUrl}`;
            }
        };

        const doRestore = () => {
            if (hasRestoredProgressRef.current) return;
            hasRestoredProgressRef.current = true;

            // 1. 切源记忆进度最高优先级
            if (initialSeekTime && initialSeekTime > 5) {
                const maxSeek = video.duration ? Math.max(0, video.duration - 1) : initialSeekTime;
                const targetTime = Math.min(initialSeekTime, maxSeek);
                if (targetTime > 0) {
                    video.currentTime = targetTime;
                    showToast(`已为您恢复切源播放进度：${formatTime(targetTime)}`);
                    hlsSource.hasSkippedIntroRef.current = true;
                    return;
                }
            }

            // 2. 本地历史进度恢复
            const key = getProgressKey(url);
            const savedTimeStr = localStorage.getItem(key);
            const savedTime = savedTimeStr ? parseFloat(savedTimeStr) : 0;

            if (savedTime > 5 && savedTime < video.duration - 5) {
                video.currentTime = savedTime;
                showToast(`已为您恢复播放进度：${formatTime(savedTime)}`);
                // 标记已跳过片头，防止再次触发跳过片头导致进度被覆盖
                hlsSource.hasSkippedIntroRef.current = true;
            } else {
                // 如果没有保存进度，且片头秒数大于0且尚未跳过，则执行跳过片头逻辑
                const target = skipIntroTimeRef.current;
                if (target > 0 && !hlsSource.hasSkippedIntroRef.current) {
                    hlsSource.hasSkippedIntroRef.current = true;
                    video.currentTime = target;
                    showToast(`已为您跳过片头 ${target}s`);
                } else {
                    hlsSource.hasSkippedIntroRef.current = true;
                }
            }
        };

        if (video.readyState >= 1) {
            doRestore();
        } else {
            const onLoadedMetadata = () => {
                doRestore();
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
        }
    }, [url, hlsSource.isLoading, showToast]);

    // Wiring: touch end → gesture cleanup (tap handling delegated to useMobileVideoTouch in VideoPlayer.tsx)
    const handleTouchEndWired = useCallback((e: React.TouchEvent) => {
        const wasTap = gestures.handleTouchEnd(e);
        if (wasTap) {
            if (e.cancelable) e.preventDefault();
            // Mobile tap handling (controls toggle / double-tap) is delegated to
            // useMobileVideoTouch in VideoPlayer.tsx for YouTube-style behavior.
            // Do NOT call controls.handleVideoClick here.
        }
        if (!wasTap) {
            controls.setIsHovering(true);
        }
    }, [gestures.handleTouchEnd, controls.setIsHovering]);

    // Wiring: mouse move → show controls (skip when settings open to prevent flicker)
    const handleMouseMoveWired = useCallback((e: React.MouseEvent) => {
        gestures.handleMouseMove(e);
        if (!settings.showSettings) {
            controls.setIsHovering(true);
        }
    }, [gestures.handleMouseMove, controls.setIsHovering, settings.showSettings]);

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

        isWebFullscreen: controls.isWebFullscreen,
        isDragging: seek.isDragging,
        dragProgress: seek.dragProgress,
        brightness: gestures.brightness,
        gestureHUD: gestures.gestureHUD,
        toast,
        levels: hlsSource.levels,
        skipIntroTime: skipIntroTimeRef,
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
        handleSeekRelative,
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

        handleMouseMove: handleMouseMoveWired,
        onSettingsPanelMouseMove: controls.onSettingsPanelMouseMove,
        onSettingsPanelClick: controls.onSettingsPanelClick,
        handleVideoClick: controls.handleVideoClick,
        handleTouchStart: gestures.handleTouchStart,
        handleTouchMove: gestures.handleTouchMove,
        handleTouchEnd: handleTouchEndWired,
        formatTime,
        showGestureHUD: gestures.showGestureHUD,
    };
}
