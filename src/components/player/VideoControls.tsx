'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX, Unlock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/player-utils';
import { CONFIG } from '@/config/config';
import VideoProgressBar from './VideoProgressBar';
import EpisodeControls from './EpisodeControls';
import ControlButtons from './ControlButtons';
import PlayerSettingsPanel from './PlayerSettingsPanel';

interface VideoControlsProps {
    controlsApi: {
        isPlaying: boolean;
        togglePlay: () => void;
        toggleMute: () => void;
        isMuted: boolean;
        volume: number;
        handleVolumeChange: (v: number) => void;
        duration: number;
        videoRef: React.RefObject<HTMLVideoElement | null>;
        isLocked: boolean;
        handleLock: () => void;
        handleUnlock: () => void;
        showSettings: boolean;
        setShowSettings: (v: boolean) => void;
    };
    progressApi: {
        progress: number;
        duration: number;
        buffered: number;
        isDragging: boolean;
        dragProgress: number;
        progressBarRef: React.RefObject<HTMLDivElement | null>;
        handleSeekStart: (e: React.TouchEvent | React.MouseEvent) => void;
        handleSeekMove: (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => void;
        handleSeekEnd: () => void;
        handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    };
    settingsApi: {
        currentLevel: number;
        levels: { height: number; index: number }[];
        activeLevelIdx: number;
        playbackRate: number;
        handleRateChange: (rate: number) => void;
        videoScale: number;
        handleScaleChange: (scale: number) => void;
        maxBufferLength: number;
        handleBufferChange: (buf: number) => void;
        handleResolutionChange: (idx: number) => void;
        skipIntroTime: React.RefObject<number>;
        handleSkipIntroChange: (seconds: number) => void;
    };
    buttonsApi: {
        showSettings: boolean;
        setShowSettings: (v: boolean) => void;
        toggleFullscreen: () => void;
        toggleWebFullscreen: () => void;
        isWebFullscreen: boolean;
    };
    url: string;
    title?: string;
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
}

const VideoControls = React.memo(function VideoControls({
    controlsApi, progressApi, settingsApi, buttonsApi, url, title,
    onPrevEpisode, onNextEpisode, hasPrevEpisode, hasNextEpisode,
}: VideoControlsProps) {
    const { isPlaying, togglePlay, toggleMute, isMuted, volume, handleVolumeChange, duration, videoRef, isLocked, handleLock, handleUnlock, showSettings, setShowSettings } = controlsApi;

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

            {/* Mobile Lock Button */}
            <div className="absolute top-4 right-4 pointer-events-auto z-30">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isLocked) handleUnlock(); else handleLock();
                    }}
                    className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white active:scale-95 transition-all"
                    title={isLocked ? "Unlock" : "Lock"}
                >
                    {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-[18px] h-[18px]" />}
                </button>
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
                        <VideoProgressBar progressApi={progressApi} variant="mobile" />
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-0.5 min-w-0">
                            <ControlButtons buttonsApi={buttonsApi} variant="mobile" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <EpisodeControls onPrevEpisode={onPrevEpisode} onNextEpisode={onNextEpisode} hasPrevEpisode={hasPrevEpisode} hasNextEpisode={hasNextEpisode} variant="mobile" />
                            <button
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); togglePlay(); }}
                                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-full text-white active:scale-90 transition-all"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white translate-x-px" />}
                            </button>
                            <button
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); }}
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all"
                            >
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                            </button>
                        </div>
                    </div>
                    <div className="text-white/60 text-[10px] text-center font-mono -mt-0.5">
                        {formatTime(duration * (progressApi.progress / 100))} / {formatTime(duration)}
                    </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:flex flex-col p-4 pb-3 gap-1">
                    <VideoProgressBar progressApi={progressApi} variant="desktop" />
                    <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-1.5 hover:text-indigo-400 active:scale-90 transition-all" title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white translate-x-px" />}
                        </button>
                        <div className="group flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="p-1 hover:text-indigo-400 transition-colors">
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                            </button>
                            <input
                                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                                onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                                className="w-0 group-hover:w-24 focus:w-24 transition-all duration-200 accent-indigo-400 cursor-pointer h-1"
                            />
                        </div>
                        <span className="text-white/90 text-xs font-mono select-none tabular-nums min-w-[7rem]">
                            {formatTime(duration * (progressApi.progress / 100))} / {formatTime(duration)}
                        </span>
                        <div className="flex-1" />
                        <EpisodeControls onPrevEpisode={onPrevEpisode} onNextEpisode={onNextEpisode} hasPrevEpisode={hasPrevEpisode} hasNextEpisode={hasNextEpisode} variant="desktop" />
                        <ControlButtons buttonsApi={buttonsApi} variant="desktop" />
                        {showSettings && (
                            <PlayerSettingsPanel settingsApi={settingsApi} onClose={() => setShowSettings(false)} className="absolute bottom-full right-4 mb-4" />
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Settings Panel */}
            {showSettings && (
                <div className="md:hidden">
                    <PlayerSettingsPanel settingsApi={settingsApi} onClose={() => setShowSettings(false)} className="absolute bottom-full right-2 mb-2" />
                </div>
            )}
        </>
    );
});

export default VideoControls;
