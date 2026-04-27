import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/player-utils';
import { CONFIG } from '@/config/config';

interface ProgressApi {
    progress: number;
    duration: number;
    buffered: number;
    isDragging: boolean;
    dragProgress: number;
    progressBarRef: React.RefObject<HTMLDivElement | null>;
    handleSeekStart: (clientX: number) => void;
    handleSeekMove: (clientX: number) => void;
    handleSeekEnd: () => void;
    handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface VideoProgressBarProps {
    player?: any;
    progressApi?: ProgressApi;
    url?: string;
    variant: 'desktop' | 'mobile';
    className?: string;
}

export default function VideoProgressBar({ player, progressApi, url, variant, className }: VideoProgressBarProps) {
    const api = progressApi || player;

    if (!api) return null;

    const progress = api.progress ?? 0;
    const duration = api.duration ?? 0;
    const buffered = api.buffered ?? 0;
    const progressBarRef = api.progressBarRef;
    const handleSeekStart = api.handleSeekStart;
    const handleSeekMove = api.handleSeekMove;
    const handleSeekEnd = api.handleSeekEnd;
    const handleProgressClick = api.handleProgressClick;

    // Local drag state — single source of truth for drag UI
    const [isDragging, setIsDragging] = useState(false);
    const [dragPercent, setDragPercent] = useState(0);
    const isDraggingRef = useRef(false);

    const [isHovering, setIsHovering] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(0);

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    const getPercentFromEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
        if (!progressBarRef?.current) return 0;
        const rect = progressBarRef.current.getBoundingClientRect();
        if (rect.width === 0) return 0;
        return clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    }, [progressBarRef]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef?.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;
        setHoverProgress(percentage);
    };

    /**
     * Pointer down — start dragging.
     * We set local state AND call into the seek hook so it records the start position.
     */
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!progressBarRef?.current) return;
        // Capture pointer so we get move/up even if finger leaves the element
        try { (progressBarRef.current as HTMLElement).setPointerCapture(e.pointerId); } catch {}

        const percent = getPercentFromEvent(e);
        setIsDragging(true);
        isDraggingRef.current = true;
        setDragPercent(percent);
        setHoverProgress(percent);

        // Notify the seek hook
        handleSeekStart(e.clientX);

        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
    }, [getPercentFromEvent, handleSeekStart, progressBarRef]);

    /**
     * Pointer move — update drag position.
     */
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;

        const percent = getPercentFromEvent(e);
        setDragPercent(percent);
        setHoverProgress(percent);

        // Notify the seek hook
        handleSeekMove(e.clientX);

        e.stopPropagation();
    }, [getPercentFromEvent, handleSeekMove]);

    /**
     * Pointer up — commit the seek.
     */
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;

        isDraggingRef.current = false;
        setIsDragging(false);
        setIsHovering(false);
        setHoverProgress(0);

        // Notify the seek hook to perform the actual video seek
        handleSeekEnd();

        try { progressBarRef?.current?.releasePointerCapture(e.pointerId); } catch {}
        e.stopPropagation();
    }, [handleSeekEnd, progressBarRef]);

    // During drag, show the local drag percentage; otherwise show real playback progress
    const displayProgress = isDragging ? dragPercent : progress;

    // Show tooltip/time during hover or drag
    const showTooltip = duration > 0 && (isDragging || isHovering);

    return (
        <div
            ref={progressBarRef}
            className={cn(
                "relative cursor-pointer group select-none",
                variant === 'desktop' ? "h-8 -mx-2 px-2" : "min-h-[44px] -mx-1 px-1 py-2 flex items-center",
                className
            )}
            style={{ touchAction: 'none' }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setHoverProgress(0); }}
            onMouseMove={handleMouseMove}
            // Block touch events from bubbling to container's gesture handler.
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                handleProgressClick?.(e as any);
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Track background */}
            <div className={cn(
                "absolute left-0 right-0 h-2 bg-white/20 rounded-full",
                variant === 'desktop' ? "top-1/2 -translate-y-1/2" : "top-1/2 -translate-y-1/2"
            )}>
                {/* Buffered bar */}
                {buffered > 0 && (
                    <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${buffered}%` }} />
                )}
                {/* Played/progress bar */}
                <div
                    className={cn(
                        "absolute h-full rounded-full",
                        isDragging
                            ? "bg-indigo-400"
                            : "bg-indigo-500 group-hover:bg-indigo-400"
                    )}
                    style={{ width: `${displayProgress}%`, transition: isDragging ? 'none' : 'width 150ms linear' }}
                />
                {/* Knob / thumb */}
                <div
                    className={cn(
                        "absolute top-1/2 rounded-full",
                        variant === 'mobile'
                            ? "bg-white w-5 h-5 opacity-100"
                            : isDragging
                                ? "bg-indigo-300 shadow-glow w-5 h-5 scale-125"
                                : "bg-white scale-100 opacity-0 group-hover:opacity-100 w-4 h-4"
                    )}
                    style={{
                        left: `${displayProgress}%`,
                        transform: 'translate(-50%, -50%)',
                        transition: isDragging ? 'none' : 'left 150ms linear',
                    }}
                />
            </div>

            {/* Desktop: hover/drag time tooltip */}
            {variant === 'desktop' && showTooltip && (
                <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none z-40 flex flex-col items-center"
                    style={{ left: `${isDragging ? dragPercent : hoverProgress}%` }}
                >
                    <span className="bg-black/80 text-white text-xs px-2 py-1 rounded mb-1 whitespace-nowrap">
                        {formatTime(duration * ((isDragging ? dragPercent : hoverProgress) / 100))} / {formatTime(duration)}
                    </span>
                </div>
            )}
            {/* Mobile: drag time tooltip near knob */}
            {variant === 'mobile' && isDragging && (
                <div
                    className="absolute bottom-full mb-2 pointer-events-none z-40 flex flex-col items-center"
                    style={{
                        left: `${dragPercent}%`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <span className="bg-black/80 text-white text-xs px-2 py-1 rounded mb-1 whitespace-nowrap">
                        {formatTime(duration * (dragPercent / 100))} / {formatTime(duration)}
                    </span>
                </div>
            )}
        </div>
    );
};
