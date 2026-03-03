import { Header } from '@/components/Header';
import { RESOURCE_SITES } from '@/lib/resources';
import { metadata } from '@/lib/metadata';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getUserPreferences } from '@/lib/preferences';
import { Suspense } from 'react';
import { MovieList } from '@/components/latest/MovieList';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

export const runtime = 'edge';
export const revalidate = 60; // Cache for 60 seconds

interface PageProps {
    searchParams: Promise<{
        source?: string;
        page?: string;
        type?: 'movie' | 'tv';
    }>;
}

export default async function LatestPage({ searchParams }: PageProps) {
    const { source, page, type } = await searchParams;

    // Read preferences
    const cookieStore = await cookies();
    const { disabledSources, customLocalUrl } = await getUserPreferences(cookieStore);

    const availableSources = RESOURCE_SITES.filter(s => !disabledSources.includes(s.id));
    const sourceId = source || metadata.id;
    const pageNum = parseInt(page || '1');
    const mediaType = type || 'movie';

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            <Header />

            <main className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">资源库</h1>
                        <p className="text-slate-400 text-sm">探索最新的电影与剧集内容</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Type Switcher for TMDB */}
                        {sourceId === 'tmdb' && (
                            <div className="flex bg-slate-900/50 backdrop-blur-md rounded-xl p-1 border border-white/5">
                                <Link
                                    href={`/latest?source=tmdb&page=1&type=movie`}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mediaType === 'movie' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                                >
                                    电影
                                </Link>
                                <Link
                                    href={`/latest?source=tmdb&page=1&type=tv`}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mediaType === 'tv' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                                >
                                    剧集
                                </Link>
                            </div>
                        )}

                        {/* Source Selector */}
                        <div className="flex bg-slate-900/50 backdrop-blur-md rounded-xl p-1 border border-white/10 overflow-x-auto max-w-[calc(100vw-2rem)]">
                            <Link
                                href={`/latest?source=tmdb&page=1`}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${sourceId === 'tmdb' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                ★ TMDB 发现
                            </Link>
                            {availableSources.map(s => (
                                <Link
                                    key={s.id}
                                    href={`/latest?source=${s.id}&page=1`}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${s.id === sourceId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    {s.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <Suspense key={`${sourceId}-${pageNum}-${mediaType}`} fallback={<HomeSkeleton />}>
                    <MovieListWrapper
                        sourceId={sourceId}
                        pageNum={pageNum}
                        mediaType={mediaType}
                        disabledSources={disabledSources}
                        customLocalUrl={customLocalUrl}
                    />
                </Suspense>
            </main>
        </div>
    );
}

// Wrapper to handle server-side data fetching for TMDB
import { getRecentMovies } from '@/lib/services/vodService';

async function MovieListWrapper({ sourceId, pageNum, mediaType, disabledSources, customLocalUrl }: any) {
    let initialData = null;

    // Server-side fetch ONLY for TMDB to support region proxies
    if (sourceId === 'tmdb') {
        try {
            initialData = await getRecentMovies(sourceId, pageNum, mediaType, disabledSources, customLocalUrl);
        } catch (e) {
            console.error("SSR Fetch Error for TMDB:", e);
        }
    }

    return (
        <MovieList
            sourceId={sourceId}
            pageNum={pageNum}
            mediaType={mediaType}
            initialData={initialData}
        />
    );
}
