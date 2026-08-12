import { ResourceSite, RESOURCE_SITES } from './resources';

/**
 * v0.9.31: 资源站列表导入/导出 + 自定义源支持
 *
 * 自定义源存储于 Cookie `VOD_CUSTOM_SOURCES`(JSON 数组, 元素为 ResourceSite)。
 * 同源请求自动携带 Cookie, 因此服务端路由/详情页可直接读到自定义源, 无需 URL 传参。
 * 本模块为同构纯函数, 客户端与服务端均可安全使用。
 */

export const CUSTOM_SOURCES_COOKIE = 'VOD_CUSTOM_SOURCES';
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

// 客户端读取自定义源 (直接读 document.cookie)
export function readCustomSourcesFromDocument(): ResourceSite[] {
    if (typeof document === 'undefined') return [];
    const m = document.cookie
        .split(';')
        .map(s => s.trim())
        .find(s => s.startsWith(`${CUSTOM_SOURCES_COOKIE}=`));
    if (!m) return [];
    try {
        return parseCustomSources(decodeURIComponent(m.slice(CUSTOM_SOURCES_COOKIE.length + 1)));
    } catch {
        return [];
    }
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
