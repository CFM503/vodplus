
import { RESOURCE_SITES, ResourceSite } from '../resources';
import { parseCustomSources } from '../sourceConfig';
import { ApiResponse, Movie } from '@/types';
type MediaType = 'movie' | 'tv';
import { getMetadataProvider } from '../metadata';
import { fetchRawFromSource } from './fetcher';
import { normalizeVodResponse } from './normalizer';
import { CONFIG } from '@/config/config';
import { withErrorHandling } from './errorHandler';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { logger } from '../logger';

// Request deduplication cache to prevent duplicate simultaneous requests
const DEDUP_TTL_MS = 5000;
const pendingRequests = new Map<string, { promise: Promise<any>; ts: number }>();

function dedupFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const entry = pendingRequests.get(key);
  if (entry && Date.now() - entry.ts < DEDUP_TTL_MS) {
    return entry.promise as Promise<T>;
  }
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, { promise, ts: Date.now() });
  return promise;
}

export async function fetchFromSource(source: ResourceSite, params: string = '', noStore = false, timeoutOverride?: number): Promise<ApiResponse> {
    const cacheKey = `${source.id}:${params}:${noStore}:${timeoutOverride || ''}`;
    return dedupFetch(cacheKey, async () => {
        const startTime = Date.now();
        try {
            const data = await fetchRawFromSource(source, params, noStore, timeoutOverride);
            const duration = Date.now() - startTime;
            return normalizeVodResponse(data, source, duration);
        } catch (error) {
            logger.error('FetchFromSource', `Error fetching from ${source.name}:`, error);
            return { code: 500, msg: 'Error', page: 1, pagecount: 0, limit: 0, total: 0, list: [] };
        }
    });
}


export async function getRecentMovies(sourceId: string = 'feifan', page: number = 1, type: 'movie' | 'tv' = 'movie', disabledSources: string[] = [], customLocalUrl: string = '', customSources?: ResourceSite[]) {
    if (sourceId === 'tmdb') {
        try {
            const provider = getMetadataProvider(sourceId);
            const list = await provider.getDiscover(type, page);

            // If TMDB returns data, use it
            if (list && list.length > 0) {
                return {
                    code: 1,
                    msg: 'OK',
                    page,
                    pagecount: 5,
                    limit: 20,
                    total: 100,
                    list
                };
            }
        } catch (e) {
            logger.warn('vodService', 'TMDB getDiscover failed, falling back to native source', e);
        }

        // Auto-fallback to native source if TMDB failed or returned empty
        const fallbackList = await fetchMixedCategory(type === 'movie' ? 1 : 2, page, 20, disabledSources, customLocalUrl);
        return {
            code: 1,
            msg: 'Fallback to native source',
            page,
            pagecount: 50,
            limit: 20,
            total: 1000,
            list: fallbackList
        };
    }

    // v0.9.31: 内置源优先, 否则查找用户自定义源
    const source = RESOURCE_SITES.find(s => s.id === sourceId) || customSources?.find(s => s.id === sourceId) || RESOURCE_SITES[0];
    return fetchFromSource(source, `?ac=detail&pg=${page}&t=`, false, CONFIG.LIST_TIMEOUT || 4000);
}

export async function getMovieDetail(sourceId: string, id: string, disabledSources: string[] = [], nameHint?: string, customSources?: ResourceSite[]) {
    if (sourceId === 'tmdb') {
        const provider = getMetadataProvider(sourceId);
        const detailId = id.replace(`${sourceId}-`, '');
        try {
            const tmdbPromise = provider.getDetail(detailId);
            
            let bestEntry = null;
            let candidates: any[] = [];
            let data = null;

            if (nameHint) {
                // Parallel Mode: Fetch TMDB details and VOD matching in parallel
                const matchPromise = performRaceMatch(nameHint, disabledSources);
                const [tmdbResult, matchResult] = await Promise.all([tmdbPromise, matchPromise]);
                data = tmdbResult;
                bestEntry = matchResult.bestEntry;
                candidates = matchResult.candidates;
            } else {
                // Serial Mode Fallback
                data = await tmdbPromise;
                if (data) {
                    const name = data.title;
                    if (name) {
                        const matchResult = await performRaceMatch(name, disabledSources);
                        bestEntry = matchResult.bestEntry;
                        candidates = matchResult.candidates;
                    }
                }
            }

            if (!data) return null;
            const finalName = nameHint || data.title;

            if (bestEntry) {
                const { match } = bestEntry;
                // Update metadata from the discovery provider
                return {
                    ...match,
                    vod_name: finalName,
                    vod_content: data.overview || match.vod_content,
                    vod_pic: data.poster || match.vod_pic,
                    // Return and cache all candidates fetched so far for client-side line switching
                    candidates: candidates.map(c => ({
                        source_id: c.source.id,
                        source_name: c.source.name,
                        vod_id: c.match.vod_id,
                        vod_play_url: c.match.vod_play_url,
                        vod_play_from: c.match.vod_play_from || c.source.name,
                    })),
                };
            }
        } catch (e) {
            logger.error('vodService', 'Match & Play Error:', e);
        }
        return null;
    }

    // v0.9.31: 优先内置源, 否则查找用户自定义源
    const source = RESOURCE_SITES.find(s => s.id === sourceId) || customSources?.find(s => s.id === sourceId);
    if (!source) return null;
    const res = await fetchFromSource(source, `${source.detailPath}${id}`);
    return res.list[0] || null;
}

