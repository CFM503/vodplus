import { NextRequest, NextResponse } from 'next/server';
import { RESOURCE_SITES } from '@/lib/resources';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const sourceId = searchParams.get('source');

    if (!sourceId) {
        return NextResponse.json(
            { error: 'Missing source parameter' },
            { status: 400 }
        );
    }

    const source = RESOURCE_SITES.find(s => s.id === sourceId);
    if (!source) {
        return NextResponse.json(
            { error: 'Unknown source' },
            { status: 404 }
        );
    }

    const startTime = Date.now();

    try {
        const testUrl = `${source.baseUrl}?ac=detail&wd=_health_check_`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    ...source.headers,
                    'Accept': 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const latency = Date.now() - startTime;

            return NextResponse.json({
                sourceId,
                sourceName: source.name,
                latency,
                status: 'ok',
                timestamp: Date.now(),
            });

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                return NextResponse.json({
                    sourceId,
                    sourceName: source.name,
                    latency: -1,
                    status: 'timeout',
                    timestamp: Date.now(),
                });
            }

            return NextResponse.json({
                sourceId,
                sourceName: source.name,
                latency: Date.now() - startTime,
                status: 'error',
                timestamp: Date.now(),
            });
        }

    } catch (error) {
        logger.error('HealthCheck', `Error checking ${source.name}:`, error);
        return NextResponse.json({
            sourceId,
            sourceName: source.name,
            latency: -1,
            status: 'error',
            timestamp: Date.now(),
        });
    }
}
