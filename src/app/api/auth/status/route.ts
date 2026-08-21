import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthStatus } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const status = await getAuthStatus(cookieStore);

        return NextResponse.json({
            code: 1,
            msg: 'OK',
            data: status
        });
    } catch {
        return NextResponse.json({
            code: 0,
            msg: 'Error checking auth status',
            data: { enabled: false, authenticated: true }
        }, { status: 500 });
    }
}
