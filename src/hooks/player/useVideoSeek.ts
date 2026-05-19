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
    // isDragging is exposed so external code (e.g. controls hide timer) knows we're dragging
    const [isDragging, setIsDragging] = useState(false);
    const [dragProgress, setDragProgress] = useState(0);
    const lastSeekEndTimeRef = useRef(0);

    /**
     * Called by the progress bar component when drag starts.
     */
    const handleSeekStart = useCallback((percent: number) => {
        setIsDragging(true);
        setDragProgress(percent);
    }, []);

    /**
     * Called by the progress bar component when drag moves.
     * 优化：添加阈值检查，减少不必要的渲染
     */
    const handleSeekMove = useCallback((percent: number) => {
        // 只在变化超过0.5%时更新，减少渲染频率
        setDragProgress(prev => {
            if (Math.abs(percent - prev) < 0.5) return prev;
            return percent;
        });
    }, []);

    /**
     * Called by the progress bar component when drag ends.
     * Performs the actual video seek and resumes playback.
     * 优化：添加播放状态检查，避免重复播放
     */
    const handleSeekEnd = useCallback((percent: number) => {
        const video = videoRef.current;

        if (video && video.duration) {
            const targetTime = (percent / 100) * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                // Immediately update progress state so knob doesn't jump back
                if (setProgressProp) setProgressProp(percent);
            }

            // Resume playback after seeking - 只在视频原本在播放时才恢复
            if (video.paused && !video.ended) {
                video.play().catch(error => {
                    if (error instanceof Error && error.name !== 'AbortError') {
                        console.warn('播放恢复失败:', error.message);
                    }
                });
            }

            // HLS流需要重新加载 - 优化：使用requestAnimationFrame避免阻塞
            if (hlsRef.current) {
                requestAnimationFrame(() => {
                    if (hlsRef.current && video.paused) {
                        hlsRef.current.startLoad();
                    }
                });
            }
        }

        setIsDragging(false);
        setDragProgress(0);
        lastSeekEndTimeRef.current = Date.now();
    }, [setProgressProp, videoRef, hlsRef]);

    /**
     * Click on the progress bar (non-drag click).
     */
    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();

        const video = videoRef.current;
        if (!video) return;

        // Suppress click that fires right after a drag ends
        if (Date.now() - lastSeekEndTimeRef.current < CONFIG.SEEK_CLICK_SUPPRESSION_DELAY) return;

        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        if (video.duration) {
            const targetTime = pos * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                if (setProgressProp) setProgressProp(pos * 100);
            }
        }
    }, [setProgressProp, videoRef, progressBarRef]);

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
