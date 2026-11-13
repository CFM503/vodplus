import { useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import type { LoaderStats } from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

interface UsePlaybackHealthProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: React.RefObject<InstanceType<typeof Hls> | null>;
  showToast: (message: string) => void;
  // v0.9.25: 线路连续卡顿达到上限时的回调 (用于自动切换到更快线路)
  onGiveUp?: () => void;
  // 起播过慢回调 (用于提前触发备用线路检索)
  onStartupSlow?: () => void;
  isLoading?: boolean;
  autoplay?: boolean;
  userPausedRef?: React.RefObject<boolean>;
  hasStartedPlayingRef?: React.RefObject<boolean>;
  lastNetworkActivityRef?: React.RefObject<number>;
  activeFragStatsRef?: React.RefObject<LoaderStats | null>;
}

// 卡死恢复等级 (无进度每 STALL_THRESHOLD_MS 升一级)
const RECOVERY_START_LOAD = 1; // 重新拉取 (hls.startLoad)
const RECOVERY_SKIP = 2; // 跳过 STALL_SKIP_SECONDS (并降级码率)
const RECOVERY_RESET = 3; // 完整重置 hls 实例 (recoverMediaError)
const RECOVERY_GIVE_UP = 4; // 以上均无效 → 交给上层自动换线

// 看门狗心跳间隔 (ms)
const WATCHDOG_INTERVAL_MS = 1000;
// 起播缓慢触发备用线路检索阈值 (ms)
const STARTUP_SLOW_MS = 3500;
// 起播完全超时放弃当前线路阈值 (ms)
const STARTUP_GIVE_UP_NO_NET_MS = 9500;
const STARTUP_GIVE_UP_MAX_MS = 15000;

/**
 * 播放健康看门狗 (v0.9.27 重写 + v0.9.49 弱网与起播优化):
 * 1. 1s 心跳检测 video.currentTime 是否前进，不依赖 waiting 重发；
 * 2. 起播阶段监听加载卡死（此时 video.paused 为 true），避免坏源死等；
 * 3. 弱网识别：检测到 HLS 正在持续接收字节 (activeFragStats.loaded 递增) 时，
 *    优先降级码率并放宽等待窗口，避免 6s 时强行 skipStall/recoverMediaError 打断即将下完的分片；
 * 4. 遇到时间轴空洞 (buffer hole) 时优先精准微调 currentTime 越过空洞。
 */
