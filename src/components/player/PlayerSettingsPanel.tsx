
import React from 'react';
import { Settings, Gauge, ZoomIn, X, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface PlayerSettingsPanelProps {
    player: PlayerState;
    onClose: () => void;
    className?: string;
}

export default function PlayerSettingsPanel({ player, onClose, className }: PlayerSettingsPanelProps) {
    const {
        currentLevel,
        levels,
        activeLevelIdx,
        playbackRate,
        handleRateChange,
        videoScale,
        handleScaleChange,
        maxBufferLength,
        handleBufferChange,
        handleResolutionChange,
        skipIntroTime,
        handleSkipIntroChange,
    } = player;

    return (
        <div className={cn("bg-slate-900 rounded-lg p-4 shadow-xl border border-white/10 text-left", className)}>
            {/* Panel Header with Close Button */}
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <span className="text-sm font-bold text-white">播放设置</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
            </div>

            {/* Resolution Selection */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">分辨率 / 自动</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleResolutionChange(-1)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs transition-all border",
                            currentLevel === -1
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white"
                        )}
                    >
                        自动 {currentLevel === -1 && levels[activeLevelIdx] && `(${levels[activeLevelIdx].height}p)`}
                    </button>
                    {levels.map((level) => (
                        <button
                            key={level.index}
                            onClick={() => handleResolutionChange(level.index)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs transition-all border flex items-center gap-1",
                                currentLevel === level.index
                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white"
                            )}
                        >
                            {level.height}p
                            {level.height >= 720 && <span className="text-[8px] bg-red-600 px-1 rounded-sm leading-tight">HD</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Playback Speed */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <Gauge className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">播放速度</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {[0.75, 1, 1.5, 2, 3].map(rate => (
                        <button
                            key={rate}
                            onClick={() => handleRateChange(rate)}
                            className={cn(
                                "px-1 py-1.5 rounded text-xs transition-all border",
                                playbackRate === rate
                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                            )}
                        >
                            {rate}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Video Scale */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <ZoomIn className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">画面缩放</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {[1, 1.25, 1.5, 2, 3].map(scale => (
                        <button
                            key={scale}
                            onClick={() => handleScaleChange(scale)}
                            className={cn(
                                "px-1 py-1.5 rounded text-xs transition-all border",
                                videoScale === scale
                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                            )}
                        >
                            {scale}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Buffer Depth */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">缓存深度 (秒)</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {[10, 30, 60, 120, 180].map(buf => (
                        <button
                            key={buf}
                            onClick={() => handleBufferChange(buf)}
                            className={cn(
                                "px-1 py-1.5 rounded text-xs transition-all border",
                                maxBufferLength === buf
                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                            )}
                        >
                            {buf}s
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500 italic">增加缓存可减少网络卡顿，但会增加启动耗时</p>
            </div>

            {/* Skip Intro Settings */}
            <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FastForward className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">跳过片头</span>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1 border border-white/5">
                        <button
                            onClick={() => handleSkipIntroChange(skipIntroTime - 10)}
                            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
                            disabled={skipIntroTime <= 0}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xs font-mono text-white min-w-[32px] text-center">
                            {skipIntroTime}s
                        </span>
                        <button
                            onClick={() => handleSkipIntroChange(skipIntroTime + 10)}
                            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 italic">设置后下个视频生效，关闭浏览器后重置</p>
            </div>
        </div>
    );
}
