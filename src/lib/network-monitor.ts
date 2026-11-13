/**
 * 实时网络质量评估、带宽 EWMA 持久化与 CDN 线路健康评分模块
 * 结合 Network Information API 与 HLS 真实分片下载吞吐率，为首屏秒开与弱网抗抖动提供决策依据。
 */

export type NetworkTier = 'poor' | 'fair' | 'good';

export interface NetworkSnapshot {
    tier: NetworkTier;
    saveData: boolean;
    effectiveType: string;
    downlinkMbps: number | null;
    rttMs: number | null;
    estimatedBps: number;
}

interface NavigatorConnectionLike {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
}

interface CdnPerfRecord {
    ewmaBps: number;
    avgTtfbMs: number;
    penalties: number;
    updatedAt: number;
}

const BW_STORAGE_KEY = 'VOD_BW_ESTIMATE_V1';
const CDN_PERF_STORAGE_KEY = 'VOD_CDN_PERF_V1';
const CDN_PERF_TTL_MS = 30 * 60 * 1000; // 30 分钟有效
const MAX_CDN_RECORDS = 30;

// 运行时平滑带宽估计 (bps) & 最近分片样本时间戳
let runtimeEwmaBps: number | null = null;
let runtimeLastTtfbMs: number | null = null;
let runtimeSampleAt = 0;

// 本会话各线路失败/成功计数 (用于自动换线优选，不跨会话永久拉黑)
const sessionLinePenalties = new Map<string, number>();
const sessionLineSuccess = new Map<string, number>();

function getNavigatorConnection(): NavigatorConnectionLike | null {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & {
        connection?: NavigatorConnectionLike;
        mozConnection?: NavigatorConnectionLike;
        webkitConnection?: NavigatorConnectionLike;
    };
    return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function readStoredBandwidth(): number | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(BW_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { bps?: number; ts?: number };
        if (!parsed.bps || !parsed.ts) return null;
        // 超过 2 小时过期，避免老网络环境误导新网络
        if (Date.now() - parsed.ts > 2 * 60 * 60 * 1000) return null;
        return Number.isFinite(parsed.bps) && parsed.bps > 0 ? parsed.bps : null;
    } catch {
        return null;
    }
}

let lastBwPersistAt = 0;
function persistBandwidth(bps: number) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    // 节流写盘：最多每 5 秒落盘一次
    if (now - lastBwPersistAt < 5000) return;
    lastBwPersistAt = now;
    try {
        localStorage.setItem(BW_STORAGE_KEY, JSON.stringify({ bps: Math.round(bps), ts: now }));
    } catch {
        // 忽略存储配额/隐私模式异常
    }
}

function readCdnPerfMap(): Record<string, CdnPerfRecord> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(CDN_PERF_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, CdnPerfRecord>;
        const now = Date.now();
        const cleaned: Record<string, CdnPerfRecord> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (v && now - v.updatedAt < CDN_PERF_TTL_MS) {
                cleaned[k] = v;
            }
        }
        return cleaned;
    } catch {
        return {};
    }
}

let lastCdnPersistAt = 0;
const memoryCdnPerf: Record<string, CdnPerfRecord> = {};
let cdnPerfLoaded = false;

function ensureCdnPerfLoaded() {
    if (cdnPerfLoaded) return;
    cdnPerfLoaded = true;
    const stored = readCdnPerfMap();
    Object.assign(memoryCdnPerf, stored);
}

function persistCdnPerf() {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - lastCdnPersistAt < 4000) return;
    lastCdnPersistAt = now;
    try {
        // 裁剪保留最新 MAX_CDN_RECORDS 条
        const entries = Object.entries(memoryCdnPerf)
            .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
            .slice(0, MAX_CDN_RECORDS);
        const out: Record<string, CdnPerfRecord> = {};
        for (const [k, v] of entries) out[k] = v;
        localStorage.setItem(CDN_PERF_STORAGE_KEY, JSON.stringify(out));
    } catch {
        // 忽略存储异常
    }
}

