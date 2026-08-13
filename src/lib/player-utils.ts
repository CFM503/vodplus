/**
 * 播放进度缓存 Key。
 * 带媒体扩展名的直链地址通常 query 是动态签名，去掉 query 以便跨会话恢复进度；
 * 无扩展名/接口型地址（自定义源常见）query 可能标识具体流，保留 query 避免不同流共用同一 Key。
 * 仅剔除明确的易变签名参数。
 */
const MEDIA_PATH_RE = /\.(m3u8|mp4|webm|flv|ts|mpd|mov|mkv)(?:[?#]|$)/i;
const VOLATILE_PROGRESS_PARAMS = new Set([
    'sign', 'signature', 'token', 'expires', 'expire', 'timestamp',
    'nonce', 'rand', 'random', '_t', 'st', 'access_token', 'play_token',
]);

export function getProgressKey(videoUrl: string): string {
    try {
        const u = new URL(videoUrl);
        if (MEDIA_PATH_RE.test(u.pathname)) {
            return `VOD_PROGRESS_${u.origin}${u.pathname}`;
        }

        const params = new URLSearchParams(u.search);
        for (const name of Array.from(params.keys())) {
            if (VOLATILE_PROGRESS_PARAMS.has(name.toLowerCase())) {
                params.delete(name);
            }
        }
        const query = params.toString();
        return `VOD_PROGRESS_${u.origin}${u.pathname}${query ? `?${query}` : ''}`;
    } catch {
        return `VOD_PROGRESS_${videoUrl}`;
    }
}

/**
 * Format seconds into M:SS or H:MM:SS display format.
 */
export function formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Compute the scale factor required to fit video height inside player container.
 */
export function computeFitHeightScale(
    video: HTMLVideoElement | null,
    container: HTMLElement | null
): number | null {
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (!cw || !ch) return null;

    let vw = video ? video.videoWidth : 0;
    let vh = video ? video.videoHeight : 0;

    // Fallback 1: Use video.clientWidth / clientHeight if videoWidth/videoHeight is 0
    if (!vw || !vh) {
        if (video && video.clientWidth && video.clientHeight) {
            vw = video.clientWidth;
            vh = video.clientHeight;
        } else {
            // Fallback 2: Default 16:9 ratio for mobile layout fallback
            vw = 16;
            vh = 9;
        }
    }

    const videoAspect = vw / vh;
    const containerAspect = cw / ch;

    let scale = 1;
    if (videoAspect > containerAspect) {
        // Video is wider than container in letterbox (top/bottom black bars)
        // Rendered height under object-contain is cw / videoAspect
        const renderedH = cw / videoAspect;
        scale = ch / renderedH;
    } else {
        // Height is already filled (video is taller or square relative to container)
        scale = 1;
    }

    // Clamp between [1, 3] and round to 2 decimal places
    const clampedScale = Math.min(3, Math.max(1, Math.round(scale * 100) / 100));
    return clampedScale;
}
