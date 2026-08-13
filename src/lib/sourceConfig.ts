import { ResourceSite, RESOURCE_SITES } from './resources';
import { setCookie, deleteCookie } from './utils';

/**
 * v0.9.31: 资源站列表导入/导出 + 自定义源支持
 *
 * 自定义源存储于 Cookie `VOD_CUSTOM_SOURCES`(JSON 数组, 元素为 ResourceSite)。
 * 同源请求自动携带 Cookie, 因此服务端路由/详情页可直接读到自定义源, 无需 URL 传参。
 * 本模块为同构纯函数, 客户端与服务端均可安全使用。
 */

export const CUSTOM_SOURCES_COOKIE = 'VOD_CUSTOM_SOURCES';
const COOKIE_CHUNK_PREFIX = 'VOD_CUSTOM_SOURCES_';
// 浏览器单条 Cookie 上限约 4KB，分片留出安全余量
const COOKIE_CHUNK_MAX_BYTES = 3500;
export const EXPORT_APP = 'vodplus';
export const EXPORT_VERSION = 1;

// 校验并解析单个自定义源配置 (严格白名单: id/name/baseUrl 必填, baseUrl 仅 http/https)
export function parseSourceConfig(raw: unknown): ResourceSite | null {
    if (!raw || typeof raw !== 'object') return null;
    const cfg = raw as Record<string, unknown>;
    const id = cfg.id;
    const name = cfg.name;
    const baseUrl = cfg.baseUrl;
    if (typeof id !== 'string' || !id.trim()) return null;
    if (typeof name !== 'string' || !name.trim()) return null;
    if (typeof baseUrl !== 'string' || !/^https?:\/\//.test(baseUrl)) return null;

    return {
        id: id.trim(),
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        searchPath: typeof cfg.searchPath === 'string' && cfg.searchPath ? cfg.searchPath : '?ac=detail&wd=',
        detailPath: typeof cfg.detailPath === 'string' && cfg.detailPath ? cfg.detailPath : '?ac=detail&ids=',
        headers: cfg.headers && typeof cfg.headers === 'object' ? (cfg.headers as Record<string, string>) : {},
        region: typeof cfg.region === 'string' ? cfg.region : undefined,
    };
}

// 解析 Cookie 字符串 → 自定义源数组 (逐条校验, 按 id 去重)
export function parseCustomSources(raw: string | null | undefined): ResourceSite[] {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        const seen = new Set<string>();
        const out: ResourceSite[] = [];
        for (const item of arr) {
            const s = parseSourceConfig(item);
            if (s && !seen.has(s.id)) {
                seen.add(s.id);
                out.push(s);
            }
        }
        return out;
    } catch {
        return [];
    }
}

// 客户端读取自定义源 (直接读 document.cookie，合并所有分片)
export function readCustomSourcesFromDocument(): ResourceSite[] {
    if (typeof document === 'undefined') return [];
    const cookies = document.cookie.split(';').map(s => s.trim());
    const parts: (string | undefined)[] = [];

    for (const c of cookies) {
        const idx = c.indexOf('=');
        if (idx < 0) continue;
        const name = c.slice(0, idx).trim();
        const rawValue = c.slice(idx + 1).trim();
        let value = rawValue;
        try {
            value = decodeURIComponent(rawValue);
        } catch {
            // 分片无法解码时跳过，交给 JSON 解析兜底
        }
        collectCustomSourceChunk(name, value, parts);
    }

    return parseCustomSources(parts.filter(Boolean).join(''));
}

// 服务端读取自定义源（cookieStore 已自动 decode，值就是原始分片）
export function readCustomSourcesFromCookieStore(cookieStore: {
    getAll?: () => { name: string; value: string }[];
    get?: (name: string) => { value: string } | undefined;
}): ResourceSite[] {
    const parts: (string | undefined)[] = [];

    if (typeof cookieStore.getAll === 'function') {
        for (const c of cookieStore.getAll()) {
            collectCustomSourceChunk(c.name, c.value, parts);
        }
    } else if (typeof cookieStore.get === 'function') {
        const c = cookieStore.get(CUSTOM_SOURCES_COOKIE);
        if (c) collectCustomSourceChunk(CUSTOM_SOURCES_COOKIE, c.value, parts);
    }

    return parseCustomSources(parts.filter(Boolean).join(''));
}