export function usePlaybackHealth({
  videoRef,
  hlsRef,
  showToast,
  onGiveUp,
  onStartupSlow,
  isLoading = false,
  autoplay = true,
  userPausedRef,
  hasStartedPlayingRef,
  lastNetworkActivityRef,
  activeFragStatsRef,
}: UsePlaybackHealthProps) {
  // 连续跳过次数计数 (用于码率降级决策)
  const skipCountRef = useRef(0);
  // 看门狗定时器
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  // 最近一次有进度的播放位置
  const lastProgressRef = useRef<number | null>(null);
  // 当前卡死起始时间 (ms)
  const stallStartRef = useRef<number | null>(null);
  // 当前恢复等级
  const recoveryStepRef = useRef(0);
  // 卡死恢复触发的 seek 标记 (与用户主动 seek 区分)
  const recoverySeekRef = useRef(false);

  // 起播监控状态
  const startupBeginRef = useRef<number>(Date.now());
  const startupSlowNotifiedRef = useRef(false);
  const startupGiveUpTriggeredRef = useRef(false);
  const lastObservedLoadedBytesRef = useRef<number>(0);
  const lastBytesProgressAtRef = useRef<number>(Date.now());
  const slowNetToastShownRef = useRef(false);

  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const onGiveUpRef = useRef(onGiveUp);
  onGiveUpRef.current = onGiveUp;
  const onStartupSlowRef = useRef(onStartupSlow);
  onStartupSlowRef.current = onStartupSlow;

  // 重置卡死跟踪 (进度前进 / 暂停 / 用户 seek / 播放 / 结束)
  const resetStallTracking = useCallback(() => {
    lastProgressRef.current = null;
    stallStartRef.current = null;
    recoveryStepRef.current = 0;
    slowNetToastShownRef.current = false;
  }, []);

  const resetSkipCount = useCallback(() => {
    skipCountRef.current = 0;
    startupBeginRef.current = Date.now();
    startupSlowNotifiedRef.current = false;
    startupGiveUpTriggeredRef.current = false;
    lastObservedLoadedBytesRef.current = 0;
    lastBytesProgressAtRef.current = Date.now();
    resetStallTracking();
  }, [resetStallTracking]);

  // 尝试跳过缓冲空洞 (例如 TS 分片之间存在 0.3~2.5s PTS 间隙)
  const tryJumpBufferHole = useCallback((video: HTMLVideoElement): boolean => {
    try {
      const now = video.currentTime;
      const buffered = video.buffered;
      for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);
        if (start > now && start - now <= 3.0 && end > start + 0.2) {
          recoverySeekRef.current = true;
          video.currentTime = start + 0.05;
          logger.info(`检测到缓冲空洞，跳转至 ${ (start + 0.05).toFixed(2) }s`);
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  // 跳过卡顿片段 (跳过 STALL_SKIP_SECONDS), 返回是否成功
  const skipStall = useCallback((): boolean => {
    const video = videoRef.current;
    if (!video) return false;

    if (tryJumpBufferHole(video)) {
      return true;
    }

    const currentTime = video.currentTime;
    const duration = video.duration;
    const skipTo = currentTime + CONFIG.STALL_SKIP_SECONDS;

    // 时长不可用或跳过位置超出视频范围时不执行跳过
    if (!Number.isFinite(duration) || !Number.isFinite(currentTime)) {
      logger.info('播放卡死: 视频时长不可用, 无法跳过');
      return false;
    }
    if (skipTo >= duration) {
      logger.info(`播放卡死: 跳过位置 ${skipTo.toFixed(1)}s 已超出视频总时长 ${duration.toFixed(1)}s`);
      return false;
    }

    recoverySeekRef.current = true;
    video.currentTime = skipTo;
    skipCountRef.current += 1;
    logger.info(`跳过卡顿片段至 ${skipTo.toFixed(1)}s，当前跳过次数: ${skipCountRef.current}`);
    return true;
  }, [videoRef, tryJumpBufferHole]);

  // 主动降一级码率 (卡顿反复或弱网下载中降低后续分片压力)
  const downgradeLevel = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls || hls.levels.length <= 1) return;
    if (hls.currentLevel === -1) {
      // 自动模式：建议 ABR 下次切换到更低清晰度
      const currentAuto = hls.loadLevel > 0 ? hls.loadLevel : hls.nextAutoLevel;
      if (currentAuto > 0) {
        hls.nextAutoLevel = currentAuto - 1;
        logger.info(`弱网/卡顿降级自动码率至 level ${hls.nextAutoLevel}`);
      }
    } else if (hls.currentLevel > 0) {
      hls.currentLevel = hls.currentLevel - 1;
      logger.info(`卡顿反复, 手动降级码率至 level ${hls.currentLevel}`);
    }
  }, [hlsRef]);

  // 完整重置 hls 实例 (detach + attach + 从当前位置恢复加载), 可恢复 hls.js 内部管线卡死
  const resetHls = useCallback((): boolean => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || typeof hls.recoverMediaError !== 'function') return false;
    try {
      logger.info('卡死恢复: recoverMediaError() 完整重置');
      const wasPlaying = !!video && !video.paused;
      hls.recoverMediaError();
      if (wasPlaying && video) {
        video.play().catch(() => { /* 自动播放策略拒绝/暂无数据时忽略, 继续由看门狗兜底 */ });
      }
      return true;
    } catch (e) {
      logger.error('recoverMediaError 失败', e);
      return false;
    }
  }, [videoRef, hlsRef]);

  // 卡死达到上限 → 提示 + 自动换线
  const giveUp = useCallback(() => {
    showToast('当前视频源不稳定，正在切换更优线路…');
    if (CONFIG.AUTO_SWITCH_LINE && onGiveUpRef.current) {
      skipCountRef.current = 0;
      onGiveUpRef.current();
    }
  }, [showToast]);

  // 执行一次恢复动作 (每阈值周期无进度升一级)
  const runRecovery = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    recoveryStepRef.current += 1;
    const step = recoveryStepRef.current;
    const hls = hlsRef.current;

    let bufInfo = '无缓冲';
    try {
      if (video.buffered && video.buffered.length > 0) {
        const ranges: string[] = [];
        for (let i = 0; i < video.buffered.length; i++) {
          ranges.push(`${video.buffered.start(i).toFixed(1)}-${video.buffered.end(i).toFixed(1)}`);
        }
        bufInfo = ranges.join(', ');
      }
    } catch { /* ignore */ }
    logger.info(`播放卡死恢复: step=${step}/4, time=${video.currentTime.toFixed(1)}s, readyState=${video.readyState}, paused=${video.paused}, buffered=[${bufInfo}], hasHls=${!!hls}`);

    switch (step) {
      case RECOVERY_START_LOAD:
        if (tryJumpBufferHole(video)) {
          recoveryStepRef.current = 0;
          break;
        }
        if (hls) {
          try {
            downgradeLevel();
            hls.startLoad();
            logger.info('卡死恢复: hls.startLoad()');
          } catch (e) {
            logger.error('hls.startLoad 失败', e);
          }
        }
        break;

      case RECOVERY_SKIP:
        if (skipCountRef.current >= 1) downgradeLevel();
        if (!skipStall()) {
          recoveryStepRef.current = RECOVERY_RESET;
          resetHls();
        }
        break;

      case RECOVERY_RESET:
        if (!resetHls()) {
          recoveryStepRef.current = RECOVERY_GIVE_UP;
          giveUp();
        }
        break;

      default:
        recoveryStepRef.current = 0;
        giveUp();
        break;
    }
  }, [videoRef, hlsRef, downgradeLevel, skipStall, resetHls, giveUp, tryJumpBufferHole]);

  // 看门狗: 周期性检测起播超时与 currentTime 前进状态
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      const v = videoRef.current;
      if (!v) return;

      const nowMs = Date.now();
      // 检测当前分片字节是否仍在稳定增长 (progressive / xhr onprogress)
      const currentLoaded = activeFragStatsRef?.current?.loaded ?? 0;
      if (currentLoaded > lastObservedLoadedBytesRef.current) {
        lastObservedLoadedBytesRef.current = currentLoaded;
        lastBytesProgressAtRef.current = nowMs;
      } else if (currentLoaded < lastObservedLoadedBytesRef.current) {
        // 切换到了下一个新分片
        lastObservedLoadedBytesRef.current = currentLoaded;
      }

      const lastNetAt = Math.max(
        lastNetworkActivityRef?.current ?? 0,
        lastBytesProgressAtRef.current
      );
      const isActivelyDownloading = nowMs - lastNetAt < 3500;

      // 1. 起播阶段监控 (尚未真正起播前 v.paused 可能为 true，必须单独监控以拯救死源)
      const hasStarted = hasStartedPlayingRef?.current ?? (v.currentTime > 0 && !v.paused);
      if (!hasStarted && autoplayRef.current && !userPausedRef?.current && !v.ended) {
        const elapsedStartup = nowMs - startupBeginRef.current;
        if (!startupSlowNotifiedRef.current && elapsedStartup >= STARTUP_SLOW_MS) {
          startupSlowNotifiedRef.current = true;
          onStartupSlowRef.current?.();
        }
        const noNetTooLong = !isActivelyDownloading && elapsedStartup >= STARTUP_GIVE_UP_NO_NET_MS;
        const totalTooLong = elapsedStartup >= STARTUP_GIVE_UP_MAX_MS;
        if (!startupGiveUpTriggeredRef.current && (noNetTooLong || totalTooLong || (isLoadingRef.current && !isActivelyDownloading && elapsedStartup >= 8000))) {
          startupGiveUpTriggeredRef.current = true;
          logger.info(`起播超时 (${elapsedStartup}ms, netActive=${isActivelyDownloading}), 触发自动换线`);
          giveUp();
          return;
        }
      }

      // 暂停 / 已结束 → 不视为播放期卡死
      if (v.paused || v.ended) {
        resetStallTracking();
        return;
      }

      const now = v.currentTime;
      const prev = lastProgressRef.current;

      if (prev === null) {
        lastProgressRef.current = now;
        return;
      }

      if (now !== prev) {
        // 有进度 → 健康
        resetStallTracking();
        lastProgressRef.current = now;
        return;
      }

      // 优先检查是否存在缓冲空洞：若前方有现成已缓冲片段，立即越过空洞
      if (tryJumpBufferHole(v)) {
        resetStallTracking();
        return;
      }

      // 无进度 → 累计卡死时间
      if (stallStartRef.current === null) {
        stallStartRef.current = nowMs;
        const hls = hlsRef.current;
        if (hls && recoveryStepRef.current === 0) {
          if (isActivelyDownloading) {
            // 弱网仍在拉流：降级后续码率但不打断当前传输
            downgradeLevel();
          } else {
            try { hls.startLoad(); } catch { /* ignore */ }
            logger.info('检测到播放停滞且无字节进展, 立即 startLoad');
          }
        }
        return;
      }

      const stalledMs = nowMs - stallStartRef.current;
      // 关键弱网保护：如果字节仍在稳定接收中，把触发 skip/reset 的等待窗口放宽 3 倍 (9s)，
      // 防止下载到 80% 的慢分片被强行 seek/recoverMediaError 销毁重下！
      const effectiveThreshold = isActivelyDownloading
        ? CONFIG.STALL_THRESHOLD_MS * 3
        : CONFIG.STALL_THRESHOLD_MS;

      if (isActivelyDownloading && stalledMs >= CONFIG.STALL_THRESHOLD_MS && !slowNetToastShownRef.current) {
        slowNetToastShownRef.current = true;
        showToast('当前网络较慢，正在全力缓冲…');
        downgradeLevel();
      }

      if (stalledMs < effectiveThreshold) return;

      runRecovery();
      stallStartRef.current = nowMs;
    };

    watchdogRef.current = setInterval(tick, WATCHDOG_INTERVAL_MS);
    return () => {
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [
    videoRef,
    hlsRef,
    resetStallTracking,
    runRecovery,
    giveUp,
    downgradeLevel,
    tryJumpBufferHole,
    showToast,
    userPausedRef,
    hasStartedPlayingRef,
    lastNetworkActivityRef,
    activeFragStatsRef,
  ]);

  // 事件联动: waiting 立即记录; playing/seeked/ended 重置
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      if (stallStartRef.current === null && !video.paused) {
        stallStartRef.current = Date.now();
        const nowMs = Date.now();
        const lastNetAt = Math.max(
          lastNetworkActivityRef?.current ?? 0,
          lastBytesProgressAtRef.current
        );
        const hls = hlsRef.current;
        if (hls && recoveryStepRef.current === 0 && nowMs - lastNetAt >= 2000) {
          try { hls.startLoad(); } catch { /* ignore */ }
        }
      }
    };

    const handlePlaying = () => {
      resetStallTracking();
      lastProgressRef.current = video.currentTime;
      skipCountRef.current = 0;
    };

    const handleSeeking = () => {
      if (!recoverySeekRef.current) {
        resetStallTracking();
      }
    };

    const handleSeeked = () => {
      recoverySeekRef.current = false;
    };

    const handleEnded = () => {
      resetStallTracking();
      skipCountRef.current = 0;
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ended', handleEnded);
      resetStallTracking();
    };
  }, [videoRef, hlsRef, resetStallTracking, lastNetworkActivityRef]);

  return {
    resetSkipCount,
    stopStallDetection: resetStallTracking,
  };
}
