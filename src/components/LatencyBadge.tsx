'use client';

import { useMemo } from 'react';
import { getLatencyInfo } from '@/lib/utils';

interface LatencyBadgeProps {
    latency: number;
    className?: string;
}

export function LatencyBadge({ latency, className = '' }: LatencyBadgeProps) {
    const info = useMemo(() => getLatencyInfo(latency), [latency]);

    return (
        <span
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${className}`}
            style={{
                backgroundColor: `${info.color}30`,
                borderColor: info.color,
                color: info.color,
            }}
            title={`响应时间: ${info.label} (${info.level})`}
        >
            {info.label}
        </span>
    );
}
