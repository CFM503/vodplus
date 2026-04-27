'use client';

import { useMemo } from 'react';
import { Loader2, Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import VideoControls from '@/components/player/VideoControls';
import { CONFIG } from '@/config/config';

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
        handleVideoClick, handleMouseMove, handleTouchStart, handleTouchMove,
        handleTouchEnd, isLocked, isEmbed, brightness, gestureHUD, toast, videoScale,
        isMuted, togglePlay, showSettings,
    } = player;

    // Memoized subset APIs for child components
    const controlsApi = useMemo(() => ({
        isPlaying: player.isPlaying,
        togglePlay: player.togglePlay,
        toggleMute: player.toggleMute,
        isMuted: player.isMuted,
        volume: player.volume,
        handleVolumeChange: player.handleVolumeChange,
        duration: player.duration,
        videoRef: player.videoRef,
        isLocked: player.isLocked,
        handleLock: player.handleLock,
        handleUnlock: player.handleUnlock,
        showSettings: player.showSettings,
        setShowSettings: player.setShowSettings,
    }), [player.isPlaying, player.togglePlay, player.toggleMute, player.isMuted,
        player.volume, player.handleVolumeChange, player.duration,
        player.isLocked, player.handleLock, player.handleUnlock,
        player.showSettings, player.setShowSettings]);

    const progressApi = useMemo(() => ({
        progress: player.progress,
        duration: player.duration,
        buffered: player.buffered,
        isDragging: player.isDragging,
        dragProgress: player.dragProgress,
        progressBarRef: player.progressBarRef,
        handleSeekStart: player.handleSeekStart,
        handleSeekMove: player.handleSeekMove,
        handleSeekEnd: player.handleSeekEnd,
        handleProgressClick: player.handleProgressClick,
    }), [player.progress, player.duration, player.buffered, player.isDragging,
        player.dragProgress, player.handleSeekStart, player.handleSeekMove,
        player.handleSeekEnd, player.handleProgressClick]);

    const settingsApi = useMemo(() => ({
        currentLevel: player.currentLevel,
        levels: player.levels,
        activeLevelIdx: player.activeLevelIdx,
        playbackRate: player.playbackRate,
        handleRateChange: player.handleRateChange,
        videoScale: player.videoScale,
        handleScaleChange: player.handleScaleChange,
        maxBufferLength: player.maxBufferLength,
        handleBufferChange: player.handleBufferChange,
        handleResolutionChange: player.handleResolutionChange,
        skipIntroTime: player.skipIntroTime,
        handleSkipIntroChange: player.handleSkipIntroChange,
    }), [player.currentLevel, player.levels, player.activeLevelIdx,
        player.playbackRate, player.handleRateChange, player.videoScale,
        player.handleScaleChange, player.maxBufferLength, player.handleBufferChange,
        player.handleResolutionChange, player.handleSkipIntroChange]);

    const buttonsApi = useMemo(() => ({
        showSettings: player.showSettings,
        setShowSettings: player.setShowSettings,
        toggleFullscreen: player.toggleFullscreen,
        toggleWebFullscreen: player.toggleWebFullscreen,
        isWebFullscreen: player.isWebFullscreen,
    }), [player.showSettings, player.setShowSettings, player.toggleFullscreen,
        player.toggleWebFullscreen, player.isWebFullscreen]);

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
            className="relative w-full aspect-video bg-black select-none group rounded-xl overflow-hidden"
            onMouseEnter={() => player.setIsHovering(true)}
            onMouseLeave={() => player.setIsHovering(false)}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
                if (!showSettings) {
                    togglePlay();
                }
            }} onDoubleClick={(e) => {
                if (!showSettings) {
                    handleVideoClick(e);
                }
            }}
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
                style={!isLocked ? { transform: `scale(${videoScale})`, transformOrigin: 'center center' } : undefined}
            />

            {/* Loading Spinner */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                    <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                </div>
            )}

            {/* Buffering Spinner */}
            {isBuffering && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
                </div>
            )}

            {/* Single Click Overlay for Mobile (shown when controls hidden) */}
            <div className="absolute inset-0 pointer-events-none z-5">
                {!isHovering && !isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Play className="w-20 h-20 text-white/60 drop-shadow-lg" />
                    </div>
                )}
            </div>

            {/* Gesture HUD */}
            {gestureHUD.visible && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 flex flex-col items-center gap-1 shadow-2xl border border-white/10">
                        {gestureHUD.icon === 'volume' && <Volume2 className="w-8 h-8 text-white" />}
                        {gestureHUD.icon === 'brightness' && <Volume2 className="w-8 h-8 text-yellow-400" />}
                        {gestureHUD.icon === 'seek' && <Volume2 className="w-8 h-8 text-indigo-400" />}
                        <span className="text-white text-base font-bold font-mono">{gestureHUD.value}</span>
                    </div>
                </div>
            )}

            {/* Brightness Overlay */}
            {brightness !== 100 && (
                <div className="absolute inset-0 pointer-events-none z-[5]" style={{ backgroundColor: `rgba(0,0,0,${1 - brightness / 100})` }} />
            )}

            {/* Toast */}
            {toast.visible && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all">
                    <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm shadow-2xl border border-white/10">
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Controls (conditionally rendered but always mounted when video is playing) */}
            {isHovering && (
                <VideoControls
                    controlsApi={controlsApi}
                    progressApi={progressApi}
                    settingsApi={settingsApi}
                    buttonsApi={buttonsApi}
                    url={url}
                    title={title}
                    onPrevEpisode={onPrevEpisode}
                    onNextEpisode={onNextEpisode}
                    hasPrevEpisode={hasPrevEpisode}
                    hasNextEpisode={hasNextEpisode}
                />
            )}
        </div>
    );
}
