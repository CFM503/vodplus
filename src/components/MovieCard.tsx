'use client';

import { Movie } from '@/types';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatencyBadge } from './LatencyBadge';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { CONFIG } from '@/config/config';
import Link from 'next/link';
import { parseVodPlayUrl } from '@/lib/vodParser';
import { usePrefetch } from '@/lib/cacheManager';

export function MovieCard({ movie, className, index = 999 }: { movie: Movie; className?: string; index?: number }) {
    if (!movie) return null;

    // Determine link
    // Ensure href is never empty or just #
    const isDiscoverySrc = movie.source_id === 'tmdb';
    const safeHref = movie.source_id && movie.vod_id
        ? `/movie/${movie.source_id}/${movie.vod_id}${isDiscoverySrc ? `?name=${encodeURIComponent(movie.vod_name)}` : ''}`
        : `/search?q=${encodeURIComponent(movie.vod_name)}`;

    const [imgSrc, setImgSrc] = useState(movie.vod_pic);
    const hasPrefetchedRef = useRef(false);

    const handlePrefetch = () => {
        if (hasPrefetchedRef.current || !movie.source_id || !movie.vod_id || isDiscoverySrc) return;
        hasPrefetchedRef.current = true;
        // 意图深度预加载：在点击前，强迫服务器解析真实的 m3u8 播放地址
        // 并直接把那个最终的 m3u8 文件也塞进 Edge Cache！
        fetch(`/api/vod/latest?source=${encodeURIComponent(movie.source_id)}&id=${encodeURIComponent(movie.vod_id)}`, {
            priority: 'low',
            cache: 'force-cache'
        })
            .then(res => res.json())
            .then(data => {
                if (data && data.list && data.list.length > 0) {
                    const detail = data.list[0];
                    if (detail && detail.vod_play_url) {
                        const episodes = parseVodPlayUrl(detail.vod_play_url);
                        if (episodes.length > 0 && episodes[0].url) {
                            // 找到了真正的视频播放地址，马上用 no-cors 去把它下载到浏览器缓存
                            fetch(episodes[0].url, { priority: 'low', mode: 'no-cors' }).catch(() => { });
                        }
                    }
                }
            })
            .catch(() => { });
    };

    return (
        <Link
            href={safeHref}
            prefetch={true}
            onMouseEnter={handlePrefetch}
            onTouchStart={handlePrefetch}
            className={cn(
                "group relative block w-full h-0 min-w-0 overflow-hidden rounded-xl bg-slate-900 border border-white/5 cursor-pointer z-0",
                className
            )}
            style={{ paddingBottom: '150%' }}
        >
            <div className="absolute inset-0 z-0">
                <Image
                    src={imgSrc}
                    alt={movie.vod_name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    quality={75}
                    priority={index < 6}
                    placeholder="blur"
                    blurDataURL={CONFIG.IMAGE_BLUR_PLACEHOLDER}
                    className="object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
                    onError={() => {
                        setImgSrc('https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500');
                    }}
                />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity pointer-events-none" />

            {/* Badges Container - Top */}
            <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-1 pointer-events-none">
                {/* Source Badge - Top Right */}
                {movie.source_id && (
                    <div className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md border shadow-lg transition-all duration-300 uppercase tracking-wider",
                        isDiscoverySrc
                            ? "bg-indigo-600/90 text-white border-indigo-400/50 ring-1 ring-indigo-400/30"
                            : "bg-slate-900/80 text-slate-300 border-white/10 group-hover:bg-indigo-600/90 group-hover:text-white group-hover:border-indigo-500/50"
                    )}>
                        {isDiscoverySrc ? `★ TMDB` : movie.source_id.split(/[$.]/)[0]}
                    </div>
                )}

                {/* Latency Badge - Top Left */}
                {movie.latency !== undefined && (
                    <LatencyBadge latency={movie.latency} />
                )}
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="rounded-full bg-indigo-500/20 p-4 backdrop-blur-sm border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 p-3 w-full pointer-events-none">
                {movie.vod_remarks && (
                    <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white mb-1 shadow-lg">
                        {movie.vod_remarks}
                    </div>
                )}
                <h3 className="line-clamp-1 text-sm font-bold text-white group-hover:text-indigo-300 transition-colors" title={movie.vod_name}>
                    {movie.vod_name}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span className="truncate max-w-[60%]">{movie.type_name}</span>
                    <span>{movie.vod_year}</span>
                </div>
            </div>
        </Link>
    );
}
