import { useState, useRef, useEffect, useCallback } from 'react';
import { CONFIG } from '@/config/config';

interface UseVideoControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
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
    containerRef, isPlaying, isDragging, showSettings,
    togglePlay, handleSeekRelative, showGestureHUD, setShowSettings, lastSeekEndTimeRef,
}: UseVideoControlsProps) {
    const [isHovering, setIsHovering] = useState(false);
    const [isWebFullscreen, setIsWebFullscreen] = useState(false);

    const lastTapRef = useRef(0);
    const [settingsActivityCount, setSettingsActivityCount] = useState(0);

    // 中央视频点击处理
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
                // 单击切换控制栏显示/隐藏
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
    }, [containerRef, togglePlay, handleSeekRelative, showGestureHUD, lastSeekEndTimeRef]);

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) container.requestFullscreen();
        else document.exitFullscreen();
    }, [containerRef]);

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
    }, [containerRef, isWebFullscreen]);

    // 设置面板鼠标活动追踪（节流，最多每秒触发一次状态更新）
    const lastActivityUpdateRef = useRef(0);
    const onSettingsPanelMouseMove = useCallback(() => {
        const now = Date.now();
        if (now - lastActivityUpdateRef.current > 1000) {
            lastActivityUpdateRef.current = now;
            setSettingsActivityCount(c => c + 1);
        }
    }, []);

    // 设置面板点击活动追踪（重置自动关闭计时器）
    const onSettingsPanelClick = useCallback(() => {
        setSettingsActivityCount(c => c + 1);
    }, []);

    // 设置面板不活动超时后自动关闭
    // 依赖 settingsActivityCount 在用户移动鼠标时重置计时器
    // 注意：不能依赖 isHovering，因为 true→true 不触发重渲染
    useEffect(() => {
        if (!showSettings) return;
        const timeout = setTimeout(() => {
            setShowSettings(false);
            setIsHovering(false);
        }, CONFIG.SETTINGS_AUTO_CLOSE_TIME);
        return () => clearTimeout(timeout);
    }, [showSettings, settingsActivityCount, setShowSettings, setIsHovering]);

    return {
        isHovering,
        setIsHovering,
        isWebFullscreen,
        handleVideoClick,
        toggleFullscreen,
        toggleWebFullscreen,
        onSettingsPanelMouseMove,
        onSettingsPanelClick,
    };
}
