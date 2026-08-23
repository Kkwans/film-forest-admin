export interface CrawlerSseEvent {
  type: string;
  jobId?: number | null;
  [key: string]: unknown;
}

interface ParsedSseFrames {
  events: CrawlerSseEvent[];
  rest: string;
}

/** 解析可能被网络分片的 SSE 帧；未结束的最后一帧会留给下一次读取。 */
export function parseCrawlerSseFrames(input: string): ParsedSseFrames {
  const normalized = input.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: CrawlerSseEvent[] = [];

  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) continue;
    try {
      const event = JSON.parse(data) as CrawlerSseEvent;
      if (event && typeof event.type === 'string') events.push(event);
    } catch {
      // 完整帧若损坏则丢弃，下一次连接会先获取数据库快照，不污染当前状态。
    }
  }

  return { events, rest };
}
