import React from 'react';
import { Settings, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import PlayerSettingsPanel from './PlayerSettingsPanel';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface ControlButtonsProps {
    player: PlayerState;
    variant?: 'desktop' | 'mobile';
}

const ControlButtons = React.memo(function ControlButtons({ player, variant = 'desktop' }: ControlButtonsProps) {
    const {
        showSettings,
        setShowSettings,
        toggleFullscreen,
        toggleWebFullscreen,
        isWebFullscreen
    } = player;

    const iconClass = variant === 'mobile' ? "w-5 h-5 text-white" : "w-6 h-6 text-white";
    const btnClass = variant === 'mobile'
        ? "p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all"
        : "p-1 hover:scale-110 transition-transform hover:text-indigo-400";

    return (
        <div
            className={cn("flex items-center", variant === 'desktop' ? "gap-4" : "gap-1")}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Settings */}
            <div className="relative">
                <button
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowSettings(!showSettings);
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(!showSettings);
                    }}
                    className={cn(
                        btnClass,
                        variant === 'desktop' && "hover:rotate-45 duration-300",
                        showSettings && (variant === 'desktop' ? "rotate-45 text-indigo-400" : "bg-white/10")
                    )}
                    title="设置"
                >
                    <Settings className={iconClass} />
                </button>

                {showSettings && variant === 'desktop' && (
                    <div
                        className="absolute bottom-full right-0 mb-4 z-50 min-w-[280px] animate-in fade-in slide-in-from-bottom-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PlayerSettingsPanel
                            player={player}
                            onClose={() => setShowSettings(false)}
                        />
                    </div>
                )}
            </div>

            {/* Web Fullscreen (Desktop Only) */}
            {variant === 'desktop' && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleWebFullscreen();
                    }}
                    className={btnClass}
                    title="网页全屏"
                >
                    {isWebFullscreen
                        ? <Minimize className={iconClass} />
                        : <Maximize className={cn(iconClass, "box-content p-0.5 border-2 border-dashed border-white/40 rounded-sm")} />
                    }
                </button>
            )}

            {/* Fullscreen */}
            <button
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFullscreen();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                }}
                className={cn(btnClass, "shrink-0")}
                title="全屏"
            >
                <Maximize className={iconClass} />
            </button>
        </div>
    );
});

ControlButtons.displayName = 'ControlButtons';

export default ControlButtons;
