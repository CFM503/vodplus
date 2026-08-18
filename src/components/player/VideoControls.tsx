'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { CONFIG } from '@/config/config';
import VideoProgressBar from './VideoProgressBar';
import EpisodeControls from './EpisodeControls';
import ControlButtons from './ControlButtons';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface VideoControlsProps {
    player: PlayerState;
    url: string;
    title?: string;
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
    onSettingsToggle?: (e: React.TouchEvent | React.MouseEvent) => void;
    onPCSettingsToggle?: (e: React.MouseEvent | React.TouchEvent) => void;
}

const stopEvent = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
};

const VideoControls = React.memo(function VideoControls({
    player,
    url,
    title,
    onPrevEpisode,
    onNextEpisode,
    hasPrevEpisode,
    hasNextEpisode,
    onSettingsToggle,
    onPCSettingsToggle,
}: VideoControlsProps) {
    const {
        isPlaying,
        togglePlay,
        toggleMute,
        isMuted,
        volume,
        handleVolumeChange,
        duration,
        formatTime,
        progress,
        showSettings,
    } = player;

    return (
        <div className="flex flex-col h-full pointer-events-none">
            {/* Top Overlay Gradient */}
            <div
                className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                {CONFIG.SHOW_EPISODE_TITLE_OVERLAY && title && (
                    <h2 className="text-white text-base md:text-lg font-medium drop-shadow-md select-text truncate max-w-[calc(100%-3rem)] md:max-w-[60%] pr-2">
                        {title}
                    </h2>
                )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom Controls */}
            <div
                className={cn(
                    "relative pointer-events-auto",
                    showSettings ? "" : "bg-gradient-to-t from-black/70 to-transparent"
                )}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                {/* Mobile layout */}
                <div className="flex md:hidden flex-col px-2 pb-2.5 pt-1 gap-1">
                    <div className="px-0.5">
                        <VideoProgressBar player={player} url={url} variant="mobile" />
                    </div>
                    <div className="flex items-center justify-between text-white gap-1 h-9">
                        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1 overflow-hidden">
                            <button
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                className="p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-transform shrink-0"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                            </button>

                            <EpisodeControls
                                onPrevEpisode={onPrevEpisode}
                                onNextEpisode={onNextEpisode}
                                hasPrevEpisode={hasPrevEpisode}
                                hasNextEpisode={hasNextEpisode}
                                variant="mobile"
                            />

                            <button
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                className="p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-transform shrink-0"
                                title={isMuted ? "取消静音" : "静音"}
                            >
                                {isMuted ? <VolumeX className="w-4 h-4 text-indigo-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                            </button>

                            <span className="text-[10px] sm:text-xs font-mono whitespace-nowrap opacity-80 ml-1 shrink min-w-0 truncate">
                                {formatTime(duration * (progress / 100))} / {formatTime(duration)}
                            </span>
                        </div>

                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">
                            <ControlButtons player={player} variant="mobile" onSettingsToggle={onSettingsToggle} />
                        </div>
                    </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:flex flex-col p-4 pb-3 gap-1">
                    <VideoProgressBar player={player} url={url} variant="desktop" />
                    <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-1.5 hover:text-indigo-400 active:scale-90 transition-all" title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white translate-x-px" />}
                        </button>

                        <EpisodeControls
                            onPrevEpisode={onPrevEpisode}
                            onNextEpisode={onNextEpisode}
                            hasPrevEpisode={hasPrevEpisode}
                            hasNextEpisode={hasNextEpisode}
                            variant="desktop"
                        />

                        {/* Volume Slider */}
                        <div className="flex items-center gap-2 group/volume relative">
                            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="hover:scale-110 transition-transform">
                                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                            <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 flex items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                    onClick={stopEvent}
                                    className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 accent-white"
                                />
                            </div>
                        </div>

                        <span className="text-sm font-medium font-sans opacity-90">
                            {formatTime(duration * (progress / 100))} <span className="text-white/50 text-xs mx-1">/</span> {formatTime(duration)}
                        </span>

                        <div className="flex-1" />

                        <ControlButtons player={player} variant="desktop" onSettingsToggle={onPCSettingsToggle} />
                    </div>
                </div>
            </div>
        </div>
    );
});

VideoControls.displayName = 'VideoControls';

export default VideoControls;
