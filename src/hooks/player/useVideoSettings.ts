import { useState, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';

interface UseVideoSettingsProps {
    hlsRef: React.RefObject<InstanceType<typeof Hls> | null>;
    isEmbed: boolean;
    skipIntroTimeRef: React.RefObject<number>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    playbackRate: number;
    setPlaybackRate: (rate: number) => void;
    videoScale: number;
    setVideoScale: (scale: number) => void;
    showToast: (message: string) => void;
    maxBufferLength: number;
    setMaxBufferLength: React.Dispatch<React.SetStateAction<number>>;
}

export function useVideoSettings({
    hlsRef, isEmbed, skipIntroTimeRef, videoRef,
    playbackRate, setPlaybackRate, videoScale, setVideoScale, showToast,
    maxBufferLength, setMaxBufferLength,
}: UseVideoSettingsProps) {
    const [showSettings, setShowSettings] = useState(false);

    const handleResolutionChange = useCallback((idx: number) => {
        if (!hlsRef.current) return;
        hlsRef.current.currentLevel = idx;
        const label = idx === -1 ? '自动' : `${hlsRef.current.levels[idx]?.height}p`;
        showToast(`清晰度已切换至：${label}`);
        // 优化：不自动关闭，允许用户连续调整
    }, [hlsRef, showToast]);

    const handleRateChange = useCallback((rate: number) => {
        setPlaybackRate(rate);
        showToast(`播放速度已切换至 ${rate}x`);
        // 优化：不自动关闭，允许用户连续调整
    }, [setPlaybackRate, showToast]);

    const handleScaleChange = useCallback((scale: number) => {
        setVideoScale(scale);
        showToast(`画面比例已缩放至 ${scale}x`);
        // 优化：不自动关闭，允许用户连续调整
    }, [setVideoScale, showToast]);

    const handleBufferChange = useCallback((buf: number) => {
        const label = buf === 10 ? '极速' : buf === 30 ? '平衡' : buf === 60 ? '流畅' : buf === 120 ? '抗断网' : buf === 180 ? '超级流畅' : `${buf}s`;
        showToast(`缓存策略已更新：${label}模式 (${buf}s)`);
        setMaxBufferLength(buf);
        // 优化：不自动关闭，允许用户连续调整
    }, [showToast, setMaxBufferLength]);

    const handleSkipIntroChange = useCallback((seconds: number) => {
        const next = Math.max(0, seconds);
        skipIntroTimeRef.current = next;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('VOD_SESSION_SKIP_INTRO', next.toString());
        }
    }, [skipIntroTimeRef]);

    return {
        showSettings,
        setShowSettings,
        handleResolutionChange,
        handleRateChange,
        handleScaleChange,
        handleBufferChange,
        handleSkipIntroChange,
    };
}
