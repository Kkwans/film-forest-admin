'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Clock3, ExternalLink, Loader2, SearchCheck, TimerReset } from 'lucide-react';
import {
  crawlerApi,
  tagApi,
  type CrawlerSchedule,
  type CrawlerScheduleMode,
  type CrawlerSchedulePreview,
  type CrawlerSourceCapabilities,
  type CrawlerSourceDescriptor,
  type CrawlerSourceQueryPreview,
  type CrawlerSourceSort,
  type CrawlerEndPolicy,
  type TagItem,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { MultiSelect, Select } from '@/components/ui/select';
import { InfoHint } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { getAccordionPanelClass } from '@/components/ui/interaction-contracts';
import { CONTENT_TYPES, Field, formatCrawlerTime, inputClass, SOURCE_SORT_LABELS as SHARED_SOURCE_SORT_LABELS } from './crawler-ui';

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
  sourceSort: CrawlerSourceSort;
  sourceFilters: Record<string, string>;
  endPolicy: CrawlerEndPolicy;
  newItemLimit: number;
  backfillItemLimit: number;
  manualRunLimit: number;
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
    sourceSort: 'TIME',
    sourceFilters: {},
    endPolicy: 'HOLD_COMPLETED',
    newItemLimit: 10,
    backfillItemLimit: 10,
    manualRunLimit: 100,
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
    sourceSort: schedule.sourceSort || 'TIME',
    sourceFilters: schedule.sourceFilters || {},
    endPolicy: schedule.endPolicy || 'HOLD_COMPLETED',
    newItemLimit: schedule.newItemLimit || schedule.batchSize || 10,
    backfillItemLimit: schedule.backfillItemLimit || schedule.batchSize || 10,
    manualRunLimit: schedule.manualRunLimit || 100,
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

const SOURCE_SORT_LABELS: Record<CrawlerSourceSort, string> = SHARED_SOURCE_SORT_LABELS;

const SOURCE_SORT_OPTIONS: CrawlerSourceSort[] = ['TIME', 'RATING', 'POPULARITY'];

const SOURCE_SORT_DESCRIPTIONS: Record<CrawlerSourceSort, string> = {
  TIME: '优先发现来源站最近更新的内容',
  RATING: '按来源站评分从高到低回填',
  POPULARITY: '按来源站热度从高到低回填',
};

const SOURCE_FILTER_LABELS: Record<string, string> = {
  year: '年份',
  region: '地区',
  language: '语言',
  genre: '来源题材',
};

function capabilityFor(source: CrawlerSourceDescriptor | null, contentType: string): CrawlerSourceCapabilities | null {
  return source?.capabilities?.[contentType] ?? null;
}

function previewStatusLabel(status?: CrawlerSourceQueryPreview['status'] | null) {
  switch (status) {
    case 'VALIDATED': return '已验证';
    case 'SOURCE_UNAVAILABLE': return '来源不可用';
    case 'UNSUPPORTED': return '不支持';
    case 'NEEDS_REVIEW': return '待复核';
    default: return '尚未验证';
  }
}

function previewStatusClass(status?: CrawlerSourceQueryPreview['status'] | null) {
  switch (status) {
    case 'VALIDATED': return 'border-primary/25 bg-primary/10 text-primary';
    case 'UNSUPPORTED': return 'border-destructive/25 bg-destructive/10 text-destructive';
    case 'SOURCE_UNAVAILABLE':
    case 'NEEDS_REVIEW': return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    default: return 'border-border bg-muted/55 text-muted-foreground';
  }
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
  const [cronApplying, setCronApplying] = useState(false);
  const [sourcePreview, setSourcePreview] = useState<CrawlerSourceQueryPreview | null>(null);
  const [sourcePreviewError, setSourcePreviewError] = useState('');
  const [sourcePreviewing, setSourcePreviewing] = useState(false);

  const selectedSource = useMemo(
    () => sources.find(item => String(item.id) === form.sourceId) ?? null,
    [form.sourceId, sources],
  );
  const selectedCapabilities = useMemo(
    () => capabilityFor(selectedSource, form.contentType),
    [form.contentType, selectedSource],
  );
  const supportedSorts = useMemo(
    () => selectedCapabilities?.supportedSorts ?? [],
    [selectedCapabilities],
  );
  const supportedFilters = useMemo(
    () => selectedCapabilities?.supportedFilters ?? [],
    [selectedCapabilities],
  );
  const effectiveSourceSort = SOURCE_SORT_OPTIONS.includes(form.sourceSort)
    ? form.sourceSort : 'TIME';
  const sourceSortOptions = useMemo(
    () => SOURCE_SORT_OPTIONS.map(sort => ({
      label: SOURCE_SORT_LABELS[sort],
      value: sort,
      disabled: Boolean(selectedCapabilities?.verified && !supportedSorts.includes(sort)),
    })),
    [selectedCapabilities?.verified, supportedSorts],
  );
  const effectiveSourceFilters = useMemo(
    () => Object.fromEntries(
      Object.entries(form.sourceFilters).filter(([key]) => supportedFilters.includes(key)),
    ),
    [form.sourceFilters, supportedFilters],
  );
  const sourceNeedsReview = Boolean(!selectedCapabilities || (
    !selectedCapabilities.verified
      || ['CHALLENGE', 'UNAVAILABLE'].includes(selectedCapabilities.availability?.toUpperCase())
  ));
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
    setSourcePreview(null);
    setSourcePreviewError('');
    setForm(current => ({
      ...current,
      sourceId,
      contentType: binding?.contentType ?? current.contentType,
      adapterCode: binding?.code ?? '',
      sourceSort: 'TIME',
      sourceFilters: {},
      genreTagIds: binding?.contentType === current.contentType ? current.genreTagIds : [],
    }));
  };

  const changeContentType = (contentType: string) => {
    const binding = selectedSource?.adapters.find(item => item.contentType === contentType);
    setGenres([]);
    setGenresLoading(true);
    setSourcePreview(null);
    setSourcePreviewError('');
    setForm(current => ({
      ...current,
      contentType,
      adapterCode: binding?.code ?? '',
      sourceSort: 'TIME',
      sourceFilters: {},
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
    setCronApplying(true);
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
      setCronApplying(false);
    }
  };

  const previewSource = async () => {
    if (!form.adapterCode || !form.contentType) return null;
    setSourcePreviewing(true);
    setSourcePreviewError('');
    try {
      const response = await crawlerApi.previewSourceQuery({
        sourceCode: form.adapterCode,
        contentType: form.contentType,
        sort: effectiveSourceSort,
        sourceFilters: effectiveSourceFilters,
        page: 1,
      });
      if (response.data?.code !== 200 || !response.data.data) {
        throw new Error(response.data?.message || '来源查询预览失败');
      }
      const result = response.data.data;
      setSourcePreview(result);
      if (result.status === 'UNSUPPORTED') {
        setSourcePreviewError(result.message);
      }
      return result;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, '来源查询预览失败');
      setSourcePreview(null);
      setSourcePreviewError(message);
      throw new Error(message);
    } finally {
      setSourcePreviewing(false);
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
      const sourceResult = await previewSource();
      if (sourceResult?.status === 'UNSUPPORTED') {
        throw new Error(sourceResult.message || '来源不支持当前查询');
      }
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
        sourceSort: effectiveSourceSort,
        sourceFilters: effectiveSourceFilters,
        endPolicy: form.endPolicy,
        newItemLimit: form.newItemLimit,
        backfillItemLimit: form.backfillItemLimit,
        manualRunLimit: form.manualRunLimit,
        genreFilter: null,
        genreTagIds: form.genreTagIds.map(Number),
        enabled: form.crawlMode === 'latest' && normalized.cronExpression && sourceResult?.status === 'VALIDATED'
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
  const autoScheduleDisabledReason = form.crawlMode === 'full'
    ? '全量手工任务不支持自动调度。'
    : !preview?.cronExpression
      ? mode === 'MANUAL'
        ? '当前选择“仅手工”，不会自动运行；切换到定时规则后才可启用。'
        : '定时规则尚未验证，验证通过后才可启用。'
      : sourceNeedsReview
        ? '来源尚未验证或当前不可用，不能启用自动调度。'
        : sourcePreview?.status !== 'VALIDATED'
          ? '请先点击“验证并查看样本”，确认来源查询可用后再启用。'
          : '';
  const autoScheduleDisabled = Boolean(autoScheduleDisabledReason);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? '编辑爬虫计划' : '新建爬虫计划'}
      description="选择来源、标准题材和易读的定时规则；保存不会立即启动任务。"
      width="xl"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={() => void save()} disabled={saving || genresLoading}>{saving && <Loader2 className="animate-spin" />}{saving ? '保存中' : '保存计划'}</Button></>}
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">任务范围</h3></div><p className="text-xs text-muted-foreground"><span className="text-destructive">*</span> 为必填项，其余为可选</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="配置名称" required><input className={inputClass} required value={form.name} maxLength={100} placeholder="例如：每日电影增量" onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="资源来源" required><Select label="资源来源" value={form.sourceId} onChange={changeSource} options={sources.map(source => ({ label: `${source.name} · ${source.code}`, value: String(source.id) }))} /></Field>
            <Field label="内容类型" required><Select label="内容类型" value={form.contentType} onChange={changeContentType} options={CONTENT_TYPES.map(option => ({ ...option, disabled: !selectedSource?.adapters.some(item => item.contentType === option.value) }))} /></Field>
            <Field label="来源适配器"><div className="flex h-9 items-center rounded-lg border border-border bg-muted/35 px-3 text-sm text-foreground">{form.adapterCode || '当前组合不可用'}</div></Field>
            <Field label="抓取模式" required help="最新增量按游标持续同步；全量扫描只允许手工启动，并使用独立的本次执行上限。"><Select label="抓取模式" value={form.crawlMode} onChange={value => setForm(current => ({ ...current, crawlMode: value as 'latest' | 'full', scheduleMode: value === 'full' ? 'MANUAL' : current.scheduleMode, enabled: value === 'full' ? 0 : current.enabled }))} options={[{ label: '最新增量（推荐）', value: 'latest' }, { label: '全量手工', value: 'full' }]} /></Field>
            <Field label="来源排序" required help={SOURCE_SORT_DESCRIPTIONS[effectiveSourceSort]}>
              <Select
                label="来源排序"
                value={effectiveSourceSort}
                onChange={value => {
                  setSourcePreview(null);
                  setSourcePreviewError('');
                  setForm(current => ({ ...current, sourceSort: value as CrawlerSourceSort }));
                }}
                options={sourceSortOptions}
              />
            </Field>
          </div>
          {supportedFilters.length > 0 && (
            <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
              <div className="flex items-center gap-1 md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">来源原生筛选</p>
                <InfoHint label="来源原生筛选" content="只显示适配器已经声明且可以预览验证的字段；填写后会进入来源查询地址。" />
              </div>
              {supportedFilters.map(key => (
                <Field key={key} label={SOURCE_FILTER_LABELS[key] || key}>
                  <input
                    className={inputClass}
                    value={effectiveSourceFilters[key] || ''}
                    placeholder={`输入${SOURCE_FILTER_LABELS[key] || key}`}
                    onChange={event => {
                      setSourcePreview(null);
                      setSourcePreviewError('');
                      setForm(current => ({
                        ...current,
                        sourceFilters: { ...current.sourceFilters, [key]: event.target.value },
                      }));
                    }}
                  />
                </Field>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-border bg-muted/15 p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-foreground">标准题材筛选 <InfoHint label="标准题材筛选" content="这是入库后的本地过滤条件，不会拼接到来源网址，也不会改变来源分页游标。" /></p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">已选 {form.genreTagIds.length} 项</span>
            </div>
            <MultiSelect
              label="标准题材筛选（入库后过滤，可多选）"
              value={form.genreTagIds}
              onChange={genreTagIds => setForm(current => ({ ...current, genreTagIds }))}
              options={genres.map(tag => ({ label: tag.name, value: String(tag.id) }))}
              searchable
              disabled={genresLoading}
              placeholder={genresLoading ? '正在加载标准题材' : genres.length ? '点击选择题材；已选项显示在框内' : '当前类型暂无标准题材'}
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/[0.03]" aria-live="polite" aria-busy={sourcePreviewing}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${sourceNeedsReview ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300' : 'bg-primary/10 text-primary'}`}>
                  {sourceNeedsReview ? <AlertTriangle className="size-4" /> : <SearchCheck className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">来源查询预览</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${previewStatusClass(sourcePreview?.status)}`}>
                      {previewStatusLabel(sourcePreview?.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    预览只读取第 1 页少量列表，不创建 Job、不写入内容，也不会推进续爬游标。
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void previewSource()} disabled={sourcePreviewing || !form.adapterCode}>
                {sourcePreviewing ? <Loader2 className="animate-spin" /> : <TimerReset />}验证并查看样本
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">排序</p>
                <p className="mt-1 text-sm font-medium text-foreground">{SOURCE_SORT_LABELS[effectiveSourceSort]}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">来源能力</p>
                <p className="mt-1 text-sm font-medium text-foreground">{selectedCapabilities?.verified ? '已验证' : '待验证'}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground" title={supportedSorts.map(sort => SOURCE_SORT_LABELS[sort] ?? sort).join('、')}>
                  已声明：{supportedSorts.length ? supportedSorts.map(sort => SOURCE_SORT_LABELS[sort] ?? sort).join('、') : '暂无'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">样本</p>
                <p className="mt-1 text-sm font-medium text-foreground">{sourcePreview ? `${sourcePreview.sampleCount} 条列表项` : '点击验证后显示'}</p>
              </div>
            </div>

            <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${previewStatusClass(sourcePreview?.status)}`}>
              <p>{sourcePreviewError || sourcePreview?.message || selectedCapabilities?.message || '选择来源排序或筛选后，点击“验证并查看样本”，结果会显示在这里。'}</p>
              {sourcePreview?.normalizedUri && (
                <p className="mt-1 flex items-start gap-1 break-all font-mono text-[11px] opacity-80">
                  <ExternalLink className="mt-0.5 size-3 shrink-0" />{sourcePreview.normalizedUri}
                </p>
              )}
              {sourcePreview && sourcePreview.sampleExternalIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sourcePreview.sampleExternalIds.map(id => <span key={id} className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[11px]">{id}</span>)}
                </div>
              )}
            </div>
            {sourceNeedsReview && <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">当前来源未验证或不可用：配置可以保存为“待复核”，但不能启用或启动。</p>}
          </section>
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

              <div>
                {mode === 'INTERVAL' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"><Field label="间隔单位" required><Select label="间隔单位" value={String(form.scheduleConfig.unit || 'hours')} onChange={unit => updateConfig({ unit })} options={[{ label: '分钟', value: 'minutes' }, { label: '小时', value: 'hours' }]} /></Field><Field label="每隔多少" required><input className={inputClass} required type="number" min={1} max={form.scheduleConfig.unit === 'minutes' ? 59 : 23} value={numberConfig(form.scheduleConfig, 'interval', 1)} onChange={event => updateConfig({ interval: Number(event.target.value) })} /></Field></div>}
                {mode === 'DAILY' && <div className="rounded-xl border border-border bg-muted/20 p-4"><Field label="每天执行时间" required><input className={inputClass} required type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
                {mode === 'WEEKLY' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_12rem]"><Field label="执行星期" required><MultiSelect label="执行星期" value={selectedDays} onChange={days => updateConfig({ days })} options={WEEKDAYS} /></Field><Field label="执行时间" required><input className={inputClass} required type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
                {mode === 'MONTHLY' && <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"><Field label="每月日期" required><input className={inputClass} required type="number" min={1} max={31} value={numberConfig(form.scheduleConfig, 'day', 1)} onChange={event => updateConfig({ day: Number(event.target.value) })} /></Field><Field label="执行时间" required><input className={inputClass} required type="time" value={timeValue(form.scheduleConfig)} onChange={event => updateConfig(parseTime(event.target.value))} /></Field></div>}
                {mode === 'MANUAL' && <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">计划只保留配置，不会自动运行；需要时点击列表中的“手工启动”。</div>}
              </div>
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
              <div className="min-h-0 min-w-0 overflow-hidden border-t border-border">
                <div className="grid min-w-0 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input className={inputClass} value={cronDraft} placeholder="例如：0 0 2 * * *" onChange={event => setCronDraft(event.target.value)} />
                  <Button variant="outline" onClick={() => void applyCron()} disabled={cronApplying}>
                    {cronApplying ? <Loader2 className="animate-spin" /> : <TimerReset />}识别并应用
                  </Button>
                </div>
              </div>
            </div>
          </div>}

          <div aria-live="polite" aria-busy={previewing} className={`rounded-xl border p-4 ${previewError ? 'border-destructive/35 bg-destructive/10' : 'border-primary/25 bg-primary/5'}`}>
            <div>
              <div className={previewing ? 'opacity-65' : undefined}>
                {previewError ? (
                  <p className="text-sm text-destructive">{previewError}</p>
                ) : preview ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{preview.description}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{preview.cronExpression || '仅手工启动'} · {preview.timezone}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{modeLabel(preview.scheduleMode)}</span>
                    </div>
                    {preview.nextRuns.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {preview.nextRuns.map((run, index) => (
                          <div key={run} className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">第 {index + 1} 次</p>
                            <p className="mt-1 text-xs font-medium text-foreground">{formatCrawlerTime(run)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">不会自动运行，仅在任务列表点击“手工启动”时执行。</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">请选择定时规则，系统会在这里显示实际执行说明。</p>
                )}
              </div>
              {previewing && <p className="mt-3 text-[11px] text-muted-foreground">正在验证规则…</p>}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2"><Clock3 className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">执行边界</h3></div>
          <div className="grid gap-4 md:grid-cols-2">
            {form.crawlMode === 'full' ? (
              <Field label="人工全量执行上限" required help="全量扫描每次手工启动允许处理的最大条目数；不参与定时任务。"><input className={inputClass} required type="number" min={1} max={5000} value={form.manualRunLimit} onChange={event => setForm(current => ({ ...current, manualRunLimit: Number(event.target.value) }))} /></Field>
            ) : (
              <>
                <Field label="新内容上限" required help="每次定时运行优先处理最新内容的数量；它不是数据库新增数量。"><input className={inputClass} required type="number" min={1} max={500} value={form.newItemLimit} onChange={event => setForm(current => ({ ...current, newItemLimit: Number(event.target.value) }))} /></Field>
                <Field label="历史回填上限" required help="每次定时运行在最新内容之外继续处理历史游标的数量，避免新内容持续出现时历史永远得不到处理。"><input className={inputClass} required type="number" min={1} max={500} value={form.backfillItemLimit} onChange={event => setForm(current => ({ ...current, backfillItemLimit: Number(event.target.value) }))} /></Field>
              </>
            )}
            <Field label="每次请求间隔（毫秒）" required help="两次来源请求之间的最小等待时间。公共来源默认不低于 2000 毫秒，用于遵守限速并减少触发访问控制。"><input className={inputClass} required type="number" min={2000} max={60000} value={form.rateLimitMs} onChange={event => setForm(current => ({ ...current, rateLimitMs: Number(event.target.value) }))} /></Field>
            {form.crawlMode !== 'full' && <Field label="本轮抓完后" required help="到达来源末页时的处理方式。推荐保持已完成，只有人工明确选择重新开始周期时才回到第 1 页。"><Select label="本轮抓完后" value={form.endPolicy} onChange={value => setForm(current => ({ ...current, endPolicy: value as CrawlerEndPolicy }))} options={[{ label: '保持已完成，不重复抓取（推荐）', value: 'HOLD_COMPLETED' }, { label: '重新开始一个周期', value: 'RESTART_CYCLE' }]} /></Field>}
          </div>
          <label className={`rounded-xl border border-border bg-card p-4 ${autoScheduleDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <div className="flex items-start gap-3">
              <input id="crawler-enable-schedule" type="checkbox" className="mt-1 size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50" checked={form.enabled === 1} disabled={autoScheduleDisabled} aria-describedby="crawler-enable-schedule-help" onChange={event => setForm(current => ({ ...current, enabled: event.target.checked ? 1 : 0 }))} />
              <span className="flex items-center gap-1"><span className="text-sm font-medium text-foreground">保存后启用自动调度</span><InfoHint label="保存后启用自动调度" content="只有选择自动定时规则、规则验证通过且来源查询已验证可用时才能启用。仅手工和全量任务不会自动运行。" /></span>
            </div>
            <p id="crawler-enable-schedule-help" className={`mt-2 pl-7 text-xs leading-5 ${autoScheduleDisabled ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
              {autoScheduleDisabledReason || '启用后，保存计划时会同时开启自动调度。'}
            </p>
          </label>
        </section>
      </div>
    </Modal>
  );
}
