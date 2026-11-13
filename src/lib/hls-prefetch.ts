import type {
    FragmentLoaderConstructor,
    FragmentLoaderContext,
    HlsConfig,
    Loader,
    LoaderCallbacks,
    LoaderConfiguration,
    LoaderContext,
    LoaderStats,
    PlaylistLoaderConstructor,
    PlaylistLoaderContext,
} from 'hls.js';
import { isDirectPlayableUrl } from './vodParser';
import { getInitialBandwidthEstimate, getNetworkSnapshot, recordTransferSample } from './network-monitor';

interface PrefetchEntry {
    url: string;
    finalUrl: string;
    data: string | ArrayBuffer;
    bytes: number;
    durationMs: number;
    ttfbMs: number;
    createdAt: number;
    kind: 'playlist' | 'binary';
}

export interface PrefetchHlsOptions {
    priority?: 'high' | 'low';
    /** 预拉取的分片数量 (默认 1；活跃播放起播建议 2) */
    prefetchSegments?: number;
    /** 续播或跳过片头时指定起播秒数，精准预拉取对应分片而非第 0 片 */
    startPosition?: number;
    /** 若开启省流模式 (saveData) 或极慢 2G 网络则跳过投机预加载 */
    skipIfSaveData?: boolean;
}

const ENTRY_TTL_MS = 90_000;
const MAX_CACHE_BYTES = 24 * 1024 * 1024; // 24MB 上限
const MAX_SINGLE_ENTRY_BYTES = 12 * 1024 * 1024; // 单片超过 12MB 不入预取缓存
const MAX_ENTRIES = 24;
const MAX_PRECONNECT_ORIGINS = 12;

const memoryCache = new Map<string, PrefetchEntry>();
const inFlightRequests = new Map<string, Promise<PrefetchEntry | null>>();
const preconnectedOrigins = new Set<string>();
let totalCachedBytes = 0;

function createEmptyStats(): LoaderStats {
    return {
        aborted: false,
        loaded: 0,
        retry: 0,
        total: 0,
        chunkCount: 0,
        bwEstimate: 0,
        loading: { start: 0, first: 0, end: 0 },
        parsing: { start: 0, end: 0 },
        buffering: { start: 0, first: 0, end: 0 },
    };
}

function evictExpiredAndOverflow() {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
        if (now - entry.createdAt > ENTRY_TTL_MS) {
            memoryCache.delete(key);
            totalCachedBytes = Math.max(0, totalCachedBytes - entry.bytes);
        }
    }
    while (memoryCache.size > MAX_ENTRIES || totalCachedBytes > MAX_CACHE_BYTES) {
        const oldestKey = memoryCache.keys().next().value;
        if (!oldestKey) break;
        const removed = memoryCache.get(oldestKey);
        memoryCache.delete(oldestKey);
        if (removed) {
            totalCachedBytes = Math.max(0, totalCachedBytes - removed.bytes);
        }
    }
}

function putCache(key: string, entry: PrefetchEntry) {
    if (entry.bytes > MAX_SINGLE_ENTRY_BYTES) return;
    const prev = memoryCache.get(key);
    if (prev) {
        memoryCache.delete(key);
        totalCachedBytes = Math.max(0, totalCachedBytes - prev.bytes);
    }
    memoryCache.set(key, entry);
    totalCachedBytes += entry.bytes;
    evictExpiredAndOverflow();
}

function getCache(key: string): PrefetchEntry | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > ENTRY_TTL_MS) {
        memoryCache.delete(key);
        totalCachedBytes = Math.max(0, totalCachedBytes - entry.bytes);
        return null;
    }
    return entry;
}

/**
 * 动态向 <head> 注入 CDN preconnect 与 dns-prefetch，提前完成 DNS/TCP/TLS 握手
 */
export function injectPreconnect(url: string) {
    if (typeof document === 'undefined' || !url) return;
    try {
        const origin = new URL(url).origin;
        if (!origin.startsWith('http') || preconnectedOrigins.has(origin)) return;
        if (preconnectedOrigins.size >= MAX_PRECONNECT_ORIGINS) return;
        preconnectedOrigins.add(origin);

        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = origin;
        preconnect.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect);

        const dns = document.createElement('link');
        dns.rel = 'dns-prefetch';
        dns.href = origin;
        document.head.appendChild(dns);
    } catch {
        // 忽略非法 URL
    }
}

function resolvePlaylistUri(uri: string, baseUrl: string): string {
    try {
        return new URL(uri.trim(), baseUrl).toString();
    } catch {
        return uri.trim();
    }
}

