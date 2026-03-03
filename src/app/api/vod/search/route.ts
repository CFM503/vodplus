
import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSource } from '@/lib/services/vodService';
import { getMetadataProvider } from '@/lib/metadata';
import { RESOURCE_SITES } from '@/lib/resources';

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
        let list = [];

        if (sourceId === 'tmdb') {
            const provider: any = getMetadataProvider('tmdb');
            list = await provider.search(keyword);
        } else {
            const source = RESOURCE_SITES.find(s => s.id === sourceId);
            if (source) {
                const searchUrl = source.searchPath.replace('ac=list', 'ac=detail');
                const res = await fetchFromSource(source, `${searchUrl}${encodeURIComponent(keyword)}`);
                list = res.list || [];
            }
        }

        return NextResponse.json({ list });
    } catch (error) {
        console.error(`Search API Error (${sourceId}):`, error);
        return NextResponse.json({ list: [] });
    }
}
