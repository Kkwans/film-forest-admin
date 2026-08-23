'use client';

import { useEffect } from 'react';

interface AdaptivePollingOptions {
  enabled?: boolean;
  hasActiveJobs: boolean;
  onPoll: () => void | Promise<void>;
  activeIntervalMs?: number;
  idleIntervalMs?: number;
}

/**
 * 单用户 NAS 的低频兜底轮询：实时事件流不可用时刷新，页面隐藏时完全暂停。
 * 首次数据加载由调用方负责，本 Hook 只安排后续动态刷新。
 */
export function useAdaptivePolling({
  enabled = true,
  hasActiveJobs,
  onPoll,
  activeIntervalMs = 30_000,
  idleIntervalMs = 60_000,
}: AdaptivePollingOptions) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const clearScheduledPoll = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const schedule = () => {
      clearScheduledPoll();
      if (cancelled || document.hidden) return;
      timeoutId = setTimeout(run, hasActiveJobs ? activeIntervalMs : idleIntervalMs);
    };

    const run = async () => {
      if (cancelled || document.hidden) return;
      try {
        await onPoll();
      } finally {
        schedule();
      }
    };

    const handleVisibilityChange = () => {
      clearScheduledPoll();
      if (!document.hidden) void run();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule();

    return () => {
      cancelled = true;
      clearScheduledPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeIntervalMs, enabled, hasActiveJobs, idleIntervalMs, onPoll]);
}
