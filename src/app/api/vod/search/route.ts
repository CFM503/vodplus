
import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSource } from '@/lib/services/vodService';
import { getMetadataProvider } from '@/lib/metadata';
import { RESOURCE_SITES } from '@/lib/resources';
import { parseCustomSources, CUSTOM_SOURCES_COOKIE } from '@/lib/sourceConfig';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const sourceId = searchParams.get('source');
    const keyword = searchParams.get('wd');

    if (!sourceId || !keyword) {
        return NextResponse.json({ list: [] }, { status: 400 });
    }

    try {
        let list: import('@/types').Movie[] = [];

        if (sourceId === 'tmdb') {
            const provider = getMetadataProvider('tmdb');
            list = await provider.search(keyword);
        } else {
            // v0.9.31: 内置源优先, 否则读 Cookie 中的自定义源
            const source = RESOURCE_SITES.find(s => s.id === sourceId)
                || parseCustomSources(request.cookies.get(CUSTOM_SOURCES_COOKIE)?.value).find(s => s.id === sourceId);
            if (source) {
                const searchUrl = source.searchPath.replace('ac=list', 'ac=detail');
                const res = await fetchFromSource(source, `${searchUrl}${encodeURIComponent(keyword)}`);
                list = res.list || [];
            }
        }

        return NextResponse.json({ list });
    } catch (error) {
        logger.error('SearchAPI', `Error (${sourceId}):`, error);
        return NextResponse.json({ list: [] });
    }
}