function safeOrigin(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * 记录一次实际传输样本 (分片或预加载清单)，更新全局与 CDN 级别带宽 EWMA
 */
export function recordTransferSample(url: string, bytes: number, durationMs: number, ttfbMs?: number) {
    if (!Number.isFinite(bytes) || bytes < 1024) return;
    // 防止内存缓存 0ms 命中污染真实网速估计；至少以 8ms 为下界
    const effectiveMs = Math.max(8, durationMs);
    const sampleBps = (bytes * 8000) / effectiveMs;
    if (!Number.isFinite(sampleBps) || sampleBps <= 0) return;

    // 下降更快感知 (alpha=0.45)，上升较稳健 (alpha=0.25)
    if (runtimeEwmaBps === null) {
        runtimeEwmaBps = sampleBps;
    } else {
        const alpha = sampleBps < runtimeEwmaBps ? 0.45 : 0.25;
        runtimeEwmaBps = runtimeEwmaBps * (1 - alpha) + sampleBps * alpha;
    }
    runtimeSampleAt = Date.now();

    if (typeof ttfbMs === 'number' && Number.isFinite(ttfbMs) && ttfbMs >= 0) {
        runtimeLastTtfbMs = runtimeLastTtfbMs === null
            ? ttfbMs
            : runtimeLastTtfbMs * 0.6 + ttfbMs * 0.4;
    }

    persistBandwidth(runtimeEwmaBps);

    const origin = safeOrigin(url);
    if (origin) {
        ensureCdnPerfLoaded();
        const prev = memoryCdnPerf[origin];
        const nextEwma = prev
            ? prev.ewmaBps * 0.65 + sampleBps * 0.35
            : sampleBps;
        const nextTtfb = typeof ttfbMs === 'number' && Number.isFinite(ttfbMs)
            ? (prev ? prev.avgTtfbMs * 0.6 + ttfbMs * 0.4 : ttfbMs)
            : (prev?.avgTtfbMs ?? 250);
        memoryCdnPerf[origin] = {
            ewmaBps: nextEwma,
            avgTtfbMs: nextTtfb,
            penalties: prev ? Math.max(0, prev.penalties - 0.25) : 0,
            updatedAt: Date.now(),
        };
        persistCdnPerf();
    }
}

/**
 * 获取供 HLS.js 初始化的带宽估计 (bps)
 */
export function getInitialBandwidthEstimate(): number {
    const conn = getNavigatorConnection();
    const stored = runtimeEwmaBps ?? readStoredBandwidth();

    let connEstimate: number | null = null;
    if (conn) {
        if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
            connEstimate = 350_000;
        } else if (conn.effectiveType === '3g') {
            connEstimate = 650_000;
        } else if (typeof conn.downlink === 'number' && conn.downlink > 0) {
            // downlink 单位 Mbps；乘 0.75 作为保守初始估测
            connEstimate = conn.downlink * 1_000_000 * 0.75;
        }
    }

    if (stored && connEstimate) {
        // 两者取较保守值（并给 80% 安全系数，确保首片秒开）
        return Math.round(Math.max(250_000, Math.min(stored * 0.85, connEstimate)));
    }
    if (stored) {
        return Math.round(Math.max(250_000, stored * 0.8));
    }
    if (connEstimate) {
        return Math.round(Math.max(250_000, connEstimate));
    }
    // 未知网络：采用适中的 800 Kbps（比原 1.2 Mbps 更利于多码率首片秒开）
    return 800_000;
}

/**
 * 获取当前综合网络快照与等级分类 ('poor' | 'fair' | 'good')
 */
export function getNetworkSnapshot(): NetworkSnapshot {
    const conn = getNavigatorConnection();
    const saveData = Boolean(conn?.saveData);
    const effectiveType = conn?.effectiveType || '4g';
    const downlinkMbps = typeof conn?.downlink === 'number' ? conn.downlink : null;
    const rttMs = typeof conn?.rtt === 'number' ? conn.rtt : null;

    // 若 30 秒内有实测分片吞吐，优先参考实测值
    const hasFreshSample = runtimeEwmaBps !== null && Date.now() - runtimeSampleAt < 30_000;
    const estimatedBps = hasFreshSample && runtimeEwmaBps !== null
        ? runtimeEwmaBps
        : getInitialBandwidthEstimate();

    let tier: NetworkTier = 'good';
    if (
        saveData ||
        effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        effectiveType === '3g' ||
        (downlinkMbps !== null && downlinkMbps > 0 && downlinkMbps < 1.5) ||
        (rttMs !== null && rttMs > 350) ||
        (hasFreshSample && estimatedBps < 900_000) ||
        (runtimeLastTtfbMs !== null && runtimeLastTtfbMs > 2200)
    ) {
        tier = 'poor';
    } else if (
        (downlinkMbps !== null && downlinkMbps < 4.5) ||
        (rttMs !== null && rttMs > 160) ||
        (hasFreshSample && estimatedBps < 2_400_000) ||
        (runtimeLastTtfbMs !== null && runtimeLastTtfbMs > 900)
    ) {
        tier = 'fair';
    }

    return {
        tier,
        saveData,
        effectiveType,
        downlinkMbps,
        rttMs,
        estimatedBps,
    };
}

