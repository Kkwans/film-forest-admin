'use client';

import { useState } from 'react';
import { Loader2, Pencil, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { crawlerApi, type CrawlerSchedule } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { CONTENT_TYPES, Field, StatusBadge, contentTypeLabel, formatCrawlerTime, inputClass } from './crawler-ui';

export interface CrawlerSourceOption {
  code: string;
  name: string;
}

interface Props {
  schedules: CrawlerSchedule[];
  sources: CrawlerSourceOption[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

type FormState = {
  id?: number;
  name: string;
  sourceSite: string;
  contentType: string;
  crawlMode: 'latest' | 'full';
  cronExpression: string;
  batchSize: number;
  rateLimitMs: number;
  priority: string;
  genreFilter: string;
  enabled: number;
};

const emptyForm: FormState = {
  name: '',
  sourceSite: 'pkmp4',
  contentType: 'movie',
  crawlMode: 'latest',
  cronExpression: '0 2 * * *',
  batchSize: 20,
  rateLimitMs: 2000,
  priority: 'by_score',
  genreFilter: '',
  enabled: 0,
};

function formFromSchedule(schedule: CrawlerSchedule): FormState {
  let filters = schedule.genreFilter || '';
  try {
    const parsed = JSON.parse(filters);
    if (Array.isArray(parsed)) filters = parsed.join('，');
  } catch { /* 保留兼容的旧文本 */ }
  return {
    id: schedule.id,
    name: schedule.name,
    sourceSite: schedule.sourceSite,
    contentType: schedule.contentType,
    crawlMode: schedule.crawlMode || 'latest',
    cronExpression: schedule.cronExpression,
    batchSize: schedule.batchSize,
    rateLimitMs: schedule.rateLimitMs,
    priority: schedule.priority,
    genreFilter: filters,
    enabled: schedule.enabled,
  };
}

export function CrawlerConfigSection({ schedules, sources, loading, onRefresh }: Props) {
  const toast = useToast();
  const dialog = useDialog();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const startCreate = () => {
    setForm({ ...emptyForm, sourceSite: sources[0]?.code || 'pkmp4' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.warning('请输入配置名称');
      return;
    }
    setSaving(true);
    try {
      await crawlerApi.saveSchedule({
        ...form,
        name: form.name.trim(),
        enabled: form.crawlMode === 'full' ? 0 : form.enabled,
        genreFilter: form.genreFilter.trim(),
      });
      toast.success(form.id ? '配置已更新' : '配置已创建');
      setOpen(false);
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '保存配置失败'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: 'start' | 'stop') => {
    setActionId(id);
    try {
      const response = action === 'start' ? await crawlerApi.start(id) : await crawlerApi.stop(id);
      if (response.data?.code !== 200 || response.data?.data !== true) {
        throw new Error(response.data?.message || (action === 'start' ? '启动请求被拒绝' : '当前没有可取消的 Job'));
      }
      toast.success(action === 'start' ? '已创建手工 Job' : '已请求在安全边界取消');
      await onRefresh();
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

  const remove = async (schedule: CrawlerSchedule) => {
    const confirmed = await dialog.confirm({
      title: '删除任务配置',
      content: `确定删除“${schedule.name}”吗？历史 Job 日志会保留。`,
      confirmText: '删除配置',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      const response = await crawlerApi.deleteSchedule(schedule.id);
      if (response.data?.data !== true) throw new Error(response.data?.message || '存在活动 Job，不能删除');
      toast.success('配置已删除，历史 Job 已保留');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '删除配置失败'));
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

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="animate-spin" />加载配置</div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">尚无任务配置。自动调度保持关闭，创建后可手工启动。</div>
        ) : (
          <div className="divide-y divide-border">
            {schedules.map(schedule => {
              const active = schedule.status === 'running';
              return (
                <article key={schedule.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(13rem,1.3fr)_minmax(22rem,2fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-foreground">{schedule.name}</h3>
                      <StatusBadge status={schedule.latestResult} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">#{schedule.id} · {schedule.sourceSite} · {contentTypeLabel(schedule.contentType)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">默认模式</dt><dd className="mt-0.5 text-foreground">{schedule.crawlMode === 'full' ? '全量手工' : '最新增量'}</dd></div>
                    <div><dt className="text-muted-foreground">批次 / 限速</dt><dd className="mt-0.5 text-foreground">{schedule.batchSize} / {schedule.rateLimitMs}ms</dd></div>
                    <div><dt className="text-muted-foreground">上次运行</dt><dd className="mt-0.5 text-foreground">{formatCrawlerTime(schedule.lastRunTime)}</dd></div>
                    <div><dt className="text-muted-foreground">下次运行</dt><dd className="mt-0.5 text-foreground">{schedule.enabled === 1 ? formatCrawlerTime(schedule.nextRunTime) : '自动调度关闭'}</dd></div>
                  </dl>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => void toggle(schedule)} disabled={schedule.crawlMode === 'full'}>
                      {schedule.enabled === 1 ? '关闭自动' : '启用自动'}
                    </Button>
                    <Button variant="outline" size="icon" title={active ? '取消 Job' : '手工启动'} disabled={actionId === schedule.id} onClick={() => void runAction(schedule.id, active ? 'stop' : 'start')}>
                      {actionId === schedule.id ? <Loader2 className="animate-spin" /> : active ? <Square /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon" title="编辑" onClick={() => { setForm(formFromSchedule(schedule)); setOpen(true); }}><Pencil /></Button>
                    <Button variant="destructive" size="icon" title="删除" onClick={() => void remove(schedule)}><Trash2 /></Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? '编辑任务配置' : '新建任务配置'}
        description="全量模式只能手工触发；新配置默认不自动运行。"
        width="lg"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="animate-spin" />}{saving ? '保存中' : '保存配置'}</Button></>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="配置名称"><input className={inputClass} value={form.name} maxLength={100} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="来源"><Select value={form.sourceSite} onChange={value => setForm(current => ({ ...current, sourceSite: value }))} options={sources.map(source => ({ label: `${source.name} (${source.code})`, value: source.code }))} /></Field>
          <Field label="内容类型"><Select value={form.contentType} onChange={value => setForm(current => ({ ...current, contentType: value }))} options={CONTENT_TYPES} /></Field>
          <Field label="默认模式"><Select value={form.crawlMode} onChange={value => setForm(current => ({ ...current, crawlMode: value as 'latest' | 'full', enabled: value === 'full' ? 0 : current.enabled }))} options={[{ label: '最新增量', value: 'latest' }, { label: '全量手工', value: 'full' }]} /></Field>
          <Field label="Cron（Asia/Shanghai）"><input className={inputClass} value={form.cronExpression} disabled={form.crawlMode === 'full'} onChange={event => setForm(current => ({ ...current, cronExpression: event.target.value }))} /></Field>
          <Field label="优先策略"><Select value={form.priority} onChange={value => setForm(current => ({ ...current, priority: value }))} options={[{ label: '评分优先', value: 'by_score' }, { label: '热度优先', value: 'by_hot' }]} /></Field>
          <Field label="单批数量"><input className={inputClass} type="number" min={1} max={500} value={form.batchSize} onChange={event => setForm(current => ({ ...current, batchSize: Number(event.target.value) }))} /></Field>
          <Field label="请求间隔（毫秒）"><input className={inputClass} type="number" min={500} max={60000} value={form.rateLimitMs} onChange={event => setForm(current => ({ ...current, rateLimitMs: Number(event.target.value) }))} /></Field>
          <div className="md:col-span-2"><Field label="题材过滤（逗号分隔，可留空）"><input className={inputClass} value={form.genreFilter} onChange={event => setForm(current => ({ ...current, genreFilter: event.target.value }))} /></Field></div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 md:col-span-2">
            <input type="checkbox" className="mt-1" checked={form.enabled === 1} disabled={form.crawlMode === 'full'} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked ? 1 : 0 }))} />
            <span><span className="block text-sm font-medium text-foreground">启用自动增量</span><span className="block text-xs text-muted-foreground">仅保存配置不会启动 Job；开启后由 Cron 在到期时创建唯一 Job。</span></span>
          </label>
        </div>
      </Modal>
    </section>
  );
}
