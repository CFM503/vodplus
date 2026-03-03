import { cn } from '@/lib/utils';

interface EpisodeControlsProps {
    onPrevEpisode?: () => void;
    onNextEpisode?: () => void;
    hasPrevEpisode?: boolean;
    hasNextEpisode?: boolean;
    variant?: 'desktop' | 'mobile';
}

export default function EpisodeControls({ onPrevEpisode, onNextEpisode, hasPrevEpisode, hasNextEpisode, variant = 'desktop' }: EpisodeControlsProps) {
    if (!onPrevEpisode && !onNextEpisode) return null;

    const iconSize = variant === 'mobile' ? "w-5 h-5" : "w-6 h-6";

    return (
        <div
            className={cn("flex items-center gap-1", variant === 'desktop' ? "gap-2" : "gap-0.5")}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (hasPrevEpisode) onPrevEpisode?.();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onPrevEpisode?.();
                }}
                disabled={!hasPrevEpisode}
                className={cn(
                    "p-1 transition-all active:scale-90 disabled:opacity-20 shrink-0",
                    variant === 'desktop' ? "p-1.5 hover:text-indigo-400" : "hover:bg-white/10 rounded-full"
                )}
                title="上一集"
            >
                <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
            </button>
            <button
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (hasNextEpisode) onNextEpisode?.();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onNextEpisode?.();
                }}
                disabled={!hasNextEpisode}
                className={cn(
                    "p-1 transition-all active:scale-90 disabled:opacity-20 shrink-0",
                    variant === 'desktop' ? "p-1.5 hover:text-indigo-400" : "hover:bg-white/10 rounded-full"
                )}
                title="下一集"
            >
                <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
            </button>
        </div>
    );
}
