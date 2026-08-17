'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {
  crawlerApi,
  type CrawlerJobItemFailure,
  type CrawlerScheduleCursor,
  type CrawlerTaskLog,
  type PageData,
} from '@/lib/api';
import Pagination from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { extractErrorMessage } from '@/lib/utils';
import {
  StatusBadge,
  contentTypeLabel,
  elapsedFor,
  formatCrawlerTime,
  inputClass,
} from './crawler-ui';

interface Props {
  jobId: number | null;
  onClose: () => void;
}

const emptyFailures: PageData<CrawlerJobItemFailure> = {
  records: [], total: 0, size: 10, current: 1, pages: 0,
};
const activeStatuses = new Set(['queued', 'running', 'cancel_requested']);
const stageOptions = [
  { label: '全部阶段', value: 'all' },
  { label: '获取页面', value: 'fetch' },
  { label: '解析内容', value: 'parse' },
  { label: '写入数据', value: 'persistence' },
];
const exhaustedOptions = [
  { label: '全部重试状态', value: 'all' },
  { label: '已耗尽重试', value: 'true' },
  { label: '仍可重试', value: 'false' },
];
const stageLabels: Record<string, string> = {
  fetch: '获取页面',
  parse: '解析内容',
  persistence: '写入数据',
};

const outcomeLabels: Record<string, string> = {
  COMPLETED: '已完成',
  PARTIAL: '部分完成',
  SOURCE_UNAVAILABLE: '来源不可用',
  RATE_LIMITED: '触发限速',
  NETWORK_FAILED: '网络失败',
  STRUCTURE_CHANGED: '来源结构变化',
  RECOVERY_REQUIRED: '需要恢复',
  ITEM_FAILED: '条目失败',
  CANCELLED: '已取消',
};

