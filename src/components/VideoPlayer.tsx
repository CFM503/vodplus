'use client';

import { useRef } from 'react';
import { Loader2, Play, Volume2, Sun, FastForward } from 'lucide-react';
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
        handleMouseMove, handleTouchStart, handleTouchMove,
        handleTouchEnd, isEmbed, brightness, gestureHUD, toast, videoScale,
        isMuted, togglePlay, showSettings,
    } = player;

    // Ref to suppress synthetic click/dblclick events originating from touch
    const touchEndTimeRef = useRef(0);

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
                "relative w-full aspect-video bg-black select-none group rounded-xl overflow-hidden",
                !isHovering && isPlaying && "cursor-none"
            )}
            onMouseEnter={() => player.setIsHovering(true)}
            onMouseLeave={() => player.setIsHovering(false)}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => {
                touchEndTimeRef.current = Date.now();
                handleTouchEnd(e);
            }}
            onClick={() => {
                // 移动端的点击由 touch 事件链处理，这里只响应 PC 端鼠标点击
                if (Date.now() - touchEndTimeRef.current < 500) return;
                if (!showSettings) {
                    togglePlay();
                }
            }}
            onDoubleClick={() => {
                if (Date.now() - touchEndTimeRef.current < 500) return;
                if (!showSettings) {
                    player.toggleFullscreen();
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
                style={{ transform: `scale(${videoScale})`, transformOrigin: 'center center' }}
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
                        {gestureHUD.icon === 'brightness' && <Sun className="w-8 h-8 text-yellow-400" />}
                        {gestureHUD.icon === 'seek' && <FastForward className="w-8 h-8 text-indigo-400" />}
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

            {/* Controls — fade in/out with smooth transition */}
            <div
                className={cn(
                    "transition-opacity duration-300",
                    isHovering || !isPlaying || showSettings ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            >
                <VideoControls
                    player={player}
                    url={url}
                    title={title}
                    onPrevEpisode={onPrevEpisode}
                    onNextEpisode={onNextEpisode}
                    hasPrevEpisode={hasPrevEpisode}
                    hasNextEpisode={hasNextEpisode}
                />
            </div>
        </div>
    );
}
