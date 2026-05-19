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
    const [brightness, setBrightness] = useState(100);
    const [gestureHUD, setGestureHUD] = useState<GestureHUDState>({
        icon: 'seek', value: '', visible: false,
    });

    const touchStartRef = useRef<{
        x: number; y: number; time: number;
        vol: number; brightness: number; currentTime: number;
    } | null>(null);
    const gestureTypeRef = useRef<'none' | 'vertical-left' | 'vertical-right' | 'horizontal'>('none');
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const gestureHUDTimerRef = useRef<NodeJS.Timeout | null>(null);

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

        // Detect gesture type on first significant move
        if (gestureTypeRef.current === 'none' && Math.abs(deltaY) > CONFIG.GESTURE_VERTICAL_THRESHOLD
            && Math.abs(deltaY) > Math.abs(deltaX) * CONFIG.GESTURE_ASPECT_RATIO_THRESHOLD) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            if (isSpeedHolding) return;

            const isLeft = touchStartRef.current.x < containerRect.left + containerRect.width * 0.5;
            gestureTypeRef.current = isLeft ? 'vertical-left' : 'vertical-right';
        }

        // Execute gesture - 优化：添加阈值检查，减少不必要的更新
        if (gestureTypeRef.current === 'vertical-left') {
            const brightnessDelta = -(deltaY / containerRect.height) * 100;
            const newBrightness = Math.max(0, Math.min(200, touchStartRef.current.brightness + brightnessDelta));
            // 只在变化超过1%时更新
            if (Math.abs(newBrightness - brightness) > 1) {
                setBrightness(newBrightness);
                showGestureHUD('brightness', `${Math.round(newBrightness)}%`);
            }
        } else if (gestureTypeRef.current === 'vertical-right') {
            const volumeDelta = -(deltaY / containerRect.height);
            const newVolume = Math.max(0, Math.min(1, touchStartRef.current.vol + volumeDelta));
            // 只在变化超过1%时更新
            if (Math.abs(newVolume - volume) > 0.01) {
                handleVolumeChange(newVolume);
                showGestureHUD('volume', `${Math.round(newVolume * 100)}%`);
            }
        }
    }, [isEmbed, isSpeedHolding, containerRef, handleVolumeChange, showGestureHUD, brightness, volume]);

    const handleTouchEnd = useCallback((e: React.TouchEvent): boolean => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (isSpeedHolding) {
            handleSpeedHoldEnd();
            touchStartRef.current = null;
            gestureTypeRef.current = 'none';
            return false;
        }

        if (!touchStartRef.current) return false;

        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const touchDuration = Date.now() - touchStartRef.current.time;

        // Handle tap (short duration, no significant drag) - returns true if it was a tap
        const isTap = gestureTypeRef.current === 'none'
            && touchDuration < CONFIG.TAP_MAX_DURATION
            && Math.abs(deltaX) < CONFIG.TAP_MAX_MOVEMENT;

        hideGestureHUD();
        touchStartRef.current = null;
        gestureTypeRef.current = 'none';

        return isTap;
    }, [isSpeedHolding, handleSpeedHoldEnd, hideGestureHUD]);

    // 长按加速时显示/隐藏 HUD
    useEffect(() => {
        if (isSpeedHolding) {
            showGestureHUD('seek', `${CONFIG.LONG_PRESS_SPEED}x`);
        } else {
            hideGestureHUD();
        }
    }, [isSpeedHolding, showGestureHUD, hideGestureHUD]);

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
    };
}
