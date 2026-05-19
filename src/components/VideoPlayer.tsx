'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Loader2, Play, Volume2, Sun, FastForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import VideoControls from '@/components/player/VideoControls';
import PlayerSettingsPanel from '@/components/player/PlayerSettingsPanel';
import {
    usePCMouseEnter,
    usePCMouseLeave,
    usePCMouseMove,
    usePCControlsHover,
    usePCVideoClick,
    usePCVideoDoubleClick,
    usePCSettingsToggle,
    usePCCloseSettingsOnOutsideClick,
    usePCCloseSettingsOnEscape,
    useMobileVideoTouch,
    useMobileSettingsToggle,
    useMobileCloseSettingsOnBackdrop,
    useAutoHideControls,
    useKeepControlsVisibleWhenSettingsOpen,
    useCleanupTimers,
    PlayerControlState,
    PlayerControlRefs,
    PlayerControlActions,
} from '@/lib/player-control-rules';

interface VideoPlayerProps {
    url: string;
    poster?: string;
    title?: string;
    onEnded?: () => void;
    autoplay?: boolean;
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
    nextEpisodeUrl?: string;
}

export default function VideoPlayer({ url, poster, title, onEnded, autoplay = false, onPrevEpisode, onNextEpisode, hasPrevEpisode = false, hasNextEpisode = false, nextEpisodeUrl }: VideoPlayerProps) {
    const player = useVideoPlayer({ url, onEnded, autoplay, nextEpisodeUrl });
    const {
        videoRef, containerRef, isPlaying, isLoading, isBuffering, isHovering,
        handleMouseMove, handleTouchStart, handleTouchMove,
        handleTouchEnd, isEmbed, brightness, gestureHUD, toast, videoScale,
        isMuted, togglePlay, showSettings, setShowSettings,
        toggleFullscreen, handleSeekRelative,
    } = player;

    // Refs
    const pcSettingsPanelRef = useRef<HTMLDivElement>(null);
    const mobileSettingsPanelRef = useRef<HTMLDivElement>(null);
    const touchEndTimeRef = useRef(0);
    const lastTapRef = useRef(0);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // State
    const state: PlayerControlState = {
        isPlaying,
        isHovering,
        showSettings,
        isDragging: player.isDragging,
    };

    // Refs
    const refs: PlayerControlRefs = {
        containerRef,
        settingsPanelRef: pcSettingsPanelRef,
        mobileSettingsPanelRef,
        touchEndTimeRef,
        lastTapRef,
        hideTimerRef,
    };

    // Actions
    const actions: PlayerControlActions = {
        togglePlay,
        toggleFullscreen,
        handleSeekRelative,
        showGestureHUD: player.showGestureHUD || (() => {}),
        setIsHovering: player.setIsHovering,
        setShowSettings,
        handleMouseMove,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };

    // PC端交互规则
    const handlePCMouseEnter = usePCMouseEnter(state, refs, actions);
    const handlePCMouseLeave = usePCMouseLeave(state, actions);
    const handlePCMouseMove = usePCMouseMove(state, refs, actions);
    const handlePCControlsHover = usePCControlsHover(state, refs, actions);
    const handlePCVideoClick = usePCVideoClick(state, refs, actions);
    const handlePCVideoDoubleClick = usePCVideoDoubleClick(state, refs, actions);
    const handlePCSettingsToggle = usePCSettingsToggle(state, actions);
    usePCCloseSettingsOnOutsideClick(state, refs, actions);
    usePCCloseSettingsOnEscape(state, actions);

    // 移动端面板触摸活动追踪（重置自动关闭计时器）
    useEffect(() => {
        const el = mobileSettingsPanelRef.current;
        if (!el) return;
        const handleTouchMove = () => { player.onSettingsPanelMouseMove?.(); };
        el.addEventListener('touchmove', handleTouchMove, true);
        return () => { el.removeEventListener('touchmove', handleTouchMove, true); };
    });

    // PC面板点击活动追踪（重置自动关闭计时器）
    // 使用 capture 阶段原生事件，确保在 React stopPropagation 之前捕获点击
    useEffect(() => {
        const el = pcSettingsPanelRef.current;
        if (!el) return;
        const handleClick = () => { player.onSettingsPanelClick?.(); };
        el.addEventListener('click', handleClick, true);
        return () => { el.removeEventListener('click', handleClick, true); };
    });

    // 移动端交互规则
    const { handleTouchStart: handleMobileTouchStart, handleTouchEnd: handleMobileTouchEnd } = useMobileVideoTouch(refs, actions, state);
    const handleMobileSettingsToggle = useMobileSettingsToggle(state, actions);
    const handleMobileCloseSettingsOnBackdrop = useMobileCloseSettingsOnBackdrop(actions);

    // 通用交互规则
    useAutoHideControls(state, refs, actions);
    useKeepControlsVisibleWhenSettingsOpen(state, actions);
    useCleanupTimers(refs);

    // 容器触摸事件处理（合并手势和控制逻辑）
    const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
        handleTouchStart(e);
        handleMobileTouchStart(e);
    }, [handleTouchStart, handleMobileTouchStart]);

    const handleContainerTouchEnd = useCallback((e: React.TouchEvent) => {
        handleMobileTouchEnd(e);
    }, [handleMobileTouchEnd]);

    if (isEmbed) {
        return (
            <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                <iframe
                    src={url}
                    className="w-full h-full border-none"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative w-full aspect-video bg-black select-none group rounded-xl",
                !isHovering && isPlaying && "cursor-none",
                showSettings ? "overflow-visible" : "overflow-hidden"
            )}
            onMouseEnter={handlePCMouseEnter}
            onMouseLeave={handlePCMouseLeave}
            onMouseMove={handlePCMouseMove}
            onTouchStart={handleContainerTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleContainerTouchEnd}
            onClick={handlePCVideoClick}
            onDoubleClick={handlePCVideoDoubleClick}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                poster={poster}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                muted={isMuted}
                style={{ transform: `scale(${videoScale})`, transformOrigin: 'center center' }}
            />

            {/* Loading Spinner - z-30 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 pointer-events-none">
                    <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                </div>
            )}

            {/* Buffering Spinner - z-10 */}
            {isBuffering && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
                </div>
            )}

            {/* Center Play Icon - z-15 */}
            {!isPlaying && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
                    <Play className="w-20 h-20 text-white/60 drop-shadow-lg" />
                </div>
            )}

            {/* Gesture HUD - z-50 */}
            {gestureHUD.visible && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex flex-col items-center gap-1 shadow-2xl border border-white/10">
                        {gestureHUD.icon === 'volume' && <Volume2 className="w-8 h-8 text-white" />}
                        {gestureHUD.icon === 'brightness' && <Sun className="w-8 h-8 text-yellow-400" />}
                        {gestureHUD.icon === 'seek' && <FastForward className="w-8 h-8 text-indigo-400" />}
                        <span className="text-white text-base font-bold font-mono">{gestureHUD.value}</span>
                    </div>
                </div>
            )}

            {/* Brightness Overlay - z-5 */}
            {brightness !== 100 && (
                <div className="absolute inset-0 pointer-events-none z-[5]" style={{ backgroundColor: `rgba(0,0,0,${1 - brightness / 100})` }} />
            )}

            {/* Toast - z-50 */}
            {toast.visible && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all">
                    <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm shadow-2xl border border-white/10">
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Controls - z-20 */}
            <div
                className={cn(
                    "absolute inset-0 transition-opacity duration-300 z-20",
                    isHovering || !isPlaying || showSettings ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onMouseMove={handlePCControlsHover}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
            >
                <VideoControls
                    player={player}
                    url={url}
                    title={title}
                    onPrevEpisode={onPrevEpisode}
                    onNextEpisode={onNextEpisode}
                    hasPrevEpisode={hasPrevEpisode}
                    hasNextEpisode={hasNextEpisode}
                    onSettingsToggle={handleMobileSettingsToggle}
                    onPCSettingsToggle={handlePCSettingsToggle}
                />
            </div>

            {/* PC端设置面板 - z-[100] 独立渲染 */}
            {showSettings && (
                <div
                    ref={pcSettingsPanelRef}
                    className="hidden md:block absolute bottom-16 right-4 z-[100]"
                    onMouseMove={() => {
                        handlePCControlsHover();
                        player.onSettingsPanelMouseMove?.();
                    }}
                >
                    <PlayerSettingsPanel
                        player={player}
                        onClose={() => setShowSettings(false)}
                    />
                </div>
            )}

            {/* 移动端设置面板 - z-[100] 独立渲染 */}
            {showSettings && (
                <div
                    ref={mobileSettingsPanelRef}
                    className="fixed inset-0 z-[100] flex items-end justify-center md:hidden"
                    onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopPropagation(); }}
                    onTouchMove={handlePCControlsHover}
                >
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                        onClick={handleMobileCloseSettingsOnBackdrop}
                    />
                    <div
                        className="relative z-10 w-full max-w-lg animate-in slide-in-from-bottom duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PlayerSettingsPanel
                            player={player}
                            onClose={() => setShowSettings(false)}
                            className="max-h-[80vh] overflow-y-auto w-full rounded-t-xl rounded-b-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
