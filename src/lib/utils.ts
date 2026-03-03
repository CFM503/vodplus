import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Fetch with automatic timeout protection
 * @param url - URL to fetch
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @param options - Standard fetch options
 */
export async function fetchWithTimeout(
    url: string,
    timeout: number = 5000,
    options: RequestInit = {}
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function getProxyImage(url: string | undefined): string {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500';
    }

    let cleanUrl = url.trim();

    // Avoid double proxying
    if (cleanUrl.includes('wsrv.nl') || cleanUrl.includes('weserv.nl')) {
        return cleanUrl;
    }

    // Handle protocol-less URLs
    if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
    } else if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    // Use wsrv.nl proxy (it's very reliable for Chinese VOD sites)
    // We remove the default param to avoid potential encoding issues with the fallback URL itself
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp`;
}

export function getThemedPlaceholder(typeName?: string, vodName?: string): string {
    // Generate a themed placeholder based on content type
    const type = (typeName || '').toLowerCase();
    const name = (vodName || '').toLowerCase();

    // Use different themed images based on content type
    if (type.includes('动作') || type.includes('action')) {
        return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&h=750&fit=crop';
    } else if (type.includes('喜剧') || type.includes('comedy')) {
        return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&h=750&fit=crop';
    } else if (type.includes('爱情') || type.includes('romance') || type.includes('韩')) {
        return 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=500&h=750&fit=crop';
    } else if (type.includes('科幻') || type.includes('sci-fi')) {
        return 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&h=750&fit=crop';
    } else if (type.includes('恐怖') || type.includes('horror')) {
        return 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=500&h=750&fit=crop';
    } else if (type.includes('动漫') || type.includes('anime')) {
        return 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&h=750&fit=crop';
    } else if (type.includes('综艺') || type.includes('variety')) {
        return 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&h=750&fit=crop';
    } else if (type.includes('纪录') || type.includes('记录') || type.includes('documentary')) {
        return 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&h=750&fit=crop';
    } else if (type.includes('短剧')) {
        return 'https://images.unsplash.com/photo-1574267432644-f610a4ab6a4c?w=500&h=750&fit=crop';
    }

    // Default movie poster
    return 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&h=750&fit=crop';
}

export function getLatencyInfo(latency: number) {
    if (latency < 0) {
        return {
            label: '---',
            level: 'unknown',
            color: '#6b7280'
        };
    }

    if (latency < 100) {
        return {
            label: `${latency}ms`,
            level: 'excellent',
            color: '#10b981' // green
        };
    }

    if (latency < 300) {
        return {
            label: `${latency}ms`,
            level: 'good',
            color: '#3b82f6' // blue
        };
    }

    if (latency < 500) {
        return {
            label: `${latency}ms`,
            level: 'fair',
            color: '#f59e0b' // amber
        };
    }

    return {
        label: `${latency}ms`,
        level: 'slow',
        color: '#ef4444' // red
    };
}
export function setCookie(name: string, value: string, days: number = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = typeof document !== 'undefined' ? document.cookie.split(';') : [];
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}
