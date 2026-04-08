"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Movie } from '@/types';
import { MovieCard } from '@/components/MovieCard';
import { Loader2, SearchX, AlertCircle, Radio, Calendar } from 'lucide-react';
import { CONFIG } from '@/config/config';
import { useSourceLatency } from '@/hooks/useSourceLatency';

interface SearchResultsProps {
    keyword: string;
    activeSources: { id: string; name: string }[];
}

interface SourceStatus {
    id: string;
    name: string;
    status: 'pending' | 'success' | 'error';
    count: number;
}

export function SearchResults({ keyword, activeSources }: SearchResultsProps) {
    const [results, setResults] = useState<Movie[]>([]);
    const [statuses, setStatuses] = useState<SourceStatus[]>(
        activeSources.map(s => ({ id: s.id, name: s.name, status: 'pending', count: 0 }))
    );
    const [isAllFinished, setIsAllFinished] = useState(false);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());

    // Real-time latency probing
    const { latencies, isProbing, probeSources, getLatency } = useSourceLatency();

    // Probe latencies when sources change or on mount
    useEffect(() => {
        if (activeSources.length > 0) {
            probeSources();
        }
    }, [activeSources, probeSources]);

    useEffect(() => {
        // Reset state on new keyword
        setResults([]);

        if (!keyword.trim()) {
            setStatuses(activeSources.map(s => ({ id: s.id, name: s.name, status: 'success', count: 0 })));
            setIsAllFinished(true);
            return;
        }

        setStatuses(activeSources.map(s => ({ id: s.id, name: s.name, status: 'pending', count: 0 })));
        setIsAllFinished(false);

        // Cancel previous requests
        abortControllers.current.forEach(controller => controller.abort());
        abortControllers.current.clear();

        let completedCount = 0;
        const totalSources = activeSources.length;

        // Browsers typically limit concurrent connections to the same domain (6).
        // We limit to CONFIG.CONCURRENCY_LIMIT to avoid stalling.
        const CONCURRENCY_LIMIT = CONFIG.CONCURRENCY_LIMIT;
        const queue = [...activeSources];
        let isCancelled = false;

        const runNext = () => {
            if (isCancelled || queue.length === 0) return;

            const source = queue.shift();
            if (!source) return;

            const controller = new AbortController();
            abortControllers.current.set(source.id, controller);

            fetch(`/api/vod/search?source=${source.id}&wd=${encodeURIComponent(keyword)}`, {
                signal: controller.signal
            })
                .then(res => res.json())
                .then(data => {
                    if (isCancelled) return;
                    const list = data.list || [];

                    // Update statuses
                    setStatuses(prev => prev.map(s =>
                        s.id === source.id ? { ...s, status: 'success', count: list.length } : s
                    ));

                    // Append unique results
                    if (list.length > 0) {
                        // Use transition to prioritize UI responsiveness
                        // This prevents typing lag or scroll stutter during rapid updates
                        import('react').then(({ startTransition }) => {
                            startTransition(() => {
                                setResults(prev => {
                                    const newItems: Movie[] = [];
                                    // Use source_id in key if deduplication is disabled
                                    const getKey = (m: Movie) => {
                                        const base = `${m.vod_name}-${m.vod_year || ''}`.toLowerCase().trim();
                                        return CONFIG.SEARCH_DEDUPLICATE ? base : `${base}-${m.source_id}`;
                                    };

                                    const seen = new Set(prev.map(m => getKey(m)));

                                    list.forEach((item: Movie) => {
                                        const key = getKey(item);
                                        if (!seen.has(key)) {
                                            seen.add(key);
                                            newItems.push(item);
                                        }
                                    });

                                    return [...prev, ...newItems];
                                });
                            });
                        });
                    }
                })
                .catch(err => {
                    if (err.name !== 'AbortError' && !isCancelled) {
                        setStatuses(prev => prev.map(s =>
                            s.id === source.id ? { ...s, status: 'error', count: 0 } : s
                        ));
                    }
                })
                .finally(() => {
                    if (isCancelled) return;
                    completedCount++;
                    if (completedCount === totalSources) {
                        setIsAllFinished(true);
                    } else {
                        // Try to trigger the next one in queue
                        runNext();
                    }
                });
        };

        // Start initial batch
        for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, totalSources); i++) {
            runNext();
        }

        return () => {
            isCancelled = true;
            abortControllers.current.forEach(controller => controller.abort());
        };
    }, [keyword, activeSources]);


    // 进阶优化 1: Top 1 结果"强力静默预载"
    // 当第一条搜索结果出现时，系统提前去后台把它的详情数据（包括第一集地址）拉取到 Edge Cache 中。
    const hasPrefetchedTopResult = useRef<string | null>(null);
    useEffect(() => {
        if (results.length > 0 && results[0] && hasPrefetchedTopResult.current !== keyword) {
            hasPrefetchedTopResult.current = keyword;
            const topResult = results[0];
            if (topResult.source_id && topResult.vod_id) {
                // 用最低优先级静默抓取
                fetch(`/api/vod/latest?source=${encodeURIComponent(topResult.source_id)}&id=${encodeURIComponent(topResult.vod_id)}`, {
                    priority: 'low',
                    cache: 'force-cache'
                }).catch(() => { });
            }
        }
    }, [results, keyword]);


    // Merge latency data into results for display
    useEffect(() => {
        if (results.length > 0 && latencies.size > 0) {
            setResults(prev => prev.map(movie => {
                const latency = getLatency(movie.source_id || '');
                return {
                    ...movie,
                    latency: latency > 0 ? latency : movie.latency
                };
            }));
        }
    }, [latencies, getLatency]);

    // Year filter state
    const [selectedYear, setSelectedYear] = useState<string>('all');

    // Extract unique years from results
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        results.forEach(movie => {
            if (movie.vod_year) {
                years.add(movie.vod_year.toString());
            }
        });
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [results]);

    // Filter results by selected year
    const filteredResults = useMemo(() => {
        if (selectedYear === 'all') return results;
        return results.filter(movie => movie.vod_year?.toString() === selectedYear);
    }, [results, selectedYear]);

    const pendingCount = statuses.filter(s => s.status === 'pending').length;
    const hasResults = results.length > 0;
    const filteredCount = filteredResults.length;

    return (
        <div>
            {/* Status Bar */}
            <div className="mb-6 flex flex-wrap gap-2 text-xs">
                {/* Latency probing indicator */}
                {isProbing && (
                    <div className="px-2 py-1 rounded-full border flex items-center gap-1.5 bg-blue-950/30 border-blue-500/20 text-blue-400">
                        <Radio className="w-3 h-3 animate-pulse" />
                        <span>测速中...</span>
                    </div>
                )}
                {statuses.map(s => (
                    <div key={s.id} className={`px-2 py-1 rounded-full border flex items-center gap-1.5 transition-all ${
                        s.status === 'pending' ? 'bg-slate-900 border-indigo-500/50 text-indigo-300 animate-pulse' :
                        s.status === 'error' ? 'bg-red-950/30 border-red-500/20 text-red-400' :
                            s.count > 0 ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400' :
                                'bg-slate-900 border-slate-700 text-slate-500'
                        }`}>
                        {s.status === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {s.status === 'error' && <AlertCircle className="w-3 h-3" />}
                        <span>{s.name}</span>
                        {s.status === 'success' && <span className="opacity-70">({s.count})</span>}
                        {/* Show latency badge if available */}
                        {s.status === 'success' && (() => {
                            const latency = latencies.get(s.id);
                            if (!latency) return null;
                            const latencyValue = latency.latency;
                            const latencyColor = latencyValue > 0 && latencyValue < 100 ? 'text-emerald-400' :
                                latencyValue > 0 && latencyValue < 300 ? 'text-blue-400' :
                                latencyValue > 0 ? 'text-amber-400' : 'text-slate-500';
                            return (
                                <span className={`ml-1 text-[10px] ${latencyColor}`}>
                                    {latencyValue > 0 ? `${latencyValue}ms` : '---'}
                                </span>
                            );
                        })()}
                    </div>
                ))}
            </div>

            {/* Year Filter */}
            {hasResults && availableYears.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-300">按年份筛选</span>
                        <span className="text-xs text-slate-500">({filteredCount} / {results.length} 部)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {/* All Years Button */}
                        <button
                            onClick={() => setSelectedYear('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                selectedYear === 'all'
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400'
                            }`}
                        >
                            全部
                        </button>
                        {/* Year Buttons */}
                        {availableYears.map(year => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                    selectedYear === year
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400'
                                }`}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results Grid */}
            {filteredCount > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredResults.map((movie, idx) => (
                        <MovieCard key={`${movie.vod_id}-${movie.source_id}-${idx}`} movie={movie} />
                    ))}
                </div>
            )}

            {/* No Results After Filter */}
            {hasResults && filteredCount === 0 && selectedYear !== 'all' && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="bg-slate-900 rounded-full p-6 mb-4">
                        <Calendar className="w-12 h-12 opacity-50" />
                    </div>
                    <p className="text-lg font-medium">没有找到 {selectedYear} 年的视频</p>
                    <p className="text-sm mt-2">请尝试选择其他年份或查看全部</p>
                </div>
            )}

            {/* Empty State / Loading State */}
            {!hasResults && !isAllFinished && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                    <p className="text-slate-400 animate-pulse">正在全网搜索 {pendingCount} 个资源库...</p>
                </div>
            )}

            {!hasResults && isAllFinished && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="bg-slate-900 rounded-full p-6 mb-4">
                        <SearchX className="w-12 h-12 opacity-50" />
                    </div>
                    <p className="text-lg font-medium">未找到相关资源</p>
                    <p className="text-sm">请尝试更换关键词搜索</p>
                </div>
            )}
        </div>
    );
}
