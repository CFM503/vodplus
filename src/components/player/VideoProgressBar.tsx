import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/player-utils';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

interface ProgressApi {
    progress: number;
    duration: number;
    buffered: number;
    isDragging: boolean;
    dragProgress: number;
    progressBarRef: React.RefObject<HTMLDivElement | null>;
    handleSeekStart: (e: React.TouchEvent | React.MouseEvent) => void;
    handleSeekMove: (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => void;
    handleSeekEnd: () => void;
    handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface VideoProgressBarProps {
    progressApi: ProgressApi;
    url?: string;
    variant: 'desktop' | 'mobile';
    className?: string;
}

export default function VideoProgressBar({ progressApi, url, variant, className }: VideoProgressBarProps) {
    const {
        progress, duration, buffered, isDragging, dragProgress, progressBarRef,
        handleSeekStart, handleSeekMove, handleSeekEnd, handleProgressClick,
    } = progressApi;

    const [isHovering, setIsHovering] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(0);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    // Calculate hover position
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;
        setHoverProgress(percentage);
    };

    const showTooltip = isHovering && duration > 0;
    const canShowPreview = CONFIG.SHOW_THUMBNAIL_PREVIEW && url?.includes('.m3u8');

    // HLS preview initialization (independent of hover state)
    useEffect(() => {
        if (!canShowPreview || !previewVideoRef.current || !url) return;

        let cancelled = false;
        const previewVideo = previewVideoRef.current;

        const initPreview = async () => {
            if (cancelled) return;
            try {
                const { default: Hls } = await import('hls.js');
                if (cancelled || !Hls.isSupported() || !previewVideo) return;
                const hls = new Hls({
                    capLevelToPlayerSize: false,
                    autoStartLoad: true,
                    startLevel: -1,
                    enableWorker: false,
                    maxBufferLength: 30,
                    manifestLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                    manifestLoadingMaxRetry: 2,
                    levelLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                    levelLoadingMaxRetry: 2,
                    fragLoadingTimeOut: 10000,
                    fragLoadingMaxRetry: 2,
                    testBandwidth: false,
                });
                hls.loadSource(url);
                hls.attachMedia(previewVideo);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (hls.levels.length > 0) hls.currentLevel = 0;
                });

                // Cleanup on effect re-run
                return () => {
                    hls.destroy();
                };
            } catch (err) {
                logger.error('VideoProgressBar', 'Preview HLS init failed', err);
            }
        };

        const cleanupHls = initPreview();
        return () => {
            cancelled = true;
            if (cleanupHls instanceof Promise) {
                cleanupHls.then(fn => fn?.());
            }
        };
    }, [url, canShowPreview]);

    // Update preview video time on hover
    useEffect(() => {
        if (canShowPreview && previewVideoRef.current && showTooltip && duration > 0) {
            const targetTime = (hoverProgress / 100) * duration;
            if (targetTime < previewVideoRef.current.duration) {
                previewVideoRef.current.currentTime = targetTime;
            }
        }
    }, [hoverProgress, showTooltip, duration, canShowPreview]);

    const displayProgress = isDragging ? dragProgress : progress;

    return (
        <div
            ref={progressBarRef}
            className={cn(
                "relative cursor-pointer group",
                variant === 'desktop' ? "h-8 -mx-2 px-2" : "h-6 -mx-1 px-1",
                className
            )}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setHoverProgress(0); }}
            onMouseMove={(e) => {
                handleMouseMove(e);
                handleSeekMove(e as any);
            }}
            onClick={handleProgressClick}
            onTouchStart={handleSeekStart}
            onTouchMove={handleSeekMove}
            onTouchEnd={handleSeekEnd}
        >
            {/* Progress bar track */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/20 rounded-full">
                {/* Buffered */}
                {buffered > 0 && (
                    <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${buffered}%` }} />
                )}
                {/* Progress */}
                <div
                    className={cn(
                        "absolute h-full rounded-full transition-[width] duration-150 ease-linear",
                        isDragging ? "bg-indigo-400" : "bg-indigo-500 group-hover:bg-indigo-400"
                    )}
                    style={{ width: `${displayProgress}%` }}
                />
                {/* Scrubber dot */}
                <div
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-all",
                        isDragging ? "scale-125 bg-indigo-300 shadow-glow" : "bg-white scale-100 opacity-0 group-hover:opacity-100"
                    )}
                    style={{ left: `${displayProgress}%` }}
                />
            </div>

            {/* Hover tooltip */}
            {showTooltip && (
                <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-40"
                    style={{ left: `${hoverProgress}%` }}
                >
                    {formatTime(duration * (hoverProgress / 100))} / {formatTime(duration)}
                    {canShowPreview && (
                        <video
                            ref={previewVideoRef}
                            className="block w-40 h-auto mt-1 rounded"
                            muted
                            playsInline
                            preload="none"
                        />
                    )}
                </div>
            )}
        </div>
    );
}
