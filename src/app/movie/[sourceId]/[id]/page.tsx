
import { cachedGetMovieDetail } from '@/lib/api';
import VideoPlayer from '@/components/VideoPlayer';
import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { Calendar, Globe, User } from 'lucide-react';
import { RESOURCE_SITES } from '@/lib/resources';
import { cookies } from 'next/headers';
import { getUserPreferences } from '@/lib/preferences';
import { parseVodPlayUrl } from '@/lib/vodParser';
import ClientPlayerWrapper from './ClientPlayerWrapper';

export const runtime = 'edge';

export const revalidate = 300;

interface PageProps {
    params: Promise<{
        sourceId: string;
        id: string;
    }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { sourceId, id } = await params;
    // We don't need disabledSources for metadata as we just want the info, 
    // and getMovieDetail handles the lookup nicely.
    // However, getMovieDetail signature requires it. 
    // We can pass empty array or fetch properly. Fetching properly is safer.
    const cookieStore = await cookies();
    const preferences = await getUserPreferences(cookieStore);

    const movie = await cachedGetMovieDetail(sourceId, id, preferences.disabledSources);

    if (!movie) {
        return {
            title: '视频未找到 - VOD',
            description: '无法找到该视频资源'
        };
    }

    const title = `${movie.vod_name} ${movie.vod_remarks || ''} - 在线观看 - VOD`;
    const description = movie.vod_content
        ? movie.vod_content.replace(/<[^>]*>?/gm, "").substring(0, 150) + '...'
        : `${movie.vod_name} 在线观看。主演：${movie.vod_actor}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [movie.vod_pic],
            type: 'video.movie',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [movie.vod_pic],
        }
    };
}

export default async function MovieDetail({ params }: PageProps) {
    const { sourceId, id } = await params;
    const cookieStore = await cookies();
    const { disabledSources } = await getUserPreferences(cookieStore);

    const movie = await cachedGetMovieDetail(sourceId, id, disabledSources);

    if (!movie) {
        notFound();
    }

    // Parse play urls using dedicated parser
    const episodes = parseVodPlayUrl(movie.vod_play_url);
    const safeEpisodes = episodes.length > 0 ? episodes : [];

    // Extract CDN hostname from the first episode URL for preconnect hint
    let cdnOrigin: string | null = null;
    try {
        if (safeEpisodes.length > 0 && safeEpisodes[0].url) {
            const parsed = new URL(safeEpisodes[0].url);
            cdnOrigin = parsed.origin; // e.g. https://cdn.example.com
        }
    } catch (_) { }

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Preconnect to CDN origin for faster HLS loading */}
            {cdnOrigin && (
                <>
                    <link rel="preconnect" href={cdnOrigin} crossOrigin="anonymous" />
                    <link rel="dns-prefetch" href={cdnOrigin} />
                </>
            )}
            <Header />

            <main className="container mx-auto px-4 pt-4">
                {/* Player Section - Top Priority for Mobile */}
                <div className="mb-8">
                    {safeEpisodes.length > 0 ? (
                        <ClientPlayerWrapper episodes={safeEpisodes} poster={movie.vod_pic} />
                    ) : (
                        <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center border border-white/10">
                            <span className="text-slate-500">视频源不可用</span>
                        </div>
                    )}
                </div>

                {/* Movie Info */}
                <div className="glass p-6 rounded-2xl space-y-4 mb-8">
                    <h1 className="text-3xl font-bold text-white">{movie.vod_name}</h1>

                    <div className="flex flex-wrap gap-2">
                        {movie.type_name && <span className="px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-indigo-300">{movie.type_name}</span>}
                        {movie.vod_year && <span className="px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-emerald-300">{movie.vod_year}</span>}
                        {movie.vod_area && <span className="px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-amber-300">{movie.vod_area}</span>}
                    </div>

                    <div className="space-y-3 pt-4 text-sm text-slate-300">
                        <div className="flex gap-3">
                            <User className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <span><strong className="text-slate-100">主演:</strong> {movie.vod_actor || '未知'}</span>
                        </div>
                        <div className="flex gap-3">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <span><strong className="text-slate-100">导演:</strong> {movie.vod_director || '未知'}</span>
                        </div>
                        <div className="flex gap-3">
                            <Globe className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <span>
                                <strong className="text-slate-100">来源:</strong> {movie.vod_play_from || '未知数据源'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="glass p-6 rounded-2xl mb-8">
                    <h2 className="text-xl font-bold text-white mb-3">剧情简介</h2>
                    <p className="text-slate-300 leading-relaxed text-sm">
                        {movie.vod_content ? movie.vod_content.replace(/<[^>]*>?/gm, "") : '暂无简介。'}
                    </p>
                </div>

            </main>
        </div>
    );
}
