import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { logger } from './logger';

interface UserPreferences {
    disabledSources: string[];
    movieSource: string;
    tvSource: string;
    customLocalUrl: string;
}

export async function getUserPreferences(cookieStore: ReadonlyRequestCookies): Promise<UserPreferences> {
    // 1. Get Disabled Sources
    const disabledCookie = cookieStore.get('VOD_DISABLED_SOURCES_V2')?.value;
    let disabledSources: string[] = [];
    if (disabledCookie) {
        try {
            disabledSources = JSON.parse(disabledCookie);
        } catch (e: unknown) {
            logger.error('Preferences', 'Failed to parse disabled sources cookie', e);
        }
    }

    // 2. Get Sources
    // Sanitize legacy 'douban' cookies or invalid values
    let movieSource = cookieStore.get('VOD_MOVIE_SOURCE')?.value || 'tmdb';
    let tvSource = cookieStore.get('VOD_TV_SOURCE')?.value || 'tmdb';

    if (movieSource !== 'local' && movieSource !== 'tmdb') movieSource = 'tmdb';
    if (tvSource !== 'local' && tvSource !== 'tmdb') tvSource = 'tmdb';

    // 3. Get Custom URL
    const customLocalUrl = cookieStore.get('VOD_CUSTOM_LOCAL_URL')?.value || '';

    return {
        disabledSources,
        movieSource,
        tvSource,
        customLocalUrl
    };
}
