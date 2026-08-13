import { fetchWithTimeout } from '../utils';
import { ApiResponse } from '@/types';
import { ResourceSite } from '../resources';
import { CONFIG } from '@/config/config';
import { logger } from '../logger';
import { parseSeaCmsXml } from './seaCmsXml';

// 拼接 baseUrl 与查询串，兼容末尾多斜杠/多问号等用户输入
function joinSourceUrl(baseUrl: string, params: string): string {
    const base = baseUrl.trim().replace(/[?/]+$/, '');
    const qs = params.trim();
    if (!qs) return base;
    if (qs.startsWith('?') || qs.startsWith('&')) return `${base}${qs}`;
    return `${base}/${qs}`;
}

export async function fetchRawFromSource(source: ResourceSite, params: string = '', noStore = false, timeoutOverride?: number): Promise<unknown> {
    const url = joinSourceUrl(source.baseUrl, params);

    // noStore=true for real-time search (always fresh); false for home/detail pages (cacheable)
    const cacheOptions = noStore
        ? { cache: 'no-store' as RequestCache }
        : { next: { revalidate: CONFIG.API_REVALIDATE_SECONDS } };

    const timeout = timeoutOverride || CONFIG.SOURCE_TIMEOUT_MAP?.[source.id] || CONFIG.SEARCH_TIMEOUT;
    try {
        const res = await fetchWithTimeout(url, timeout, cacheOptions);
        const text = await res.text();

        // 支持两类响应：
        // 1) MacCMS JSON（以 { 开头）
        // 2) SeaCMS/MacCMS XML 采集协议 RSS 5.1（以 < 开头，如 <?xml / <rss），
        //    解析结果与 JSON 同构，下游 normalizer 无需感知差异
        // 去除 BOM 后再判断类型，避免 UTF-8 BOM 导致 JSON/XML 检测失败
        const trimmed = text.replace(/^\uFEFF/, '').trim();
        if (trimmed.startsWith('{')) {
            return JSON.parse(trimmed);
        }
        if (trimmed.startsWith('<')) {
            const parsed = parseSeaCmsXml(trimmed);
            if (parsed) {
                const count = (parsed as any)?.list?.length ?? 0;
                logger.info('Fetcher', `SeaCMS XML response from ${source.name}, ${count} items`);
                return parsed;
            }
            logger.warn('Fetcher', `Failed to parse XML response from ${source.name}, skipping`);
            return undefined;
        }

        logger.warn('Fetcher', `Non-JSON/XML response from ${source.name}, skipping`);
        return undefined;
    } catch (error: unknown) {
        // 处理超时中止错误（AbortError），不抛出，仅警告
        if (error instanceof DOMException && error.name === 'AbortError') {
            logger.warn('Fetcher', `请求 ${source.name} 超时（${timeout}ms），已中止`);
            return undefined;
        }
        // 其他错误正常抛出
        logger.error('Fetcher', `Error fetching from ${source.name}:`, error);
        throw error;
    }
}
