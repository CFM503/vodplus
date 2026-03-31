'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { cn } from '@/lib/utils';
import { PlayCircle } from 'lucide-react';
import { Episode } from '@/types';

const EPISODE_WINDOW = 40;

export default function ClientPlayerWrapper({ episodes, poster }: { episodes: Episode[], poster: string }) {
    const [currentEpIndex, setCurrentEpIndex] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const gridRef = useRef<HTMLDivElement>(null);

    const currentEp = episodes[currentEpIndex];
    const hasPrev = currentEpIndex > 0;
    const hasNext = currentEpIndex < episodes.length - 1;

    const handleEpisodeEnd = () => {
        if (hasNext) {
            setCurrentEpIndex(currentEpIndex + 1);
        }
    };

    const handlePrevEpisode = () => {
        if (hasPrev) {
            setCurrentEpIndex(currentEpIndex - 1);
        }
    };

    const handleNextEpisode = () => {
        if (hasNext) {
            setCurrentEpIndex(currentEpIndex + 1);
        }
    };

    const handleScroll = useCallback(() => {
        if (gridRef.current) {
            setScrollTop(gridRef.current.scrollTop);
        }
    }, []);

    const handleJumpToEpisode = useCallback((idx: number) => {
        setCurrentEpIndex(idx);
        if (gridRef.current) {
            const button = gridRef.current.querySelector(`[data-ep-idx="${idx}"]`) as HTMLElement;
            if (button) {
                button.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    }, []);

    const totalEpisodes = episodes.length;
    const shouldWindow = totalEpisodes > EPISODE_WINDOW * 2;

    let windowStart = 0;
    let windowEnd = totalEpisodes;

    if (shouldWindow) {
        windowStart = Math.max(0, currentEpIndex - EPISODE_WINDOW);
        windowEnd = Math.min(totalEpisodes, currentEpIndex + EPISODE_WINDOW + 1);
    }

    const visibleEpisodes = shouldWindow
        ? episodes.slice(windowStart, windowEnd).map((ep, i) => ({ ...ep, originalIdx: windowStart + i }))
        : episodes.map((ep, i) => ({ ...ep, originalIdx: i }));

    return (
        <div className="space-y-6">
            <div className="rounded-xl overflow-hidden shadow-2xl bg-black">
                <VideoPlayer
                    url={currentEp.url}
                    poster={poster}
                    title={currentEp.name}
                    onEnded={handleEpisodeEnd}
                    autoplay={true}
                    onPrevEpisode={handlePrevEpisode}
                    onNextEpisode={handleNextEpisode}
                    hasPrevEpisode={hasPrev}
                    hasNextEpisode={hasNext}
                    nextEpisodeUrl={hasNext ? episodes[currentEpIndex + 1].url : undefined}
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-indigo-400" />
                        剧集列表
                        <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                            共 {totalEpisodes} 集{shouldWindow && ` (显示 ${windowEnd - windowStart} 集)`}
                        </span>
                    </h3>
                    <div className="text-xs text-slate-400">
                        正在播放: <span className="text-indigo-300 font-medium">{currentEp.name}</span>
                    </div>
                </div>

                {shouldWindow && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>第 {windowStart + 1} - {windowEnd} 集</span>
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{
                                    width: `${((currentEpIndex + 1) / totalEpisodes) * 100}%`,
                                    marginLeft: `${(windowStart / totalEpisodes) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                <div
                    ref={gridRef}
                    onScroll={handleScroll}
                    className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 bg-slate-900/50 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto custom-scrollbar"
                >
                    {visibleEpisodes.map((ep) => {
                        const idx = ep.originalIdx;
                        const isCurrent = currentEpIndex === idx;
                        const isNext = idx === currentEpIndex + 1;
                        return (
                            <button
                                key={idx}
                                data-ep-idx={idx}
                                onClick={() => handleJumpToEpisode(idx)}
                                onMouseEnter={() => {
                                    if (isNext && ep.url) {
                                        fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => { });
                                    }
                                }}
                                onTouchStart={() => {
                                    if (isNext && ep.url) {
                                        fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => { });
                                    }
                                }}
                                className={cn(
                                    "px-2 py-2 text-xs font-medium rounded-lg transition-all border",
                                    isCurrent
                                        ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                        : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-600"
                                )}
                            >
                                {ep.name}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
