/**
 * YouTube风格播放器控制交互规则
 * 
 * 本文件定义了播放器控制按钮和设置面板的所有交互逻辑
 * PC端和移动端分开管理，与YouTube行为完全一致
 * 
 * 修改规则只需修改此文件
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook: creates a stable ref that always points to the latest value.
 * Allows callbacks to read current state without being in the dependency array.
 */
function useLatestRef<T>(value: T): React.MutableRefObject<T> {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

// ===========================
// 配置常量
// ===========================

export const PLAYER_CONTROL_CONFIG = {
    // 控制栏自动隐藏延迟（毫秒）
    CONTROLS_AUTO_HIDE_DELAY: 3000,
    
    // 双击判定时间间隔（毫秒）
    DOUBLE_TAP_DELAY: 300,
    
    // 双击快进/快退秒数
    SKIP_SECONDS: 10,
    
    // 双击快进触发区域占比（0.3 = 屏幕左右30%）
    DOUBLE_TAP_SKIP_ZONE_PERCENT: 0.3,
    
    // 拖动结束后点击抑制时间（毫秒）
    SEEK_CLICK_SUPPRESSION_DELAY: 200,
    
    // 触摸后点击抑制时间（毫秒）
    TOUCH_CLICK_SUPPRESSION_DELAY: 500,
};

// ===========================
// 类型定义
// ===========================

export interface PlayerControlState {
    isPlaying: boolean;
    isHovering: boolean;
    showSettings: boolean;
    isDragging: boolean;
}

export interface PlayerControlRefs {
    containerRef: React.RefObject<HTMLDivElement | null>;
    settingsPanelRef: React.RefObject<HTMLDivElement | null>;
    mobileSettingsPanelRef: React.RefObject<HTMLDivElement | null>;
    touchEndTimeRef: React.RefObject<number>;
    lastTapRef: React.RefObject<number>;
    hideTimerRef: React.RefObject<NodeJS.Timeout | null>;
}

export interface PlayerControlActions {
    togglePlay: () => void;
    toggleFullscreen: () => void;
    toggleWebFullscreen?: () => void;
    handleSeekRelative: (seconds: number) => void;
    showGestureHUD: (icon: 'volume' | 'brightness' | 'seek', value: string) => void;
    setIsHovering: (v: boolean | ((prev: boolean) => boolean)) => void;
    setShowSettings: (v: boolean | ((prev: boolean) => boolean)) => void;
    handleMouseMove?: (e: React.MouseEvent) => void;
    handleTouchStart?: (e: React.TouchEvent) => void;
    handleTouchMove?: (e: React.TouchEvent) => void;
    handleTouchEnd?: (e: React.TouchEvent) => void;
}

// ===========================
// PC端交互规则（与YouTube一致）
// ===========================

/**
 * PC端：鼠标移入播放器 → 显示控制栏，重置计时器
 */
export function usePCMouseEnter(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        const { isPlaying, showSettings } = stateRef.current;
        const { setIsHovering } = actionsRef.current;
        setIsHovering(true);
        resetHideTimer(refs.hideTimerRef, isPlaying, showSettings, setIsHovering);
    }, []); // stable — reads latest via refs
}

/**
 * PC端：鼠标移出播放器 → 如果设置面板未打开，隐藏控制栏
 */
export function usePCMouseLeave(
    state: PlayerControlState,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        if (!stateRef.current.showSettings) {
            actionsRef.current.setIsHovering(false);
        }
    }, []); // stable
}

/**
 * PC端：鼠标在播放器内移动 → 显示控制栏，重置计时器
 */
export function usePCMouseMove(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback((e: React.MouseEvent) => {
        const { isPlaying, showSettings } = stateRef.current;
        const { handleMouseMove, setIsHovering } = actionsRef.current;
        handleMouseMove?.(e);
        if (showSettings) return;
        setIsHovering(true);
        resetHideTimer(refs.hideTimerRef, isPlaying, showSettings, setIsHovering);
    }, []); // stable
}

/**
 * PC端：鼠标在控制栏区域移动 → 重置计时器（保持控制栏显示）
 * 设置面板打开时跳过，避免不必要的状态更新导致闪烁
 */
export function usePCControlsHover(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        const { isPlaying, showSettings } = stateRef.current;
        const { setIsHovering } = actionsRef.current;
        if (showSettings) return;
        setIsHovering(true);
        resetHideTimer(refs.hideTimerRef, isPlaying, showSettings, setIsHovering);
    }, []); // stable
}

/**
 * PC端：单击视频区域 → 播放/暂停（设置面板打开时不响应）
 */
export function usePCVideoClick(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        if (Date.now() - refs.touchEndTimeRef.current < PLAYER_CONTROL_CONFIG.TOUCH_CLICK_SUPPRESSION_DELAY) return;
        if (!stateRef.current.showSettings) {
            actionsRef.current.togglePlay();
        }
    }, []); // stable
}

/**
 * PC端：双击视频区域 → 全屏（设置面板打开时不响应）
 */
