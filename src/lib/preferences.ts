import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { logger } from './logger';
import { ResourceSite } from './resources';
import { readCustomSourcesFromCookieStore } from './sourceConfig';

interface UserPreferences {
    disabledSources: string[];
    movieSource: string;
    tvSource: string;
    customLocalUrl: string;
    // v0.9.31: 自定义资源站列表 (用户通过 设置-资源站管理 添加, 存于 Cookie)
    customSources: ResourceSite[];
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

    // 4. Get Custom Sources (v0.9.31)
    const customSources = readCustomSourcesFromCookieStore(cookieStore);

    return {
        disabledSources,
        movieSource,
        tvSource,
        customLocalUrl,
        customSources
    };
}
