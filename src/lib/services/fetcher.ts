import { fetchWithTimeout } from '../utils';
import { ApiResponse } from '@/types';
import { ResourceSite } from '../resources';
import { CONFIG } from '@/config/config';

export async function fetchRawFromSource(source: ResourceSite, params: string = '', noStore = false): Promise<any> {
    const url = `${source.baseUrl}${params}`;

    // noStore=true for real-time search (always fresh); false for home/detail pages (cacheable)
    const cacheOptions = noStore
        ? { cache: 'no-store' as RequestCache }
        : { next: { revalidate: CONFIG.API_REVALIDATE_SECONDS } };

    try {
        const res = await fetchWithTimeout(url, CONFIG.SEARCH_TIMEOUT, cacheOptions);
        const text = await res.text();

        // Only support JSON responses for Edge Runtime compatibility
        if (!text.trim().startsWith('{')) {
            console.warn(`Non-JSON response from ${source.name}, skipping`);
            return null;
        }

        return JSON.parse(text);
    } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
        throw error;
    }
}
