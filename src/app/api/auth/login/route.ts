import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSessionToken, AUTH_COOKIE_NAME, isAuthEnabled } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        if (!isAuthEnabled()) {
            return NextResponse.json({
                code: 1,
                msg: '当前站点未开启鉴权限制',
                user: { username: 'guest' }
            });
        }

        const body = await request.json().catch(() => ({}));
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password.trim() : '';

        if (!username || !password) {
            return NextResponse.json(
                { code: 0, msg: '请输入用户名和密码' },
                { status: 400 }
            );
        }

        const isValid = verifyCredentials(username, password);
        if (!isValid) {
            return NextResponse.json(
                { code: 0, msg: '用户名或密码错误' },
                { status: 401 }
            );
        }

        const token = await createSessionToken(username);
        const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

        const response = NextResponse.json({
            code: 1,
            msg: '登录成功',
            user: { username }
        });

        // Set HttpOnly session cookie
        response.cookies.set(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            secure: isHttps || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return response;
    } catch (error) {
        return NextResponse.json(
            { code: 0, msg: '登录服务异常，请稍后重试' },
            { status: 500 }
        );
    }
}
