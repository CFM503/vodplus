import { useState, useRef, useEffect, useCallback } from 'react';
import type Hls from 'hls.js';

interface UseVideoSeekProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    progressBarRef: React.RefObject<HTMLDivElement | null>;
    hlsRef: React.RefObject<InstanceType<typeof Hls> | null>;
    isHoveringRef: React.RefObject<boolean>;
    setProgress?: (pct: number) => void;
}

export function useVideoSeek({ videoRef, progressBarRef, hlsRef, isHoveringRef, setProgress: setProgressProp }: UseVideoSeekProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragProgress, setDragProgress] = useState(0);

    const isDraggingRef = useRef(false);
    const dragProgressRef = useRef(0);
    const progressRectRef = useRef<DOMRect | null>(null);
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSeekEndTimeRef = useRef(0);

    // Sync state to refs for stable callbacks
    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);

    const calculatePosition = useCallback((clientX: number, rect: DOMRect) => {
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }, []);

    // Progress bar rect cache
    useEffect(() => {
        const updateRect = () => {
            if (progressBarRef.current) {
                progressRectRef.current = progressBarRef.current.getBoundingClientRect();
            }
        };
        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('fullscreenchange', updateRect);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('fullscreenchange', updateRect);
        };
    }, []);

    const handleSeekStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        const isTouch = 'touches' in e;
        if (isTouch && !isHoveringRef.current) return;

        if (!progressBarRef.current || !videoRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        progressRectRef.current = rect;

        if (rect.width === 0) return;

        const clientX = 'touches' in e
            ? (e as React.TouchEvent).touches[0].clientX
            : (e as React.MouseEvent).clientX;

        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

        setDragProgress(percent);
        dragProgressRef.current = percent;
        setIsDragging(true);

        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleSeekMove = useCallback((e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => {
        if (!isDraggingRef.current || !progressRectRef.current) return;
        const rect = progressRectRef.current;
        const clientX = 'touches' in e
            ? (e as TouchEvent).touches[0].clientX
            : ('clientX' in e ? (e as MouseEvent).clientX : 0);

        if (clientX === 0) return;
        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        setDragProgress(percent);
        dragProgressRef.current = percent;
    }, []);

    const handleSeekEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        const video = videoRef.current;
        if (video && video.duration) {
            const targetTime = (dragProgressRef.current / 100) * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                if (setProgressProp) setProgressProp(dragProgressRef.current);
            }

            if (hlsRef.current && video.paused && !video.ended) {
                seekTimeoutRef.current = setTimeout(() => {
                    if (hlsRef.current && video.paused) hlsRef.current.startLoad();
                }, 100);
            }
        }
        setIsDragging(false);
        setDragProgress(0);
        dragProgressRef.current = 0;
        progressRectRef.current = null;
        lastSeekEndTimeRef.current = Date.now();
    }, [setProgressProp]);

    // Global listeners for desktop dragging
    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => handleSeekMove(e);
        const onMouseUp = () => handleSeekEnd();

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, handleSeekMove, handleSeekEnd]);

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();

        const video = videoRef.current;
        if (!video || isDraggingRef.current) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const pos = calculatePosition(e.clientX, rect);
        if (video.duration) {
            const targetTime = pos * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                if (setProgressProp) setProgressProp(pos * 100);
            }
        }
    }, [calculatePosition, setProgressProp]);

    return {
        isDragging,
        dragProgress,
        progressBarRef,
        lastSeekEndTimeRef,
        handleSeekStart,
        handleSeekMove,
        handleSeekEnd,
        handleProgressClick,
    };
}
