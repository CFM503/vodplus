import { Episode, PlayGroup } from '@/types';

export function parseSinglePlaylist(playlist: string): Episode[] {
    const cleanPlaylist = playlist.trim();
    if (!cleanPlaylist) return [];

    const episodes = cleanPlaylist.split('#').map(ep => {
        const parts = ep.split('$');
        if (parts.length >= 2) {
            return { name: parts[0], url: parts[1] };
        } else {
            // Handle cases where name is missing "http://url"
            const potentialUrl = parts[0];
            const name = potentialUrl.startsWith('http') ? '播放' : potentialUrl;
            return { name, url: potentialUrl };
        }
    }).filter(e => {
        if (!e.url || typeof e.url !== 'string') return false;
        const cleanUrl = e.url.trim();
        // Check for valid URL protocols or extensions
        const isValidProtocol = cleanUrl.startsWith('http');
        const hasValidExt = cleanUrl.includes('.m3u8') || cleanUrl.includes('.mp4');
        return isValidProtocol || hasValidExt;
    });

    // Fallback: Treat whole string as URL if parsing failed but it looks like a URL
    if (episodes.length === 0) {
        if (cleanPlaylist.startsWith('http')) {
            episodes.push({ name: 'Play', url: cleanPlaylist });
        }
    }

    return episodes;
}

export function parseVodPlayUrl(url: string | undefined | null): Episode[] {
    if (!url) return [];
    const rawUrl = url.trim();
    if (!rawUrl) return [];

    // 1. Handle Multiple Playlists (separated by $$$)
    // We prioritize .m3u8 playlists if multiple exist
    const playlists = rawUrl.split('$$$');
    let activePlaylist = playlists[0] || '';

    // Simple heuristic: prefer m3u8
    for (const p of playlists) {
        if (p.includes('.m3u8')) {
            activePlaylist = p;
            break;
        }
    }

    const parsed = parseSinglePlaylist(activePlaylist);

    // Fallback: If parsing of the chosen playlist failed but rawUrl itself looks like a direct link
    if (parsed.length === 0 && rawUrl.startsWith('http') && !rawUrl.includes('$') && !rawUrl.includes('#')) {
        parsed.push({ name: 'Play', url: rawUrl });
    }

    return parsed;
}

export function parseVodPlayGroups(url: string | undefined | null, playFrom?: string | null): PlayGroup[] {
    if (!url) return [];
    const rawUrl = url.trim();
    if (!rawUrl) return [];

    const playlists = rawUrl.split('$$$');
    const fromParts = playFrom ? playFrom.split('$$$') : [];

    const groups: PlayGroup[] = [];

    playlists.forEach((playlist, index) => {
        const cleanPlaylist = playlist.trim();
        if (!cleanPlaylist) return;

        const episodes = parseSinglePlaylist(cleanPlaylist);
        if (episodes.length === 0) return;

        let name = '';
        if (fromParts[index]) {
            name = fromParts[index].trim();
        }
        if (!name) {
            name = `线路${index + 1}`;
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
