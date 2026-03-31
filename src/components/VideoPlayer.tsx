'use client';

import { Loader2, Play, Pause, Sun, Volume2, FastForward } from 'lucide-react';
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
        videoRef,
        containerRef,
        isPlaying,
        isLoading,
        isBuffering,
        isHovering,
        handleVideoClick,
        handleMouseMove,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        isLocked,
        isEmbed,
        brightness,
        gestureHUD,
        toast,
        videoScale
    } = player;


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
            className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group touch-none select-none"
            onMouseEnter={() => !isLocked && player.setIsHovering(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => !isLocked && player.setIsHovering(false)}
            onClick={handleVideoClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Main Video Wrapper for Scaling */}
            <div
                className="w-full h-full absolute inset-0 bg-black flex items-center justify-center transition-transform duration-200 ease-out"
                style={{
                    transform: `scale(${videoScale})`
                }}
            >
                <video
                    ref={videoRef}
                    poster={poster}
                    className="w-full h-full object-contain"
                    playsInline
                    webkit-playsinline="true"
                    x5-playsinline="true"
                    x5-video-player-type="h5"
                    x5-video-player-fullscreen="true"
                    crossOrigin="anonymous"
                    style={{
                        filter: `brightness(${brightness}%)`
                    }}
                    preload="auto"
                    suppressHydrationWarning
                />
            </div>

            {/* Brightness Overlay Removed - using CSS filter instead */}

            {/* Gesture HUD */}
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-200 pointer-events-none",
                gestureHUD.visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
            )}>
                <div className={cn(
                    "flex flex-col items-center gap-2 min-w-[120px]",
                    gestureHUD.icon === 'seek'
                        ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        : "bg-black/60 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10"
                )}>
                    {gestureHUD.icon === 'volume' && <Volume2 className="w-8 h-8 text-white" />}
                    {gestureHUD.icon === 'brightness' && <Sun className="w-8 h-8 text-white" />}
                    {gestureHUD.icon === 'seek' && <FastForward className="w-10 h-10 text-white fill-white/20 animate-pulse" />}
                    <span className="text-white font-bold text-lg">{gestureHUD.value}</span>
                </div>
            </div>

            {/* Loading / Buffering Spinner */}
            {(isLoading || isBuffering) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none gap-4">
                    {/* Clean loading state without background box */}
                    <div className="flex flex-col items-center gap-3 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                        <span className="text-white font-medium text-sm tracking-widest animate-pulse text-shadow-sm">
                            {isLoading ? '正在加载...' : '正在缓冲...'}
                        </span>
                    </div>
                </div>
            )}

            {/* Controls Layer */}
            <div className={cn(
                "absolute inset-0 z-20 flex flex-col justify-end transition-opacity duration-300 pointer-events-none",
                (isHovering || !isPlaying) ? "opacity-100 visible" : "opacity-0 invisible"
            )}>
                {/* Center play/pause button (Visible when config enabled AND HUD is active) */}
                {(CONFIG.SHOW_CENTER_PLAY_BUTTON === 1 && !isLoading && !isBuffering) && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                        <button
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                player.togglePlay();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                player.togglePlay();
                            }}
                            className="bg-black/40 hover:bg-black/60 text-white p-5 rounded-full backdrop-blur-md border border-white/10 transition-all hover:scale-110 active:scale-95 shadow-2xl"
                        >
                            {isPlaying ? <Pause className="w-10 h-10 fill-white" /> : <Play className="w-10 h-10 fill-white ml-1" />}
                        </button>
                    </div>
                )}

                {/* Bottom Controls */}
                {!isEmbed && (
                    <VideoControls
                        player={player}
                        url={url}
                        title={title}
                        onPrevEpisode={onPrevEpisode}
                        onNextEpisode={onNextEpisode}
                        hasPrevEpisode={hasPrevEpisode}
                        hasNextEpisode={hasNextEpisode}
                    />
                )}
            </div>

            {/* Toast Alerts */}
            {toast.visible && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 text-white px-6 py-2.5 rounded-full text-sm font-medium shadow-2xl">
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
