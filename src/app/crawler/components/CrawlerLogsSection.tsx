'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { crawlerApi, type CrawlerSchedule, type CrawlerSourceDescriptor, type CrawlerTaskLog, type PageData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { useToast } from '@/components/ui/toast';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { extractErrorMessage } from '@/lib/utils';
import { CONTENT_TYPES, JOB_STATUSES, StatusBadge, contentTypeLabel, elapsedFor, formatCrawlerTime, inputClass } from './crawler-ui';

interface Props {
  schedules: CrawlerSchedule[];
  sources: CrawlerSourceDescriptor[];
  hasActiveJobs: boolean;
}

const emptyPage: PageData<CrawlerTaskLog> = { records: [], total: 0, size: 20, current: 1, pages: 0 };
const retryableStatuses = new Set(['failed', 'partial_success', 'cancelled', 'interrupted']);

function shanghaiInputToIso(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

export function CrawlerLogsSection({ schedules, sources, hasActiveJobs }: Props) {
  const toast = useToast();
  const [pageData, setPageData] = useState<PageData<CrawlerTaskLog>>(emptyPage);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CrawlerTaskLog | null>(null);
  const [status, setStatus] = useState('all');
  const [scheduleId, setScheduleId] = useState('all');
  const [source, setSource] = useState('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [keyword, setKeyword] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crawlerApi.listLogs({
        status: status === 'all' ? undefined : status,
        scheduleId: scheduleId === 'all' ? undefined : Number(scheduleId),
        source: source === 'all' ? undefined : source,
        type: type === 'all' ? undefined : type,
        from: from ? shanghaiInputToIso(from) : undefined,
        to: to ? shanghaiInputToIso(to) : undefined,
        keyword: keyword.trim() || undefined,
        page,
        size: 20,
      });
      if (response.data?.code !== 200) throw new Error(response.data?.message || '日志加载失败');
      setPageData(response.data.data as PageData<CrawlerTaskLog>);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '日志加载失败'));
    } finally {
      setLoading(false);
    }
  }, [from, keyword, page, scheduleId, source, status, to, toast, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchLogs(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);
  useAdaptivePolling({ hasActiveJobs, onPoll: fetchLogs });

  const resetPage = () => setPage(1);

  const retry = async (job: CrawlerTaskLog) => {
    setRetryingId(job.id);
    try {
      const response = await crawlerApi.retry(job.id);
      if (response.data?.code !== 200) throw new Error(response.data?.message || '重试被拒绝');
      toast.success(`已基于 Job #${job.id} 创建重试任务`);
      await fetchLogs();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '重试 Job 失败'));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-foreground">执行日志</h2><p className="mt-1 text-sm text-muted-foreground">服务端真分页；关键词检索配置、当前项、来源和错误摘要。</p></div>
        <Button variant="outline" onClick={() => void fetchLogs()} disabled={loading}><RefreshCw />刷新当前页</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input className={`${inputClass} pl-9`} value={keyword} placeholder="配置、当前项、来源或错误" onChange={event => { setKeyword(event.target.value); resetPage(); }} /></div>
        <Select value={status} onChange={value => { setStatus(value); resetPage(); }} options={JOB_STATUSES} />
        <Select value={scheduleId} onChange={value => { setScheduleId(value); resetPage(); }} options={[{ label: '全部配置', value: 'all' }, ...schedules.map(item => ({ label: item.name, value: String(item.id) }))]} searchable />
        <Select value={source} onChange={value => { setSource(value); resetPage(); }} options={[{ label: '全部来源', value: 'all' }, ...sources.map(item => ({ label: item.name, value: item.code }))]} />
        <Select value={type} onChange={value => { setType(value); resetPage(); }} options={[{ label: '全部类型', value: 'all' }, ...CONTENT_TYPES]} />
        <label className="space-y-1"><span className="text-xs text-muted-foreground">开始时间（上海）</span><input className={inputClass} type="datetime-local" value={from} onChange={event => { setFrom(event.target.value); resetPage(); }} /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">结束时间（上海）</span><input className={inputClass} type="datetime-local" value={to} onChange={event => { setTo(event.target.value); resetPage(); }} /></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm"><span className="text-muted-foreground">共 <strong className="text-foreground">{pageData.total}</strong> 个 Job</span><span className="text-xs text-muted-foreground">第 {pageData.current}/{Math.max(pageData.pages, 1)} 页</span></div>
        {loading && pageData.records.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="animate-spin" />查询日志</div>
        ) : pageData.records.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">当前筛选条件下没有 Job 日志。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Job / 配置</th><th className="p-3">来源 / 类型</th><th className="p-3">状态</th><th className="p-3">发现 / 获取 / 解析</th><th className="p-3">新增 / 更新 / 失败</th><th className="p-3">耗时</th><th className="p-3">开始时间</th><th className="p-3 text-right">操作</th></tr></thead>
              <tbody className="divide-y divide-border">
                {pageData.records.map(job => (
                  <tr key={job.id} className="hover:bg-muted/20">
                    <td className="p-3"><p className="font-medium text-foreground">#{job.id} · {job.scheduleName || '-'}</p><p className="mt-1 text-xs text-muted-foreground">{job.triggerType || '-'}{job.retryOfJobId ? ` · 重试 #${job.retryOfJobId}` : ''}</p></td>
                    <td className="p-3 text-muted-foreground">{job.sourceCode || '-'} / {contentTypeLabel(job.contentType)}</td>
                    <td className="p-3"><StatusBadge status={job.status} /></td>
                    <td className="p-3 text-muted-foreground">{job.discoveredCount ?? 0} / {job.fetchSucceededCount ?? 0} / {job.parseSucceededCount ?? 0}</td>
                    <td className="p-3"><span className="text-primary">+{job.addedCount ?? 0}</span> / {job.updatedCount ?? 0} / <span className={(job.failedCount ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}>{job.failedCount ?? 0}</span></td>
                    <td className="p-3 text-muted-foreground">{elapsedFor(job.startedAt, job.queuedAt, job.durationMs)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatCrawlerTime(job.startedAt || job.queuedAt)}</td>
                    <td className="p-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="查看详情" onClick={() => setDetail(job)}><Eye /></Button>{retryableStatuses.has(job.status) && <Button variant="outline" size="icon" title="重试" disabled={retryingId === job.id} onClick={() => void retry(job)}>{retryingId === job.id ? <Loader2 className="animate-spin" /> : <RotateCcw />}</Button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border p-4"><Pagination currentPage={pageData.current} totalPages={pageData.pages} onPageChange={setPage} /></div>
      </div>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail ? `Job #${detail.id} 日志详情` : '日志详情'} width="lg">
        {detail && <div className="space-y-4"><div className="flex flex-wrap gap-2"><StatusBadge status={detail.status} /><span className="text-sm text-muted-foreground">{detail.scheduleName} · {detail.sourceCode} · {contentTypeLabel(detail.contentType)}</span></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">当前项</dt><dd className="mt-1 break-all text-foreground">{detail.currentItem || '-'}</dd></div><div><dt className="text-xs text-muted-foreground">检查点</dt><dd className="mt-1 break-all text-foreground">{detail.checkpoint || '-'}</dd></div><div><dt className="text-xs text-muted-foreground">心跳</dt><dd className="mt-1 text-foreground">{formatCrawlerTime(detail.heartbeatAt)}</dd></div><div><dt className="text-xs text-muted-foreground">完成时间</dt><dd className="mt-1 text-foreground">{formatCrawlerTime(detail.finishedAt)}</dd></div></dl>{(detail.errorSummary || detail.errorMessage) && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3"><p className="text-xs font-medium text-destructive">错误摘要</p><p className="mt-1 whitespace-pre-wrap break-all text-sm text-destructive">{detail.errorSummary || detail.errorMessage}</p></div>}</div>}
      </Modal>
    </section>
  );
}