/**
 * 根据播放阶段、网络状况与用户偏好计算最优运行期 maxBufferLength (秒)
 * - 省流模式 (saveData)：严格限制为 <= 10s
 * - 起播阶段 (!hasStarted)：保持精简缓冲 (12-16s) 避免抢占带宽，加速首帧渲染
 * - 稳态播放且网络抖动/较差：自动向上扩容至 35-45s 抗抖动安全垫 (若用户手动设得更大则保留用户值)
 */
export function getAdaptiveBufferTarget(
    userMaxBuffer: number,
    hasStarted: boolean,
    snapshot: NetworkSnapshot,
    highBwCap: number
): number {
    if (snapshot.saveData) {
        return Math.min(userMaxBuffer, 10);
    }

    if (!hasStarted) {
        return Math.min(userMaxBuffer, snapshot.tier === 'poor' ? 12 : 16);
    }

    if (snapshot.tier === 'poor') {
        return Math.max(userMaxBuffer, highBwCap);
    }
    if (snapshot.tier === 'fair') {
        return Math.max(userMaxBuffer, Math.min(highBwCap, 35));
    }
    return userMaxBuffer;
}

/**
 * 订阅浏览器网络变化事件 (如 WiFi 切 4G / 弱网恢复)
 */
export function subscribeNetworkChange(listener: () => void): () => void {
    const conn = getNavigatorConnection();
    if (!conn?.addEventListener || !conn?.removeEventListener) {
        return () => {};
    }
    conn.addEventListener('change', listener);
    return () => {
        conn.removeEventListener?.('change', listener);
    };
}

/**
 * 记录线路卡顿/失败惩罚，用于动态优化自动换线顺序
 */
export function recordSourcePenalty(sourceId: string, url?: string) {
    if (!sourceId) return;
    sessionLinePenalties.set(sourceId, (sessionLinePenalties.get(sourceId) || 0) + 1);
    if (url) {
        const origin = safeOrigin(url);
        if (origin) {
            ensureCdnPerfLoaded();
            const prev = memoryCdnPerf[origin];
            memoryCdnPerf[origin] = {
                ewmaBps: prev?.ewmaBps ?? 400_000,
                avgTtfbMs: prev?.avgTtfbMs ?? 1500,
                penalties: (prev?.penalties ?? 0) + 1,
                updatedAt: Date.now(),
            };
            persistCdnPerf();
        }
    }
}

export function recordSourceSuccess(sourceId: string) {
    if (!sourceId) return;
    sessionLineSuccess.set(sourceId, (sessionLineSuccess.get(sourceId) || 0) + 1);
}

/**
 * 综合会话实测表现 + LINE_PREFERENCE 静态先验，对候选线路进行智能排序
 */
export function rankLineOrder<T extends { source_id: string }>(
    lines: T[],
    preferredIds: readonly string[]
): T[] {
    const prefRank = new Map<string, number>();
    preferredIds.forEach((id, idx) => prefRank.set(id, idx));

    return [...lines].sort((a, b) => {
        const penA = sessionLinePenalties.get(a.source_id) || 0;
        const penB = sessionLinePenalties.get(b.source_id) || 0;
        if (penA !== penB) return penA - penB;

        const sucA = sessionLineSuccess.get(a.source_id) || 0;
        const sucB = sessionLineSuccess.get(b.source_id) || 0;
        if (sucA !== sucB) return sucB - sucA;

        const rankA = prefRank.has(a.source_id) ? prefRank.get(a.source_id)! : 999;
        const rankB = prefRank.has(b.source_id) ? prefRank.get(b.source_id)! : 999;
        return rankA - rankB;
    });
}
