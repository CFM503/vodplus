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

    const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

    // 监听原生全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            const doc = document as any;
            const isFull = !!(
                doc.fullscreenElement ||
                doc.webkitFullscreenElement ||
                doc.mozFullScreenElement ||
                doc.msFullscreenElement
            );
            setIsNativeFullscreen(isFull);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    // 网页全屏（Pseudo Fullscreen）切换
    const toggleWebFullscreen = useCallback((forceState?: boolean) => {
        const container = containerRef.current;
        if (!container) return;
        const next = typeof forceState === 'boolean' ? forceState : !isWebFullscreen;
        if (next) {
            container.classList.add('player-web-fullscreen');
            document.body.style.overflow = 'hidden';
            setIsWebFullscreen(true);
        } else {
            container.classList.remove('player-web-fullscreen');
            document.body.style.overflow = '';
            setIsWebFullscreen(false);
        }
    }, [containerRef, isWebFullscreen]);

    // 全屏总开关：优先尝试标准 Fullscreen API，若宿主 WebView 拒绝/不支持则无缝降级为网页全屏
    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const doc = document as any;
        const isNative = !!(
            doc.fullscreenElement ||
            doc.webkitFullscreenElement ||
            doc.mozFullScreenElement ||
            doc.msFullscreenElement
        );

        // 若当前处于网页全屏或原生全屏状态，则退出
        if (isWebFullscreen) {
            toggleWebFullscreen(false);
            return;
        }

        if (isNative) {
            const exit = doc.exitFullscreen ||
                doc.webkitExitFullscreen ||
                doc.mozCancelFullScreen ||
                doc.msExitFullscreen;
            if (exit) {
                try {
                    const p = exit.call(doc);
                    if (p && typeof p.catch === 'function') {
                        p.catch(() => { /* 忽略退出全屏失败 */ });
                    }
                } catch {}
            }
            return;
        }

        // 优先使用标准原生 Fullscreen API
        const el = container as any;
        const request = el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.mozRequestFullScreen ||
            el.msRequestFullscreen;

        if (request) {
            try {
                const p = request.call(el);
                if (p && typeof p.then === 'function') {
                    p.catch((_err: unknown) => {
                        // 当 Android WebView 宿主未实现 onShowCustomView 时，requestFullscreen 会 reject
                        // 此时自动无缝降级为网页全屏（Pseudo-Fullscreen），保证用户点击绝对有反应且全屏可用
                        toggleWebFullscreen(true);
                    });
                }
            } catch {
                toggleWebFullscreen(true);
            }
        } else {
            // iOS Safari 等特殊环境处理
            const video = container.querySelector('video') as any;
            if (video && typeof video.webkitEnterFullscreen === 'function') {
                try {
                    video.webkitEnterFullscreen();
                } catch {
                    toggleWebFullscreen(true);
                }
            } else {
                toggleWebFullscreen(true);
            }
        }
    }, [containerRef, isWebFullscreen, toggleWebFullscreen]);

    // 网页全屏下按 ESC 退出
    useEffect(() => {
        if (!isWebFullscreen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                toggleWebFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isWebFullscreen, toggleWebFullscreen]);

    // 组件卸载时恢复 body 滚动
    useEffect(() => {
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

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
    useEffect(() => {
        if (!showSettings) return;
        const timeout = setTimeout(() => {
            setShowSettings(false);
            setIsHovering(false);
        }, CONFIG.SETTINGS_AUTO_CLOSE_TIME);
        return () => clearTimeout(timeout);
    }, [showSettings, settingsActivityCount, setShowSettings, setIsHovering]);

    const isFullscreen = isNativeFullscreen || isWebFullscreen;

    return {
        isHovering,
        setIsHovering,
        isFullscreen,
        isWebFullscreen,
        handleVideoClick,
        toggleFullscreen,
        toggleWebFullscreen,
        onSettingsPanelMouseMove,
        onSettingsPanelClick,
    };
}
