import { useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import { CONFIG } from '@/config/config';
import { logger } from '@/lib/logger';

interface UsePlaybackHealthProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: React.RefObject<InstanceType<typeof Hls> | null>;
  showToast: (message: string) => void;
}

export function usePlaybackHealth({ videoRef, hlsRef, showToast }: UsePlaybackHealthProps) {
  // 连续跳过次数计数
  const skipCountRef = useRef(0);
  // 卡死检测定时器
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 是否正在恢复中
  const recoveringRef = useRef(false);

  // 执行跳过操作
  const skipStall = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;
    const duration = video.duration;
    const skipTo = currentTime + CONFIG.STALL_SKIP_SECONDS;

    // 如果时长不可用或跳过位置超出视频范围，不执行跳过
    if (!Number.isFinite(duration) || !Number.isFinite(currentTime)) {
      logger.info('视频时长不可用，无法跳过');
      return;
    }

    // 如果跳过会超过或达到总时长，不执行跳过
    if (skipTo >= duration) {
      logger.info(`跳过位置 ${skipTo.toFixed(1)}s 已超出视频总时长 ${duration.toFixed(1)}s`);
      return;
    }

    video.currentTime = skipTo;
    skipCountRef.current += 1;

    logger.info(`跳过卡顿片段至 ${skipTo.toFixed(1)}s，当前跳过次数: ${skipCountRef.current}`);

    if (skipCountRef.current < CONFIG.MAX_STALL_SKIPS) {
      showToast(`视频卡顿，已跳过 ${CONFIG.STALL_SKIP_SECONDS} 秒`);
    } else {
      showToast('当前视频源不稳定，建议切换线路');
    }
  }, [showToast]);

  // 启动卡死检测
  const startStallDetection = useCallback(() => {
    stopStallDetection();
    recoveringRef.current = false;

    stallTimerRef.current = setTimeout(() => {
      // waiting 状态持续超过阈值，触发跳过
      const video = videoRef.current;
      if (!video) return;

      // 再次确认是否仍然卡顿（readyState < 3 表示没有足够数据播放）
      // readyState === 0 (HAVE_NOTHING) 也需要尝试跳过，因为可能一直无法加载
      if (video.readyState < 3) {
        recoveringRef.current = true;
        skipStall();
      }
    }, CONFIG.STALL_THRESHOLD_MS);
  }, [skipStall]);

  // 停止卡死检测
  const stopStallDetection = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    recoveringRef.current = false;
  }, []);

  // 主效果：监听 waiting 和 playing 事件
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      // 如果已经在恢复中，跳过检测
      if (recoveringRef.current) return;
      startStallDetection();
    };

    const handlePlaying = () => {
      // 开始播放后清除卡死检测
      stopStallDetection();
      // 成功播放后重置跳过计数
      skipCountRef.current = 0;
    };

    const handleSeeking = () => {
      // seek 时清除检测（用户主动操作不视为卡顿）
      stopStallDetection();
    };

    const handleEnded = () => {
      stopStallDetection();
      skipCountRef.current = 0;
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('ended', handleEnded);
      stopStallDetection();
    };
  }, [startStallDetection, stopStallDetection]);

  return {
    resetSkipCount: () => {
      skipCountRef.current = 0;
    },
    stopStallDetection,
  };
}
