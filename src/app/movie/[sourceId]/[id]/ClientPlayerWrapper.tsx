'use client';

import { useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { cn } from '@/lib/utils';
import { PlayCircle } from 'lucide-react';
import { Episode } from '@/types';

export default function ClientPlayerWrapper({ episodes, poster }: { episodes: Episode[], poster: string }) {
    const [currentEpIndex, setCurrentEpIndex] = useState(0);

    const currentEp = episodes[currentEpIndex];
    const hasPrev = currentEpIndex > 0;
    const hasNext = currentEpIndex < episodes.length - 1;

    const handleEpisodeEnd = () => {
        // Auto-play next episode if available
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
                            共 {episodes.length} 集
                        </span>
                    </h3>
                    <div className="text-xs text-slate-400">
                        正在播放: <span className="text-indigo-300 font-medium">{currentEp.name}</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 bg-slate-900/50 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                    {episodes.map((ep, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentEpIndex(idx)}
                            onMouseEnter={() => {
                                if (idx === currentEpIndex + 1 && ep.url) {
                                    fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => { });
                                }
                            }}
                            onTouchStart={() => {
                                if (idx === currentEpIndex + 1 && ep.url) {
                                    fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => { });
                                }
                            }}
                            className={cn(
                                "px-2 py-2 text-xs font-medium rounded-lg transition-all border",
                                currentEpIndex === idx
                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-600"
                            )}
                        >
                            {ep.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
