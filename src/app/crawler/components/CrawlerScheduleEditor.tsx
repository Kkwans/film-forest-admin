'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Loader2, TimerReset } from 'lucide-react';
import {
  crawlerApi,
  tagApi,
  type CrawlerSchedule,
  type CrawlerScheduleMode,
  type CrawlerSchedulePreview,
  type CrawlerSourceDescriptor,
  type TagItem,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { MultiSelect, Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { getAccordionPanelClass } from '@/components/ui/interaction-contracts';
import { CONTENT_TYPES, Field, formatCrawlerTime, inputClass } from './crawler-ui';

type FormState = {
  id?: number;
  name: string;
  sourceId: string;
  adapterCode: string;
  contentType: string;
  crawlMode: 'latest' | 'full';
  scheduleMode: CrawlerScheduleMode;
  scheduleConfig: Record<string, unknown>;
  cronExpression: string;
  timezone: string;
  batchSize: number;
  rateLimitMs: number;
  priority: string;
  genreTagIds: string[];
  enabled: number;
};

interface Props {
  open: boolean;
  schedule: CrawlerSchedule | null;
  sources: CrawlerSourceDescriptor[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const WEEKDAYS = [
  { label: '周一', value: 'MON' }, { label: '周二', value: 'TUE' },
  { label: '周三', value: 'WED' }, { label: '周四', value: 'THU' },
  { label: '周五', value: 'FRI' }, { label: '周六', value: 'SAT' },
  { label: '周日', value: 'SUN' },
];

const SCHEDULE_MODES: Array<{
  mode: Exclude<CrawlerScheduleMode, 'CUSTOM_CRON'>;
  label: string;
  description: string;
}> = [
  { mode: 'MANUAL', label: '仅手工', description: '不自动执行' },
  { mode: 'INTERVAL', label: '固定间隔', description: '每隔 N 分钟或小时' },
  { mode: 'DAILY', label: '每天', description: '每天固定时间' },
  { mode: 'WEEKLY', label: '每周', description: '选择星期与时间' },
  { mode: 'MONTHLY', label: '每月', description: '选择日期与时间' },
];

function defaultForm(sources: CrawlerSourceDescriptor[]): FormState {
  const source = sources[0];
  const binding = source?.adapters.find(item => item.contentType === 'movie')
    ?? source?.adapters[0];
  return {
    name: '',
    sourceId: source ? String(source.id) : '',
    adapterCode: binding?.code ?? '',
    contentType: binding?.contentType ?? 'movie',
    crawlMode: 'latest',
    scheduleMode: 'MANUAL',
    scheduleConfig: {},
    cronExpression: '',
    timezone: 'Asia/Shanghai',
    batchSize: 20,
    rateLimitMs: 2000,
    priority: 'by_score',
    genreTagIds: [],
    enabled: 0,
  };
}

function fromSchedule(schedule: CrawlerSchedule, sources: CrawlerSourceDescriptor[]): FormState {
  const fallback = defaultForm(sources);
  return {
    ...fallback,
    id: schedule.id,
    name: schedule.name,
    sourceId: String(schedule.sourceId),
    adapterCode: schedule.adapterCode,
    contentType: schedule.contentType,
    crawlMode: schedule.crawlMode || 'latest',
    scheduleMode: schedule.scheduleMode || 'CUSTOM_CRON',
    scheduleConfig: schedule.scheduleConfig || {},
    cronExpression: schedule.cronExpression || '',
    timezone: schedule.timezone || 'Asia/Shanghai',
    batchSize: schedule.batchSize,
    rateLimitMs: schedule.rateLimitMs,
    priority: schedule.priority,
    genreTagIds: (schedule.genreTagIds || []).map(String),
    enabled: schedule.enabled,
  };
}

function numberConfig(config: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(config[key]);
  return Number.isFinite(value) ? value : fallback;
}

function timeValue(config: Record<string, unknown>) {
  const hour = numberConfig(config, 'hour', 2);
  const minute = numberConfig(config, 'minute', 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function modeLabel(mode: CrawlerScheduleMode) {
  if (mode === 'CUSTOM_CRON') return '高级自定义 Cron';
  return SCHEDULE_MODES.find(item => item.mode === mode)?.label ?? mode;
}

export function CrawlerScheduleEditor({ open, schedule, sources, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => schedule
    ? fromSchedule(schedule, sources)
    : defaultForm(sources));
  const [genres, setGenres] = useState<TagItem[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [preview, setPreview] = useState<CrawlerSchedulePreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    schedule?.scheduleMode === 'CUSTOM_CRON',
  );
  const [cronDraft, setCronDraft] = useState(schedule?.cronExpression || '');
  const [saving, setSaving] = useState(false);

  const selectedSource = useMemo(
    () => sources.find(item => String(item.id) === form.sourceId) ?? null,
    [form.sourceId, sources],
  );
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    tagApi.listStandardGenres(form.contentType)
      .then(response => {
        if (cancelled) return;
        if (response.data?.code !== 200) throw new Error(response.data?.message || '标准题材加载失败');
        setGenres(Array.isArray(response.data.data) ? response.data.data : []);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGenres([]);
          setPreviewError(extractErrorMessage(error, '标准题材加载失败'));
        }
      })
      .finally(() => { if (!cancelled) setGenresLoading(false); });
    return () => { cancelled = true; };
  }, [form.contentType, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      try {
        const mode = form.crawlMode === 'full' ? 'MANUAL' : form.scheduleMode;
        const response = await crawlerApi.previewSchedule({
          scheduleMode: mode,
          scheduleConfig: mode === 'CUSTOM_CRON'
            ? { cronExpression: cronDraft }
            : form.scheduleConfig,
          cronExpression: mode === 'CUSTOM_CRON' ? cronDraft : undefined,
          timezone: form.timezone,
        });
        if (cancelled) return;
        if (response.data?.code !== 200) throw new Error(response.data?.message || '定时规则无效');
        const normalized = response.data.data as CrawlerSchedulePreview;
        setPreview(normalized);
        setPreviewError('');
        setForm(current => {
          if (current.scheduleMode !== form.scheduleMode || current.crawlMode !== form.crawlMode) {
            return current;
          }
          const nextConfig = normalized.scheduleConfig || {};
          const sameConfig = JSON.stringify(current.scheduleConfig) === JSON.stringify(nextConfig);
          const sameCron = (current.cronExpression || '') === (normalized.cronExpression || '');
          if (sameConfig && sameCron && current.timezone === normalized.timezone) return current;
          return {
            ...current,
            scheduleConfig: nextConfig,
            cronExpression: normalized.cronExpression || '',
            timezone: normalized.timezone,
          };
        });
        if (mode !== 'CUSTOM_CRON') setCronDraft(normalized.cronExpression || '');
      } catch (error: unknown) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(extractErrorMessage(error, '定时规则无效'));
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cronDraft, form.crawlMode, form.scheduleConfig, form.scheduleMode,
    form.timezone, open]);

  const updateConfig = (patch: Record<string, unknown>) => {
    setForm(current => ({ ...current, scheduleConfig: { ...current.scheduleConfig, ...patch } }));
  };

  const changeSource = (sourceId: string) => {
    const source = sources.find(item => String(item.id) === sourceId);
    const binding = source?.adapters.find(item => item.contentType === form.contentType)
      ?? source?.adapters[0];
    if (binding?.contentType !== form.contentType) {
      setGenres([]);
      setGenresLoading(true);
    }
    setForm(current => ({
      ...current,
      sourceId,
      contentType: binding?.contentType ?? current.contentType,
      adapterCode: binding?.code ?? '',
      genreTagIds: binding?.contentType === current.contentType ? current.genreTagIds : [],
    }));
  };

  const changeContentType = (contentType: string) => {
    const binding = selectedSource?.adapters.find(item => item.contentType === contentType);
    setGenres([]);
    setGenresLoading(true);
    setForm(current => ({
      ...current,
      contentType,
      adapterCode: binding?.code ?? '',
      genreTagIds: [],
    }));
  };

  const changeMode = (scheduleMode: Exclude<CrawlerScheduleMode, 'CUSTOM_CRON'>) => {
    const defaults: Record<CrawlerScheduleMode, Record<string, unknown>> = {
      MANUAL: {},
      INTERVAL: { unit: 'hours', interval: 1 },
      DAILY: { hour: 2, minute: 0 },
      WEEKLY: { days: ['MON'], hour: 2, minute: 0 },
      MONTHLY: { day: 1, hour: 2, minute: 0 },
      CUSTOM_CRON: {},
    };
    setForm(current => ({
      ...current,
      scheduleMode,
      scheduleConfig: current.scheduleMode === scheduleMode
        ? current.scheduleConfig
        : defaults[scheduleMode],
      enabled: scheduleMode === 'MANUAL' ? 0 : current.enabled,
    }));
  };

  const applyCron = async () => {
    setPreviewing(true);
    try {
      const response = await crawlerApi.previewSchedule({
        cronExpression: cronDraft,
        timezone: form.timezone,
      });
      if (response.data?.code !== 200) throw new Error(response.data?.message || 'Cron 无法识别');
      const normalized = response.data.data as CrawlerSchedulePreview;
      setPreview(normalized);
      setPreviewError('');
      setForm(current => ({
        ...current,
        scheduleMode: normalized.scheduleMode,
        scheduleConfig: normalized.scheduleConfig || {},
        cronExpression: normalized.cronExpression || '',
        timezone: normalized.timezone,
        enabled: normalized.cronExpression ? current.enabled : 0,
      }));
      setCronDraft(normalized.cronExpression || '');
      toast.success(normalized.scheduleMode === 'CUSTOM_CRON'
        ? 'Cron 已保留为高级自定义规则'
        : `Cron 已识别为“${modeLabel(normalized.scheduleMode)}”`);
    } catch (error: unknown) {
      setPreviewError(extractErrorMessage(error, 'Cron 无法识别'));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.warning('请输入配置名称');
      return;
    }
    if (!form.sourceId || !form.adapterCode) {
      toast.warning('当前来源不支持所选内容类型');
      return;
    }
    setSaving(true);
    try {
      const normalizedResponse = await crawlerApi.previewSchedule({
        scheduleMode: form.crawlMode === 'full' ? 'MANUAL' : form.scheduleMode,
        scheduleConfig: form.scheduleMode === 'CUSTOM_CRON'
          ? { cronExpression: cronDraft }
          : form.scheduleConfig,
        cronExpression: form.scheduleMode === 'CUSTOM_CRON' ? cronDraft : undefined,
        timezone: form.timezone,
      });
      if (normalizedResponse.data?.code !== 200) {
        throw new Error(normalizedResponse.data?.message || '定时规则无效');
      }
      const normalized = normalizedResponse.data.data as CrawlerSchedulePreview;
      const response = await crawlerApi.saveSchedule({
        id: form.id,
        name: form.name.trim(),
        sourceId: Number(form.sourceId),
        sourceSite: form.adapterCode,
        adapterCode: form.adapterCode,
        contentType: form.contentType,
        crawlMode: form.crawlMode,
        scheduleMode: normalized.scheduleMode,
        scheduleConfig: normalized.scheduleConfig,
        cronExpression: normalized.cronExpression,
        timezone: normalized.timezone,
        batchSize: form.batchSize,
        rateLimitMs: form.rateLimitMs,
        priority: form.priority,
        genreFilter: null,
        genreTagIds: form.genreTagIds.map(Number),
        enabled: form.crawlMode === 'latest' && normalized.cronExpression
          ? form.enabled
          : 0,
      });
      if (response.data?.code !== 200 || response.data?.data !== true) {
        throw new Error(response.data?.message || '保存配置失败');
      }
      toast.success(form.id ? '配置已更新' : '配置已创建');
      onClose();
      await onSaved();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '保存配置失败'));
    } finally {
      setSaving(false);
    }
  };

  const mode = form.crawlMode === 'full' ? 'MANUAL' : form.scheduleMode;
  const selectedDays = Array.isArray(form.scheduleConfig.days)
    ? form.scheduleConfig.days.map(String)
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? '编辑爬虫计划' : '新建爬虫计划'}
      description="选择来源、标准题材和易读的定时规则；保存不会立即启动任务。"
      width="xl"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={() => void save()} disabled={saving || previewing || genresLoading}>{saving && <Loader2 className="animate-spin" />}{saving ? '保存中' : '保存计划'}</Button></>}
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2"><CheckCircle2 className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">任务范围</h3></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="配置名称"><input className={inputClass} value={form.name} maxLength={100} placeholder="例如：每日电影增量" onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="资源来源"><Select value={form.sourceId} onChange={changeSource} options={sources.map(source => ({ label: `${source.name} · ${source.code}`, value: String(source.id) }))} /></Field>
            <Field label="内容类型"><Select value={form.contentType} onChange={changeContentType} options={CONTENT_TYPES.map(option => ({ ...option, disabled: !selectedSource?.adapters.some(item => item.contentType === option.value) }))} /></Field>
            <Field label="来源适配器"><div className="flex h-9 items-center rounded-lg border border-border bg-muted/35 px-3 text-sm text-foreground">{form.adapterCode || '当前组合不可用'}</div></Field>
            <Field label="抓取模式"><Select value={form.crawlMode} onChange={value => setForm(current => ({ ...current, crawlMode: value as 'latest' | 'full', scheduleMode: value === 'full' ? 'MANUAL' : current.scheduleMode, enabled: value === 'full' ? 0 : current.enabled }))} options={[{ label: '最新增量（推荐）', value: 'latest' }, { label: '全量手工', value: 'full' }]} /></Field>
            <Field label="优先策略"><Select value={form.priority} onChange={value => setForm(current => ({ ...current, priority: value }))} options={[{ label: '评分优先', value: 'by_score' }, { label: '热度优先', value: 'by_hot' }]} /></Field>
          </div>
          <Field label="标准题材（可多选）"><MultiSelect value={form.genreTagIds} onChange={genreTagIds => setForm(current => ({ ...current, genreTagIds }))} options={genres.map(tag => ({ label: tag.name, value: String(tag.id) }))} searchable disabled={genresLoading} placeholder={genresLoading ? '正在加载标准题材' : genres.length ? '不限题材' : '当前类型暂无标准题材'} /></Field>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2"><CalendarDays className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">定时规则</h3></div>
          {form.crawlMode === 'full' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">全量任务只允许管理员手工启动，避免周期性重复扫描来源站。</div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {SCHEDULE_MODES.map(option => (
                  <button key={option.mode} type="button" onClick={() => changeMode(option.mode)} className={`rounded-xl border p-3 text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/35 ${mode === option.mode ? 'border-primary bg-primary/10 ring-2 ring-primary/15' : 'border-border bg-card hover:border-primary/45 hover:bg-muted/35'}`}>
                    <span className="block text-sm font-medium text-foreground">{option.label}</span><span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>

              {mode === 'INTERVAL' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"><Field label="间隔单位"><Select value={String(form.scheduleConfig.unit || 'hours')} onChange={unit => updateConfig({ unit })} options={[{ label: '分钟', value: 'minutes' }, { label: '小时', value: 'hours' }]} /></Field><Field label="每隔多少"><input className={inputClass} type="number" min={1} max={form.scheduleConfig.unit === 'minutes' ? 59 : 23} value={numberConfig(form.scheduleConfig, 'interval', 1)} onChange={event => updateConfig({ interval: Number(event.target.value) })} /></Field></div>}
              {mode === 'DAILY' && <div className="rounded-xl border border-border bg-muted/20 p-4"><Field label="每天执行时间"><input className={inputClass} type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
              {mode === 'WEEKLY' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-[1fr_12rem]"><Field label="执行星期"><MultiSelect value={selectedDays} onChange={days => updateConfig({ days })} options={WEEKDAYS} /></Field><Field label="执行时间"><input className={inputClass} type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
              {mode === 'MONTHLY' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"><Field label="每月日期"><input className={inputClass} type="number" min={1} max={31} value={numberConfig(form.scheduleConfig, 'day', 1)} onChange={event => updateConfig({ day: Number(event.target.value) })} /></Field><Field label="执行时间"><input className={inputClass} type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
              {mode === 'MANUAL' && <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">计划只保留配置，需要时点击列表中的“手工启动”。</div>}
            </>
          )}

          {form.crawlMode !== 'full' && <div className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setAdvancedOpen(value => !value)}
              aria-expanded={advancedOpen}
              aria-controls="crawler-advanced-cron-panel"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">高级 Cron</span>
                <span className="block text-xs text-muted-foreground">图形向导会自动生成；也可粘贴 Cron 反向识别</span>
              </span>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              id="crawler-advanced-cron-panel"
              role="region"
              aria-label="高级 Cron 设置"
              aria-hidden={!advancedOpen}
              inert={!advancedOpen}
              className={getAccordionPanelClass(advancedOpen)}
            >
              <div className="min-h-0 overflow-hidden border-t border-border">
                <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                  <input className={inputClass} value={cronDraft} placeholder="例如：0 0 2 * * *" onChange={event => setCronDraft(event.target.value)} />
                  <Button variant="outline" onClick={() => void applyCron()} disabled={previewing}>
                    {previewing ? <Loader2 className="animate-spin" /> : <TimerReset />}识别并应用
                  </Button>
                </div>
              </div>
            </div>
          </div>}

          <div aria-live="polite" className={`rounded-xl border p-4 ${previewError ? 'border-destructive/35 bg-destructive/10' : 'border-primary/25 bg-primary/5'}`}>
            {previewing ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在校验并计算未来执行时间</div> : previewError ? <p className="text-sm text-destructive">{previewError}</p> : preview ? <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-foreground">{preview.description}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{preview.cronExpression || '无自动 Cron'} · {preview.timezone}</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{modeLabel(preview.scheduleMode)}</span></div>{preview.nextRuns.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{preview.nextRuns.map((run, index) => <div key={run} className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">第 {index + 1} 次</p><p className="mt-1 text-xs font-medium text-foreground">{formatCrawlerTime(run)}</p></div>)}</div>}</div> : <p className="text-sm text-muted-foreground">请选择定时规则。</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2"><Clock3 className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">执行边界</h3></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="单次最多处理"><input className={inputClass} type="number" min={1} max={500} value={form.batchSize} onChange={event => setForm(current => ({ ...current, batchSize: Number(event.target.value) }))} /></Field>
            <Field label="每次请求间隔（毫秒）"><input className={inputClass} type="number" min={500} max={60000} value={form.rateLimitMs} onChange={event => setForm(current => ({ ...current, rateLimitMs: Number(event.target.value) }))} /></Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.enabled === 1} disabled={form.crawlMode === 'full' || !preview?.cronExpression} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked ? 1 : 0 }))} />
            <span><span className="block text-sm font-medium text-foreground">保存后启用自动调度</span><span className="mt-1 block text-xs text-muted-foreground">未勾选时只保存规则；手工启动仍可随时使用。全量与仅手工模式不会自动运行。</span></span>
          </label>
        </section>
      </div>
    </Modal>
  );
}
