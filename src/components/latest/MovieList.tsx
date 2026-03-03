"use client";

import { MovieCard } from '@/components/MovieCard';
import { Movie, ApiResponse } from '@/types';
import { useLibrary } from '@/hooks/useLibrary';
import { Loader2 } from 'lucide-react';
import { metadata } from '@/lib/metadata';
import { useSearchParams } from 'next/navigation';

interface MovieListProps {
    sourceId: string;
    pageNum: number;
    mediaType: 'movie' | 'tv';
    // initialData is optional, passed from server
    initialData?: ApiResponse | null;
}

export function MovieList({ sourceId, pageNum, mediaType, initialData = null }: MovieListProps) {
    const { list, total, page, isLoading, goToPage, isSSR } = useLibrary(initialData, sourceId, mediaType);
    const searchParams = useSearchParams();

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-16 animate-pulse">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] bg-slate-800/50 rounded-xl" />
                ))}
            </div>
        )
    }

    // Pagination limits
    const maxPages = sourceId === metadata.id ? 5 : 50;
    const hasNextPage = page < maxPages;

    if (!isLoading && list.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <span className="text-4xl text-slate-700">?</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">暂无内容</h3>
                <p className="text-slate-500 max-w-xs">当前源暂未找到匹配的资源，请尝试切换其他线路。</p>
            </div>
        );
    }

    const handlePrefetchPage = (targetPage: number) => {
        if (targetPage < 1 || targetPage > maxPages || isLoading) return;
        // background silent fetch, Next.js / React server components cache handles the deduplication automatically
        const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
        params.set('page', targetPage.toString());
        // Prefetch the API data directly 
        fetch(`/api/vod/latest?source=${sourceId}&page=${targetPage}&type=${mediaType}`, { priority: 'low' }).catch(() => { });
    };

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-16">
                {list.map((movie: Movie) => (
                    <MovieCard key={movie.vod_id} movie={movie} />
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-6">
                <button
                    onClick={() => goToPage(page - 1)}
                    onMouseEnter={() => handlePrefetchPage(page - 1)}
                    onTouchStart={() => handlePrefetchPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 ${page > 1
                        ? "bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300"
                        : "opacity-0 pointer-events-none"
                        }`}
                >
                    上一页
                </button>

                <div className="flex flex-col items-center">
                    <span className="text-white font-mono font-bold text-lg">第 {page} 页</span>
                    <span className="text-slate-500 text-[10px] uppercase tracking-widest mt-0.5">PAGE {page}</span>
                </div>

                <button
                    onClick={() => goToPage(page + 1)}
                    onMouseEnter={() => handlePrefetchPage(page + 1)}
                    onTouchStart={() => handlePrefetchPage(page + 1)}
                    disabled={!hasNextPage || isLoading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg active:scale-95 ${hasNextPage
                        ? "bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/20 text-white shadow-indigo-500/20"
                        : "bg-slate-900/50 border border-white/5 text-slate-600 cursor-not-allowed shadow-none"
                        }`}
                >
                    {hasNextPage ? '下一页' : '已封顶'}
                </button>
            </div>
        </>
    );
}
