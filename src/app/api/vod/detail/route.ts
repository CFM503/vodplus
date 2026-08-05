import { NextRequest, NextResponse } from 'next/server';
import { cachedGetMovieDetail } from '@/lib/services/vodService';
import { getUserPreferences } from '@/lib/preferences';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

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
        const { disabledSources } = await getUserPreferences(cookieStore);

        const movie = await cachedGetMovieDetail(source, id, disabledSources, name);
        return NextResponse.json({ code: 1, msg: 'OK', data: movie });
    } catch (error) {
        logger.error('DetailAPI', 'Error fetching detail:', error);
        return NextResponse.json(
            { code: 500, msg: 'Internal Server Error', data: null },
            { status: 500 }
        );
    }
}
