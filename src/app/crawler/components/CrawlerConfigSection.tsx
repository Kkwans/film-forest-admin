'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Play, Plus, RefreshCw, RotateCcw, Square, Trash2 } from 'lucide-react';
import { crawlerApi, type CrawlerJobStartResult, type CrawlerSchedule, type CrawlerScheduleCursor, type CrawlerSourceDescriptor } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { StatusBadge, contentTypeLabel, formatCrawlerTime, sourceSortLabel } from './crawler-ui';
import { CrawlerScheduleEditor } from './CrawlerScheduleEditor';

interface Props {
  schedules: CrawlerSchedule[];
  sources: CrawlerSourceDescriptor[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onJobStarted: (result: CrawlerJobStartResult) => void | Promise<void>;
}

export function CrawlerConfigSection({ schedules, sources, loading, onRefresh, onJobStarted }: Props) {
  const toast = useToast();
  const dialog = useDialog();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CrawlerSchedule | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [cursors, setCursors] = useState<Record<number, CrawlerScheduleCursor>>({});

  useEffect(() => {
    let cancelled = false;
    const loadCursors = async () => {
      const entries = await Promise.all(schedules.map(async schedule => {
        try {
          const response = await crawlerApi.getCursor(schedule.id);
          return response.data?.code === 200 && response.data.data
            ? [schedule.id, response.data.data] as const
            : null;
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        setCursors(Object.fromEntries(entries.filter((entry): entry is readonly [number, CrawlerScheduleCursor] => entry !== null)));
      }
    };
    void loadCursors();
    return () => { cancelled = true; };
  }, [schedules]);

  const startCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const runAction = async (id: number, action: 'start' | 'stop') => {
    setActionId(id);
    try {
      if (action === 'start') {
        const response = await crawlerApi.start(id);
        const started = response.data?.data;
        if (response.data?.code !== 200 || !started?.jobId) {
          throw new Error(response.data?.message || '启动请求被拒绝');
        }
        toast.success(`Job #${started.jobId} 已进入队列`);
        await onJobStarted(started);
      } else {
        const response = await crawlerApi.stop(id);
        if (response.data?.code !== 200 || response.data?.data !== true) {
          throw new Error(response.data?.message || '当前没有可取消的 Job');
        }
        toast.success('已请求在安全边界取消');
        await onRefresh();
      }
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, action === 'start' ? '启动失败' : '取消失败'));
    } finally {
      setActionId(null);
    }
  };

  const toggle = async (schedule: CrawlerSchedule) => {
    try {
      const enabled = schedule.enabled !== 1;
      const response = await crawlerApi.toggleEnabled(schedule.id, enabled);
      if (response.data?.data !== true) throw new Error(response.data?.message || '状态修改被拒绝');
      toast.success(enabled ? '自动增量已启用' : '自动增量已关闭');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '修改调度状态失败'));
    }
  };

