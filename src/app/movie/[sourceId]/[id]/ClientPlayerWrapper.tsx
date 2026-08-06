'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { PlayCircle, Loader2 } from 'lucide-react';
import { Episode, Movie, PlayGroup } from '@/types';
import { parseVodPlayUrl, parseVodPlayGroups } from '@/lib/vodParser';
import { RESOURCE_SITES } from '@/lib/resources';
import { isNameMatch } from '@/lib/services/vodService';
import { CONFIG } from '@/config/config';

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
    vodPlayFrom = '',
    movieName = ''
}: {
    episodes: Episode[];
    poster: string;
    candidates?: NonNullable<Movie['candidates']>;
    initialSourceId?: string;
    initialSourceName?: string;
    vodPlayUrl?: string | null;
    vodPlayFrom?: string | null;
    movieName?: string;
}) {
    const [episodes, setEpisodes] = useState(initialEpisodes);
    const [currentSourceId, setCurrentSourceId] = useState(() => `${initialSourceId}-group-0`);
    const [currentEpIndex, setCurrentEpIndex] = useState(0);
    const [clientCandidates, setClientCandidates] = useState<NonNullable<Movie['candidates']>>(candidates || []);
    const [isMatching, setIsMatching] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);

    const currentEp = episodes[currentEpIndex];
    const hasPrev = currentEpIndex > 0;
    const hasNext = currentEpIndex < episodes.length - 1;

    // Asynchronous client-side cross-source search (fan-out pattern)
    useEffect(() => {
        if (!movieName) return;

        let isMounted = true;
        const targetSites = RESOURCE_SITES.filter(s => s.id !== initialSourceId);
        if (targetSites.length === 0) return;

        setIsMatching(true);
        const limit = CONFIG.CLIENT_MATCH_CONCURRENCY || 5;
        const queue = [...targetSites];

        const fetchSiteCandidate = async (site: typeof RESOURCE_SITES[number]) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.CLIENT_MATCH_TIMEOUT_MS || 5000);

            try {
                const res = await fetch(`/api/vod/search?source=${encodeURIComponent(site.id)}&wd=${encodeURIComponent(movieName)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data && data.list && data.list.length > 0) {
                        const match = data.list.find((m: any) => m.vod_play_url && isNameMatch(m.vod_name, movieName));
                        if (match && isMounted) {
                            const newCandidate = {
                                source_id: site.id,
                                source_name: site.name,
                                vod_id: match.vod_id,
                                vod_play_url: match.vod_play_url,
                                vod_play_from: match.vod_play_from || site.name
                            };

                            setClientCandidates(prev => {
                                if (prev.some(c => c.source_id === site.id)) return prev;
                                return [...prev, newCandidate];
                            });
                        }
                    }
                }
            } catch (_) {
                // Ignore network timeout or abort errors
            }
        };

        const worker = async () => {
            while (queue.length > 0 && isMounted) {
                const site = queue.shift();
                if (!site) break;
                await fetchSiteCandidate(site);
            }
        };

        const workers = Array.from({ length: Math.min(limit, targetSites.length) }, () => worker());

        Promise.all(workers).finally(() => {
            if (isMounted) setIsMatching(false);
        });

        return () => {
            isMounted = false;
        };
    }, [movieName, initialSourceId]);

    // Clean initial source name if it contains $$$ separators
    const cleanInitialSourceName = useMemo(() => {
        if (!initialSourceName) return '默认线路';
        if (initialSourceName.includes('$$$')) {
            return initialSourceName.split('$$$')[0].trim() || '默认线路';
        }
        return initialSourceName.trim();
    }, [initialSourceName]);

    // Expand current and client candidate lines into multi-line play groups
    const allLines = useMemo(() => {
        const lines: { source_id: string; source_name: string; vod_id: string; vod_play_url: string; vod_play_from: string }[] = [];

        // 1. Expand current source groups
        const currentGroups = parseVodPlayGroups(vodPlayUrl, vodPlayFrom);
        currentGroups.forEach((g, idx) => {
            lines.push({
                source_id: `${initialSourceId}-group-${idx}`,
                source_name: `${cleanInitialSourceName}${currentGroups.length > 1 ? ' · ' + g.name : ''}`,
                vod_id: '',
                vod_play_url: g.playUrl,
                vod_play_from: cleanInitialSourceName
            });
        });

        // 2. Expand candidate groups
        if (clientCandidates && clientCandidates.length > 0) {
            clientCandidates.forEach((c) => {
                if (c.source_id === initialSourceId) return;

                const cGroups = parseVodPlayGroups(c.vod_play_url, c.vod_play_from);
                cGroups.forEach((g, idx) => {
                    const cBaseName = c.source_name ? c.source_name.split('$$$')[0].trim() : '其他线路';
                    lines.push({
                        source_id: `${c.source_id}-group-${idx}`,
                        source_name: `${cBaseName}${cGroups.length > 1 ? ' · ' + g.name : ''}`,
                        vod_id: c.vod_id,
                        vod_play_url: g.playUrl,
                        vod_play_from: c.vod_play_from || cBaseName
                    });
                });
            });
        }

        return lines;
    }, [clientCandidates, initialSourceId, cleanInitialSourceName, vodPlayUrl, vodPlayFrom]);

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
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 flex items-center gap-1.5">
                                可用 {allLines.length} 个源
                                {isMatching && (
                                    <span className="text-indigo-400 flex items-center gap-1">
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        检索中...
                                    </span>
                                )}
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