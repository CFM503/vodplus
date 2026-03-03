'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX, Unlock, Lock } from 'lucide-react';
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
    title?: string; // Add title prop
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
        isLocked,
        handleLock,
        handleUnlock,
        showSettings,
        setShowSettings,
    } = player;

    return (
        <>
            {/* Top Overlay Gradient (Title & Mobile Lock) */}
            <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300">
                {/* Title Display */}
                {CONFIG.SHOW_EPISODE_TITLE_OVERLAY && title && (
                    <h2 className="text-white text-base md:text-lg font-medium drop-shadow-md select-text pointer-events-auto truncate max-w-[calc(100%-3rem)] md:max-w-[60%] pr-2">
                        {title}
                    </h2>
                )}
            </div>

            {/* Mobile-only Lock Button (Top Right) */}
            <div
                className="absolute top-4 right-4 z-20 pointer-events-auto md:hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        isLocked ? handleUnlock() : handleLock();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        isLocked ? handleUnlock() : handleLock();
                    }}
                    className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors backdrop-blur-md active:scale-90"
                    title={isLocked ? "解锁旋转" : "锁定旋转"}
                >
                    {isLocked ? <Lock className="w-5 h-5 text-indigo-400" /> : <Unlock className="w-5 h-5 text-white" />}
                </button>
            </div>


            {/* Desktop Controls (Standard Row) */}
            <div
                className="hidden md:flex flex-col absolute bottom-0 left-0 right-0 pointer-events-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent cursor-default"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                {/* Progress Bar - Full Width Container */}
                <div className="w-full px-2 group/controls transition-all duration-300 ease-out">
                    {/* YouTube renders the bar almost full width, with slight padding sometimes, or fully flush. 
                        Let's use px-2 to avoid edge clicks being difficult, but keep it stable.
                    */}
                    <VideoProgressBar player={player} url={url} variant="desktop" className="transform translate-y-1 z-50" />
                </div>

                {/* Control Icons Row */}
                <div className="flex items-center justify-between text-white px-4 pb-3 pt-2">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                togglePlay();
                            }}
                            className="hover:scale-110 transition-transform p-1"
                        >
                            {isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white" />}
                        </button>

                        <EpisodeControls
                            onPrevEpisode={onPrevEpisode}
                            onNextEpisode={onNextEpisode}
                            hasPrevEpisode={hasPrevEpisode}
                            hasNextEpisode={hasNextEpisode}
                            variant="desktop"
                        />

                        {/* Volume Slider (Desktop Only) */}
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
                            {formatTime(videoRef.current?.currentTime || 0)} <span className="text-white/50 text-xs mx-1">/</span> {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <ControlButtons player={player} variant="desktop" />
                    </div>
                </div>
            </div>

            {/* Mobile Controls (Responsive Layout) */}
            <div
                className="md:hidden absolute bottom-0 left-0 right-0 p-3 pb-safe pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3 transition-transform duration-300"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
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
                            {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
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
        </>
    );
});

VideoControls.displayName = 'VideoControls';

export default VideoControls;
