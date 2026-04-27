import React from 'react';
import { Settings, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import PlayerSettingsPanel from './PlayerSettingsPanel';

interface ControlButtonsProps {
    buttonsApi: {
        showSettings: boolean;
        setShowSettings: (v: boolean) => void;
        toggleFullscreen: () => void;
        toggleWebFullscreen: () => void;
        isWebFullscreen: boolean;
    };
    variant?: 'desktop' | 'mobile';
}

const ControlButtons = React.memo(function ControlButtons({ buttonsApi, variant = 'desktop' }: ControlButtonsProps) {
    const { showSettings, setShowSettings, toggleFullscreen, toggleWebFullscreen, isWebFullscreen } = buttonsApi;

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
                        showSettings && (variant === 'desktop' ? "rotate-45 text-indigo-400" : "bg-white/20")
                    )}
                    title="Settings"
                >
                    <Settings className={iconClass} />
                </button>
            </div>

            {/* Web Fullscreen */}
            <button
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleWebFullscreen();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    toggleWebFullscreen();
                }}
                className={btnClass}
                title={isWebFullscreen ? 'Exit Web Fullscreen' : 'Web Fullscreen'}
            >
                {isWebFullscreen ? <Minimize className={iconClass} /> : <Maximize className={cn(iconClass, "scale-90")} />}
            </button>

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
                className={cn(
                    btnClass,
                    variant === 'mobile' && "hidden"
                )}
                title="Fullscreen"
            >
                <Maximize className={iconClass} />
            </button>
        </div>
    );
});

export default ControlButtons;