async function fetchToCache(
    url: string,
    kind: 'playlist' | 'binary',
    priority: 'high' | 'low',
    timeoutMs: number
): Promise<PrefetchEntry | null> {
    const existing = getCache(url);
    if (existing) return existing;

    const existingPromise = inFlightRequests.get(url);
    if (existingPromise) return existingPromise;

    const task = (async (): Promise<PrefetchEntry | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

        try {
            const init: RequestInit & { priority?: 'high' | 'low' | 'auto' } = {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                signal: controller.signal,
                priority,
            };
            const res = await fetch(url, init);
            const firstByteAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (!res.ok) return null;

            let data: string | ArrayBuffer;
            let bytes: number;
            if (kind === 'playlist') {
                const text = await res.text();
                data = text;
                bytes = text.length * 2;
            } else {
                const buf = await res.arrayBuffer();
                data = buf;
                bytes = buf.byteLength;
            }

            const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const durationMs = Math.max(1, end - start);
            const ttfbMs = Math.max(0, firstByteAt - start);

            const entry: PrefetchEntry = {
                url,
                finalUrl: res.url || url,
                data,
                bytes,
                durationMs,
                ttfbMs,
                createdAt: Date.now(),
                kind,
            };

            putCache(url, entry);
            // 若命中了原始 URL 与重定向后 finalUrl 不同，同时建立索引避免二次请求
            if (entry.finalUrl && entry.finalUrl !== url) {
                putCache(entry.finalUrl, entry);
            }
            if (bytes >= 4096) {
                recordTransferSample(entry.finalUrl || url, bytes, durationMs, ttfbMs);
            }
            return entry;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
            inFlightRequests.delete(url);
        }
    })();

    inFlightRequests.set(url, task);
    return task;
}

interface ParsedMasterVariant {
    bandwidth: number;
    url: string;
}

function parseMasterVariants(m3u8Text: string, baseUrl: string): ParsedMasterVariant[] {
    const lines = m3u8Text.split(/\r?\n/);
    const variants: ParsedMasterVariant[] = [];
    let pendingBandwidth: number | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const match = /BANDWIDTH=(\d+)/i.exec(line);
            pendingBandwidth = match ? parseInt(match[1], 10) : 800_000;
            continue;
        }
        if (line.startsWith('#')) continue;
        if (pendingBandwidth !== null) {
            variants.push({
                bandwidth: pendingBandwidth,
                url: resolvePlaylistUri(line, baseUrl),
            });
            pendingBandwidth = null;
        }
    }
    return variants;
}

interface ParsedMediaPlaylist {
    keyUrl: string | null;
    mapUrl: string | null;
    segments: { url: string; duration: number; hasByteRange: boolean }[];
}

function parseMediaPlaylist(m3u8Text: string, baseUrl: string): ParsedMediaPlaylist {
    const lines = m3u8Text.split(/\r?\n/);
    let keyUrl: string | null = null;
    let mapUrl: string | null = null;
    const segments: { url: string; duration: number; hasByteRange: boolean }[] = [];

    let pendingDuration = 0;
    let hasDuration = false;
    let pendingByteRange = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith('#EXT-X-KEY:')) {
            if (!keyUrl && !/METHOD=NONE/i.test(line)) {
                const uriMatch = /URI="([^"]+)"/i.exec(line);
                if (uriMatch?.[1]) {
                    keyUrl = resolvePlaylistUri(uriMatch[1], baseUrl);
                }
            }
            continue;
        }

        if (line.startsWith('#EXT-X-MAP:')) {
            if (!mapUrl && !/BYTERANGE=/i.test(line)) {
                const uriMatch = /URI="([^"]+)"/i.exec(line);
                if (uriMatch?.[1]) {
                    mapUrl = resolvePlaylistUri(uriMatch[1], baseUrl);
                }
            }
            continue;
        }

        if (line.startsWith('#EXTINF:')) {
            const numMatch = /#EXTINF:\s*([\d.]+)/i.exec(line);
            pendingDuration = numMatch ? parseFloat(numMatch[1]) : 0;
            hasDuration = true;
            continue;
        }

        if (line.startsWith('#EXT-X-BYTERANGE:')) {
            pendingByteRange = true;
            continue;
        }

        if (line.startsWith('#')) continue;

        if (hasDuration) {
            segments.push({
                url: resolvePlaylistUri(line, baseUrl),
                duration: Number.isFinite(pendingDuration) ? pendingDuration : 0,
                hasByteRange: pendingByteRange,
            });
            hasDuration = false;
            pendingDuration = 0;
            pendingByteRange = false;
        }
    }

    return { keyUrl, mapUrl, segments };
}

