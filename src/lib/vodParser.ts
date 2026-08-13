import { Episode, PlayGroup } from '@/types';

// 产品定位：仅支持直链流媒体。可播扩展名严格限定为 m3u8 / mp4 / webm。
const DIRECT_EXT_RE = /\.(m3u8|mp4|webm)(?:[?#]|$)/i;
// 云播/解析/跳转类线路关键词（忽略大小写；中文关键词按小写原文匹配）
const CLOUD_LINE_KEYWORDS = ['yun', 'cloud', 'parse', '解析', '跳转', 'player', 'iframe', '共享', '云'];

function trimUrl(url: string | undefined | null): string {
    return (url || '').trim();
}

function looksLikeUrl(raw: string): boolean {
    const u = raw.trim();
    if (!u) return false;
    if (/^(https?:\/\/|blob:|data:|\/\/|\/)/i.test(u)) return true;
    return DIRECT_EXT_RE.test(u);
}

/**
 * 是否为可直接交给 HLS.js / 原生 video 播放的直链。
 * 严格版：只有包含 .m3u8 / .mp4 / .webm 的地址才算可播；
 * 纯 HTML 播放页、无扩展名解析接口、FLV 等一律视为不可播。
 */
export function isDirectPlayableUrl(url: string | undefined | null): boolean {
    const u = trimUrl(url);
    return !!u && DIRECT_EXT_RE.test(u);
}

/**
 * 是否为云播/解析/跳转类线路名。
 */
export function isCloudLine(name: string | undefined | null): boolean {
    const n = (name || '').toLowerCase();
    if (!n) return false;
    return CLOUD_LINE_KEYWORDS.some(k => n.includes(k));
}

/**
 * 把相对播放地址解析为绝对地址。相对地址以 baseUrl 的 origin 为基准。
 */
export function resolvePlayUrl(rawUrl: string, baseUrl?: string | null): string {
    const u = trimUrl(rawUrl);
    if (!u) return u;
    if (/^(https?:\/\/|blob:|data:)/i.test(u)) return u;
    if (u.startsWith('//')) return 'https:' + u;
    if (baseUrl) {
        try {
            const base = new URL(baseUrl);
            if (u.startsWith('/')) return base.origin + u;
            return new URL(u, base.origin + '/').toString();
        } catch {
            return u;
        }
    }
    return u;
}

export function isDirectPlayableEpisodeList(episodes: Episode[]): boolean {
    if (!episodes || episodes.length === 0) return false;
    const ok = episodes.filter(e => isDirectPlayableUrl(e.url)).length;
    return ok >= Math.ceil(episodes.length * 0.8);
}

/**
 * 单个线路组是否可保留：
 * 1) 名字是云播/解析类且名字本身不含 m3u8/mp4/webm → 丢弃
 * 2) 组内直链可播比例低于 80% → 丢弃
 */
function isPlayableGroup(name: string | undefined, episodes: Episode[]): boolean {
    if (episodes.length === 0) return false;
    if (isCloudLine(name) && !DIRECT_EXT_RE.test(name || '')) return false;
    return isDirectPlayableEpisodeList(episodes);
}

export function parseSinglePlaylist(playlist: string, baseUrl?: string | null): Episode[] {
    const cleanPlaylist = playlist.trim();
    if (!cleanPlaylist) return [];

    const episodes = cleanPlaylist.split('#').map(ep => {
        const parts = ep.split('$');
        if (parts.length >= 2) {
            return { name: parts[0], url: resolvePlayUrl(parts[1], baseUrl) };
        } else {
            const potentialUrl = parts[0];
            const name = potentialUrl.startsWith('http') ? '播放' : potentialUrl;
            return { name, url: resolvePlayUrl(potentialUrl, baseUrl) };
        }
    }).filter(e => {
        if (!e.url || typeof e.url !== 'string') return false;
        return looksLikeUrl(e.url);
    });

    // 整个字符串就是一个播放地址（没有 # 分集分隔符）
    if (episodes.length === 0 && looksLikeUrl(cleanPlaylist)) {
        episodes.push({ name: 'Play', url: resolvePlayUrl(cleanPlaylist, baseUrl) });
    }

    return episodes;
}

/**
 * 详情页默认起播解析：只从严格直链可播的线路组中选，优先 m3u8，其次 mp4/webm。
 * 没有可用直链时返回空数组，绝不选中云播/解析组。
 */
export function parseVodPlayUrl(url: string | undefined | null, baseUrl?: string | null): Episode[] {
    if (!url) return [];
    const rawUrl = url.trim();
    if (!rawUrl) return [];

    const playlists = rawUrl.split('$$$');
    const candidates: { episodes: Episode[]; score: number }[] = [];

    for (const playlist of playlists) {
        const episodes = parseSinglePlaylist(playlist, baseUrl);
        if (!isDirectPlayableEpisodeList(episodes)) continue;

        const lower = playlist.toLowerCase();
        const score = lower.includes('.m3u8') ? 2 : (lower.includes('.mp4') || lower.includes('.webm')) ? 1 : 0;
        candidates.push({ episodes, score });
    }

    if (candidates.length === 0) {
        // 单地址（无 $$$ / #）且严格可播
        if (isDirectPlayableUrl(rawUrl) && !rawUrl.includes('$') && !rawUrl.includes('#')) {
            return parseSinglePlaylist(rawUrl, baseUrl);
        }
        return [];
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].episodes;
}

export function parseVodPlayGroups(url: string | undefined | null, playFrom?: string | null, baseUrl?: string | null): PlayGroup[] {
    if (!url) return [];
    const rawUrl = url.trim();
    if (!rawUrl) return [];

    const playlists = rawUrl.split('$$$');
    const fromParts = playFrom ? playFrom.split('$$$') : [];

    const groups: PlayGroup[] = [];

    playlists.forEach((playlist, index) => {
        const cleanPlaylist = playlist.trim();
        if (!cleanPlaylist) return;

        let name = '';
        if (fromParts[index]) {
            name = fromParts[index].trim();
        }
        if (!name) {
            name = `线路${index + 1}`;
        }

        const episodes = parseSinglePlaylist(cleanPlaylist, baseUrl);
        if (!isPlayableGroup(name, episodes)) return;

        groups.push({
            id: `group-${index}`,
            name,
            playUrl: cleanPlaylist,
            episodes
        });
    });

    return groups;
}
