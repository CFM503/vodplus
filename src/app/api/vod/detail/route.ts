import { NextRequest, NextResponse } from 'next/server';
import { cachedGetMovieDetail } from '@/lib/services/vodService';
import { getUserPreferences } from '@/lib/preferences';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { getAuthStatus } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const id = searchParams.get('id');
    const name = searchParams.get('name') || undefined;

    if (!source || !id) {
        return NextResponse.json({ code: 400, msg: 'Missing source or id', data: null }, { status: 400 });
    }

    try {
        const cookieStore = await cookies();
        const authStatus = await getAuthStatus(cookieStore);
        if (authStatus.enabled && !authStatus.authenticated) {
            return NextResponse.json({ code: 401, msg: 'Authentication required', data: null }, { status: 401 });
        }

        const { disabledSources, customSources } = await getUserPreferences(cookieStore);

        const movie = await cachedGetMovieDetail(source, id, disabledSources, name, customSources);
        return NextResponse.json(
            { code: 1, msg: 'OK', data: movie },
            { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } }
        );
    } catch (error) {
        logger.error('DetailAPI', 'Error fetching detail:', error);
        return NextResponse.json(
            { code: 500, msg: 'Internal Server Error', data: null },
            { status: 500 }
        );
    }
}
