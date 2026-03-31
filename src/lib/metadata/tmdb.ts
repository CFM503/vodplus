import { Movie } from '@/types';
import { MetadataProvider } from './interface';
import { getTmdbTrending, getTmdbPopular, getTmdbDiscover, TMDB_API_KEY, TMDB_BASE_URL } from '../tmdb';
import { logger } from '../logger';

export class TmdbMetadataProvider implements MetadataProvider {
    id = 'tmdb';

    getName() {
        return 'TMDB';
    }

    async getTrending(type: 'movie' | 'tv') {
        try {
            return await getTmdbTrending(type);
        } catch (e: unknown) {
            logger.warn('TMDB', `getTrending(${type}) failed:`, e);
            return [];
        }
    }

    async getPopular(type: 'movie' | 'tv') {
        try {
            return await getTmdbPopular(type);
        } catch (e: unknown) {
            logger.warn('TMDB', `getPopular(${type}) failed:`, e);
            return [];
        }
    }

    async getDiscover(type: 'movie' | 'tv', page: number) {
        try {
            return await getTmdbDiscover(type, page);
        } catch (e: unknown) {
            logger.warn('TMDB', `getDiscover(${type}) failed:`, e);
            return [];
        }
    }

    async getDetail(id: string) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            try {
                let res = await fetch(`${TMDB_BASE_URL}/movie/${id}?language=zh-CN`, {
                    signal: controller.signal,
                    headers: { Authorization: `Bearer ${TMDB_API_KEY}` }
                });
                let data = await res.json();

                if (data.success === false) {
                    const resTv = await fetch(`${TMDB_BASE_URL}/tv/${id}?language=zh-CN`, {
                        signal: controller.signal,
                        headers: { Authorization: `Bearer ${TMDB_API_KEY}` }
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
                logger.warn('TMDB', 'Network Error:', fetchError);
                return null;
            }
        } catch (e) {
            logger.error('TMDB', 'Detail fetch failed:', e);
        }
        return null;
    }
}
