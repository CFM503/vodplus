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