function pickStartingSegmentIndex(
    segments: { duration: number }[],
    startPosition?: number
): number {
    if (!startPosition || startPosition <= 0 || segments.length === 0) return 0;
    let totalDuration = 0;
    for (const s of segments) totalDuration += s.duration;
    // 与进度恢复策略一致：若已接近片尾则从头起播
    if (totalDuration > 0 && startPosition >= totalDuration - 5) return 0;

    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
        acc += segments[i].duration;
        if (acc > startPosition) return i;
    }
    return 0;
}

/**
 * 预热 HLS 流：在播放器挂载/hls.js 加载完成前预先拉取 .m3u8 清单、加密密钥、初始化段与起播切片。
 * 失败静默返回，绝不影响正常播放路径。
 */
export async function prefetchHlsStream(url: string, options: PrefetchHlsOptions = {}): Promise<void> {
    if (typeof window === 'undefined' || !url) return;
    const cleanUrl = url.trim();
    if (!isDirectPlayableUrl(cleanUrl)) return;

    injectPreconnect(cleanUrl);

    const priority = options.priority ?? 'low';
    const snapshot = getNetworkSnapshot();
    if (options.skipIfSaveData && (snapshot.saveData || snapshot.effectiveType === '2g' || snapshot.effectiveType === 'slow-2g')) {
        return;
    }

    // 仅 .m3u8 需要清单解析与首片预取；mp4/webm 完成 preconnect 即可
    if (!cleanUrl.toLowerCase().includes('.m3u8')) {
        return;
    }

    const timeoutMs = priority === 'high' ? 6000 : 5000;
    const playlistEntry = await fetchToCache(cleanUrl, 'playlist', priority, timeoutMs);
    if (!playlistEntry || typeof playlistEntry.data !== 'string') return;

    let mediaPlaylistText = playlistEntry.data;
    let mediaPlaylistUrl = playlistEntry.finalUrl || cleanUrl;

    // 如果是 Master Playlist，按当前网络估计选中最合适的起始子清晰度清单并继续预取
    if (mediaPlaylistText.includes('#EXT-X-STREAM-INF:')) {
        const variants = parseMasterVariants(mediaPlaylistText, mediaPlaylistUrl);
        if (variants.length === 0) return;
        const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
        const estBps = getInitialBandwidthEstimate();
        // 弱网直接取最低码率实现秒开；正常网取不超过 85% 估算带宽的最高清晰度
        let chosen = sorted[0];
        if (snapshot.tier !== 'poor') {
            for (const v of sorted) {
                if (v.bandwidth <= estBps * 0.85) {
                    chosen = v;
                }
            }
        }
        injectPreconnect(chosen.url);
        const subEntry = await fetchToCache(chosen.url, 'playlist', priority, timeoutMs);
        if (!subEntry || typeof subEntry.data !== 'string') return;
        mediaPlaylistText = subEntry.data;
        mediaPlaylistUrl = subEntry.finalUrl || chosen.url;
    }

    const parsed = parseMediaPlaylist(mediaPlaylistText, mediaPlaylistUrl);
    if (parsed.segments.length === 0) return;

    const targetIdx = pickStartingSegmentIndex(parsed.segments, options.startPosition);
    const desiredCount = Math.max(
        0,
        Math.min(
            snapshot.tier === 'poor' ? 1 : (options.prefetchSegments ?? 1),
            parsed.segments.length - targetIdx
        )
    );

    const binaryTasks: Promise<PrefetchEntry | null>[] = [];
    if (parsed.keyUrl) {
        injectPreconnect(parsed.keyUrl);
        binaryTasks.push(fetchToCache(parsed.keyUrl, 'binary', priority, 6000));
    }
    if (parsed.mapUrl) {
        injectPreconnect(parsed.mapUrl);
        binaryTasks.push(fetchToCache(parsed.mapUrl, 'binary', priority, 8000));
    }

    for (let i = 0; i < desiredCount; i++) {
        const seg = parsed.segments[targetIdx + i];
        if (!seg || seg.hasByteRange) continue;
        injectPreconnect(seg.url);
        binaryTasks.push(fetchToCache(seg.url, 'binary', priority, priority === 'high' ? 12000 : 8000));
    }

    if (binaryTasks.length > 0) {
        await Promise.allSettled(binaryTasks);
    }
}

/**
 * 构建供 hls.js 使用的 pLoader (Playlist) 与 fLoader (Fragment)：
 * 命中内存预取缓存时 0ms 直接交付；未命中或预取失败时无缝委托回 hls.js 默认 Loader (保留 FetchLoader 渐进式流传输)。
 */
