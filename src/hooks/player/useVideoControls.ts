import { useState, useRef, useEffect, useCallback } from 'react';
import { CONFIG } from '@/config/config';

interface UseVideoControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    isDragging: boolean;
    showSettings: boolean;
    togglePlay: () => void;
    handleSeekRelative: (seconds: number) => void;
    showGestureHUD: (icon: 'volume' | 'brightness' | 'seek', value: string) => void;
    setShowSettings: (v: boolean) => void;
    lastSeekEndTimeRef: React.RefObject<number>;
}

export function useVideoControls({
    containerRef, videoRef, isPlaying, isDragging, showSettings,
    togglePlay, handleSeekRelative, showGestureHUD, setShowSettings, lastSeekEndTimeRef,
}: UseVideoControlsProps) {
    const [isHovering, setIsHovering] = useState(false);
    const [isWebFullscreen, setIsWebFullscreen] = useState(false);

    const lastTapRef = useRef(0);

    // Central video click handler
    const handleVideoClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now();
        const isTouch = 'touches' in e || 'changedTouches' in e;

        if (now - lastSeekEndTimeRef.current < CONFIG.SEEK_CLICK_SUPPRESSION_DELAY) return;

        const timeSinceLastTap = now - lastTapRef.current;
        const isDoubleTap = timeSinceLastTap < CONFIG.DOUBLE_TAP_DELAY;

        if (isTouch) {
            if (isDoubleTap) {
                const container = containerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                const x = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.TouchEvent).touches[0].clientX;
                const relativeX = x - rect.left;

                if (relativeX < rect.width * CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT) {
                    handleSeekRelative(-CONFIG.SKIP_SECONDS);
                    showGestureHUD('seek', `-${CONFIG.SKIP_SECONDS}s`);
                } else if (relativeX > rect.width * (1 - CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT)) {
                    handleSeekRelative(CONFIG.SKIP_SECONDS);
                    showGestureHUD('seek', `+${CONFIG.SKIP_SECONDS}s`);
                } else {
                    togglePlay();
                }
            } else {
                setIsHovering(prev => !prev);
            }
        } else {
            if (isDoubleTap) {
                toggleFullscreen();
            } else {
                togglePlay();
            }
        }

        lastTapRef.current = now;
    }, [containerRef, isDragging, togglePlay, handleSeekRelative, showGestureHUD]);

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) container.requestFullscreen();
        else document.exitFullscreen();
    }, []);

    const toggleWebFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!isWebFullscreen) {
            container.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:999999;background:#000;border-radius:0;';
            setIsWebFullscreen(true);
        } else {
            container.style.cssText = '';
            setIsWebFullscreen(false);
        }
    }, [isWebFullscreen]);

    // Auto-hide controls
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
        const shouldAutoHide = CONFIG.AUTO_HIDE_CONTROLS || isTouchDevice;

        if (shouldAutoHide && isPlaying && isHovering && !isDragging && !showSettings) {
            timeout = setTimeout(() => setIsHovering(false), CONFIG.CONTROLS_AUTO_HIDE_TIME);
        }
        return () => clearTimeout(timeout);
    }, [isPlaying, isHovering, isDragging, showSettings]);

    // Auto-close settings when controls hide
    useEffect(() => {
        if (!isHovering) setShowSettings(false);
    }, [isHovering, setShowSettings]);

    return {
        isHovering,
        setIsHovering,
        isWebFullscreen,
        handleVideoClick,
        toggleFullscreen,
        toggleWebFullscreen,
    };
}
