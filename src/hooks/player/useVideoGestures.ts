import { useState, useRef, useCallback, useEffect } from 'react';
import { CONFIG } from '@/config/config';

interface UseVideoGesturesProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    volume: number;
    playbackRate: number;
    isEmbed: boolean;
    handleVolumeChange: (newVolume: number) => void;
    handleSpeedHoldStart: () => void;
    handleSpeedHoldEnd: () => void;
    isSpeedHolding: boolean;
}

interface GestureHUDState {
    icon: 'volume' | 'brightness' | 'seek';
    value: string;
    visible: boolean;
}

export function useVideoGestures({
    videoRef, containerRef, volume, playbackRate, isEmbed,
    handleVolumeChange, handleSpeedHoldStart, handleSpeedHoldEnd, isSpeedHolding,
}: UseVideoGesturesProps) {
    const [brightness, setBrightness] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('VOD_BRIGHTNESS');
            if (saved) {
                const parsed = parseFloat(saved);
                if (Number.isFinite(parsed)) return Math.max(0, Math.min(200, parsed));
            }
        }
        return 100;
    });
    const [gestureHUD, setGestureHUD] = useState<GestureHUDState>({
        icon: 'seek', value: '', visible: false,
    });

    const touchStartRef = useRef<{
        x: number; y: number; time: number;
        vol: number; brightness: number; currentTime: number;
    } | null>(null);
    const gestureTypeRef = useRef<'none' | 'vertical-left' | 'vertical-right' | 'horizontal'>('none');
    // 本次触摸是否已识别为手势（亮度/音量/seek 拖拽等），用于手势结束后避免误触发控制栏单击开关
    const gestureActiveRef = useRef(false);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const gestureHUDTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingSeekTimeRef = useRef<number | null>(null);

    // 亮度在会话间持久化，避免每次重新打开播放器都回到 100%
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('VOD_BRIGHTNESS', brightness.toString());
        }
    }, [brightness]);

    const showGestureHUD = useCallback((icon: 'volume' | 'brightness' | 'seek', value: string) => {
        if (gestureHUDTimerRef.current) clearTimeout(gestureHUDTimerRef.current);
        setGestureHUD({ icon, value, visible: true });
        gestureHUDTimerRef.current = setTimeout(() => {
            setGestureHUD(prev => ({ ...prev, visible: false }));
        }, CONFIG.GESTURE_HUD_AUTO_HIDE_TIME);
    }, []);

    const hideGestureHUD = useCallback(() => {
        if (gestureHUDTimerRef.current) {
            clearTimeout(gestureHUDTimerRef.current);
            gestureHUDTimerRef.current = null;
        }
        setGestureHUD(prev => ({ ...prev, visible: false }));
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = Math.abs(currentX - lastMousePosRef.current.x);
        const deltaY = Math.abs(currentY - lastMousePosRef.current.y);
        if (deltaX > 0 || deltaY > 0) {
            lastMousePosRef.current = { x: currentX, y: currentY };
        }
    }, []);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (isEmbed) return;
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            vol: volume,
            brightness: brightness,
            currentTime: videoRef.current?.currentTime || 0,
        };
        gestureTypeRef.current = 'none';
        gestureActiveRef.current = false;
        pendingSeekTimeRef.current = null;

        // Long press speed logic (right 25% zone)
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const isRightZone = touch.clientX > rect.left + rect.width * 0.75;

            if (isRightZone) {
                longPressTimerRef.current = setTimeout(() => {
                    handleSpeedHoldStart();
                }, 500);
            }
        }
    }, [isEmbed, volume, brightness, containerRef, handleSpeedHoldStart]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (isEmbed || !touchStartRef.current || !containerRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const containerRect = containerRef.current.getBoundingClientRect();

        // 手指发生位移时取消长按计时器
        if (longPressTimerRef.current && (Math.abs(deltaX) > CONFIG.TAP_MAX_MOVEMENT || Math.abs(deltaY) > CONFIG.TAP_MAX_MOVEMENT)) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // 识别垂直手势：左半屏亮度 / 右半屏音量
        if (gestureTypeRef.current === 'none' && Math.abs(deltaY) > CONFIG.GESTURE_VERTICAL_THRESHOLD
            && Math.abs(deltaY) > Math.abs(deltaX) * CONFIG.GESTURE_ASPECT_RATIO_THRESHOLD) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            if (isSpeedHolding) return;

            const isLeft = touchStartRef.current.x < containerRect.left + containerRect.width * 0.5;
            gestureTypeRef.current = isLeft ? 'vertical-left' : 'vertical-right';
            gestureActiveRef.current = true;
        }

        // 识别水平手势：左右滑动 seek
        if (gestureTypeRef.current === 'none' && Math.abs(deltaX) > CONFIG.GESTURE_VERTICAL_THRESHOLD
            && Math.abs(deltaX) > Math.abs(deltaY) * CONFIG.GESTURE_ASPECT_RATIO_THRESHOLD) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            if (isSpeedHolding) return;

            gestureTypeRef.current = 'horizontal';
            gestureActiveRef.current = true;
        }

        // 垂直手势执行
        if (gestureTypeRef.current === 'vertical-left') {
            const brightnessDelta = -(deltaY / containerRect.height) * 100;
            const newBrightness = Math.max(0, Math.min(200, touchStartRef.current.brightness + brightnessDelta));
            if (Math.abs(newBrightness - brightness) > 1) {
                setBrightness(newBrightness);
                showGestureHUD('brightness', `${Math.round(newBrightness)}%`);
            }
        } else if (gestureTypeRef.current === 'vertical-right') {
            const volumeDelta = -(deltaY / containerRect.height);
            const newVolume = Math.max(0, Math.min(1, touchStartRef.current.vol + volumeDelta));
            if (Math.abs(newVolume - volume) > 0.01) {
                handleVolumeChange(newVolume);
                showGestureHUD('volume', `${Math.round(newVolume * 100)}%`);
            }
        } else if (gestureTypeRef.current === 'horizontal') {
            // 水平滑动 seek：整屏宽度 = HORIZONTAL_SEEK_SECONDS 秒
            const video = videoRef.current;
            const duration = video?.duration || 0;
            if (duration > 0 && containerRect.width > 0) {
                const seekSeconds = (deltaX / containerRect.width) * CONFIG.HORIZONTAL_SEEK_SECONDS;
                const target = Math.max(0, Math.min(duration - 1, touchStartRef.current.currentTime + seekSeconds));
                pendingSeekTimeRef.current = target;
                const diff = Math.round(target - touchStartRef.current.currentTime);
                showGestureHUD('seek', `${diff > 0 ? '+' : ''}${diff}s`);
            }
        }
    }, [isEmbed, isSpeedHolding, containerRef, handleVolumeChange, showGestureHUD, brightness, volume, videoRef]);

    const handleTouchEnd = useCallback((e: React.TouchEvent): { isTap: boolean; wasGesture: boolean } => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (isSpeedHolding) {
            handleSpeedHoldEnd();
            touchStartRef.current = null;
            gestureTypeRef.current = 'none';
            gestureActiveRef.current = false;
            pendingSeekTimeRef.current = null;
            return { isTap: false, wasGesture: true };
        }

        if (!touchStartRef.current) return { isTap: false, wasGesture: false };

        // 水平滑动结束时应用 seek
        if (gestureTypeRef.current === 'horizontal' && pendingSeekTimeRef.current !== null && videoRef.current) {
            videoRef.current.currentTime = pendingSeekTimeRef.current;
        }

        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const touchDuration = Date.now() - touchStartRef.current.time;

        // Handle tap (short duration, no significant drag) - returns true if it was a tap
        const isTap = gestureTypeRef.current === 'none'
            && touchDuration < CONFIG.TAP_MAX_DURATION
            && Math.abs(deltaX) < CONFIG.TAP_MAX_MOVEMENT;

        const wasGesture = gestureActiveRef.current;

        hideGestureHUD();
        touchStartRef.current = null;
        gestureTypeRef.current = 'none';
        gestureActiveRef.current = false;
        pendingSeekTimeRef.current = null;

        return { isTap, wasGesture };
    }, [isSpeedHolding, handleSpeedHoldEnd, hideGestureHUD, videoRef]);

    // 触摸被系统打断（如浏览器接管滚动、来电等）时的清理：重置手势状态，避免残留影响下一次触摸
    const handleTouchCancel = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (isSpeedHolding) {
            handleSpeedHoldEnd();
        }
        hideGestureHUD();
        touchStartRef.current = null;
        gestureTypeRef.current = 'none';
        gestureActiveRef.current = false;
        pendingSeekTimeRef.current = null;
    }, [isSpeedHolding, handleSpeedHoldEnd, hideGestureHUD]);

    // 长按加速时显示/隐藏 HUD
    useEffect(() => {
        if (isSpeedHolding) {
            showGestureHUD('seek', `${CONFIG.LONG_PRESS_SPEED}x`);
        } else {
            hideGestureHUD();
        }
    }, [isSpeedHolding, showGestureHUD, hideGestureHUD]);

    // 组件卸载时清理所有定时器
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (gestureHUDTimerRef.current) clearTimeout(gestureHUDTimerRef.current);
        };
    }, []);

    return {
        brightness,
        setBrightness,
        gestureHUD,
        showGestureHUD,
        hideGestureHUD,
        isSpeedHolding,
        handleMouseMove,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
    };
}
