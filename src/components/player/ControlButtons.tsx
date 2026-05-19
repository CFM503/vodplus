import React from 'react';
import { Settings, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

type PlayerState = ReturnType<typeof useVideoPlayer>;

interface ControlButtonsProps {
    player: PlayerState;
    variant?: 'desktop' | 'mobile';
    onSettingsToggle?: (e: React.TouchEvent | React.MouseEvent) => void;
}

const ControlButtons = React.memo(function ControlButtons({ player, variant = 'desktop', onSettingsToggle }: ControlButtonsProps) {
    const {
        showSettings,
        toggleFullscreen,
        toggleWebFullscreen,
        isWebFullscreen
    } = player;

    const iconClass = variant === 'mobile' ? "w-5 h-5 text-white" : "w-6 h-6 text-white";
    const btnClass = variant === 'mobile'
        ? "p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all"
        : "p-1 hover:scale-110 transition-transform hover:text-indigo-400";

    const handleSettingsClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onSettingsToggle) {
            onSettingsToggle(e);
        }
    };

    return (
        <div className={cn("flex items-center", variant === 'desktop' ? "gap-4" : "gap-1")}>
            {/* Settings */}
            <div className="relative">
                <button
                    data-settings-toggle
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={handleSettingsClick}
                    onClick={handleSettingsClick}
                    className={cn(
                        btnClass,
                        variant === 'desktop' && "hover:rotate-45 duration-300",
                        showSettings && (variant === 'desktop' ? "rotate-45 text-indigo-400" : "bg-white/10")
                    )}
                    title="设置"
                    aria-expanded={showSettings}
                >
                    <Settings className={iconClass} />
                </button>
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
