import React, { useState, useEffect } from 'react';
import { Settings, Gauge, ZoomIn, X, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsPanelApi {
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
}

interface PlayerSettingsPanelProps {
    settingsApi: SettingsPanelApi;
    onClose: () => void;
    className?: string;
}

export default function PlayerSettingsPanel({ settingsApi, onClose, className }: PlayerSettingsPanelProps) {
    const {
        currentLevel, levels, activeLevelIdx, playbackRate, handleRateChange,
        videoScale, handleScaleChange, maxBufferLength, handleBufferChange,
        handleResolutionChange, skipIntroTime, handleSkipIntroChange,
    } = settingsApi;

    // Local state for skip intro time display, initialized from ref
    const [localSkipTime, setLocalSkipTime] = useState(() => skipIntroTime.current);

    const onSkipChange = (delta: number) => {
        const next = Math.max(0, localSkipTime + delta);
        setLocalSkipTime(next);
        handleSkipIntroChange(next);
    };
    
    // Sync local state when ref changes (e.g., from session storage)
    useEffect(() => {
        setLocalSkipTime(skipIntroTime.current);
    }, [skipIntroTime.current]);

    return (
        <div className={cn("bg-slate-900 rounded-lg p-4 shadow-xl border border-white/10 text-left", className)}>
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <span className="text-sm font-bold text-white">播放设置</span>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
            </div>

            {/* Resolution Selection */}
            {levels.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                        <Settings className="w-3.5 h-3.5" />
                        <span>清晰度</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => handleResolutionChange(-1)}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-md transition-all",
                                currentLevel === -1 ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                            )}
                        >
                            自动
                        </button>
                        {levels.map((level) => (
                            <button
                                key={level.index}
                                onClick={() => handleResolutionChange(level.index)}
                                className={cn(
                                    "px-3 py-1.5 text-xs rounded-md transition-all",
                                    activeLevelIdx === level.index
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white/10 text-slate-300 hover:bg-white/20"
                                )}
                            >
                                {level.height}p
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Playback Speed */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>播放速度</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {[0.75, 1, 1.25, 1.5, 2, 3].map((rate) => (
                        <button
                            key={rate}
                            onClick={() => handleRateChange(rate)}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-md transition-all",
                                playbackRate === rate ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                            )}
                        >
                            {rate}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Video Zoom */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>画面缩放</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {[1, 1.5, 2, 3].map((scale) => (
                        <button
                            key={scale}
                            onClick={() => handleScaleChange(scale)}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-md transition-all",
                                videoScale === scale ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                            )}
                        >
                            {scale}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Buffer Strategy */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <span>缓存策略</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { label: '10s', value: 10 },
                        { label: '30s', value: 30 },
                        { label: '60s', value: 60 },
                        { label: '120s', value: 120 },
                        { label: '180s', value: 180 },
                    ].map(({ label, value }) => (
                        <button
                            key={value}
                            onClick={() => handleBufferChange(value)}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-md transition-all",
                                maxBufferLength === value ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Skip Intro */}
            <div>
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <FastForward className="w-3.5 h-3.5" />
                    <span>跳过片头</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onSkipChange(-10)}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                        title="-10s"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-300" />
                    </button>
                    <span className="text-white text-sm font-mono min-w-[4rem] text-center select-none">
                        {localSkipTime}s
                    </span>
                    <button
                        onClick={() => onSkipChange(10)}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                        title="+10s"
                    >
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                    </button>
                </div>
            </div>
        </div>
    );
}
