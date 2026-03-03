interface Episode {
    name: string;
    url: string;
}

export function parseVodPlayUrl(url: string | undefined | null): Episode[] {
    if (!url) return [];

    // The API usually returns "Name$url#Name2$url2" or multiple lists separated by $$$
    // Format: "EpisodeName$URL#EpisodeName2$URL2"
    // Sometimes raw XML format contains multiple <dd> tags which our API joins with $$$

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

    // 2. Parse Episodes (separated by #)
    const episodes = activePlaylist.split('#').map(ep => {
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

    // 3. Fallback: Treat whole string as URL if parsing failed but it looks like a URL
    if (episodes.length === 0) {
        if (activePlaylist.startsWith('http')) {
            episodes.push({ name: 'Play', url: activePlaylist });
        } else if (rawUrl.startsWith('http') && !rawUrl.includes('$') && !rawUrl.includes('#')) {
            episodes.push({ name: 'Play', url: rawUrl });
        }
    }

    return episodes;
}