export function createPrefetchLoaders(): {
    pLoader: PlaylistLoaderConstructor;
    fLoader: FragmentLoaderConstructor;
} {
    class PrefetchProxyLoader<T extends LoaderContext> implements Loader<T> {
        context: T | null = null;
        stats: LoaderStats = createEmptyStats();
        private hlsConfig: HlsConfig;
        private fallbackLoader: Loader<T> | null = null;
        private destroyed = false;
        private aborted = false;
        private consumeBinaryOnHit: boolean;

        constructor(config: HlsConfig, consumeBinaryOnHit: boolean) {
            this.hlsConfig = config;
            this.consumeBinaryOnHit = consumeBinaryOnHit;
        }

        private delegateToDefault(
            context: T,
            config: LoaderConfiguration,
            callbacks: LoaderCallbacks<T>
        ) {
            if (this.destroyed || this.aborted) return;
            const BaseLoader = this.hlsConfig.loader as unknown as { new (cfg: HlsConfig): Loader<T> };
            const loader = new BaseLoader(this.hlsConfig);
            this.fallbackLoader = loader;
            loader.load(context, config, callbacks);
        }

        private deliverHit(
            entry: PrefetchEntry,
            context: T,
            callbacks: LoaderCallbacks<T>
        ): boolean {
            const wantsBinary = context.responseType === 'arraybuffer';
            if (wantsBinary && !(entry.data instanceof ArrayBuffer)) return false;
            if (!wantsBinary && typeof entry.data !== 'string') return false;

            const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.stats.loading.start = start;

            queueMicrotask(() => {
                if (this.destroyed || this.aborted || this.stats.aborted) return;

                // 分片命中后释放内存占用；清单保留至 TTL 过期
                if (this.consumeBinaryOnHit && entry.kind === 'binary') {
                    memoryCache.delete(entry.url);
                    if (entry.finalUrl) memoryCache.delete(entry.finalUrl);
                    totalCachedBytes = Math.max(0, totalCachedBytes - entry.bytes);
                }

                const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                // 保持真实记录的下载耗时以便 ABR 正确估算带宽 (避免除以 0)
                const simFirst = start + Math.min(entry.ttfbMs, 5);
                const simEnd = Math.max(simFirst + 1, start + entry.durationMs);
                this.stats.loading.first = simFirst;
                this.stats.loading.end = Math.max(now, simEnd);
                const len = entry.data instanceof ArrayBuffer ? entry.data.byteLength : entry.data.length;
                this.stats.loaded = len;
                this.stats.total = len;
                this.stats.bwEstimate = len * 8000 / Math.max(1, entry.durationMs);

                callbacks.onProgress?.(this.stats, context, entry.data as string | ArrayBuffer, null);
                callbacks.onSuccess(
                    { url: entry.finalUrl || context.url, data: entry.data, code: 200 },
                    this.stats,
                    context,
                    null
                );
            });
            return true;
        }

        load(
            context: T,
            config: LoaderConfiguration,
            callbacks: LoaderCallbacks<T>
        ) {
            this.context = context;

            // Byte-range 请求直接走默认流式加载器
            if (context.rangeEnd) {
                this.delegateToDefault(context, config, callbacks);
                return;
            }

            const cached = getCache(context.url);
            if (cached && this.deliverHit(cached, context, callbacks)) {
                return;
            }

            const pending = inFlightRequests.get(context.url);
            if (pending) {
                pending.then((entry) => {
                    if (this.destroyed || this.aborted) return;
                    if (entry && this.deliverHit(entry, context, callbacks)) {
                        return;
                    }
                    this.delegateToDefault(context, config, callbacks);
                });
                return;
            }

            this.delegateToDefault(context, config, callbacks);
        }

        abort() {
            this.aborted = true;
            this.stats.aborted = true;
            this.fallbackLoader?.abort();
        }

        destroy() {
            this.destroyed = true;
            this.aborted = true;
            this.fallbackLoader?.destroy();
            this.fallbackLoader = null;
            this.context = null;
        }

        getCacheAge(): number | null {
            return this.fallbackLoader?.getCacheAge?.() ?? null;
        }

        getResponseHeader(name: string): string | null {
            return this.fallbackLoader?.getResponseHeader?.(name) ?? null;
        }
    }

    class PrefetchPlaylistLoader extends PrefetchProxyLoader<PlaylistLoaderContext> {
        constructor(config: HlsConfig) {
            super(config, false);
        }
    }

    class PrefetchFragmentLoader extends PrefetchProxyLoader<FragmentLoaderContext> {
        constructor(config: HlsConfig) {
            super(config, true);
        }
    }

    return {
        pLoader: PrefetchPlaylistLoader,
        fLoader: PrefetchFragmentLoader,
    };
}
