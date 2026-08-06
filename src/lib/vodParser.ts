import { Episode, PlayGroup } from '@/types';

export function isDirectPlayableUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    const u = url.trim().toLowerCase();
    if (!u.startsWith('http')) return false;
    return u.includes('.m3u8') || u.includes('.mp4') || u.includes('.webm') || u.includes('.flv');
}

export function isDirectPlayableEpisodeList(episodes: Episode[]): boolean {
    if (!episodes || episodes.length === 0) return false;
    const ok = episodes.filter(e => isDirectPlayableUrl(e.url)).length;
    return ok >= Math.ceil(episodes.length * 0.8);
}

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

    const playlists = rawUrl.split('$$$');
    let bestPlaylist = '';

    // Loop through playlists and prioritize direct playable stream groups
    for (const playlist of playlists) {
        const episodes = parseSinglePlaylist(playlist);
        if (isDirectPlayableEpisodeList(episodes)) {
            if (!bestPlaylist || playlist.toLowerCase().includes('.m3u8')) {
                bestPlaylist = playlist;
                if (playlist.toLowerCase().includes('.m3u8')) {
                    break;
                }
            }
        }
    }

    // Fallback if no playlist passed direct-playable verification
    if (!bestPlaylist && playlists.length > 0) {
        bestPlaylist = playlists.find(p => p.toLowerCase().includes('.m3u8')) || playlists[0];
    }

    const parsed = parseSinglePlaylist(bestPlaylist);

    // Fallback: If parsing failed but rawUrl itself is a direct playable link
    if (parsed.length === 0 && isDirectPlayableUrl(rawUrl) && !rawUrl.includes('$') && !rawUrl.includes('#')) {
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

        let name = '';
        if (fromParts[index]) {
            name = fromParts[index].trim();
        }
        if (!name) {
            name = `线路${index + 1}`;
        }

        // Safeguard: Filter out player indicator names containing 'yun' but lacking direct stream hints
        const lowerFrom = name.toLowerCase();
        if (lowerFrom.includes('yun') && !lowerFrom.includes('m3u8') && !lowerFrom.includes('mp4') && !lowerFrom.includes('webm')) {
            return; // drop web/iframe yun player lines
        }

        const episodes = parseSinglePlaylist(cleanPlaylist);
        // Filter out groups that fail direct playable checks
        if (!isDirectPlayableEpisodeList(episodes)) {
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
