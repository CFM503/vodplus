import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
    const response = NextResponse.json({
        code: 1,
        msg: '已退出登录'
    });

    response.cookies.set(AUTH_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
    });

    return response;
}

export async function GET(_request: NextRequest) {
    return POST(_request);
}