const internalCachedGetMovieDetail = unstable_cache(
    async (sourceId: string, id: string, disabledSourcesKey: string, nameHint?: string, customSourcesKey?: string) => {
        const disabledSources = disabledSourcesKey ? disabledSourcesKey.split(',') : [];
        const customSources = customSourcesKey ? parseCustomSources(customSourcesKey) : [];
        return getMovieDetail(sourceId, id, disabledSources, nameHint, customSources);
    },
    ['movie-detail-v4'],
    { revalidate: CONFIG.DETAIL_REVALIDATE_SECONDS || 43200 }
);

// React.cache ensures per-request deduplication (e.g. generateMetadata + MovieDetail page component)
export const cachedGetMovieDetail = cache(async (sourceId: string, id: string, disabledSources: string[] = [], nameHint?: string, customSources?: ResourceSite[]) => {
    const disabledSourcesKey = (disabledSources || []).slice().sort().join(',');
    // 自定义源序列化后参与缓存键, 保证自定义源配置变化时缓存失效
    const customSourcesKey = customSources && customSources.length > 0 ? JSON.stringify(customSources) : '';
    return internalCachedGetMovieDetail(sourceId, id, disabledSourcesKey, nameHint, customSourcesKey);
});

import { isNameMatch } from '@/lib/nameMatch';
export { isNameMatch };

async function performRaceMatch(name: string, disabledSources: string[]) {
    const activeSources = RESOURCE_SITES.filter(s => !disabledSources.includes(s.id));
    const candidates: any[] = [];
    const targetCount = CONFIG.MATCH_CANDIDATE_COUNT || 8;

    // Create a promise for each source search
    const searchPromises = activeSources.map(async (source) => {
        try {
            const searchUrl = source.searchPath.replace('ac=list', 'ac=detail');
            // Use a configurable timeout for candidate searches to avoid blocking SSR
            const res = await fetchFromSource(source, `${searchUrl}${encodeURIComponent(name)}`, false, CONFIG.MATCH_SOURCE_TIMEOUT || 3500);

            if (res && res.list && res.list.length > 0) {
                // Find precise match within this source's results
                const match = res.list.find((m: any) =>
                    m.vod_play_url && isNameMatch(m.vod_name, name)
                );

                if (match) {
                    return { source, match, timestamp: Date.now() };
                }
            }
        } catch (e) {
            // Ignore individual source errors
        }
        return null;
    });

    // Race to N implementation with total timeout and source deduplication
    await new Promise<void>((resolve) => {
        let completed = 0;
        let found = 0;
        let resolved = false;

        const totalTimeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        }, CONFIG.MATCH_TOTAL_TIMEOUT || 5500);

        const finish = () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(totalTimeout);
                resolve();
            }
        };

        if (searchPromises.length === 0) finish();

        searchPromises.forEach(p => {
            p.then(result => {
                if (resolved) return;
                completed++;
                if (result) {
                    // Deduplicate by source_id so each site has at most 1 candidate
                    if (!candidates.some(c => c.source.id === result.source.id)) {
                        candidates.push(result);
                        found++;
                    }
                }

                // Stop waiting if we have enough candidates OR all sources finished
                if (found >= targetCount || completed === searchPromises.length) {
                    finish();
                }
            });
        });
    });

    const bestEntry = selectBestMatch(candidates, name);
    return { bestEntry, candidates };
}

