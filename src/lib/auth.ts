import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export const AUTH_COOKIE_NAME = 'vod_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * 检查当前站点是否开启了鉴权
 * 如果配置了 AUTH_USERNAME/AUTH_PASSWORD 或 AUTH_USERS，则视为开启
 */
export function isAuthEnabled(): boolean {
    const username = process.env.AUTH_USERNAME;
    const password = process.env.AUTH_PASSWORD;
    const users = process.env.AUTH_USERS;

    if (users && users.trim().length > 0) return true;
    if (username && password && username.trim().length > 0 && password.trim().length > 0) return true;

    return false;
}

/**
 * 获取用于签名的 Secret Key
 */
function getAuthSecret(): string {
    return (
        process.env.AUTH_SECRET ||
        process.env.AUTH_PASSWORD ||
        process.env.AUTH_USERNAME ||
        'vodplus_default_fallback_secret_key'
    );
}

/**
 * 校验用户提交的账号密码
 */
export function verifyCredentials(inputUser: string, inputPass: string): boolean {
    if (!isAuthEnabled()) return true;

    const trimmedUser = inputUser.trim();
    const trimmedPass = inputPass.trim();

    if (!trimmedUser || !trimmedPass) return false;

    // 1. 检查单一配置 AUTH_USERNAME & AUTH_PASSWORD
    const singleUser = process.env.AUTH_USERNAME?.trim();
    const singlePass = process.env.AUTH_PASSWORD?.trim();
    if (singleUser && singlePass && singleUser === trimmedUser && singlePass === trimmedPass) {
        return true;
    }

    // 2. 检查多用户配置 AUTH_USERS (格式: user1:pass1,user2:pass2)
    const usersEnv = process.env.AUTH_USERS;
    if (usersEnv) {
        const userPairs = usersEnv.split(',').map(s => s.trim()).filter(Boolean);
        for (const pair of userPairs) {
            const separatorIdx = pair.indexOf(':');
            if (separatorIdx > 0) {
                const u = pair.slice(0, separatorIdx).trim();
                const p = pair.slice(separatorIdx + 1).trim();
                if (u === trimmedUser && p === trimmedPass) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Web Crypto API 生成 HMAC-SHA256 签名 (适用于 Cloudflare Edge, Node 18+)
 */
async function generateHmac(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Base64 URL 编解码 (支持 UTF-8)
 */
function base64UrlEncode(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string | null {
    try {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

/**
 * 创建防篡改的 Session Token
 */
export async function createSessionToken(username: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_MAX_AGE_SECONDS;
    const payloadStr = JSON.stringify({ u: username, iat: now, exp });
    const encodedPayload = base64UrlEncode(payloadStr);

    const secret = getAuthSecret();
    const signature = await generateHmac(encodedPayload, secret);

    return `${encodedPayload}.${signature}`;
}

/**
 * 校验 Session Token
 */
export async function verifySessionToken(token: string | undefined | null): Promise<{ valid: boolean; username?: string }> {
    if (!token || typeof token !== 'string') return { valid: false };

    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };

    const [encodedPayload, signature] = parts;
    const secret = getAuthSecret();
    const expectedSignature = await generateHmac(encodedPayload, secret);

    if (signature !== expectedSignature) {
        return { valid: false };
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    if (!payloadJson) return { valid: false };

    try {
        const payload = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);

        if (!payload.u || !payload.exp || payload.exp < now) {
            return { valid: false };
        }

        return { valid: true, username: payload.u };
    } catch {
        return { valid: false };
    }
}

export interface AuthStatus {
    enabled: boolean;
    authenticated: boolean;
    username?: string;
}

/**
 * 服务端获取当前用户的鉴权状态
 */
export async function getAuthStatus(cookieStore: ReadonlyRequestCookies): Promise<AuthStatus> {
    const enabled = isAuthEnabled();
    if (!enabled) {
        return {
            enabled: false,
            authenticated: true,
        };
    }

    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const { valid, username } = await verifySessionToken(sessionCookie);

    return {
        enabled: true,
        authenticated: valid,
        username: valid ? username : undefined,
    };
}
