import { Movie } from '@/types';
import { MetadataProvider } from './interface';
import { getTmdbTrending, getTmdbPopular, getTmdbDiscover } from '../tmdb';

import { SERVER_CONFIG } from '@/config/server';

const TMDB_API_KEY = SERVER_CONFIG.TMDB.API_KEY;
const TMDB_BASE_URL = SERVER_CONFIG.TMDB.BASE_URL;

export class TmdbMetadataProvider implements MetadataProvider {
    id = 'tmdb';

    getName() {
        return 'TMDB';
    }

    async getTrending(type: 'movie' | 'tv') {
        try {
            return await getTmdbTrending(type);
        } catch (e: any) {
            console.warn(`TMDB getTrending(${type}) failed: ${e.message || String(e)}`);
            return [];
        }
    }

    async getPopular(type: 'movie' | 'tv') {
        try {
            return await getTmdbPopular(type);
        } catch (e: any) {
            console.warn(`TMDB getPopular(${type}) failed: ${e.message || String(e)}`);
            return [];
        }
    }

    async getDiscover(type: 'movie' | 'tv', page: number) {
        try {
            return await getTmdbDiscover(type, page);
        } catch (e: any) {
            console.warn(`TMDB getDiscover(${type}) failed: ${e.message || String(e)}`);
            return [];
        }
    }

    async getDetail(id: string) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            try {
                let res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=zh-CN`, {
                    signal: controller.signal
                });
                let data = await res.json();

                if (data.success === false) {
                    const resTv = await fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=zh-CN`, {
                        signal: controller.signal
                    });
                    data = await resTv.json();
                }
                clearTimeout(timeoutId);

                if (data.id) {
                    return {
                        title: data.title || data.name,
                        overview: data.overview,
                        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
                        success: true
                    };
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.warn('TMDB Network Error:', fetchError);
                return null;
            }
        } catch (e) {
            console.error('TMDB Detail fetch failed:', e);
        }
        return null;
    }
}