export function usePCVideoDoubleClick(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        if (Date.now() - refs.touchEndTimeRef.current < PLAYER_CONTROL_CONFIG.TOUCH_CLICK_SUPPRESSION_DELAY) return;
        if (!stateRef.current.showSettings) {
            actionsRef.current.toggleFullscreen();
        }
    }, []); // stable
}

/**
 * PC端：点击设置图标 → 切换设置面板显示/隐藏
 */
export function usePCSettingsToggle(
    state: PlayerControlState,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current.setShowSettings(!stateRef.current.showSettings);
    }, []); // stable
}

/**
 * PC端：点击设置面板外部 → 关闭设置面板
 * 使用 mousedown + contains() 检测，避免 React 合成事件与原生事件的时序问题
 */
export function usePCCloseSettingsOnOutsideClick(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const showSettingsRef = useRef(state.showSettings);
    useEffect(() => {
        showSettingsRef.current = state.showSettings;
    });

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (!showSettingsRef.current) return;
            const target = e.target as HTMLElement;
            // 点击设置面板内部（PC 或移动端）→ 不关闭
            const pcPanel = refs.settingsPanelRef.current;
            if (pcPanel && pcPanel.contains(target)) return;
            const mobilePanel = refs.mobileSettingsPanelRef.current;
            if (mobilePanel && mobilePanel.contains(target)) return;
            // 点击设置齿轮按钮 → 不关闭（由齿轮按钮自己的 onClick 处理开关）
            if (target.closest('[data-settings-toggle]')) return;
            actions.setShowSettings(false);
        };

        document.addEventListener('mousedown', handleMouseDown, true);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown, true);
        };
    }, [actions.setShowSettings]);
}

/**
 * PC端：按ESC键 → 关闭设置面板
 */
export function usePCCloseSettingsOnEscape(
    state: PlayerControlState,
    actions: PlayerControlActions
) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && state.showSettings) {
                actions.setShowSettings(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [state.showSettings, actions.setShowSettings]);
}

// ===========================
// 移动端交互规则（与YouTube一致）
// ===========================

/**
 * 移动端：触摸结束 → 处理手势，设置触摸结束时间
 */
export function useMobileTouchEnd(
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    const actionsRef = useLatestRef(actions);
    return useCallback((e: React.TouchEvent) => {
        refs.touchEndTimeRef.current = Date.now();
        actionsRef.current.handleTouchEnd?.(e);
    }, []); // stable
}

/**
 * 移动端：触摸视频区域 → 处理单击（显示/隐藏控制栏）和双击（快进/快退/播放暂停）
 * 单击：仅切换控制栏可见性，不触发播放/暂停（与YouTube一致）
 * 双击：左边缘快退，右边缘快进，中间播放/暂停
 * 使用延迟执行区分单击和双击
 */
export function useMobileVideoTouch(
    refs: PlayerControlRefs,
    actions: PlayerControlActions,
    state: PlayerControlState
) {
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);

    // 触摸开始时检测双击
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - refs.lastTapRef.current;
        const isDoubleTap = timeSinceLastTap < PLAYER_CONTROL_CONFIG.DOUBLE_TAP_DELAY;

        if (isDoubleTap && refs.containerRef.current) {
            // Cancel pending single-tap controls toggle
            if (pendingTimerRef.current) {
                clearTimeout(pendingTimerRef.current);
                pendingTimerRef.current = null;
            }

            const container = refs.containerRef.current;
            const rect = container.getBoundingClientRect();
            const x = e.changedTouches[0].clientX;
            const relativeX = x - rect.left;

            const { handleSeekRelative, showGestureHUD, togglePlay } = actionsRef.current;
            if (relativeX < rect.width * PLAYER_CONTROL_CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT) {
                // 左边缘 → 快退
                handleSeekRelative(-PLAYER_CONTROL_CONFIG.SKIP_SECONDS);
                showGestureHUD('seek', `-${PLAYER_CONTROL_CONFIG.SKIP_SECONDS}s`);
            } else if (relativeX > rect.width * (1 - PLAYER_CONTROL_CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT)) {
                // 右边缘 → 快进
                handleSeekRelative(PLAYER_CONTROL_CONFIG.SKIP_SECONDS);
                showGestureHUD('seek', `+${PLAYER_CONTROL_CONFIG.SKIP_SECONDS}s`);
            } else {
                // 中间 → 播放/暂停
                togglePlay();
            }
        }

        // 注意：不在这里写 lastTapRef！必须在 handleTouchEnd 中写入，
        // 否则 handleTouchEnd 读取时 timeSinceLastTap = 触摸持续时间（~100ms），
        // 永远 < 300ms，导致 isDoubleTap 恒为 true，单击处理永远不会执行。
    }, []); // stable

    // 触摸结束时处理单击（延迟执行以避免与双击冲突）
    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        refs.touchEndTimeRef.current = Date.now();

        // Cancel any pending single-tap action
        if (pendingTimerRef.current) {
            clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
        }

        const now = Date.now();
        const timeSinceLastTap = now - refs.lastTapRef.current;
        const isDoubleTap = timeSinceLastTap < PLAYER_CONTROL_CONFIG.DOUBLE_TAP_DELAY;

        // 记录本次触摸结束时间，供下次双击检测使用
        refs.lastTapRef.current = now;

        if (!isDoubleTap && !stateRef.current.showSettings) {
            // Delayed single-tap: toggle controls visibility (not play/pause)
            pendingTimerRef.current = setTimeout(() => {
                // 使用函数式更新避免闭包中 isHovering 过期
                actionsRef.current.setIsHovering(prev => !prev);
            }, PLAYER_CONTROL_CONFIG.DOUBLE_TAP_DELAY);
        }

        // Forward to gesture handler for long-press cleanup and gesture state reset.
        actionsRef.current.handleTouchEnd?.(e);
    }, []); // stable

    // Cleanup
    useEffect(() => {
        return () => {
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        };
    }, []);

    return { handleTouchStart, handleTouchEnd };
}

