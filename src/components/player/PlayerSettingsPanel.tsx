import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Settings, Gauge, ZoomIn, FastForward, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeFitHeightScale } from '@/lib/player-utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface PlayerSettingsPanelProps {
    player: PlayerState;
    onClose: () => void;
    className?: string;
}

type SubMenuType = 'quality' | 'speed' | 'scale' | 'buffer' | 'skipIntro' | null;

// YouTube风格：主菜单项（定义在组件外部，避免每次渲染创建新函数导致卸载重建）
const MenuItem = ({ icon: Icon, label, value, onClick, showArrow = true }: {
    icon: React.ElementType;
    label: string;
    value: string;
    onClick: () => void;
    showArrow?: boolean;
}) => (
    <button
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer"
    >
        <Icon className="w-5 h-5 text-slate-400 shrink-0" />
        <span className="flex-1 text-sm text-white">{label}</span>
        <span className="text-xs text-slate-400">{value}</span>
        {showArrow && <ChevronRight className="w-4 h-4 text-slate-500" />}
    </button>
);

// YouTube风格：子菜单选项项
const SubMenuItem = ({ label, isActive, onClick }: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left cursor-pointer"
    >
        {isActive ? (
            <Check className="w-5 h-5 text-slate-400 shrink-0" />
        ) : (
            <div className="w-5 h-5 shrink-0" />
        )}
        <span className="text-sm text-slate-300">
            {label}
        </span>
    </button>
);

