import { useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

interface UsePlaybackHealthProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: React.RefObject<InstanceType<typeof Hls> | null>;
  showToast: (message: string) => void;
  // v0.9.25: 线路连续卡顿达到上限时的回调 (用于自动切换到更快线路)
  onGiveUp?: () => void;
}

// 卡死恢复等级 (无进度每 STALL_THRESHOLD_MS 升一级)
const RECOVERY_START_LOAD = 1; // 重新拉取 (hls.startLoad)
const RECOVERY_SKIP = 2; // 跳过 STALL_SKIP_SECONDS (并降级码率)
const RECOVERY_RESET = 3; // 完整重置 hls 实例 (recoverMediaError)
const RECOVERY_GIVE_UP = 4; // 以上均无效 → 交给上层自动换线

// 看门狗心跳间隔 (ms)
const WATCHDOG_INTERVAL_MS = 1000;

/**
 * 播放健康看门狗 (v0.9.27 重写):
 * 旧实现依赖 waiting 事件重发 + readyState 门禁, 存在三条死锁路径导致"播放着就停下来不缓存, 然后永久卡住":
 *  1. 缓冲区内有残存数据时 readyState>=3, 定时器到点不动作, 而 waiting 不会重发;
 *  2. skipStall 提前 return (时长不可用/已到结尾) 后 recoveringRef 卡在 true, 吞掉后续所有 waiting;
 *  3. useHlsSource 错误处理 default 分支 hls.destroy() 后实例作废, 后续 startLoad 全是空操作。
 * 新实现改为: 1s 心跳检测 video.currentTime 是否前进, 无进度持续超过 STALL_THRESHOLD_MS 就逐级恢复
 * (startLoad → 跳过 → recoverMediaError → 自动换线), 不依赖 waiting 重发, 且不存在能卡死的门禁。
 */
export function usePlaybackHealth({ videoRef, hlsRef, showToast, onGiveUp }: UsePlaybackHealthProps) {
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

  // 重置卡死跟踪 (进度前进 / 暂停 / 用户 seek / 播放 / 结束)
  const resetStallTracking = useCallback(() => {
    lastProgressRef.current = null;
    stallStartRef.current = null;
    recoveryStepRef.current = 0;
  }, []);

  // 跳过卡顿片段 (跳过 STALL_SKIP_SECONDS), 返回是否成功
  const skipStall = useCallback((): boolean => {
    const video = videoRef.current;
    if (!video) return false;

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
  }, [videoRef]);

  // 主动降一级码率 (卡顿反复时降低网络压力)
  const downgradeLevel = useCallback(() => {
    const hls = hlsRef.current;
    if (hls && hls.currentLevel > 0) {
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
      // v0.9.28: recoverMediaError 内部 media.load() 会把视频置为暂停, hls.js 不会自动续播,
      // 恢复前若是播放中则手动 resume, 否则重置后视频会停在暂停态 (看门狗也会因此误判为健康暂停)
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
    showToast('当前视频源不稳定，建议切换线路');
    // v0.9.25: 卡顿已达上限, 触发自动切换 (切到偏好表里更快的线路)
    if (CONFIG.AUTO_SWITCH_LINE && onGiveUp) {
      // 重置计数, 允许切换后若仍卡顿可再次触发
      skipCountRef.current = 0;
      onGiveUp();
    }
  }, [showToast, onGiveUp]);

  // 执行一次恢复动作 (每 STALL_THRESHOLD_MS 无进度升一级)
  const runRecovery = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    recoveryStepRef.current += 1;
    const step = recoveryStepRef.current;
    const hls = hlsRef.current;

    // 诊断日志: 便于排查卡死根因 (用户反馈时带上控制台输出)
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
        // 1. 重新拉取数据 (hls.js 若卡在内部状态, startLoad 是安全的重启入口)
        if (hls) {
          try {
            hls.startLoad();
            logger.info('卡死恢复: hls.startLoad()');
          } catch (e) {
            logger.error('hls.startLoad 失败', e);
          }
        }
        break;

      case RECOVERY_SKIP:
        // 2. 跳过卡顿片段; 反复卡顿则顺便降一级码率
        if (skipCountRef.current >= 1) downgradeLevel();
        if (!skipStall()) {
          // 无法跳过 (时长不可用/已到结尾/未起播) → 直接升级到完整重置
          recoveryStepRef.current = RECOVERY_RESET;
          resetHls();
        }
        break;

      case RECOVERY_RESET:
        // 3. 完整重置 hls 实例 (可恢复 hls.js 内部管线卡死)
        if (!resetHls()) {
          recoveryStepRef.current = RECOVERY_GIVE_UP;
          giveUp();
        }
        break;

      default:
        // 4. 以上均无效 → 自动换线
        recoveryStepRef.current = 0;
        giveUp();
        break;
    }
  }, [videoRef, hlsRef, downgradeLevel, skipStall, resetHls, giveUp]);

  // 看门狗: 周期性检测 currentTime 是否前进 (不依赖 waiting 事件重发)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      const v = videoRef.current;
      if (!v) return;

      // 暂停 / 已结束 → 不视为卡死
      if (v.paused || v.ended) {
        resetStallTracking();
        return;
      }

      const now = v.currentTime;
      const prev = lastProgressRef.current;

      if (prev === null) {
        // 首次观测: 记录位置
        lastProgressRef.current = now;
        return;
      }

      if (now !== prev) {
        // 有进度 → 健康
        resetStallTracking();
        lastProgressRef.current = now;
        return;
      }

      // 无进度 → 累计卡死时间
      if (stallStartRef.current === null) {
        stallStartRef.current = Date.now();
        // 首次检测到停滞: 立即尝试 startLoad (不等阈值, 快速响应)
        const hls = hlsRef.current;
        if (hls && recoveryStepRef.current === 0) {
          try { hls.startLoad(); } catch { /* ignore */ }
          logger.info('检测到播放停滞, 立即 startLoad');
        }
        return;
      }

      const stalledMs = Date.now() - stallStartRef.current;
      if (stalledMs < CONFIG.STALL_THRESHOLD_MS) return;

      // 超过阈值 → 升级恢复动作
      runRecovery();
      // 恢复动作会 seek/重置, 重新计时
      stallStartRef.current = Date.now();
    };

    watchdogRef.current = setInterval(tick, WATCHDOG_INTERVAL_MS);
    return () => {
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [videoRef, hlsRef, resetStallTracking, runRecovery]);

  // 事件联动: waiting 立即记录 + 快速响应; playing/seeked/ended 重置
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      // 尚未记录卡死且未暂停 → 立即记录, 并快速 startLoad
      if (stallStartRef.current === null && !video.paused) {
        stallStartRef.current = Date.now();
        const hls = hlsRef.current;
        if (hls && recoveryStepRef.current === 0) {
          try { hls.startLoad(); } catch { /* ignore */ }
        }
      }
    };

    const handlePlaying = () => {
      // 成功恢复播放 → 重置卡死跟踪与跳过计数
      resetStallTracking();
      lastProgressRef.current = video.currentTime;
      skipCountRef.current = 0;
    };

    const handleSeeking = () => {
      // 用户主动 seek 不视为卡顿 (卡死恢复产生的 seek 除外)
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
  }, [videoRef, hlsRef, resetStallTracking]);

  return {
    resetSkipCount: () => {
      skipCountRef.current = 0;
    },
    stopStallDetection: resetStallTracking,
  };
}