  const resetCursor = async (schedule: CrawlerSchedule) => {
    const confirmed = await dialog.confirm({
      title: '重置续爬游标',
      content: `将把“${schedule.name}”的下一页恢复为第 1 页，不删除历史 Job 或内容数据。当前没有活动 Job 时才能重置。确定继续吗？`,
      confirmText: '确认重置',
      variant: 'warning',
    });
    if (!confirmed) return;
    try {
      const response = await crawlerApi.resetCursor(schedule.id);
      if (response.data?.code !== 200 || !response.data.data) {
        throw new Error(response.data?.message || '游标重置失败');
      }
      setCursors(current => ({ ...current, [schedule.id]: response.data.data }));
      toast.success('续爬游标已重置，历史数据未删除');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '游标重置失败'));
    }
  };

  const remove = async (schedule: CrawlerSchedule) => {
    const confirmed = await dialog.confirm({
      title: '删除任务配置',
      content: `确定删除“${schedule.name}”吗？历史 Job 日志会保留。`,
      confirmText: '删除配置',
      variant: 'danger',
    });
    if (!confirmed) return;
    setDeletingId(schedule.id);
    try {
      const response = await crawlerApi.deleteSchedule(schedule.id);
      if (response.data?.data !== true) throw new Error(response.data?.message || '存在活动 Job，不能删除');
      setCursors(current => {
        const next = { ...current };
        delete next[schedule.id];
        return next;
      });
      toast.success('配置已删除，历史 Job 已保留');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '删除配置失败'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">任务配置</h2>
          <p className="mt-1 text-sm text-muted-foreground">定义来源、内容类型和默认抓取模式；自动调度仅适用于最新增量。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void onRefresh()} disabled={loading}><RefreshCw />刷新</Button>
          <Button onClick={startCreate}><Plus />新建配置</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.02]">
        {loading && schedules.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="animate-spin" />加载配置</div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">尚无任务配置。自动调度保持关闭，创建后可手工启动。</div>
        ) : (
          <div className="divide-y divide-border">
            {schedules.map(schedule => {
              const active = schedule.status === 'running';
              const cursor = cursors[schedule.id];
              const needsReview = schedule.configurationStatus === 'NEEDS_REVIEW';
              return (
                <article key={schedule.id} className="grid gap-4 p-5 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(15rem,1.2fr)_minmax(22rem,2fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-foreground">{schedule.name}</h3>
                      <StatusBadge status={schedule.latestResult} />
                      {needsReview && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">待复核</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">#{schedule.id} · {sources.find(source => source.id === schedule.sourceId)?.name || schedule.sourceSite} · {contentTypeLabel(schedule.contentType)}</p>
                  </div>
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">运行规则</dt><dd className="mt-0.5 text-foreground">{schedule.crawlMode === 'full' ? '全量手工' : schedule.scheduleMode === 'MANUAL' ? '仅手工' : schedule.scheduleMode === 'CUSTOM_CRON' ? '高级 Cron' : schedule.scheduleMode}</dd></div>
                    <div><dt className="text-muted-foreground">来源排序</dt><dd className="mt-0.5 text-foreground">{sourceSortLabel(schedule.sourceSort || 'TIME')}</dd></div>
                    <div><dt className="text-muted-foreground">新内容 / 回填</dt><dd className="mt-0.5 text-foreground">{schedule.newItemLimit ?? schedule.batchSize} / {schedule.backfillItemLimit ?? schedule.batchSize}</dd></div>
                    <div><dt className="text-muted-foreground">游标</dt><dd className="mt-0.5 text-foreground">{cursor ? `${cursor.state} · 第 ${cursor.nextPage} 页` : '尚未建立'}</dd></div>
                    <div><dt className="text-muted-foreground">上次运行</dt><dd className="mt-0.5 text-foreground">{formatCrawlerTime(schedule.lastRunTime)}</dd></div>
                    <div><dt className="text-muted-foreground">下次运行</dt><dd className="mt-0.5 text-foreground">{schedule.enabled === 1 ? formatCrawlerTime(schedule.nextRunTime) : '自动调度关闭'}</dd></div>
                  </dl>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => void toggle(schedule)} disabled={schedule.crawlMode === 'full' || needsReview}>
                      {schedule.enabled === 1 ? '关闭自动' : '启用自动'}
                    </Button>
                    <Button variant="outline" size="icon" title={active ? '取消 Job' : needsReview ? '来源待复核' : '手工启动'} disabled={actionId === schedule.id || (!active && needsReview)} onClick={() => void runAction(schedule.id, active ? 'stop' : 'start')}>
                      {actionId === schedule.id ? <Loader2 className="animate-spin" /> : active ? <Square /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon" title="重置续爬游标" disabled={active || !cursor} onClick={() => void resetCursor(schedule)}><RotateCcw /></Button>
                    <Button variant="ghost" size="icon" title="编辑" onClick={() => { setEditing(schedule); setEditorOpen(true); }}><Pencil /></Button>
                    <Button variant="destructive" size="icon" title="删除" disabled={deletingId === schedule.id} onClick={() => void remove(schedule)}>
                      {deletingId === schedule.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editorOpen && <CrawlerScheduleEditor open schedule={editing} sources={sources} onClose={() => setEditorOpen(false)} onSaved={onRefresh} />}
    </section>
  );
}