// 客户端写入自定义源：按 URL-encode 后的字节数分片写入多个 Cookie
export function saveCustomSourcesToCookies(sources: ResourceSite[]): void {
    if (typeof document === 'undefined') return;

    const json = JSON.stringify(sources);
    const chunks = splitByEncodedSize(json, COOKIE_CHUNK_MAX_BYTES);

    // 清除旧分片，避免残留造成重复
    for (let i = 2; i <= 64; i++) {
        deleteCookie(`${COOKIE_CHUNK_PREFIX}${i}`);
    }

    chunks.forEach((chunk, index) => {
        const name = index === 0 ? CUSTOM_SOURCES_COOKIE : `${COOKIE_CHUNK_PREFIX}${index + 1}`;
        setCookie(name, chunk);
    });
}

function collectCustomSourceChunk(name: string, value: string, parts: (string | undefined)[]): void {
    if (name === CUSTOM_SOURCES_COOKIE) {
        parts[0] = value;
        return;
    }
    if (name.startsWith(COOKIE_CHUNK_PREFIX)) {
        const n = parseInt(name.slice(COOKIE_CHUNK_PREFIX.length), 10);
        if (Number.isInteger(n) && n >= 2) {
            parts[n - 1] = value;
        }
    }
}

function splitByEncodedSize(json: string, maxBytes: number): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const ch of json) {
        const candidate = current + ch;
        if (current.length > 0 && encodeURIComponent(candidate).length > maxBytes) {
            chunks.push(current);
            current = ch;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

// 合并 内置源 + 自定义源 (自定义源 id 不得与内置源冲突)
export function mergeSources(customSources: ResourceSite[]): ResourceSite[] {
    const builtInIds = new Set(RESOURCE_SITES.map(s => s.id));
    return [...RESOURCE_SITES, ...customSources.filter(s => !builtInIds.has(s.id))];
}

// ============ 导入 / 导出 ============

export interface ExportPayload {
    app: string;
    version: number;
    exportedAt: string;
    disabledSources: string[];
    customSources: ResourceSite[];
}

export function buildExportPayload(disabledSources: string[], customSources: ResourceSite[]): ExportPayload {
    return {
        app: EXPORT_APP,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        disabledSources,
        customSources,
    };
}

export type ImportResult =
    | { ok: true; disabledSources: string[]; customSources: ResourceSite[] }
    | { ok: false; error: string };

export function validateImportPayload(raw: string): ImportResult {
    let j: unknown;
    try {
        j = JSON.parse(raw);
    } catch {
        return { ok: false, error: '不是有效的 JSON 文件' };
    }
    if (!j || typeof j !== 'object') {
        return { ok: false, error: 'JSON 格式不正确' };
    }
    const o = j as Record<string, unknown>;
    if (o.app !== undefined && o.app !== EXPORT_APP) {
        return { ok: false, error: '不是 vodplus 导出的源列表文件' };
    }

    let disabledSources: string[] = [];
    if (o.disabledSources !== undefined) {
        if (!Array.isArray(o.disabledSources) || o.disabledSources.some(x => typeof x !== 'string')) {
            return { ok: false, error: 'disabledSources 字段格式不正确' };
        }
        disabledSources = o.disabledSources;
    }

    let customSources: ResourceSite[] = [];
    if (o.customSources !== undefined) {
        if (!Array.isArray(o.customSources)) {
            return { ok: false, error: 'customSources 字段格式不正确' };
        }
        const seen = new Set<string>();
        for (const item of o.customSources) {
            const s = parseSourceConfig(item);
            if (s && !seen.has(s.id)) {
                seen.add(s.id);
                customSources.push(s);
            }
        }
    }

    return { ok: true, disabledSources, customSources };
}
