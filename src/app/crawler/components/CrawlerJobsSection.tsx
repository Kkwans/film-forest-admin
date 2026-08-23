'use client';

import { useState } from 'react';
import { Eye, Loader2, RefreshCw, Square } from 'lucide-react';
import { crawlerApi, type CrawlerTaskLog } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { TooltipText } from '@/components/ui/tooltip';
import { extractErrorMessage } from '@/lib/utils';
import { StatusBadge, contentTypeLabel, crawlerErrorMessage, crawlerPanelClass, crawlerStageLabel, elapsedFor, formatCrawlerTime } from './crawler-ui';
import { CrawlerJobDetailModal } from './CrawlerJobDetailModal';

interface Props {
  jobs: CrawlerTaskLog[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  focusJobId?: number | null;
  onFocusHandled?: () => void;
}

const progressFields: Array<[keyof CrawlerTaskLog, string]> = [
  ['discoveredCount', '发现'],
  ['fetchSucceededCount', '获取'],
  ['parseSucceededCount', '解析'],
  ['addedCount', '新增'],
  ['updatedCount', '更新'],
  ['unchangedCount', '未变化'],
  ['filteredCount', '过滤'],
  ['failedCount', '失败'],
];

export function CrawlerJobsSection({ jobs, loading, onRefresh, focusJobId, onFocusHandled }: Props) {
  const toast = useToast();
  const dialog = useDialog();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const detailJobId = focusJobId ?? selectedJobId;

  const cancel = async (job: CrawlerTaskLog) => {
    const confirmed = await dialog.confirm({
      title: '取消运行 Job',
      content: `Job #${job.id} 会完成当前内容项、保存安全检查点后退出。确定继续？`,
      confirmText: '请求取消',
      variant: 'warning',
    });
    if (!confirmed) return;
    setCancellingId(job.id);
    try {
      const response = await crawlerApi.cancelJob(job.id);
      if (response.data?.data !== true) throw new Error(response.data?.message || 'Job 已不在活动状态');
      toast.success(`Job #${job.id} 已收到取消请求`);
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '取消 Job 失败'));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">运行任务</h2>
          <p className="mt-1 text-sm text-muted-foreground">只展示排队、运行和正在取消的权威 Job；活动任务会自动刷新，页面隐藏时暂停。</p>
        </div>
        <Button variant="outline" onClick={() => void onRefresh()} disabled={loading}><RefreshCw />手动刷新</Button>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-12 text-muted-foreground"><Loader2 className="animate-spin" />读取活动 Job</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><p className="font-medium text-foreground">当前没有活动 Job</p><p className="mt-1 text-sm text-muted-foreground">空闲时轮询降为 20 秒；可在任务配置中手工启动。</p></div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <article key={job.id} className={`${crawlerPanelClass} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">Job #{job.id}</h3><StatusBadge status={job.status} /></div>
                  <p className="mt-1 text-sm text-muted-foreground">{job.scheduleName || `配置 #${job.scheduleId}`} · {job.sourceCode || '-'} · {contentTypeLabel(job.contentType)} · {job.triggerType || '-'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedJobId(job.id)}><Eye />详情</Button>
                  <Button variant="destructive" size="sm" disabled={cancellingId === job.id || job.status === 'cancel_requested'} onClick={() => void cancel(job)}>
                    {cancellingId === job.id ? <Loader2 className="animate-spin" /> : <Square />}{job.status === 'cancel_requested' ? '等待退出' : '取消'}
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                {progressFields.map(([key, label]) => <div key={key} className="h-[3.75rem] rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums text-foreground">{Number(job[key] ?? 0)}</p></div>)}
              </div>
              {job.currentItemTitle && (
                <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.045] px-3 py-2 text-sm">
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                  <span className="shrink-0 text-xs font-medium text-primary">当前解析</span>
                  <span className="min-w-0 truncate font-medium text-foreground" title={job.currentItemTitle}>{job.currentItemTitle}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">· {crawlerStageLabel(job.currentStage)}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-xs font-semibold text-primary">{job.currentStageProgress ?? 0}%</span>
                </div>
              )}
              <dl className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <div className="min-w-0">当前页：<span className="text-foreground">{job.currentPage ?? '-'}</span></div>
                <div className="min-w-0 truncate">当前项：<span className="text-foreground">{job.currentItem ? <TooltipText content={job.currentItem}>{job.currentItem}</TooltipText> : '-'}</span></div>
                <div className="min-w-0">已用时：<span className="text-foreground">{elapsedFor(job.startedAt, job.queuedAt, job.durationMs)}</span></div>
                <div className="min-w-0">心跳：<span className="text-foreground">{formatCrawlerTime(job.heartbeatAt)}</span></div>
              </dl>
              {job.errorSummary && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{crawlerErrorMessage(job.errorSummary)}</p>}
            </article>
          ))}
        </div>
      )}

      <CrawlerJobDetailModal
        key={detailJobId ?? 'closed'}
        jobId={detailJobId}
        onClose={() => {
          setSelectedJobId(null);
          onFocusHandled?.();
        }}
      />
    </section>
  );
}
