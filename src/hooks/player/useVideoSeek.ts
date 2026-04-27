import { useState, useRef, useEffect, useCallback } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';

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

    /**
     * handleSeekStart: Called when pointer goes down on the progress bar.
     * Sets up drag state and records initial position.
     */
    const handleSeekStart = useCallback((clientX: number) => {
        if (!progressBarRef.current || !videoRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        progressRectRef.current = rect;

        if (rect.width === 0) return;

        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

        setDragProgress(percent);
        dragProgressRef.current = percent;
        isDraggingRef.current = true;
        setIsDragging(true);
    }, []);

    /**
     * handleSeekMove: Called when pointer moves while dragging.
     * Updates the drag progress percentage.
     */
    const handleSeekMove = useCallback((clientX: number) => {
        if (!isDraggingRef.current || !progressRectRef.current) return;
        const rect = progressRectRef.current;
        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        setDragProgress(percent);
        dragProgressRef.current = percent;
    }, []);

    /**
     * handleSeekEnd: Called when pointer is released.
     * Seeks the video to the drag position and resumes playback.
     */
    const handleSeekEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        const video = videoRef.current;
        const finalProgress = dragProgressRef.current;

        if (video && video.duration) {
            const targetTime = (finalProgress / 100) * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                if (setProgressProp) setProgressProp(finalProgress);
            }

            // Resume playback after seeking
            if (video.paused && !video.ended) {
                video.play().catch(error => {
                    if (error instanceof Error && error.name !== 'AbortError') { /* ignore */ }
                });
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

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();

        const video = videoRef.current;
        if (!video || isDraggingRef.current) return;

        // Suppress click that fires after a drag ends (pointerup → click)
        if (Date.now() - lastSeekEndTimeRef.current < CONFIG.SEEK_CLICK_SUPPRESSION_DELAY) return;

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
