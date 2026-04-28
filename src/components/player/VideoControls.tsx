'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { CONFIG } from '@/config/config';
import VideoProgressBar from './VideoProgressBar';
import EpisodeControls from './EpisodeControls';
import ControlButtons from './ControlButtons';
import PlayerSettingsPanel from './PlayerSettingsPanel';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface VideoControlsProps {
    player: PlayerState;
    url: string;
    title?: string;
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
}

const VideoControls = React.memo(function VideoControls({
    player,
    url,
    title,
    onPrevEpisode,
    onNextEpisode,
    hasPrevEpisode,
    hasNextEpisode
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
        videoRef,
        progress,
        showSettings,
        setShowSettings,
    } = player;

    return (
        <>
            {/* Top Overlay Gradient */}
            <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300">
                {CONFIG.SHOW_EPISODE_TITLE_OVERLAY && title && (
                    <h2 className="text-white text-base md:text-lg font-medium drop-shadow-md select-text pointer-events-auto truncate max-w-[calc(100%-3rem)] md:max-w-[60%] pr-2">
                        {title}
                    </h2>
                )}
            </div>


            {/* Center Play Button */}
            {CONFIG.SHOW_CENTER_PLAY_BUTTON === 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <button
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            togglePlay();
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePlay();
                        }}
                        className={cn(
                            "pointer-events-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-xl",
                            "flex items-center justify-center active:scale-90 transition-all"
                        )}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8 md:w-10 md:h-10 fill-white" />
                        ) : (
                            <Play className="w-8 h-8 md:w-10 md:h-10 fill-white translate-x-0.5" />
                        )}
                    </button>
                </div>
            )}

            {/* Bottom Controls */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 transition-opacity duration-300 z-20",
                showSettings ? "" : "bg-gradient-to-t from-black/70 to-transparent"
            )}>
                {/* Mobile layout */}
                <div className="flex md:hidden flex-col p-2 pb-3 gap-0.5">
                    <div className="px-1">
                        <VideoProgressBar player={player} url={url} variant="mobile" />
                    </div>
                    <div className="flex items-center justify-between text-white gap-1 h-10">
                        <div className="flex items-center gap-1 shrink-0 min-w-0">
                            <button
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    togglePlay();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePlay();
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-transform shrink-0"
                            >
                                {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
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
                                onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleMute();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMute();
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-transform shrink-0"
                                title={isMuted ? "取消静音" : "静音"}
                            >
                                {isMuted ? <VolumeX className="w-5 h-5 text-indigo-400" /> : <Volume2 className="w-5 h-5 text-white" />}
                            </button>

                            <span className="text-[10px] font-mono whitespace-nowrap opacity-80 ml-1 shrink-0">
                                {formatTime(duration * (progress / 100))} / {formatTime(duration)}
                            </span>
                        </div>

                        <div className="flex items-center shrink-0">
                            <ControlButtons player={player} variant="mobile" />
                        </div>
                    </div>

                    {/* Mobile Settings Modal */}
                    {showSettings && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                                onClick={() => setShowSettings(false)}
                            />
                            <div
                                className="relative z-10 w-full max-w-xs animate-in zoom-in-95 duration-200"
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <PlayerSettingsPanel
                                    player={player}
                                    onClose={() => setShowSettings(false)}
                                    className="max-h-[80vh] overflow-y-auto w-full"
                                />
                            </div>
                        </div>
                    )}
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
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMute();
                                }}
                                className="hover:scale-110 transition-transform"
                            >
                                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                            <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 flex items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={(e) => {
                                        handleVolumeChange(parseFloat(e.target.value));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 accent-white"
                                />
                            </div>
                        </div>

                        <span className="text-sm font-medium font-sans opacity-90">
                            {formatTime(duration * (progress / 100))} <span className="text-white/50 text-xs mx-1">/</span> {formatTime(duration)}
                        </span>

                        <div className="flex-1" />

                        <ControlButtons player={player} variant="desktop" />
                    </div>
                </div>
            </div>
        </>
    );
});

VideoControls.displayName = 'VideoControls';

export default VideoControls;