export function CrawlerJobDetailModal({ jobId, onClose }: Props) {
  const [job, setJob] = useState<CrawlerTaskLog | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState('');
  const [failures, setFailures] = useState<PageData<CrawlerJobItemFailure>>(emptyFailures);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [failuresError, setFailuresError] = useState('');
  const [failurePage, setFailurePage] = useState(1);
  const [stage, setStage] = useState('all');
  const [exhausted, setExhausted] = useState('all');
  const [categoryInput, setCategoryInput] = useState('');
  const [category, setCategory] = useState('');
  const [cursor, setCursor] = useState<CrawlerScheduleCursor | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    setJobLoading(true);
    try {
      const response = await crawlerApi.getJob(jobId);
      if (response.data?.code !== 200 || !response.data.data) {
        throw new Error(response.data?.message || 'Job 详情加载失败');
      }
      setJob(response.data.data);
      try {
        const cursorResponse = await crawlerApi.getCursor(response.data.data.scheduleId);
        setCursor(cursorResponse.data?.code === 200 ? cursorResponse.data.data || null : null);
      } catch {
        setCursor(null);
      }
      setJobError('');
    } catch (error: unknown) {
      setJobError(extractErrorMessage(error, 'Job 详情加载失败'));
    } finally {
      setJobLoading(false);
    }
  }, [jobId]);

  const fetchFailures = useCallback(async () => {
    if (!jobId) return;
    setFailuresLoading(true);
    try {
      const response = await crawlerApi.listJobFailures(jobId, {
        stage: stage === 'all' ? undefined : stage as 'fetch' | 'parse' | 'persistence',
        category: category || undefined,
        retryExhausted: exhausted === 'all' ? undefined : exhausted === 'true',
        page: failurePage,
        size: 10,
      });
      if (response.data?.code !== 200 || !response.data.data) {
        throw new Error(response.data?.message || '失败明细加载失败');
      }
      setFailures(response.data.data);
      setFailuresError('');
    } catch (error: unknown) {
      setFailuresError(extractErrorMessage(error, '失败明细加载失败'));
    } finally {
      setFailuresLoading(false);
    }
  }, [category, exhausted, failurePage, jobId, stage]);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setTimeout(() => void fetchJob(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchJob, jobId]);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setTimeout(() => void fetchFailures(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchFailures, jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCategory(categoryInput.trim());
      setFailurePage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [categoryInput]);

  const active = Boolean(job && activeStatuses.has(job.status));
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchJob(), fetchFailures()]);
  }, [fetchFailures, fetchJob]);
  useAdaptivePolling({
    enabled: Boolean(jobId) && active,
    hasActiveJobs: active,
    onPoll: refreshAll,
  });

  return (
    <Modal
      open={jobId !== null}
      onClose={onClose}
      title={jobId ? `Job #${jobId} 运行详情` : 'Job 运行详情'}
      description={active ? '运行中每 4 秒刷新进度和失败条目。' : '展示该 Job 的最终运行事实和条目级失败。'}
      width="xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {job && <StatusBadge status={job.status} />}
            {job?.outcomeCode && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">{outcomeLabels[job.outcomeCode] || job.outcomeCode}</span>}
            {job && <span className="text-sm text-muted-foreground">{job.scheduleName || `配置 #${job.scheduleId}`} · {job.sourceCode || '-'} · {contentTypeLabel(job.contentType)}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={jobLoading || failuresLoading}>
            {jobLoading || failuresLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新
          </Button>
        </div>

        {jobError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{jobError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchJob()}>重试详情</Button>
          </div>
        )}

        {job ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ['发现', job.discoveredCount], ['获取', job.fetchSucceededCount], ['解析', job.parseSucceededCount],
                ['新增', job.addedCount], ['更新', job.updatedCount], ['未变化', job.unchangedCount],
                ['过滤', job.filteredCount], ['失败', job.failedCount], ['扫描页', job.pagesScanned],
                ['列表项', job.listItemsScanned], ['详情尝试', job.detailAttempted], ['游标推进', job.cursorAdvanced],
                ['新内容', job.newItems], ['历史回填', job.backfillItems],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border bg-muted/35 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{Number(value ?? 0)}</p>
                </div>
              ))}
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['当前页', job.currentPage ?? '-'], ['当前项', job.currentItem || '-'],
                ['来源排序', job.sourceSort || '-'], ['遍历模式', job.traversalMode || '-'],
                ['排队时间', formatCrawlerTime(job.queuedAt)], ['开始时间', formatCrawlerTime(job.startedAt)],
                ['最近心跳', formatCrawlerTime(job.heartbeatAt)], ['完成时间', formatCrawlerTime(job.finishedAt)],
                ['累计耗时', elapsedFor(job.startedAt, job.queuedAt, job.durationMs)], ['检查点', job.checkpoint || '-'],
                ['游标状态', cursor ? `${cursor.state} · 第 ${cursor.nextPage} 页` : '-'],
                ['游标锚点', cursor?.nextExternalId || cursor?.lastCommittedExternalId || '-'],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0 rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-all text-foreground">{String(value)}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">查询快照</p>
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-foreground">{job.querySnapshot || '未记录'}</pre>
              </div>
              <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">配置快照</p>
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-foreground">{job.configSnapshot || '未记录'}</pre>
              </div>
            </div>

            {(job.errorSummary || job.errorMessage) && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-xs font-semibold text-destructive">Job 错误摘要</p>
                <p className="mt-1 whitespace-pre-wrap break-all text-sm text-destructive">{job.errorSummary || job.errorMessage}</p>
              </div>
            )}
          </>
        ) : jobLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="animate-spin" />读取权威 Job</div>
        ) : null}

        <section className="space-y-3 border-t border-border pt-5" aria-labelledby="failure-detail-title">
          <div>
            <h3 id="failure-detail-title" className="font-semibold text-foreground">条目失败明细</h3>
            <p className="mt-1 text-xs text-muted-foreground">共 {failures.total} 条；每条都限定在当前 Job，不混入历史任务。</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={stage} onChange={value => { setStage(value); setFailurePage(1); }} options={stageOptions} />
            <Select value={exhausted} onChange={value => { setExhausted(value); setFailurePage(1); }} options={exhaustedOptions} />
            <label>
              <span className="sr-only">错误分类</span>
              <input className={inputClass} value={categoryInput} maxLength={64} placeholder="错误分类（精确匹配）" onChange={event => setCategoryInput(event.target.value)} />
            </label>
          </div>

          {failuresError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{failuresError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchFailures()}>重试失败明细</Button>
            </div>
          ) : failuresLoading && failures.records.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="animate-spin" />读取失败明细</div>
          ) : failures.records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">当前条件下没有条目失败。</div>
          ) : (
            <div className="space-y-2">
              {failures.records.map(failure => (
                <article key={failure.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">{stageLabels[failure.failureStage] || failure.failureStage}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{failure.errorCategory}</span>
                        {failure.retryExhausted && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">重试已耗尽</span>}
                      </div>
                      <p className="mt-2 break-all text-sm font-medium text-foreground">来源条目 {failure.externalId}</p>
                    </div>
                    <a href={failure.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      查看来源 <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-all text-sm text-muted-foreground">{failure.diagnostic || '未记录诊断摘要'}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>尝试 {failure.attemptCount} 次</span><span>{formatCrawlerTime(failure.failedAt)}</span><span>{failure.sourceCode} · {contentTypeLabel(failure.contentType)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
          <Pagination currentPage={failures.current} totalPages={failures.pages} onPageChange={setFailurePage} />
        </section>
      </div>
    </Modal>
  );
}
