'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { crawlerApi, type CrawlerOperationsStats } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { extractErrorMessage } from '@/lib/utils';
import { formatCrawlerTime, formatDuration } from './crawler-ui';

interface Props {
  hasActiveJobs: boolean;
}

export function CrawlerStatsSection({ hasActiveJobs }: Props) {
  const toast = useToast();
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<CrawlerOperationsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crawlerApi.getOperationsStats(days);
      if (response.data?.code !== 200) throw new Error(response.data?.message || '统计加载失败');
      setData(response.data.data as CrawlerOperationsStats);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '统计加载失败'));
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);
  useAdaptivePolling({ hasActiveJobs, onPoll: fetchStats });

  const maxDailyJobs = useMemo(() => Math.max(1, ...(data?.daily.map(item => item.jobs) || [1])), [data]);
  const metrics = data ? [
    ['Job 总数', data.jobs], ['成功', data.success], ['部分成功', data.partial], ['失败', data.failed],
    ['取消/中断', data.cancelled], ['平均耗时', formatDuration(data.avgDurationMs)], ['新增内容', data.added], ['更新内容', data.updated], ['失败内容项', data.failedItems],
  ] : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-foreground">运行统计</h2><p className="mt-1 text-sm text-muted-foreground">全部指标由数据库在 7/30 天窗口内聚合，不加载全量日志到浏览器。</p></div>
        <div className="flex gap-2"><Select className="w-28" value={String(days)} onChange={value => setDays(Number(value) as 7 | 30)} options={[{ label: '近 7 天', value: '7' }, { label: '近 30 天', value: '30' }]} /><Button variant="outline" onClick={() => void fetchStats()} disabled={loading}><RefreshCw />刷新</Button></div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-12 text-muted-foreground"><Loader2 className="animate-spin" />聚合运行数据</div>
      ) : !data ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">暂无统计数据。</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {metrics.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold text-foreground">{value}</p></div>)}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-medium text-foreground">每日 Job 趋势</h3>
              <div className="mt-4 space-y-2">
                {data.daily.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">该窗口尚无 Job。</p> : data.daily.map(day => (
                  <div key={day.date} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{day.date}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (day.jobs / maxDailyJobs) * 100)}%` }} /></div>
                    <span className="w-24 text-right text-foreground">{day.jobs} Job · +{day.added}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-medium text-foreground">来源健康度</h3>
              <div className="mt-4 space-y-3">
                {data.sourceHealth.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">该窗口尚无来源运行记录。</p> : data.sourceHealth.map(source => {
                  const rate = source.jobs === 0 ? 0 : Math.round((source.success / source.jobs) * 100);
                  return (
                    <div key={source.source} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between"><span className="font-medium text-foreground">{source.source}</span><span className="text-sm text-foreground">{rate}% 成功</span></div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{source.jobs} Job</span><span>{source.partial} 部分</span><span>{source.failed} 失败</span><span>均耗 {formatDuration(source.avgDurationMs)}</span></div>
                      <p className="mt-2 text-xs text-muted-foreground">最近运行：{formatCrawlerTime(source.lastRunAt)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
