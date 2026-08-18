import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';

interface EpisodeControlsProps {
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
    variant?: 'desktop' | 'mobile';
}

const EpisodeControls = React.memo(function EpisodeControls({ onPrevEpisode, onNextEpisode, hasPrevEpisode, hasNextEpisode, variant = 'desktop' }: EpisodeControlsProps) {
    if (!onPrevEpisode && !onNextEpisode) return null;

    const iconSize = variant === 'mobile' ? "w-4 h-4" : "w-6 h-6";

    const stopPropagation = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

    const handlePrevClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasPrevEpisode) onPrevEpisode?.();
    }, [hasPrevEpisode, onPrevEpisode]);

    const handleNextClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasNextEpisode) onNextEpisode?.();
    }, [hasNextEpisode, onNextEpisode]);

    return (
        <div
            className={cn("flex items-center", variant === 'desktop' ? "gap-2" : "gap-0.5")}
            onClick={stopPropagation}
        >
            <button
                onTouchStart={stopPropagation}
                onTouchEnd={stopPropagation}
                onClick={handlePrevClick}
                disabled={!hasPrevEpisode}
                className={cn(
                    "transition-all active:scale-90 disabled:opacity-20 shrink-0",
                    variant === 'desktop' ? "p-1.5 hover:text-indigo-400" : "p-1.5 hover:bg-white/10 rounded-full"
                )}
                title="上一集"
            >
                <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
            </button>
            <button
                onTouchStart={stopPropagation}
                onTouchEnd={stopPropagation}
                onClick={handleNextClick}
                disabled={!hasNextEpisode}
                className={cn(
                    "transition-all active:scale-90 disabled:opacity-20 shrink-0",
                    variant === 'desktop' ? "p-1.5 hover:text-indigo-400" : "p-1.5 hover:bg-white/10 rounded-full"
                )}
                title="下一集"
            >
                <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 18h2V6h-2zm-3.5-6l-8.5 6V6z" />
                </svg>
            </button>
        </div>
    );
});

EpisodeControls.displayName = 'EpisodeControls';

export default EpisodeControls;
