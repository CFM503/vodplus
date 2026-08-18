import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/player-utils';

interface VideoProgressBarProps {
    player?: any;
    progressApi?: any;
    url?: string;
    variant: 'desktop' | 'mobile';
    className?: string;
}

export default function VideoProgressBar({ player, progressApi, url, variant, className }: VideoProgressBarProps) {
    const api = progressApi || player;

    if (!api) return null;

    const progress: number = api.progress ?? 0;
    const duration: number = api.duration ?? 0;
    const buffered: number = api.buffered ?? 0;
    const progressBarRef = api.progressBarRef;
    const handleSeekStart: (percent: number) => void = api.handleSeekStart;
    const handleSeekMove: (percent: number) => void = api.handleSeekMove;
    const handleSeekEnd: (percent: number) => void = api.handleSeekEnd;
    const handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void = api.handleProgressClick;

    // Ref for the actual visual track (the thin bar), used for precise position calculation
    const trackRef = useRef<HTMLDivElement>(null);

    // Local drag state — single source of truth for drag UI
    const [isDragging, setIsDragging] = useState(false);
    const [dragPercent, setDragPercent] = useState(0);
    const isDraggingRef = useRef(false);
    const dragPercentRef = useRef(0);
    const trackRectRef = useRef<DOMRect | null>(null); // 缓存track的rect

    const [isHovering, setIsHovering] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(0);

    /**
     * Calculate percentage from clientX using the track element's bounding rect.
     * forceRefresh=true forces measuring fresh getBoundingClientRect at pointerdown.
     */
    const getPercentFromClientX = useCallback((clientX: number, forceRefresh = false): number => {
        const el = trackRef.current;
        if (!el) return 0;
        
        let rect = trackRectRef.current;
        if (!rect || forceRefresh || rect.width === 0) {
            rect = el.getBoundingClientRect();
            trackRectRef.current = rect;
        }
        
        if (rect.width === 0) return 0;
        const x = clientX - rect.left;
        return Math.max(0, Math.min(100, (x / rect.width) * 100));
    }, []);
    
    // 窗口大小变化时更新缓存
    useEffect(() => {
        const updateRect = () => {
            if (trackRef.current) {
                trackRectRef.current = trackRef.current.getBoundingClientRect();
            }
        };
        window.addEventListener('resize', updateRect);
        window.addEventListener('fullscreenchange', updateRect);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('fullscreenchange', updateRect);
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        setHoverProgress(getPercentFromClientX(e.clientX));
    }, [getPercentFromClientX]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Capture pointer so move/up events continue even if finger leaves element
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}

        // Always measure fresh rect on pointerdown to handle scroll/reflow accurately
        const percent = getPercentFromClientX(e.clientX, true);
        setIsDragging(true);
        isDraggingRef.current = true;
        setDragPercent(percent);
        dragPercentRef.current = percent;
        setHoverProgress(percent);

        handleSeekStart?.(percent);

        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
    }, [getPercentFromClientX, handleSeekStart]);

    // 使用requestAnimationFrame节流拖动时的渲染频率
    const rafRef = useRef<number | null>(null);
    
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;

        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
        }

        const clientX = e.clientX;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (!isDraggingRef.current) return;

            const percent = getPercentFromClientX(clientX);

            // 只在变化超过阈值时更新
            if (Math.abs(percent - dragPercentRef.current) < 0.5) return;

            setDragPercent(percent);
            dragPercentRef.current = percent;
            handleSeekMove?.(percent);
        });

        e.stopPropagation();
    }, [getPercentFromClientX, handleSeekMove]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        
        if (!isDraggingRef.current) return;

        const finalPercent = dragPercentRef.current;
        isDraggingRef.current = false;
        setIsDragging(false);
        trackRectRef.current = null;

        // Pass the final percentage so the hook seeks the video
        handleSeekEnd?.(finalPercent);

        try {
            const target = e.currentTarget as HTMLElement;
            if (target && target.hasPointerCapture && target.hasPointerCapture(e.pointerId)) {
                target.releasePointerCapture(e.pointerId);
            }
        } catch {}
        e.stopPropagation();
    }, [handleSeekEnd]);

    // 优化：使用useCallback包装事件处理函数
    const handleMouseEnter = useCallback(() => setIsHovering(true), []);
    const handleMouseLeave = useCallback(() => {
        setIsHovering(false);
        setHoverProgress(0);
    }, []);

    // During drag, show the local drag percentage; otherwise show real playback progress
    const displayProgress = isDragging ? dragPercent : progress;

    // Show tooltip during hover or drag
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
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Track — this is the visual bar; we use trackRef for position calculation */}
            <div
                ref={trackRef}
                className={cn(
                    "absolute left-0 right-0 h-2 bg-white/20 rounded-full",
                    "top-1/2 -translate-y-1/2"
                )}
            >
                {/* Buffered bar */}
                {buffered > 0 && (
                    <div
                        className="absolute h-full bg-white/30 rounded-full"
                        style={{ width: `${buffered}%` }}
                    />
                )}
                {/* Played bar */}
                <div
                    className={cn(
                        "absolute h-full rounded-full",
                        isDragging ? "bg-indigo-400" : "bg-indigo-500 group-hover:bg-indigo-400"
                    )}
                    style={{
                        width: `${displayProgress}%`,
                        transition: isDragging ? 'none' : 'width 150ms linear',
                    }}
                />
                {/* Knob / thumb */}
                <div
                    className={cn(
                        "absolute top-1/2 rounded-full pointer-events-none",
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