// YouTube风格：子菜单头部
const SubMenuHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBack();
            }}
            className="p-1.5 rounded-full transition-colors cursor-pointer"
        >
            <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-sm font-bold text-white">{title}</span>
    </div>
);

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

    const [localSkipTime, setLocalSkipTime] = useState(() => skipIntroTime.current);
    const [activeSubMenu, setActiveSubMenu] = useState<SubMenuType>(null);

    useEffect(() => {
        setLocalSkipTime(skipIntroTime.current);
    }, [skipIntroTime.current]);

    const onSkipChange = useCallback((delta: number) => {
        const next = Math.max(0, localSkipTime + delta);
        setLocalSkipTime(next);
        handleSkipIntroChange(next);
    }, [localSkipTime, handleSkipIntroChange]);

    // Memoized label computations — only recalculate when dependencies change
    const qualityLabel = useMemo(() => {
        if (currentLevel === -1) return '自动';
        return `${levels.find(l => l.index === currentLevel)?.height || '?'}p`;
    }, [currentLevel, levels]);

    const speedLabel = useMemo(() => `${playbackRate}x`, [playbackRate]);

    const scaleLabel = useMemo(() => videoScale === 1 ? '默认' : `${videoScale}x`, [videoScale]);

    const bufferLabel = useMemo(() => {
        const map: Record<number, string> = { 10: '极速', 30: '平衡', 60: '流畅', 120: '抗断网', 180: '超级流畅' };
        return map[maxBufferLength] || `${maxBufferLength}s`;
    }, [maxBufferLength]);

    const skipIntroLabel = useMemo(() => localSkipTime === 0 ? '关闭' : `${localSkipTime}s`, [localSkipTime]);

    const handleCloseClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    }, [onClose]);

    const stopPropagation = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

    return (
        <div
            className={cn("bg-slate-900 rounded-lg shadow-xl border border-white/10 text-left w-72 overflow-hidden", className)}
            onClick={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchMove={stopPropagation}
            onTouchEnd={stopPropagation}
        >
            {/* Panel Header */}
            {!activeSubMenu && (
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                    <span className="text-sm font-bold text-white">设置</span>
                    <button
                        onClick={handleCloseClick}
                        className="p-1.5 rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            )}

            <div className="py-1 max-h-[70vh] overflow-y-auto">
                {/* 主菜单 */}
                {!activeSubMenu && (
                    <div className="py-1">
                        {levels.length > 0 && (
                            <MenuItem
                                icon={Settings}
                                label="清晰度"
                                value={qualityLabel}
                                onClick={() => setActiveSubMenu('quality')}
                            />
                        )}
                        <MenuItem
                            icon={Gauge}
                            label="播放速度"
                            value={speedLabel}
                            onClick={() => setActiveSubMenu('speed')}
                        />
                        <MenuItem
                            icon={ZoomIn}
                            label="画面缩放"
                            value={scaleLabel}
                            onClick={() => setActiveSubMenu('scale')}
                        />
                        <MenuItem
                            icon={HardDrive}
                            label="缓存策略"
                            value={bufferLabel}
                            onClick={() => setActiveSubMenu('buffer')}
                        />
                        <MenuItem
                            icon={FastForward}
                            label="跳过片头"
                            value={skipIntroLabel}
                            onClick={() => setActiveSubMenu('skipIntro')}
                        />
                    </div>
                )}

                {/* 子菜单：清晰度 */}
                {activeSubMenu === 'quality' && levels.length > 0 && (
                    <div className="py-1">
                        <SubMenuHeader title="清晰度" onBack={() => setActiveSubMenu(null)} />
                        <SubMenuItem
                            label="自动"
                            isActive={currentLevel === -1}
                            onClick={() => handleResolutionChange(-1)}
                        />
                        {levels.map((level) => (
                            <SubMenuItem
                                key={level.index}
                                label={`${level.height}p`}
                                isActive={activeLevelIdx === level.index}
                                onClick={() => handleResolutionChange(level.index)}
                            />
                        ))}
                    </div>
                )}

                {/* 子菜单：播放速度 */}
                {activeSubMenu === 'speed' && (
                    <div className="py-1">
                        <SubMenuHeader title="播放速度" onBack={() => setActiveSubMenu(null)} />
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((rate) => (
                            <SubMenuItem
                                key={rate}
                                label={`${rate}x`}
                                isActive={playbackRate === rate}
                                onClick={() => handleRateChange(rate)}
                            />
                        ))}
                    </div>
                )}

                {/* 子菜单：画面缩放 */}
                {activeSubMenu === 'scale' && (
                    <div className="py-1">
                        <SubMenuHeader title="画面缩放" onBack={() => setActiveSubMenu(null)} />
                        {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((scale) => (
                            <SubMenuItem
                                key={scale}
                                label={`${scale}x`}
                                isActive={videoScale === scale}
                                onClick={() => handleScaleChange(scale)}
                            />
                        ))}
                        <SubMenuItem
                            label="适配高度"
                            isActive={videoScale !== 1 && ![1.25, 1.5, 1.75, 2, 2.5, 3].includes(videoScale)}
                            onClick={() => {
                                const video = player.videoRef?.current || null;
                                const container = player.containerRef?.current || null;

                                if (!container) {
                                    player.showToast?.('暂时无法计算画面尺寸，请待视频加载后再试');
                                    return;
                                }

                                // 若元数据尚未载入：同时监听 loadedmetadata / loadeddata / canplay，任一就绪即重算并应用。
                                // 移动端 HLS (MSE) 存在 loadedmetadata 已触发但 videoWidth 仍为 0 的时序窗口，
                                // 只监听 loadedmetadata 会导致监听器永不再次触发（静默失败），故用多事件 + 就绪检查兜底
                                if (video && (video.readyState < 1 || !video.videoWidth || !video.videoHeight)) {
                                    player.showToast?.('将在视频就绪后自动适配高度');
                                    const applyWhenReady = () => {
                                        if (!video.videoWidth || !video.videoHeight) return; // 尚未就绪，等待下一次就绪事件
                                        const newScale = computeFitHeightScale(video, container);
                                        if (newScale !== null) {
                                            player.handleScaleChange(newScale);
                                        }
                                        video.removeEventListener('loadedmetadata', applyWhenReady);
                                        video.removeEventListener('loadeddata', applyWhenReady);
                                        video.removeEventListener('canplay', applyWhenReady);
                                    };
                                    video.addEventListener('loadedmetadata', applyWhenReady);
                                    video.addEventListener('loadeddata', applyWhenReady);
                                    video.addEventListener('canplay', applyWhenReady);
                                    return;
                                }

                                const scale = computeFitHeightScale(video, container);
                                if (scale === null) {
                                    player.showToast?.('暂时无法计算画面尺寸，请待视频加载后再试');
                                    return;
                                }

                                if (Math.abs(scale - videoScale) < 0.01) {
                                    player.showToast?.('已是适配高度');
                                } else {
                                    handleScaleChange(scale);
                                }
                            }}
                        />
                    </div>
                )}

                {/* 子菜单：缓存策略 */}
                {activeSubMenu === 'buffer' && (
                    <div className="py-1">
                        <SubMenuHeader title="缓存策略" onBack={() => setActiveSubMenu(null)} />
                        {[
                            { label: '极速 (10s)', value: 10 },
                            { label: '平衡 (30s)', value: 30 },
                            { label: '流畅 (60s)', value: 60 },
                            { label: '抗断网 (120s)', value: 120 },
                            { label: '超级流畅 (180s)', value: 180 },
                        ].map(({ label, value }) => (
                            <SubMenuItem
                                key={value}
                                label={label}
                                isActive={maxBufferLength === value}
                                onClick={() => handleBufferChange(value)}
                            />
                        ))}
                    </div>
                )}

                {/* 子菜单：跳过片头 */}
                {activeSubMenu === 'skipIntro' && (
                    <div className="py-1">
                        <SubMenuHeader title="跳过片头" onBack={() => setActiveSubMenu(null)} />
                        <div className="px-3 py-4">
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSkipChange(-10);
                                    }}
                                    className="p-2 bg-white/10 rounded-full transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-5 h-5 text-white" />
                                </button>
                                <span className="text-white text-lg font-mono min-w-[4rem] text-center select-none">
                                    {localSkipTime}s
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSkipChange(10);
                                    }}
                                    className="p-2 bg-white/10 rounded-full transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="w-5 h-5 text-white" />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 text-center mt-3">
                                每次调整 10 秒，0 秒为关闭
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
