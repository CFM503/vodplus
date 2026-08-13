'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { PlayCircle, Loader2 } from 'lucide-react';
import { Episode, Movie, PlayGroup } from '@/types';
import { parseVodPlayUrl, parseVodPlayGroups } from '@/lib/vodParser';
import { RESOURCE_SITES } from '@/lib/resources';
import { readCustomSourcesFromDocument } from '@/lib/sourceConfig';
import { isNameMatch } from '@/lib/nameMatch';
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

    // v0.9.25: 自动切换线路 (连续卡顿达到上限时) 的循环保护与提示
    const triedLinesRef = useRef<Set<string>>(new Set());
    const [switchNotice, setSwitchNotice] = useState<{ msg: string; key: number } | null>(null);
    const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track real-time playback state (currentTime and playing status) for line switching progress recovery
    const playbackStateRef = useRef<{ currentTime: number; isPlaying: boolean }>({ currentTime: 0, isPlaying: true });
    const [pendingSeekTime, setPendingSeekTime] = useState<number | undefined>(undefined);
    const [pendingAutoplay, setPendingAutoplay] = useState<boolean>(true);

    const gridRef = useRef<HTMLDivElement>(null);

    // 自定义源 baseUrl 解析表，用于把相对播放地址解析为绝对地址
    const customSources = useMemo(() => readCustomSourcesFromDocument(), []);
    const getSourceBaseUrl = useCallback((sourceId: string) => {
        const rawId = sourceId.split('-group-')[0];
        return RESOURCE_SITES.find(s => s.id === rawId)?.baseUrl || customSources.find(s => s.id === rawId)?.baseUrl;
    }, [customSources]);

    const currentEp = episodes[currentEpIndex];
    const hasPrev = currentEpIndex > 0;
    const hasNext = currentEpIndex < episodes.length - 1;

    const handleTimeUpdate = useCallback((c: number, _d: number, p: boolean) => {
        playbackStateRef.current = { currentTime: c, isPlaying: p };
    }, []);

    // Asynchronous client-side cross-source search (fan-out pattern with bandwidth yielding & batching)
    useEffect(() => {
        if (!movieName) return;

        let isMounted = true;
        // v0.9.31: 换源匹配包含用户自定义源 (Cookie 中的 VOD_CUSTOM_SOURCES)
        const targetSites = [...RESOURCE_SITES, ...readCustomSourcesFromDocument()].filter(s => s.id !== initialSourceId);
        if (targetSites.length === 0) return;

        let startTimeoutId: NodeJS.Timeout | null = null;
        let batchTimerId: NodeJS.Timeout | null = null;
        const pendingQueue: NonNullable<Movie['candidates']> = [];

        const flushCandidates = () => {
            if (pendingQueue.length === 0 || !isMounted) return;
            const itemsToAdd = [...pendingQueue];
            pendingQueue.length = 0;

            setClientCandidates(prev => {
                const existingIds = new Set(prev.map(c => c.source_id));
                const newItems = itemsToAdd.filter(c => !existingIds.has(c.source_id));
                if (newItems.length === 0) return prev;
                return [...prev, ...newItems];
            });
        };

        const scheduleFlush = () => {
            if (batchTimerId) return;
            batchTimerId = setTimeout(() => {
                batchTimerId = null;
                flushCandidates();
            }, 300); // 300ms batch throttle
        };

        // Yield bandwidth to HLS player startup for 1.8s
        startTimeoutId = setTimeout(() => {
            if (!isMounted) return;
            setIsMatching(true);

            let limit = CONFIG.CLIENT_MATCH_CONCURRENCY || 3;
            // Adaptively reduce concurrency on weak networks or data saver mode
            if (typeof navigator !== 'undefined' && 'connection' in navigator) {
                const conn = (navigator as any).connection;
                if (conn && (conn.effectiveType === '2g' || conn.effectiveType === '3g' || conn.saveData)) {
                    limit = 1;
                }
            }

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

                                pendingQueue.push(newCandidate);
                                scheduleFlush();
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
                if (isMounted) {
                    if (batchTimerId) {
                        clearTimeout(batchTimerId);
                        batchTimerId = null;
                    }
                    flushCandidates();
                    setIsMatching(false);
                }
            });
        }, 1800);

        return () => {
            isMounted = false;
            if (startTimeoutId) clearTimeout(startTimeoutId);
            if (batchTimerId) clearTimeout(batchTimerId);
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
        const currentGroups = parseVodPlayGroups(vodPlayUrl, vodPlayFrom, getSourceBaseUrl(initialSourceId));
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

                const cGroups = parseVodPlayGroups(c.vod_play_url, c.vod_play_from, getSourceBaseUrl(c.source_id));
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
    }, [clientCandidates, initialSourceId, cleanInitialSourceName, vodPlayUrl, vodPlayFrom, getSourceBaseUrl]);

    const handleSwitchSource = useCallback((line: { source_id: string; source_name: string; vod_play_url: string }) => {
        if (line.source_id === currentSourceId) return;
        const nextEpisodes = parseVodPlayUrl(line.vod_play_url, getSourceBaseUrl(line.source_id));
        if (!nextEpisodes || nextEpisodes.length === 0) {
            alert('该线路暂无有效剧集');
            return;
        }

        const currentEp = episodes[currentEpIndex];
        let nextIndex = -1;
        let isSameEpisode = false;

        if (currentEp) {
            // 1. Exact name match
            nextIndex = nextEpisodes.findIndex(ep => ep.name === currentEp.name);
            if (nextIndex !== -1) {
                isSameEpisode = true;
            }

            // 2. Numeric / Fuzzy match (e.g. "第1集" vs "01")
            if (nextIndex === -1) {
                const cleanNum = (name: string) => {
                    const numStr = name.replace(/[^\d]/g, '');
                    return numStr ? parseInt(numStr, 10) : null;
                };
                const targetNum = cleanNum(currentEp.name);
                if (targetNum !== null) {
                    nextIndex = nextEpisodes.findIndex(ep => cleanNum(ep.name) === targetNum);
                    if (nextIndex !== -1) {
                        isSameEpisode = true;
                    }
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

        const { currentTime, isPlaying } = playbackStateRef.current;
        if (isSameEpisode && currentTime > 5) {
            setPendingSeekTime(currentTime);
            setPendingAutoplay(isPlaying);
        } else {
            setPendingSeekTime(undefined);
            setPendingAutoplay(true);
        }

        setEpisodes(nextEpisodes);
        setCurrentSourceId(line.source_id);
        setCurrentEpIndex(nextIndex);
    }, [currentSourceId, episodes, currentEpIndex, getSourceBaseUrl]);

    // v0.9.25: 卡顿自动切换提示 (播放器内自带 toast, 这里额外提示切到了哪条线路)
    const showSwitchNotice = useCallback((msg: string) => {
        setSwitchNotice({ msg, key: Date.now() });
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => setSwitchNotice(null), 3500);
    }, []);

    // v0.9.25: 线路连续卡顿达到上限时, 自动切换到偏好表里更快/更稳的线路
    // 偏好顺序来自实测 CDN 速度 (见 CONFIG.LINE_PREFERENCE), 避免在当前慢线 (如量子 EU 节点) 上反复缓冲
    const handleAutoSwitchLine = useCallback(() => {
        if (!CONFIG.AUTO_SWITCH_LINE || allLines.length < 2) return;

        // 当前线路记为失败, 防止切回后乒乓
        triedLinesRef.current.add(currentSourceId);

        // 按偏好顺序排序: LINE_PREFERENCE 里的线路优先, 其余按原顺序追加
        const knownIds = new Set(CONFIG.LINE_PREFERENCE);
        const preferred = allLines.filter(l => knownIds.has(l.source_id));
        const rest = allLines.filter(l => !knownIds.has(l.source_id));
        const ordered = [...preferred, ...rest];

        // 找下一个未尝试过的线路 (且不是当前线路)
        const next = ordered.find(l => l.source_id !== currentSourceId && !triedLinesRef.current.has(l.source_id));
        if (!next) {
            showSwitchNotice('所有线路都已尝试，仍无法流畅播放');
            return;
        }

        showSwitchNotice(`当前线路卡顿，已自动切换到「${next.source_name}」`);
        handleSwitchSource(next);
    }, [allLines, currentSourceId, handleSwitchSource, showSwitchNotice]);

    const handleEpisodeEnd = useCallback(() => {
        setPendingSeekTime(undefined);
        setPendingAutoplay(true);
        if (hasNext) {
            setCurrentEpIndex(prev => prev + 1);
        }
    }, [hasNext]);

    const handlePrevEpisode = useCallback(() => {
        setPendingSeekTime(undefined);
        setPendingAutoplay(true);
        if (hasPrev) {
            setCurrentEpIndex(prev => prev - 1);
        }
    }, [hasPrev]);

    const handleNextEpisode = useCallback(() => {
        setPendingSeekTime(undefined);
        setPendingAutoplay(true);
        if (hasNext) {
            setCurrentEpIndex(prev => prev + 1);
        }
    }, [hasNext]);

    const handleJumpToEpisode = useCallback((idx: number) => {
        setPendingSeekTime(undefined);
        setPendingAutoplay(true);
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
                        autoplay={pendingAutoplay}
                        onPrevEpisode={handlePrevEpisode}
                        onNextEpisode={handleNextEpisode}
                        hasPrevEpisode={hasPrev}
                        hasNextEpisode={hasNext}
                        nextEpisodeUrl={hasNext ? episodes[currentEpIndex + 1].url : undefined}
                        initialSeekTime={pendingSeekTime}
                        onTimeUpdate={handleTimeUpdate}
                        onGiveUp={handleAutoSwitchLine}
                    />
                ) : (
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/5">
                        <span className="text-slate-500 text-sm">该线路无有效剧集</span>
                    </div>
                )}
            </div>

            {/* v0.9.25: 卡顿自动切换提示 */}
            {switchNotice && (
                <div key={switchNotice.key} className="flex justify-center -mt-2">
                    <div className="px-4 py-2 rounded-lg bg-indigo-600/90 text-white text-xs font-medium shadow-lg border border-indigo-400/50 animate-in fade-in">
                        {switchNotice.msg}
                    </div>
                </div>
            )}

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
                                    onClick={() => { triedLinesRef.current = new Set(); handleSwitchSource(line); }}
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