/**
 * 移动端：点击设置图标 → 切换设置面板显示/隐藏
 */
export function useMobileSettingsToggle(
    state: PlayerControlState,
    actions: PlayerControlActions
) {
    const stateRef = useLatestRef(state);
    const actionsRef = useLatestRef(actions);
    return useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current.setShowSettings(!stateRef.current.showSettings);
    }, []); // stable
}

/**
 * 移动端：点击设置面板背景遮罩 → 关闭设置面板
 */
export function useMobileCloseSettingsOnBackdrop(
    actions: PlayerControlActions
) {
    const actionsRef = useLatestRef(actions);
    return useCallback(() => {
        actionsRef.current.setShowSettings(false);
    }, []); // stable
}

// ===========================
// 通用交互规则（PC和移动端共用）
// ===========================

/**
 * 通用：设置面板打开时保持控制栏显示
 */
export function useKeepControlsVisibleWhenSettingsOpen(
    state: PlayerControlState,
    actions: PlayerControlActions
) {
    useEffect(() => {
        if (state.showSettings) {
            actions.setIsHovering(true);
        }
    }, [state.showSettings, actions.setIsHovering]);
}

/**
 * 通用：自动隐藏控制栏（设置面板打开时暂停计时）
 */
export function useAutoHideControls(
    state: PlayerControlState,
    refs: PlayerControlRefs,
    actions: PlayerControlActions
) {
    useEffect(() => {
        if (refs.hideTimerRef.current) clearTimeout(refs.hideTimerRef.current);

        if (state.isPlaying && state.isHovering && !state.isDragging && !state.showSettings) {
            refs.hideTimerRef.current = setTimeout(() => {
                actions.setIsHovering(false);
            }, PLAYER_CONTROL_CONFIG.CONTROLS_AUTO_HIDE_DELAY);
        }

        return () => {
            if (refs.hideTimerRef.current) clearTimeout(refs.hideTimerRef.current);
        };
    }, [state.isPlaying, state.isHovering, state.isDragging, state.showSettings, actions.setIsHovering]);
}

/**
 * 通用：清理计时器
 */
export function useCleanupTimers(refs: PlayerControlRefs) {
    useEffect(() => {
        return () => {
            if (refs.hideTimerRef.current) clearTimeout(refs.hideTimerRef.current);
        };
    }, []);
}

// ===========================
// 辅助函数
// ===========================

/**
 * 重置控制栏隐藏计时器
 */
function resetHideTimer(
    hideTimerRef: React.RefObject<NodeJS.Timeout | null>,
    isPlaying: boolean,
    showSettings: boolean,
    setIsHovering: (v: boolean) => void
) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying && !showSettings) {
        hideTimerRef.current = setTimeout(() => {
            setIsHovering(false);
        }, PLAYER_CONTROL_CONFIG.CONTROLS_AUTO_HIDE_DELAY);
    }
}

// ===========================
// YouTube交互规则对比表
// ===========================

/**
 * YouTube PC端交互规则：
 * ✅ 鼠标移入播放器 → 显示控制栏
 * ✅ 鼠标移出播放器 → 隐藏控制栏
 * ✅ 鼠标在控制栏上 → 保持显示（重置计时器）
 * ✅ 单击视频区域 → 播放/暂停
 * ✅ 双击视频区域 → 全屏
 * ✅ 点击设置图标 → 弹出设置面板（按钮上方）
 * ✅ 点击设置面板外部 → 关闭面板
 * ✅ 按ESC键 → 关闭面板
 * ✅ 设置面板打开时 → 控制栏保持显示
 * ✅ 点击设置项 → 进入子菜单（不关闭面板）
 * ✅ 点击返回箭头 → 回到主菜单
 * 
 * YouTube 移动端交互规则：
 * ✅ 点击视频区域 → 切换控制栏显示/隐藏
 * ✅ 双击左边缘 → 快退10秒
 * ✅ 双击右边缘 → 快进10秒
 * ✅ 双击中间 → 播放/暂停
 * ✅ 点击设置图标 → 底部弹出设置面板（模态框）
 * ✅ 点击背景遮罩 → 关闭面板
 * ✅ 设置面板打开时 → 控制栏保持显示
 * ✅ 点击设置项 → 进入子菜单
 * ✅ 点击返回箭头 → 回到主菜单
 */
