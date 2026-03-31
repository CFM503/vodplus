import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface VideoProgressBarProps {
    player: PlayerState;
    url?: string;
    variant: 'desktop' | 'mobile';
    className?: string;
}

export default function VideoProgressBar({ player, url, variant, className }: VideoProgressBarProps) {
    const {
        progress,
        duration,
        buffered,
        isDragging,
        dragProgress,
        progressBarRef,
        handleSeekStart,
        handleSeekMove,
        handleSeekEnd,
        handleProgressClick,
        formatTime,
    } = player;

    const [isHovering, setIsHovering] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(0);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const localRef = useRef<HTMLDivElement>(null);

    // Sync refs for the hook to work
    const syncRef = () => {
        if (localRef.current && progressBarRef) {
            // @ts-ignore - assigning to readonly ref object usually works in React but better to use object assignment if possible, 
            // or just assume progressBarRef is a MutableRefObject (it likely is from the hook).
            (progressBarRef as React.MutableRefObject<HTMLDivElement | null>).current = localRef.current;
        }
    };

    // Calculate hover position
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!localRef.current) return;
        const rect = localRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;
        setHoverProgress(percentage);

        // Update Preview Video Time
        if (previewVideoRef.current && duration) {
            const targetTime = (percentage / 100) * duration;
            if (Number.isFinite(targetTime)) {
                previewVideoRef.current.currentTime = targetTime;
            }
        }
    };

    // Desktop: Mouse Events
    const desktopEvents = {
        onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
            syncRef();
            handleSeekStart(e);
        },
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            syncRef();
            handleProgressClick(e);
        },
        onMouseEnter: () => {
            syncRef();
            setIsHovering(true);
        },
        onMouseLeave: () => {
            setIsHovering(false);
            setHoverProgress(0);
        },
        onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
            // Ensure ref is synced just in case mouse entered without triggering enter (edge case)
            if (progressBarRef.current !== localRef.current) syncRef();
            handleMouseMove(e);
        }
    };

    // Mobile: Touch Events
    const mobileEvents = {
        onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => {
            syncRef();
            handleSeekStart(e);
        },
        onTouchMove: handleSeekMove, // Hook handles this, assuming ref is set correctly on start
        onTouchEnd: handleSeekEnd,
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            syncRef();
            handleProgressClick(e);
        },
    };

    const eventProps = variant === 'desktop' ? desktopEvents : mobileEvents;

    // Visual Constants
    const containerHeight = variant === 'mobile' ? 16 : 14;

    // Time to display in tooltip
    const tooltipTime = isDragging
        ? (dragProgress / 100) * duration
        : (hoverProgress / 100) * duration;

    // Also sync preview video during drag
    if (isDragging && previewVideoRef.current && duration) {
        previewVideoRef.current.currentTime = tooltipTime;
    }

    // Position for tooltip
    const rawPos = isDragging ? dragProgress : hoverProgress;
    const tooltipPos = Math.max(0, Math.min(100, rawPos));

    // Check validation - Relaxed for functionality
    const showTooltip = (isDragging || (isHovering && variant === 'desktop'));

    // Determines if we can show a video preview - Enable for all, try to handle HLS
    // Now controlled by Config
    const canShowPreview = !!url && CONFIG.SHOW_THUMBNAIL_PREVIEW;

    // HLS Integration for Preview
    useEffect(() => {
        if (!canShowPreview || !previewVideoRef.current || !url.includes('.m3u8')) return;

        let hls: any = null;

        const initHls = async () => {
            try {
                const { default: Hls } = await import('hls.js');
                if (Hls.isSupported()) {
                    hls = new Hls({
                        enableWorker: true,
                        // Optimize for thumbnails:
                        startLevel: 0, // Start with lowest quality
                        autoStartLoad: true,
                        capLevelToPlayerSize: true, // Limit quality based on tiny video size
                    });

                    hls.loadSource(url);
                    hls.attachMedia(previewVideoRef.current);

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        // Force lowest level to save bandwidth
                        if (hls.levels.length > 0) {
                            hls.currentLevel = 0;
                        }
                    });
                } else if (previewVideoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS (Safari)
                    previewVideoRef.current.src = url;
                }
            } catch (e) {
                logger.error('VideoProgressBar', 'HLS init for preview failed', e);
            }
        };

        initHls();

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [url, showTooltip, canShowPreview]); // Re-run when tooltip visibility changes (mounts/unmounts)

    return (
        <div
            className={cn(
                "w-full flex items-center relative group/progress select-none touch-none",
                variant === 'mobile' ? "px-0" : "cursor-pointer mx-0",
                isDragging ? "cursor-grabbing" : "",
                className
            )}
            style={{
                height: `${containerHeight}px`,
                // Make sure we have a wide hit area
            }}
            ref={localRef}
            {...eventProps}
        >
            {/* Hover Tooltip & Thumbnail */}
            {showTooltip && (
                <div
                    className="absolute z-[100] flex flex-col items-center gap-2 pointer-events-none"
                    style={{
                        left: `${tooltipPos}%`,
                        transform: `translateX(${tooltipPos < 10 ? '0%' : tooltipPos > 90 ? '-100%' : '-50%'})`,
                        // Ensure precise alignment
                        bottom: '20px',
                    }}
                >
                    {/* Thumbnail Preview Window - Only render if available */}
                    {canShowPreview && (
                        <div className="relative w-40 aspect-video bg-black rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl flex items-center justify-center bg-black">
                            <video
                                ref={previewVideoRef}
                                src={!url?.includes('.m3u8') ? url : undefined} // Only set src directly for non-HLS
                                className="w-full h-full object-cover"
                                muted
                                preload="auto"
                                playsInline
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}

                    {/* Time Display */}
                    <div className="px-2 py-0.5 text-white text-[13px] font-bold drop-shadow-md bg-black/60 backdrop-blur-md rounded border border-white/10">
                        {Number.isFinite(tooltipTime) ? formatTime(tooltipTime) : '00:00'}
                    </div>
                </div>
            )}

            {/* Track Background (The visible bar container) */}
            <div
                className={cn(
                    "w-full relative bg-white/20 transition-all duration-100 ease-out origin-left",
                    // Reset rounding to be subtler or square-ish like YouTube? YouTube is square. Let's keep slight round for modern feel.
                    "rounded-sm"
                )}
                style={{
                    height: (isHovering || isDragging) ? `${CONFIG.PROGRESS_BAR_HEIGHT + 2}px` : `${CONFIG.PROGRESS_BAR_HEIGHT}px`,
                }}
            >
                {/* Buffered Bar */}
                <div
                    className="absolute left-0 top-0 h-full bg-white/40 transition-all duration-200"
                    style={{ width: `${buffered}%` }}
                />

                {/* Played Bar (Red) */}
                <div
                    className={cn(
                        "absolute left-0 top-0 h-full z-10",
                        !isDragging && "transition-all duration-100 linear"
                    )}
                    style={{
                        width: `${isDragging ? dragProgress : progress}%`,
                        backgroundColor: CONFIG.PROGRESS_BAR_COLOR
                    }}
                />

                {/* Scrubber Handle (The Dot) */}
                <div
                    className={cn(
                        "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100 ease-out z-20 shadow-md",
                        variant === 'desktop'
                            ? (isHovering || isDragging ? "opacity-100 scale-100" : "opacity-0 scale-0")
                            : "" // Mobile always show
                    )}
                    style={{
                        left: `${isDragging ? dragProgress : progress}%`,
                        backgroundColor: CONFIG.PROGRESS_BAR_HANDLE_COLOR,
                        width: `${CONFIG.PROGRESS_BAR_HEIGHT + CONFIG.PROGRESS_BAR_HANDLE_SIZE_ADD}px`,
                        height: `${CONFIG.PROGRESS_BAR_HEIGHT + CONFIG.PROGRESS_BAR_HANDLE_SIZE_ADD}px`,
                    }}
                />
            </div>
        </div>
    );
}
