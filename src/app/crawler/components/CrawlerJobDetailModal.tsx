'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {
  crawlerApi,
  type CrawlerProgressEvent,
  type CrawlerJobItemFailure,
  type CrawlerJobItemSuccess,
  type CrawlerScheduleCursor,
  type CrawlerTaskLog,
  type PageData,
} from '@/lib/api';
import Pagination from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { InfoHint, TooltipText } from '@/components/ui/tooltip';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { useCrawlerEvents } from '@/hooks/crawler-events';
import { extractErrorMessage } from '@/lib/utils';
import {
  CrawlerDetailField,
  CRAWLER_PROGRESS_STAGES,
  StatusBadge,
  contentTypeLabel,
  crawlerStageLabel,
  crawlerStageProgress,
  crawlerPanelClass,
  crawlerErrorMessage,
  elapsedFor,
  formatCrawlerTime,
  inputClass,
  sourceSortLabel,
  traversalModeLabel,
} from './crawler-ui';

interface Props {
  jobId: number | null;
  onClose: () => void;
}

const emptyFailures: PageData<CrawlerJobItemFailure> = {
  records: [], total: 0, size: 10, current: 1, pages: 0,
};
const emptySuccesses: PageData<CrawlerJobItemSuccess> = {
  records: [], total: 0, size: 8, current: 1, pages: 0,
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

const jobMetricHelp: Record<string, string> = {
  '发现': '从来源列表页识别出的条目总数。',
  '获取': '成功请求详情页并拿到响应的条目数。',
  '解析': '详情页通过来源解析器校验的条目数。',
  '新增': '本次运行首次写入内容库的条目数。',
  '更新': '本次运行刷新了已有内容字段的条目数。',
  '未变化': '已有记录与本次来源指纹一致，没有发生内容变化。',
  '过滤': '解析成功但被标准题材等后置条件过滤的条目数。',
  '失败': '获取、解析或保存阶段失败的条目数。',
  '扫描页': '本次运行实际请求并处理的来源列表页数。',
  '列表项': '从来源列表页读取的条目数；其中一部分可能因游标或上限未进入详情处理。',
  '详情尝试': '实际发起详情页请求的次数。',
  '游标推进': '成功确认处理结果并安全推进游标的次数。',
  '新内容': '最新区间计数：仅统计最新页窗口内处理的条目，不等同于“新增入库”。',
  '历史回填': '历史区间计数：评分/热度断点续爬，或超过最新页窗口的条目；即使首次入库，也属于历史区间。',
};

const jobMetaHelp: Record<string, string> = {
  '当前页': '当前正在处理或下一次准备处理的来源分页。',
  '当前项': '当前来源列表条目的链接或外部标识。',
  '来源排序': '本次 Job 请求来源列表时使用的排序方式。',
  '遍历模式': '本次 Job 采用的游标遍历策略，不代表内容是否首次入库。',
  '排队时间': 'Job 进入执行队列的时间。',
  '开始时间': 'Job 实际开始处理的时间。',
  '最近心跳': '服务端最近一次报告运行进度的时间。',
  '完成时间': 'Job 结束并写入最终统计的时间。',
  '累计耗时': '从排队/开始到结束或当前时刻的累计耗时。',
  '检查点': '用于异常恢复的页码、列表索引和外部 ID 快照。',
  '游标状态': '当前计划游标的状态与下一页位置。',
  '游标锚点': '恢复分页时用于定位的来源外部 ID。',
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

function listText(value?: string | null): string {
  if (!value) return '—';
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string' && item.trim()).join(' / ') || '—';
  } catch {
    // 历史数据可能是未编码的单值字符串，直接展示。
  }
  return value;
}

function scoreText(value?: number | null): string {
  return value === null || value === undefined ? '—' : String(value);
}

function CurrentItemProgress({ job, connected }: { job: CrawlerTaskLog; connected: boolean }) {
  if (!job.currentItemTitle && !job.currentStage) return null;
  const percent = Math.max(0, Math.min(100,
    job.currentStageProgress ?? crawlerStageProgress(job.currentStage)));
  const stages = CRAWLER_PROGRESS_STAGES.filter(stage => stage.value !== 'COMPLETED');

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-4" aria-label="当前解析进度">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">当前解析</p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground" title={job.currentItemTitle || undefined}>
            {job.currentItemTitle || '正在准备下一个影片'}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={job.currentStageMessage || undefined}>
            {job.currentStageMessage || crawlerStageLabel(job.currentStage)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-primary">{percent}%</p>
          <p className="text-xs text-muted-foreground">{crawlerStageLabel(job.currentStage)}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{connected ? '实时进度已连接' : '正在连接实时进度，断线后自动重连'}</span>
        <span className="tabular-nums">阶段进度 {percent}%</span>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-6" aria-label="影片解析阶段">
        {stages.map(stage => {
          const reached = crawlerStageProgress(job.currentStage) >= stage.percent;
          const active = job.currentStage === stage.value;
          return (
            <li key={stage.value} className="flex min-w-0 items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-primary ring-4 ring-primary/15' : reached ? 'bg-primary/65' : 'bg-border'}`} />
              <p className={`truncate text-[11px] ${active ? 'font-semibold text-primary' : reached ? 'text-foreground/75' : 'text-muted-foreground'}`}>
                {stage.label}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

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
  const [successes, setSuccesses] = useState<PageData<CrawlerJobItemSuccess>>(emptySuccesses);
  const [successesLoading, setSuccessesLoading] = useState(false);
  const [successesError, setSuccessesError] = useState('');
  const [successPage, setSuccessPage] = useState(1);
  const [successKeywordInput, setSuccessKeywordInput] = useState('');
  const [successKeyword, setSuccessKeyword] = useState('');
  const [cursor, setCursor] = useState<CrawlerScheduleCursor | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

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

  const fetchSuccesses = useCallback(async () => {
    if (!jobId) return;
    setSuccessesLoading(true);
    try {
      const response = await crawlerApi.listJobSuccesses(jobId, {
        keyword: successKeyword || undefined,
        page: successPage,
        size: 8,
      });
      if (response.data?.code !== 200 || !response.data.data) {
        throw new Error(response.data?.message || '成功明细加载失败');
      }
      setSuccesses(response.data.data);
      setSuccessesError('');
    } catch (error: unknown) {
      setSuccessesError(extractErrorMessage(error, '成功明细加载失败'));
    } finally {
      setSuccessesLoading(false);
    }
  }, [jobId, successKeyword, successPage]);

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
    if (!jobId) return;
    const timer = window.setTimeout(() => void fetchSuccesses(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchSuccesses, jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCategory(categoryInput.trim());
      setFailurePage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [categoryInput]);

  const active = Boolean(job && activeStatuses.has(job.status));
  const successfulCount = job
    ? (job.addedCount ?? 0) + (job.updatedCount ?? 0) + (job.unchangedCount ?? 0)
    : 0;
  const historicalSuccessSnapshotsUnavailable = Boolean(
    job && !successesLoading && successes.total === 0 && successfulCount > 0,
  );
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchJob(), fetchFailures(), fetchSuccesses()]);
  }, [fetchFailures, fetchJob, fetchSuccesses]);

  const handleCrawlerEvent = useCallback((event: CrawlerProgressEvent) => {
    if (event.job?.id !== jobId) return;
    setJob(event.job);
    if (event.type === 'item-completed' || event.type === 'item-failed' || event.type === 'terminal') {
      void fetchFailures();
      void fetchSuccesses();
    }
  }, [fetchFailures, fetchSuccesses, jobId]);

  useCrawlerEvents(jobId, {
    enabled: Boolean(jobId) && active,
    closeOnTerminal: true,
    onEvent: handleCrawlerEvent,
    onConnectionChange: setStreamConnected,
  });

  useAdaptivePolling({
    enabled: Boolean(jobId) && active && !streamConnected,
    hasActiveJobs: active,
    onPoll: refreshAll,
    activeIntervalMs: 30_000,
    idleIntervalMs: 60_000,
  });

  return (
    <Modal
      open={jobId !== null}
      onClose={onClose}
      title={jobId ? `Job #${jobId} 运行详情` : 'Job 运行详情'}
      description={active ? '实时接收当前解析状态；连接中断时每 30 秒低频兜底刷新。' : '展示该 Job 的最终运行事实和条目级明细。'}
      width="xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {job && <StatusBadge status={job.status} />}
            {job?.outcomeCode && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">{outcomeLabels[job.outcomeCode] || job.outcomeCode}</span>}
            {job && <span className="text-sm text-muted-foreground">{job.scheduleName || `配置 #${job.scheduleId}`} · {job.sourceCode || '-'} · {contentTypeLabel(job.contentType)}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={jobLoading || failuresLoading || successesLoading}>
            {jobLoading || failuresLoading || successesLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新
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
            <CurrentItemProgress job={job} connected={streamConnected} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ['发现', job.discoveredCount], ['获取', job.fetchSucceededCount], ['解析', job.parseSucceededCount],
                ['新增', job.addedCount], ['更新', job.updatedCount], ['未变化', job.unchangedCount],
                ['过滤', job.filteredCount], ['失败', job.failedCount], ['扫描页', job.pagesScanned],
                ['列表项', job.listItemsScanned], ['详情尝试', job.detailAttempted], ['游标推进', job.cursorAdvanced],
                ['新内容', job.newItems], ['历史回填', job.backfillItems],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex h-[4.75rem] flex-col justify-center rounded-xl border border-border bg-muted/35 p-3">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{label}</span>
                    <InfoHint label={String(label)} content={jobMetricHelp[String(label)] || '本次 Job 的运行统计。'} />
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{Number(value ?? 0)}</p>
                </div>
              ))}
            </div>

            <dl className="grid items-start gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['当前页', job.currentPage ?? '-'], ['当前项', job.currentItem || '-'],
                ['来源排序', sourceSortLabel(job.sourceSort)], ['遍历模式', traversalModeLabel(job.traversalMode)],
                ['排队时间', formatCrawlerTime(job.queuedAt)], ['开始时间', formatCrawlerTime(job.startedAt)],
                ['最近心跳', formatCrawlerTime(job.heartbeatAt)], ['完成时间', formatCrawlerTime(job.finishedAt)],
                ['累计耗时', elapsedFor(job.startedAt, job.queuedAt, job.durationMs)], ['检查点', job.checkpoint || '-'],
                ['游标状态', cursor ? `${cursor.state} · 第 ${cursor.nextPage} 页` : '-'],
                ['游标锚点', cursor?.nextExternalId || cursor?.lastCommittedExternalId || '-'],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex min-h-[5.75rem] min-w-0 flex-col justify-start rounded-xl border border-border p-3">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{label}</span>
                    <InfoHint label={String(label)} content={jobMetaHelp[String(label)] || 'Job 运行上下文信息。'} />
                  </dt>
                  <dd className="mt-1 min-h-10 min-w-0 text-foreground">
                    {String(value).length > 36 ? (
                      <TooltipText className="line-clamp-2 whitespace-normal break-all leading-5" content={String(value)}>{String(value)}</TooltipText>
                    ) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>

            {(job.errorSummary || job.errorMessage) && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-xs font-semibold text-destructive">任务错误摘要</p>
                <p className="mt-1 whitespace-pre-wrap break-all text-sm text-destructive">{crawlerErrorMessage(job.errorSummary || job.errorMessage)}</p>
              </div>
            )}
          </>
        ) : jobLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="animate-spin" />读取权威 Job</div>
        ) : null}

        <section className="space-y-3 border-t border-border pt-5" aria-labelledby="success-detail-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 id="success-detail-title" className="font-semibold text-foreground">爬取成功明细</h3>
              <p className="mt-1 text-xs text-muted-foreground">共 {successes.total} 条；按最新爬取时间倒序展示，序号表示本次 Job 的处理顺序，最新条目为最大序号。</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <input
                className={`${inputClass} min-w-0 sm:w-56`}
                value={successKeywordInput}
                placeholder="搜索标题、别名或来源 ID"
                onChange={event => setSuccessKeywordInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    setSuccessKeyword(successKeywordInput.trim());
                    setSuccessPage(1);
                  }
                }}
              />
              <Button variant="outline" onClick={() => { setSuccessKeyword(successKeywordInput.trim()); setSuccessPage(1); }}>
                搜索
              </Button>
            </div>
          </div>

          {successesError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{successesError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchSuccesses()}>重试成功明细</Button>
            </div>
          ) : successesLoading && successes.records.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="animate-spin" />读取成功明细</div>
          ) : historicalSuccessSnapshotsUnavailable ? (
            <div className="rounded-2xl border border-dashed border-amber-500/35 bg-amber-500/5 p-5 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">该 Job 有 {successfulCount} 条成功统计，但没有逐条成功快照。</p>
              <p className="mt-1 leading-6">这些记录产生于成功明细启用前，历史数据库只保存了汇总数字，无法补造真实的标题、来源和爬取时间。新运行的 Job 会从处理成功的第一条内容开始保存明细。</p>
            </div>
          ) : successes.records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">当前 Job 没有可展示的成功明细。</div>
          ) : (
            <div className="space-y-3">
              {successes.records.map((success, index) => {
                const sequence = Math.max(
                  successes.total - ((successes.current - 1) * successes.size + index),
                  1,
                );
                return (
                  <article key={success.id} data-crawler-success-card className={`${crawlerPanelClass} grid items-stretch gap-4 p-3 sm:h-[12rem] sm:grid-cols-[auto_minmax(0,1fr)]`}>
                    <div className="relative flex h-36 w-24 shrink-0 items-center justify-center self-center overflow-hidden rounded-xl bg-muted/50 text-[10px] text-muted-foreground sm:h-full sm:w-auto sm:aspect-[2/3]">
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-card/95 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary shadow-sm">{String(sequence).padStart(2, '0')}</span>
                      {success.posterUrl ? <img src={success.posterUrl} alt={`${success.title}海报`} className="block h-full w-full object-cover" /> : '无海报'}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <div className="grid min-h-0 gap-2 border-b border-border/70 pb-2 sm:h-[3.5rem] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-foreground">{success.title}{success.year ? `（${success.year}）` : ''}</p>
                          <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">别名：<TooltipText content={listText(success.alias)}>{listText(success.alias)}</TooltipText></p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-xs text-muted-foreground sm:justify-self-end">
                          <span className="tabular-nums">爬取时间 {formatCrawlerTime(success.crawledAt)}</span>
                          <a href={success.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            查看来源 <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                      <dl className="mt-2 grid min-w-0 auto-rows-[1.75rem] grid-cols-2 gap-x-5 gap-y-0 text-xs sm:grid-cols-4">
                        <CrawlerDetailField label="类型" title={contentTypeLabel(success.contentType)}>{contentTypeLabel(success.contentType)}</CrawlerDetailField>
                        <CrawlerDetailField label="评分" title={`豆瓣 ${scoreText(success.scoreDouban)} · IMDb ${scoreText(success.scoreImdb)} · 烂番茄 ${scoreText(success.scoreRt)}`}>豆瓣 {scoreText(success.scoreDouban)} · IMDb {scoreText(success.scoreImdb)} · 烂番茄 {scoreText(success.scoreRt)}</CrawlerDetailField>
                        <CrawlerDetailField label="导演" title={listText(success.directors)}>{listText(success.directors)}</CrawlerDetailField>
                        <CrawlerDetailField label="编剧" title={listText(success.writers)}>{listText(success.writers)}</CrawlerDetailField>
                        <CrawlerDetailField label="主演" title={listText(success.actors)}>{listText(success.actors)}</CrawlerDetailField>
                        <CrawlerDetailField label="题材" title={listText(success.genres)}>{listText(success.genres)}</CrawlerDetailField>
                        <CrawlerDetailField label="地区" title={listText(success.regions)}>{listText(success.regions)}</CrawlerDetailField>
                        <CrawlerDetailField label="语言" title={listText(success.languages)}>{listText(success.languages)}</CrawlerDetailField>
                        <CrawlerDetailField label="日期" title={success.releaseDate || '—'}>{success.releaseDate || '—'}</CrawlerDetailField>
                        <CrawlerDetailField label="时长">{success.duration ? `${success.duration} 分钟` : '—'}</CrawlerDetailField>
                        <CrawlerDetailField label="来源条目" title={success.externalId}>{success.externalId}</CrawlerDetailField>
                        <CrawlerDetailField label="内容">{contentTypeLabel(success.contentType)} #{success.contentId}</CrawlerDetailField>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <Pagination currentPage={successes.current} totalPages={successes.pages} onPageChange={setSuccessPage} />
        </section>

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
