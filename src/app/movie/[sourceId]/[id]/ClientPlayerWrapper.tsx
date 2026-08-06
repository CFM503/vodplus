'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { PlayCircle, Loader2 } from 'lucide-react';
import { Episode, Movie, PlayGroup } from '@/types';
import { parseVodPlayUrl, parseVodPlayGroups } from '@/lib/vodParser';

const VideoPlayer = dynamic(
  () => import('@/components/VideoPlayer').then((mod) => mod.default),
  {
    loading: () => (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

const EPISODE_WINDOW = 40;

export default function ClientPlayerWrapper({
    episodes: initialEpisodes,
    poster,
    candidates = [],
    initialSourceId = '',
    initialSourceName = '',
    vodPlayUrl = '',
    vodPlayFrom = ''
}: {
    episodes: Episode[];
    poster: string;
    candidates?: NonNullable<Movie['candidates']>;
    initialSourceId?: string;
    initialSourceName?: string;
    vodPlayUrl?: string | null;
    vodPlayFrom?: string | null;
}) {
    const [episodes, setEpisodes] = useState(initialEpisodes);
    const [currentSourceId, setCurrentSourceId] = useState(() => `${initialSourceId}-group-0`);
    const [currentEpIndex, setCurrentEpIndex] = useState(0);
    const gridRef = useRef<HTMLDivElement>(null);

    const currentEp = episodes[currentEpIndex];
    const hasPrev = currentEpIndex > 0;
    const hasNext = currentEpIndex < episodes.length - 1;

    // Expand current and candidate lines into multi-line play groups
    const allLines = useMemo(() => {
        const lines: { source_id: string; source_name: string; vod_id: string; vod_play_url: string; vod_play_from: string }[] = [];

        // 1. Expand current source groups
        const currentGroups = parseVodPlayGroups(vodPlayUrl, vodPlayFrom);
        currentGroups.forEach((g, idx) => {
            lines.push({
                source_id: `${initialSourceId}-group-${idx}`,
                source_name: `${initialSourceName}${currentGroups.length > 1 ? ' · ' + g.name : ''}`,
                vod_id: '',
                vod_play_url: g.playUrl,
                vod_play_from: initialSourceName
            });
        });

        // 2. Expand candidate groups
        if (candidates && candidates.length > 0) {
            candidates.forEach((c) => {
                if (c.source_id === initialSourceId) return;

                const cGroups = parseVodPlayGroups(c.vod_play_url, c.vod_play_from);
                cGroups.forEach((g, idx) => {
                    lines.push({
                        source_id: `${c.source_id}-group-${idx}`,
                        source_name: `${c.source_name}${cGroups.length > 1 ? ' · ' + g.name : ''}`,
                        vod_id: c.vod_id,
                        vod_play_url: g.playUrl,
                        vod_play_from: c.vod_play_from || c.source_name
                    });
                });
            });
        }

        return lines;
    }, [candidates, initialSourceId, initialSourceName, vodPlayUrl, vodPlayFrom]);

    const handleSwitchSource = useCallback((line: { source_id: string; source_name: string; vod_play_url: string }) => {
        if (line.source_id === currentSourceId) return;

        const nextEpisodes = parseVodPlayUrl(line.vod_play_url);
        if (!nextEpisodes || nextEpisodes.length === 0) {
            alert('该线路暂无有效剧集');
            return;
        }

        const currentEp = episodes[currentEpIndex];
        let nextIndex = -1;

        if (currentEp) {
            // 1. Exact name match
            nextIndex = nextEpisodes.findIndex(ep => ep.name === currentEp.name);

            // 2. Numeric / Fuzzy match (e.g. "第1集" vs "01")
            if (nextIndex === -1) {
                const cleanNum = (name: string) => {
                    const numStr = name.replace(/[^\d]/g, '');
                    return numStr ? parseInt(numStr, 10) : null;
                };
                const targetNum = cleanNum(currentEp.name);
                if (targetNum !== null) {
                    nextIndex = nextEpisodes.findIndex(ep => cleanNum(ep.name) === targetNum);
                }
            }
        }

        // 3. Fallback to same index (clamped) or 0
        if (nextIndex === -1) {
            nextIndex = Math.min(currentEpIndex, nextEpisodes.length - 1);
        }
        if (nextIndex === -1) {
            nextIndex = 0;
        }

        setEpisodes(nextEpisodes);
        setCurrentSourceId(line.source_id);
        setCurrentEpIndex(nextIndex);
    }, [currentSourceId, episodes, currentEpIndex]);

    const handleEpisodeEnd = useCallback(() => {
        if (hasNext) {
            setCurrentEpIndex(prev => prev + 1);
        }
    }, [hasNext]);

    const handlePrevEpisode = useCallback(() => {
        if (hasPrev) {
            setCurrentEpIndex(prev => prev - 1);
        }
    }, [hasPrev]);

    const handleNextEpisode = useCallback(() => {
        if (hasNext) {
            setCurrentEpIndex(prev => prev + 1);
        }
    }, [hasNext]);

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

    const { windowStart, windowEnd, visibleEpisodes } = useMemo(() => {
        let start = 0;
        let end = totalEpisodes;

        if (shouldWindow) {
            start = Math.max(0, currentEpIndex - EPISODE_WINDOW);
            end = Math.min(totalEpisodes, currentEpIndex + EPISODE_WINDOW + 1);
        }

        const visible = shouldWindow
            ? episodes.slice(start, end).map((ep, i) => ({ ...ep, originalIdx: start + i }))
            : episodes.map((ep, i) => ({ ...ep, originalIdx: i }));

        return { windowStart: start, windowEnd: end, visibleEpisodes: visible };
    }, [episodes, currentEpIndex, totalEpisodes, shouldWindow]);

    return (
        <div className="space-y-6">
            <div className="rounded-xl overflow-hidden shadow-2xl bg-black">
                {currentEp ? (
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
                ) : (
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/5">
                        <span className="text-slate-500 text-sm">该线路无有效剧集</span>
                    </div>
                )}
            </div>

            {/* Line Selection */}
            {allLines.length >= 2 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            线路选择
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                可用 {allLines.length} 个源
                            </span>
                        </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 bg-slate-900/30 p-3.5 rounded-xl border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                        {allLines.map((line) => {
                            const isCurrent = currentSourceId === line.source_id;
                            return (
                                <button
                                    key={line.source_id}
                                    onClick={() => handleSwitchSource(line)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-all border cursor-pointer",
                                        isCurrent
                                            ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-600"
                                    )}
                                >
                                    {line.source_name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-indigo-400" />
                        剧集列表
                        <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                            共 {totalEpisodes} 集{shouldWindow && ` (显示 ${windowEnd - windowStart} 集)`}
                        </span>
                    </h3>
                    {currentEp && (
                        <div className="text-xs text-slate-400">
                            正在播放: <span className="text-indigo-300 font-medium">{currentEp.name}</span>
                        </div>
                    )}
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
                                        fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => {});
                                    }
                                }}
                                onTouchStart={() => {
                                    if (isNext && ep.url) {
                                        fetch(ep.url, { priority: 'low', mode: 'no-cors' }).catch(() => {});
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