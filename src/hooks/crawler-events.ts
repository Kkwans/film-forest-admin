'use client';

import { useEffect, useRef } from 'react';
import { adminStreamUrl, type CrawlerProgressEvent } from '@/lib/api';
import { parseCrawlerSseFrames } from './crawler-sse';

interface CrawlerEventsOptions {
  enabled?: boolean;
  closeOnTerminal?: boolean;
  onEvent: (event: CrawlerProgressEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * 认证 SSE。原生 EventSource 不能携带现有 Bearer JWT，因此使用 fetch 流读取，
 * 断线采用指数退避重连；实时流不可用时由业务层启用低频兜底刷新。
 */
export function useCrawlerEvents(
  target: number | 'all' | null,
  { enabled = true, closeOnTerminal = false, onEvent, onConnectionChange }: CrawlerEventsOptions,
) {
  const onEventRef = useRef(onEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onConnectionChangeRef.current = onConnectionChange; }, [onConnectionChange]);

  useEffect(() => {
    if (!enabled || target === null || typeof window === 'undefined') return;

    let stopped = false;
    let retryTimer: number | undefined;
    let controller: AbortController | undefined;
    let retryDelay = 1_000;

    const setConnected = (connected: boolean) => onConnectionChangeRef.current?.(connected);
    const scheduleReconnect = () => {
      if (stopped) return;
      retryTimer = window.setTimeout(() => { void connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };

    async function connect() {
      if (stopped) return;
      const token = localStorage.getItem('token');
      if (!token) {
        setConnected(false);
        scheduleReconnect();
        return;
      }

      controller = new AbortController();
      const path = target === 'all' ? '/api/crawler/events' : `/api/crawler/jobs/${target}/events`;
      try {
        const response = await fetch(adminStreamUrl(path), {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);

        retryDelay = 1_000;
        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const parsed = parseCrawlerSseFrames(buffer);
          buffer = parsed.rest;
          for (const event of parsed.events) {
            onEventRef.current(event as CrawlerProgressEvent);
            if (closeOnTerminal && event.type === 'terminal') {
              stopped = true;
              break;
            }
          }
        }
      } catch {
        // Abort、权限刷新和网络断开都走同一套低频指数退避重连。
      } finally {
        setConnected(false);
        if (!stopped) scheduleReconnect();
      }
    }

    void connect();
    return () => {
      stopped = true;
      setConnected(false);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [closeOnTerminal, enabled, target]);
}