function selectBestMatch(candidates: any[], targetName: string) {
    if (!candidates || candidates.length === 0) return null;

    // Sort candidates by priority:
    // 1. Exact Name Match
    // 2. Arrival Order (implies speed)

    candidates.sort((a, b) => {
        const nameA = a.match.vod_name.trim();
        const nameB = b.match.vod_name.trim();
        const target = targetName.trim();

        const aIsExact = nameA === target;
        const bIsExact = nameB === target;

        if (aIsExact && !bIsExact) return -1;
        if (!aIsExact && bIsExact) return 1;

        // If both are exact or both are partial, prefer the one that arrived first
        return a.timestamp - b.timestamp;
    });

    const best = candidates[0];
    return best;
}


// Helper to mix results from multiple sources to ensure reliability
async function fetchMixedCategory(typeId: number, page: number = 1, limit: number = 12, disabledSources: string[] = [], customLocalUrl: string = ''): Promise<Movie[]> {
    if (customLocalUrl) {
        // If custom URL is provided, only fetch from this source
        const customSource: ResourceSite = {
            id: 'custom_local',
            name: 'Custom Local',
            baseUrl: customLocalUrl,
            searchPath: '?ac=detail&wd=',
            detailPath: '?ac=detail&ids=',
            headers: {}
        };
        try {
            // Basic validation for URL
            if (!customLocalUrl.startsWith('http')) throw new Error('Invalid URL');

            const res = await fetchFromSource(customSource, `?ac=detail&pg=${page}&t=${typeId}`);
            return res.list.slice(0, limit);
        } catch (e) {
            logger.error('vodService', 'Custom local source fetch failed', e);
            return [];
        }
    }

    // Filter out disabled sources and take the top 4 remaining ones
    const activeSources = RESOURCE_SITES.filter(s => !disabledSources.includes(s.id));
    const sources = activeSources.slice(0, 4);

    if (sources.length === 0) return [];
    try {
        const promises = sources.map(s =>
            fetchFromSource(s, `?ac=detail&pg=${page}&t=${typeId}`, false, CONFIG.LIST_TIMEOUT || 4000)
                .then(res => res.list)
                .catch(() => [])
        );

        const results = await Promise.all(promises);
        const mixed: Movie[] = [];
        const maxLen = Math.max(...results.map(r => r.length));

        // Interleave results
        const seen = new Set<string>();
        for (let i = 0; i < maxLen; i++) {
            for (const list of results) {
                if (list[i]) {
                    const name = list[i].vod_name.trim();
                    if (!seen.has(name)) { // Simple dedup
                        seen.add(name);
                        mixed.push(list[i]);
                    }
                }
            }
            if (mixed.length >= limit) break;
        }

        return mixed.slice(0, limit);
    } catch (e) {
        logger.error('vodService', `Error fetching category ${typeId}`, e);
        return [];
    }
}

// Individual fetchers for Streaming
export async function getTrendingMovies(source: string, disabledSources: string[], customLocalUrl: string) {
    return fetchTrendingWithFallback(source, 'movie', 1, disabledSources, customLocalUrl);
}

export async function getTrendingTv(source: string, disabledSources: string[], customLocalUrl: string) {
    return fetchTrendingWithFallback(source, 'tv', 2, disabledSources, customLocalUrl);
}

export async function getNewestAction(disabledSources: string[], customLocalUrl: string) {
    return fetchMixedCategory(6, 1, 12, disabledSources, customLocalUrl);
}

export async function getNewestTv(disabledSources: string[], customLocalUrl: string) {
    return fetchMixedCategory(13, 1, 12, disabledSources, customLocalUrl);
}

// Helper to safely fetch trending with fallback
async function fetchTrendingWithFallback(
    source: string,
    type: MediaType,
    typeId: number,
    disabledSources: string[],
    customLocalUrl: string
): Promise<Movie[]> {
    let items: Movie[] = [];
    if (source === 'tmdb') {
        items = await withErrorHandling(
            () => getMetadataProvider(source).getTrending(type),
            {
                context: `TMDB Trending ${type === 'movie' ? 'Movies' : 'TV'}`,
                fallback: []
            }
        );
    }

    // If discovery failed or returned empty (and we were supposed to use it), OR if we are in local mode
    if (items.length === 0) {
        items = await fetchMixedCategory(typeId, 2, 12, disabledSources, customLocalUrl);
    }
    return items.slice(0, 12);
}

