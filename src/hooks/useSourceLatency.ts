import { useState, useEffect, useCallback, useRef } from 'react';
import { RESOURCE_SITES } from '@/lib/resources';

interface LatencyResult {
    sourceId: string;
    sourceName: string;
    latency: number;
    status: 'ok' | 'error' | 'timeout' | 'pending';
    timestamp: number;
}

interface UseSourceLatencyReturn {
    latencies: Map<string, LatencyResult>;
    isProbing: boolean;
    probeSources: () => void;
    getLatency: (sourceId: string) => number;
}

const CACHE_KEY = 'VODPLUS_SOURCE_LATENCY_CACHE';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export function useSourceLatency(): UseSourceLatencyReturn {
    const [latencies, setLatencies] = useState<Map<string, LatencyResult>>(new Map());
    const [isProbing, setIsProbing] = useState(false);
    const probeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

    // Load cached latencies on mount
    useEffect(() => {
        const cached = loadFromCache();
        if (cached.size > 0) {
            setLatencies(cached);
        }
    }, []);

    const loadFromCache = (): Map<string, LatencyResult> => {
        if (typeof window === 'undefined') return new Map();
        
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return new Map();
            
            const data = JSON.parse(cached);
            const now = Date.now();
            
            // Filter out expired entries
            const validEntries = Object.entries(data).filter(
                ([, value]: [string, any]) => now - value.timestamp < CACHE_DURATION
            );
            
            if (validEntries.length === 0) return new Map();
            
            const map = new Map<string, LatencyResult>();
            validEntries.forEach(([key, value]) => {
                map.set(key, value as LatencyResult);
            });
            
            return map;
        } catch {
            return new Map();
        }
    };

    const saveToCache = useCallback((data: Map<string, LatencyResult>) => {
        if (typeof window === 'undefined') return;
        
        try {
            const obj: Record<string, LatencyResult> = {};
            data.forEach((value, key) => {
                obj[key] = value;
            });
            localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
        } catch {
            // Ignore cache write errors
        }
    }, []);

    const probeSource = useCallback(async (source: typeof RESOURCE_SITES[0]): Promise<LatencyResult> => {
        const controller = new AbortController();
        abortControllersRef.current.set(source.id, controller);

        const startTime = performance.now();

        try {
            const response = await fetch(`/api/vod/health?source=${source.id}`, {
                signal: controller.signal,
                cache: 'no-store',
            });

            if (!response.ok) {
                return {
                    sourceId: source.id,
                    sourceName: source.name,
                    latency: -1,
                    status: 'error',
                    timestamp: Date.now(),
                };
            }

            const data = await response.json();
            const clientLatency = Math.round(performance.now() - startTime);

            return {
                sourceId: data.sourceId || source.id,
                sourceName: data.sourceName || source.name,
                latency: data.latency > 0 ? data.latency : clientLatency,
                status: data.status || 'ok',
                timestamp: Date.now(),
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    sourceId: source.id,
                    sourceName: source.name,
                    latency: -1,
                    status: 'timeout',
                    timestamp: Date.now(),
                };
            }

            return {
                sourceId: source.id,
                sourceName: source.name,
                latency: -1,
                status: 'error',
                timestamp: Date.now(),
            };
        } finally {
            abortControllersRef.current.delete(source.id);
        }
    }, []);

    const probeSources = useCallback(async () => {
        if (isProbing) return;

        setIsProbing(true);

        // Cancel any ongoing probes
        abortControllersRef.current.forEach(controller => controller.abort());
        abortControllersRef.current.clear();

        const results = await Promise.allSettled(
            RESOURCE_SITES.map(source => probeSource(source))
        );

        const newLatencies = new Map<string, LatencyResult>();

        results.forEach((result, index) => {
            const source = RESOURCE_SITES[index];
            
            if (result.status === 'fulfilled') {
                newLatencies.set(source.id, result.value);
            } else {
                newLatencies.set(source.id, {
                    sourceId: source.id,
                    sourceName: source.name,
                    latency: -1,
                    status: 'error',
                    timestamp: Date.now(),
                });
            }
        });

        setLatencies(newLatencies);
        saveToCache(newLatencies);
        setIsProbing(false);
    }, [isProbing, probeSource, saveToCache]);

    const getLatency = useCallback((sourceId: string): number => {
        const result = latencies.get(sourceId);
        if (!result) return -1;
        return result.latency > 0 ? result.latency : -1;
    }, [latencies]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (probeTimeoutRef.current) {
                clearTimeout(probeTimeoutRef.current);
            }
            abortControllersRef.current.forEach(controller => controller.abort());
        };
    }, []);

    return {
        latencies,
        isProbing,
        probeSources,
        getLatency,
    };
}

export function getSourceLatencyFromCache(sourceId: string): number {
    if (typeof window === 'undefined') return -1;
    
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return -1;
        
        const data = JSON.parse(cached);
        const entry = data[sourceId];
        
        if (!entry) return -1;
        
        // Check if expired
        if (Date.now() - entry.timestamp > CACHE_DURATION) {
            return -1;
        }
        
        return entry.latency > 0 ? entry.latency : -1;
    } catch {
        return -1;
    }
}
