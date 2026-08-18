
import { NextRequest, NextResponse } from 'next/server';
import { getRecentMovies } from '@/lib/services/vodService';
import { getUserPreferences } from '@/lib/preferences';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'feifan';
    const page = parseInt(searchParams.get('page') || '1');
    const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv';

    // Read preferences from cookies (shared with server components)
    const cookieStore = await cookies();
    const { disabledSources, customLocalUrl, customSources } = await getUserPreferences(cookieStore);

    try {
        const data = await getRecentMovies(source, page, type, disabledSources, customLocalUrl, customSources);
        return NextResponse.json(
            data,
            { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } }
        );
    } catch (error) {
        logger.error('LatestAPI', 'Error:', error);
        return NextResponse.json(
            { code: 500, msg: 'Internal Server Error', list: [] },
            { status: 500 }
        );
    }
}
