
import { Movie } from '@/types';
import { getThemedPlaceholder, fetchWithTimeout } from './utils';
import { logger } from './logger';

import { SERVER_CONFIG } from '@/config/server';

export const TMDB_API_KEY = SERVER_CONFIG.TMDB.API_KEY;
export const TMDB_BASE_URL = SERVER_CONFIG.TMDB.BASE_URL;
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

interface TmdbItem {
    id: number;
    title?: string;
    name?: string;
    poster_path: string;
    overview: string;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    media_type?: string;
}


function normalizeTmdbToMovie(item: TmdbItem, type: 'movie' | 'tv'): Movie {
    const isMovie = type === 'movie';
    const title = item.title || item.name || 'Unknown';
    return {
        vod_id: `tmdb-${item.id}`,
        vod_name: title,
        vod_pic: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : getThemedPlaceholder(isMovie ? '电影' : '电视剧', title),
        vod_remarks: `${item.vote_average.toFixed(1)} 分`,
        type_name: isMovie ? '电影' : '电视剧',
        vod_year: (item.release_date || item.first_air_date || '').split('-')[0],
        vod_content: item.overview,
        source_id: 'tmdb',
    };
}

export async function getTmdbTrending(type: 'movie' | 'tv' = 'movie'): Promise<Movie[]> {
    try {
        const res = await fetchWithTimeout(
            `${TMDB_BASE_URL}/trending/${type}/week?api_key=${TMDB_API_KEY}&language=zh-CN`,
            2500,
            { next: { revalidate: 43200 } }
        );

        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);

        const data = await res.json();
        return (data.results || []).map((item: TmdbItem) => normalizeTmdbToMovie(item, type));
    } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
            logger.warn('TMDB', `Error fetching trending (${type}):`, error);
        }
        return [];
    }
}

export async function getTmdbPopular(type: 'movie' | 'tv' = 'movie'): Promise<Movie[]> {
    try {
        const res = await fetchWithTimeout(
            `${TMDB_BASE_URL}/${type}/popular?api_key=${TMDB_API_KEY}&language=zh-CN`,
            2500,
            { next: { revalidate: 43200 } }
        );

        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);

        const data = await res.json();
        return (data.results || []).map((item: TmdbItem) => normalizeTmdbToMovie(item, type));
    } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
            logger.warn('TMDB', `Error fetching popular (${type}):`, error);
        }
        return [];
    }
}

export async function getTmdbDiscover(type: 'movie' | 'tv' = 'movie', page: number = 1): Promise<Movie[]> {
    try {
        const res = await fetchWithTimeout(
            `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=zh-CN&sort_by=popularity.desc&page=${page}`,
            2500,
            { next: { revalidate: 43200 } }
        );

        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);

        const data = await res.json();
        return (data.results || []).map((item: TmdbItem) => normalizeTmdbToMovie(item, type));
    } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
            logger.warn('TMDB', `Error discovering (${type}) page ${page}:`, error);
        }
        return [];
    }
}
