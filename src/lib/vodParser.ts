import { Episode, PlayGroup } from '@/types';

// 已知流媒体扩展名。带扩展名时可直接判定为媒体地址，而不是 iframe/网页。
const MEDIA_EXT_RE = /\.(m3u8|mp4|webm|flv|ts|mpd|mov|mkv|ogg|aac|mp3|m4a|m4v|m4s)(?:[?#]|$)/i;
// 明确是网页/播放器页面的扩展名，不应交给 HLS.js。
const PAGE_EXT_RE = /\.(html|htm|php|aspx|jsp|shtml)(?:[?#]|$)/i;
// 明显的 iframe/嵌入地址特征。
const EMBED_HINT_RE = /(\/embed\/|\biframe\b|player\.php|embed=true)/i;

function trimUrl(url: string | undefined | null): string {
    return (url || '').trim();
}

function looksLikeUrl(raw: string): boolean {
    const u = raw.trim();
    if (!u) return false;
    if (/^(https?:\/\/|blob:|data:|\/\/|\/)/i.test(u)) return true;
    return MEDIA_EXT_RE.test(u);
}

/**
 * 判断是否为可直接交给播放器处理的媒体流地址。
 * 与旧实现不同：无扩展名的 http(s) 地址也视为可直接播放（HLS 常省略 .m3u8），
 * 只有明显的网页/iframe 地址才返回 false。
 */
export function isDirectPlayableUrl(url: string | undefined | null): boolean {
    const u = trimUrl(url);
    if (!u) return false;
    if (/^(blob:|data:)/i.test(u)) return true;
    if (u.startsWith('//') || u.startsWith('/')) return true;
    if (!u.startsWith('http')) return MEDIA_EXT_RE.test(u);
    if (PAGE_EXT_RE.test(u) || EMBED_HINT_RE.test(u)) return false;
    return true;
}

/**
 * 判断是否为 iframe/网页嵌入地址（需要 <iframe> 渲染）。
 */
export function isEmbedUrl(url: string | undefined | null): boolean {
    const u = trimUrl(url);
    if (!/^https?:\/\//i.test(u)) return false;
    if (MEDIA_EXT_RE.test(u)) return false;
    return PAGE_EXT_RE.test(u) || EMBED_HINT_RE.test(u);
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

export function parseVodPlayUrl(url: string | undefined | null, baseUrl?: string | null): Episode[] {
    if (!url) return [];
    const rawUrl = url.trim();
    if (!rawUrl) return [];

    const playlists = rawUrl.split('$$$');
    let bestPlaylist = '';

    // 优先选择含 .m3u8 的线路；其次保留可直接播放的线路。
    for (const playlist of playlists) {
        const episodes = parseSinglePlaylist(playlist, baseUrl);
        if (isDirectPlayableEpisodeList(episodes)) {
            if (!bestPlaylist || playlist.toLowerCase().includes('.m3u8')) {
                bestPlaylist = playlist;
                if (playlist.toLowerCase().includes('.m3u8')) {
                    break;
                }
            }
        }
    }

    // 没有通过“可直接播放”校验的线路时，回退到含 .m3u8 的线路或第一条。
    if (!bestPlaylist && playlists.length > 0) {
        bestPlaylist = playlists.find(p => p.toLowerCase().includes('.m3u8')) || playlists[0];
    }

    const parsed = parseSinglePlaylist(bestPlaylist, baseUrl);

    // 单地址（无 $$$ / #）直接返回
    if (parsed.length === 0 && isDirectPlayableUrl(rawUrl) && !rawUrl.includes('$') && !rawUrl.includes('#')) {
        parsed.push({ name: 'Play', url: resolvePlayUrl(rawUrl, baseUrl) });
    }

    return parsed;
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

        const lowerFrom = name.toLowerCase();
        const episodes = parseSinglePlaylist(cleanPlaylist, baseUrl);
        if (episodes.length === 0) return;

        // 老的线路名过滤规则：名字含 'yun' 且没有任何流媒体地址 → 视为网页/网盘线路丢弃。
        // 注意：这里用 isDirectPlayableUrl 而不是简单判断扩展名，避免把无扩展名 HLS 误杀。
        if (lowerFrom.includes('yun') && !episodes.some(e => isDirectPlayableUrl(e.url))) {
            return;
        }

        groups.push({
            id: `group-${index}`,
            name,
            playUrl: cleanPlaylist,
            episodes
        });
    });

    return groups;
}
