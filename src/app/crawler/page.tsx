'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { crawlerApi, contentApi, type CrawlerTaskLog } from '@/lib/api';
import type { AxiosResponse } from 'axios';
import { extractErrorMessage } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Play, Square, ToggleLeft, ToggleRight, Clock, Activity, Database, Plus, Pencil, Trash2, RefreshCw, FileText, ChevronDown, ChevronUp, Loader2, RotateCcw, Filter, CheckCircle, XCircle, AlertTriangle, StopCircle, Search, X } from 'lucide-react';

// ========== 类型定义 ==========
// 注意：CrawlerTaskLog 从 @/lib/api 导入
// CrawlerScheduleItem 是 API 返回的简化类型（与 CrawlerSchedule 不同），保留本地定义
interface CrawlerScheduleItem { id: number; name: string; contentType: string; sourceSite: string; enabled: number; status: string; totalRuns: number; totalItems: number; cronExpression: string; batchSize: number; rateLimitMs: number; priority: string; genreFilter: string | null; lastRunTime: string | null; nextRunTime: string | null; }
interface SourceOption { id: number; name: string; url: string; type: string; enabled: number; }
// 爬虫状态 API 返回结构（直接返回 data，非 Result 包装）
interface CrawlerStatusData { total: number; running: number; idle: number; schedules: CrawlerScheduleItem[]; }
interface LogResult { code: number; data: CrawlerTaskLog[]; }
interface SourcesResult { code: number; data: SourceOption[]; }
interface GenresResult { code: number; data: string[]; }

type CronMode = 'interval' | 'daily' | 'weekly' | 'monthly';


function parseCronMode(expr: string): CronMode {
  if (!expr) return 'daily';
  const parts = expr.split(' ');
  if (parts.length !== 5) return 'daily';
  const [min, hour, dom, , dow] = parts;
  // 分钟间隔: */N * * * *
  if (min.includes('*/') && hour === '*') return 'interval';
  // 小时间隔: 0 */N * * *
  if (min === '0' && hour.includes('*/')) return 'interval';
  // 整点间隔: 0 * * * * (每小时), 0 */2 * * * (每2小时) 等 — 匹配 INTERVAL_OPTIONS 中的值
  if (dom === '*' && dow === '*') {
    const isIntervalOption = INTERVAL_OPTIONS.some(opt => opt.value === expr);
    if (isIntervalOption) return 'interval';
  }
  if (dow !== '*' && dom === '*') return 'weekly';
  if (dom !== '*' && dow === '*') return 'monthly';
  return 'daily';
}

function buildCron(mode: CronMode, interval: string, hour: string, minute: string, dom: string, dow: string[]): string {
  switch (mode) {
    case 'interval': return interval;
    case 'daily': return `${minute} ${hour} * * *`;
    case 'weekly': return `${minute} ${hour} * * ${dow.join(',') || '1'}`;
    case 'monthly': return `${minute} ${hour} ${dom || '1'} * *`;
  }
}

function describeCron(expr: string): string {
  if (!expr) return '未设置';
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hour, dom, , dow] = parts;

  if (min.startsWith('*/')) return `每${min.replace('*/', '')}分钟执行一次`;
  if (hour.startsWith('*/')) return `每${hour.replace('*/', '')}小时执行一次`;

  const h = hour.padStart(2, '0');
  const m = min.padStart(2, '0');
  if (dom === '*' && dow === '*') return `每天 ${h}:${m} 执行`;

  if (dom === '*' && dow !== '*') {
    const dayNames = dow.split(',').map(d => WEEKDAYS.find(w => w.value === d)?.label || d);
    return `每${dayNames.join('、')} ${h}:${m} 执行`;
  }

  if (dom !== '*' && dow === '*') return `每月${dom}号 ${h}:${m} 执行`;

  return expr;
}

function CronBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<CronMode>(() => parseCronMode(value));
  const [intervalValue, setIntervalValue] = useState(value || '*/30 * * * *');
  const [hour, setHour] = useState('2');
  const [minute, setMinute] = useState('0');
  const [dom, setDom] = useState('1');
  const [dow, setDow] = useState<string[]>(['1']);

  useEffect(() => {
    const m = parseCronMode(value);
    setMode(m);
    if (m === 'interval') setIntervalValue(value);
    else {
      const parts = value.split(' ');
      if (parts.length === 5) {
        setMinute(parts[0]);
        setHour(parts[1]);
        setDom(parts[2] === '*' ? '1' : parts[2]);
        if (parts[4] !== '*') setDow(parts[4].split(','));
      }
    }
  }, [value]);

  const update = (newMode: CronMode, newInterval?: string, newHour?: string, newMinute?: string, newDom?: string, newDow?: string[]) => {
    const result = buildCron(newMode, newInterval || intervalValue, newHour || hour, newMinute || minute, newDom || dom, newDow || dow);
    onChange(result);
  };

  const handleModeChange = (newMode: CronMode) => {
    setMode(newMode);
    // 从当前 cron 中提取时分，确保模式切换时不丢失时间设置
    const parts = (value || '').split(' ');
    const curMin = parts.length === 5 ? parts[0] : minute;
    const curHour = parts.length === 5 ? parts[1] : hour;
    if (newMode === 'interval') {
      update(newMode, intervalValue);
    } else if (newMode === 'daily') {
      setHour(curHour);
      setMinute(curMin);
      update(newMode, undefined, curHour, curMin);
    } else if (newMode === 'weekly') {
      setHour(curHour);
      setMinute(curMin);
      update(newMode, undefined, curHour, curMin);
    } else if (newMode === 'monthly') {
      setHour(curHour);
      setMinute(curMin);
      update(newMode, undefined, curHour, curMin);
    }
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ label: `${String(i).padStart(2, '0')}时`, value: String(i) }));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5).map(i => ({ label: `${String(i).padStart(2, '0')}分`, value: String(i) }));
  const domOptions = Array.from({ length: 28 }, (_, i) => ({ label: `${i + 1}号`, value: String(i + 1) }));

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 md:p-4 space-y-3 md:space-y-4">
      {/* 模式选择 */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'interval' as CronMode, label: '定时间隔' },
          { key: 'daily' as CronMode, label: '每天定时' },
          { key: 'weekly' as CronMode, label: '每周定时' },
          { key: 'monthly' as CronMode, label: '每月定时' },
        ]).map(opt => (
          <button key={opt.key} type="button" onClick={() => handleModeChange(opt.key)}
            className={`px-3 py-1.5 text-xs md:text-sm rounded-lg transition-colors ${mode === opt.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'interval' && (
        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">选择间隔</label>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {INTERVAL_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => { setIntervalValue(opt.value); onChange(opt.value); }}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${intervalValue === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {/* 自定义间隔输入 */}
          <div className="flex items-center gap-2 mt-1">
            <label className="text-xs text-muted-foreground">自定义：</label>
            <input
              type="number"
              min={1}
              max={1440}
              placeholder="分钟"
              className="w-20 h-8 px-2 rounded-lg border bg-background text-foreground text-xs"
              onChange={e => {
                const val = parseInt(e.target.value);
                if (val > 0 && val <= 1440) {
                  const cron = val >= 60 && val % 60 === 0
                    ? `0 */${val / 60} * * *`
                    : `*/${val} * * * *`;
                  setIntervalValue(cron);
                  onChange(cron);
                }
              }}
            />
            <span className="text-xs text-muted-foreground">分钟</span>
          </div>
        </div>
      )}

      {mode === 'daily' && (
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <span className="text-sm text-muted-foreground">每天</span>
          <Select value={hour} onChange={v => { setHour(v); update(mode, undefined, v); }} options={hourOptions} className="w-20 md:w-24" size="sm" />
          <Select value={minute} onChange={v => { setMinute(v); update(mode, undefined, undefined, v); }} options={minuteOptions} className="w-20 md:w-24" size="sm" />
          <span className="text-sm text-muted-foreground">执行</span>
        </div>
      )}

      {mode === 'weekly' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {WEEKDAYS.map(d => (
              <button key={d.value} type="button" onClick={() => {
                const newDow = dow.includes(d.value) ? dow.filter(x => x !== d.value) : [...dow, d.value];
                setDow(newDow); update(mode, undefined, undefined, undefined, undefined, newDow);
              }}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${dow.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-sm text-muted-foreground">时间</span>
            <Select value={hour} onChange={v => { setHour(v); update(mode, undefined, v); }} options={hourOptions} className="w-20 md:w-24" size="sm" />
            <Select value={minute} onChange={v => { setMinute(v); update(mode, undefined, undefined, v); }} options={minuteOptions} className="w-20 md:w-24" size="sm" />
          </div>
        </div>
      )}

      {mode === 'monthly' && (
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <span className="text-sm text-muted-foreground">每月</span>
          <Select value={dom} onChange={v => { setDom(v); update(mode, undefined, undefined, undefined, v); }} options={domOptions} className="w-20 md:w-24" size="sm" />
          <Select value={hour} onChange={v => { setHour(v); update(mode, undefined, v); }} options={hourOptions} className="w-20 md:w-24" size="sm" />
          <Select value={minute} onChange={v => { setMinute(v); update(mode, undefined, undefined, v); }} options={minuteOptions} className="w-20 md:w-24" size="sm" />
        </div>
      )}

      {/* 预览 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground">{describeCron(value)}</span>
        <span className="text-xs text-muted-foreground font-mono ml-auto hidden sm:inline">{value}</span>
      </div>
    </div>
  );
}

// ========== 页面主组件 ==========

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return parseCrawlerTime(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const diff = Date.now() - parseCrawlerTime(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

/** 后端爬虫 datetime 统一按 UTC 存储；已有显式偏移时保持原值。 */
function parseCrawlerTime(iso: string): Date {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasTimeZone ? iso : `${iso}Z`);
}

// ========== 常量（模块级，避免组件重渲染时重复创建）==========

const WEEKDAYS = [
  { label: '周日', value: '0' }, { label: '周一', value: '1' }, { label: '周二', value: '2' },
  { label: '周三', value: '3' }, { label: '周四', value: '4' }, { label: '周五', value: '5' }, { label: '周六', value: '6' },
];

const INTERVAL_OPTIONS = [
  { label: '每10分钟', value: '*/10 * * * *' },
  { label: '每15分钟', value: '*/15 * * * *' },
  { label: '每20分钟', value: '*/20 * * * *' },
  { label: '每30分钟', value: '*/30 * * * *' },
  { label: '每1小时', value: '0 * * * *' },
  { label: '每2小时', value: '0 */2 * * *' },
  { label: '每3小时', value: '0 */3 * * *' },
  { label: '每4小时', value: '0 */4 * * *' },
  { label: '每6小时', value: '0 */6 * * *' },
  { label: '每8小时', value: '0 */8 * * *' },
  { label: '每12小时', value: '0 */12 * * *' },
  { label: '每天早8点', value: '0 8 * * *' },
  { label: '每天晚10点', value: '0 22 * * *' },
  { label: '每周一早8点', value: '0 8 * * 1' },
  { label: '每月1号早8点', value: '0 8 1 * *' },
];

const TYPE_MAP: Record<string, string> = {
  movie: '🎬 电影', drama: '📺 剧集', variety: '🎤 综艺', anime: '🎯 动漫', short: '⚡ 短剧'
};


const PRIORITY_OPTIONS = [
  { label: '按评分从高到低', value: 'by_score' },
  { label: '按热度从高到低', value: 'by_hot' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  queued: { label: '排队中', icon: <Clock className="w-3 h-3" />, className: 'bg-slate-500/20 text-slate-600 dark:text-slate-300' },
  success: { label: '成功', icon: <CheckCircle className="w-3 h-3" />, className: 'bg-primary/20 text-primary dark:text-primary' },
  partial_success: { label: '部分成功', icon: <AlertTriangle className="w-3 h-3" />, className: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  failed: { label: '失败', icon: <XCircle className="w-3 h-3" />, className: 'bg-destructive/20 text-destructive' },
  running: { label: '运行中', icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-blue-500/20 text-blue-500' },
  cancel_requested: { label: '正在取消', icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  cancelled: { label: '已取消', icon: <StopCircle className="w-3 h-3" />, className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  interrupted: { label: '已中断', icon: <AlertTriangle className="w-3 h-3" />, className: 'bg-violet-500/20 text-violet-600 dark:text-violet-400' },
  stopped: { label: '已停止', icon: <StopCircle className="w-3 h-3" />, className: 'bg-orange-500/20 text-orange-500' },
  pending_retry: { label: '等待重试', icon: <RotateCcw className="w-3 h-3" />, className: 'bg-yellow-500/20 text-yellow-600' },
};

const RETRYABLE_JOB_STATUSES = new Set(['failed', 'partial_success', 'cancelled', 'interrupted']);

function isRetryableJobStatus(status: string): boolean {
  return RETRYABLE_JOB_STATUSES.has(status);
}

function countRetryableJobs(byStatus: Record<string, number> | undefined): number {
  if (!byStatus) return 0;
  return Array.from(RETRYABLE_JOB_STATUSES)
    .reduce((total, status) => total + (byStatus[status] || 0), 0);
}

interface ScheduleForm {
  id?: number;
  name: string;
  contentType: string;
  sourceSite: string;
  cronExpression: string;
  batchSize: number;
  rateLimitMs: number;
  priority: string;
  genreFilter: string;
  enabled: number;
}

const EMPTY_FORM: ScheduleForm = {
  name: '',
  contentType: 'movie',
  sourceSite: '七味网',
  cronExpression: '0 2 * * *',
  batchSize: 20,
  rateLimitMs: 1000,
  priority: 'by_score',
  genreFilter: '',
  enabled: 1,
};

export default function CrawlerPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [schedules, setSchedules] = useState<CrawlerScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, running: 0, idle: 0 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CrawlerTaskLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logStats, setLogStats] = useState<{ total: number; byStatus: Record<string, number>; recentFailed: CrawlerTaskLog[] } | null>(null);
  const retryableLogCount = countRetryableJobs(logStats?.byStatus);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryAllLoading, setRetryAllLoading] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 20;
  const paginatedLogs = logs.slice(0, logPage * LOG_PAGE_SIZE);
  const hasMoreLogs = paginatedLogs.length < logs.length;
  const searchRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Keyboard shortcut: Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Name keyword search state
  const [nameKeyword, setNameKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(nameKeyword), 300);
    return () => clearTimeout(timer);
  }, [nameKeyword]);

  // Filtered schedules based on name keyword
  const filteredSchedules = debouncedKeyword
    ? schedules.filter(s => s.name.toLowerCase().includes(debouncedKeyword.toLowerCase()))
    : schedules;

  // sort state
  const [sortKey, setSortKey] = useState<'name' | 'contentType' | 'cron' | 'lastRun'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'contentType') cmp = a.contentType.localeCompare(b.contentType);
    else if (sortKey === 'cron') cmp = a.cronExpression.localeCompare(b.cronExpression);
    else if (sortKey === 'lastRun') cmp = (a.lastRunTime || '').localeCompare(b.lastRunTime || '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <span className="text-muted-foreground/30 ml-1">⇅</span>;
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await crawlerApi.getStatus() as AxiosResponse<{ code: number; data: CrawlerStatusData }>;
      const statusData = res.data?.data;
      const data = statusData?.schedules || [];
      setSchedules(data);
      setStats({
        total: statusData?.total ?? data.length,
        running: statusData?.running ?? data.filter((s: CrawlerScheduleItem) => s.status === 'running').length,
        idle: statusData?.idle ?? data.filter((s: CrawlerScheduleItem) => s.status !== 'running').length,
      });
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '获取爬虫配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (status?: string) => {
    try {
      setLogsLoading(true);
      const params: { status?: string } = {};
      if (status && status !== 'all') params.status = status;
      const res = await crawlerApi.listLogs(params) as AxiosResponse<LogResult>;
      setLogs(res.data?.data || []);
      setLogsLoaded(true);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '获取日志列表失败'));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchLogStats = useCallback(async () => {
    try {
      const res = await crawlerApi.getLogStats() as AxiosResponse<{ code: number; data: { total: number; byStatus: Record<string, number>; recentFailed: CrawlerTaskLog[] } }>;
      if (res.data?.code === 200) setLogStats(res.data.data);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '获取日志统计失败'));
    }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // 预加载日志和统计
  useEffect(() => {
    if (!logsLoaded) {
      fetchLogs();
      fetchLogStats();
    }
  }, [logsLoaded, fetchLogs, fetchLogStats]);

  // 状态筛选变化时重新获取
  useEffect(() => {
    if (logsLoaded) {
      fetchLogs(logStatusFilter);
    }
  }, [logStatusFilter, fetchLogs, logsLoaded]);

  // 加载资源来源列表
  useEffect(() => {
    crawlerApi.listSources().then((res: AxiosResponse<SourcesResult>) => {
      const data = res.data;
      if (data?.code === 200) setSources(data.data || []);
    }).catch((e: unknown) => { toast.error(extractErrorMessage(e, '加载资源来源失败')); });
  }, []);

  // 当 contentType 变化且表单打开时加载 genre 列表
  useEffect(() => {
    if (showForm) {
      contentApi.getGenres(form.contentType).then((res: AxiosResponse<GenresResult>) => {
        const data = res.data;
        if (data?.code === 200) setGenres(data.data || []);
      }).catch((e: unknown) => { toast.error(extractErrorMessage(e, '加载类型列表失败')); setGenres([]); });
    }
  }, [form.contentType, showForm]);

  const handleStart = async (id: number) => {
    setActionId(id);
    try { await crawlerApi.start(id); toast.success('爬虫已启动'); await fetchSchedules(); } catch (e: unknown) { toast.error(extractErrorMessage(e, '启动失败')); } finally { setActionId(null); }
  };

  const handleStop = async (id: number) => {
    setActionId(id);
    try { await crawlerApi.stop(id); toast.success('爬虫已停止'); await fetchSchedules(); } catch (e: unknown) { toast.error(extractErrorMessage(e, '停止失败')); } finally { setActionId(null); }
  };

  const handleToggle = async (schedule: CrawlerScheduleItem) => {
    try { await crawlerApi.toggleEnabled(schedule.id, schedule.enabled !== 1); toast.success(schedule.enabled ? '已禁用' : '已启用'); await fetchSchedules(); } catch (e: unknown) { toast.error(extractErrorMessage(e, '操作失败')); }
  };

  const handleDelete = async (id: number) => {
    const ok = await dialog.confirm({ title: '删除配置', content: '确定删除此爬虫配置？删除后不可恢复。', confirmText: '删除', cancelText: '取消', variant: 'danger' });
    if (!ok) return;
    try { await crawlerApi.deleteSchedule(id); toast.success('已删除'); await fetchSchedules(); } catch (e: unknown) { toast.error(extractErrorMessage(e, '删除失败')); }
  };

  const parseGenreFilterForDisplay = (gf: string | null): string => {
    if (!gf) return '';
    try {
      const arr = JSON.parse(gf);
      if (Array.isArray(arr)) return arr.join('，');
    } catch (e: unknown) { return gf; }
    return gf;
  };

  const handleEdit = (schedule: CrawlerScheduleItem) => {
    setForm({
      id: schedule.id,
      name: schedule.name,
      contentType: schedule.contentType,
      sourceSite: schedule.sourceSite,
      cronExpression: schedule.cronExpression,
      batchSize: schedule.batchSize,
      rateLimitMs: schedule.rateLimitMs,
      priority: schedule.priority,
      genreFilter: parseGenreFilterForDisplay(schedule.genreFilter),
      enabled: schedule.enabled,
    });
    try {
      if (schedule.genreFilter) {
        const arr = JSON.parse(schedule.genreFilter);
        setSelectedGenres(Array.isArray(arr) ? arr : []);
      } else {
        setSelectedGenres([]);
      }
    } catch (e: unknown) { setSelectedGenres([]); }
    setEditingId(schedule.id);
    setShowAdvanced(selectedGenres.length > 0);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.warning('请输入配置名称'); return; }
    if (saving) return; // 防抖：防止快速连续点击
    setSaving(true);
    try {
      const submitData: { name: string; contentType: string; sourceSite: string; cronExpression: string; batchSize: number; rateLimitMs: number; priority: string; genreFilter: string; enabled: number; id?: number } = {
        name: form.name,
        contentType: form.contentType,
        sourceSite: form.sourceSite,
        cronExpression: form.cronExpression,
        batchSize: form.batchSize,
        rateLimitMs: form.rateLimitMs,
        priority: form.priority,
        genreFilter: selectedGenres.length > 0 ? JSON.stringify(selectedGenres) : '',
        enabled: form.enabled,
      };
      if (editingId) submitData.id = editingId;
      await crawlerApi.saveSchedule(submitData);
      toast.success(editingId ? '配置已更新' : '配置已创建');
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSelectedGenres([]);
      await fetchSchedules();
    } catch (e: unknown) { toast.error(extractErrorMessage(e, '保存失败')); } finally { setSaving(false); }
  };

  const handleCreateNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSelectedGenres([]);
    setShowAdvanced(false);
    setShowForm(true);
  };

  const handleRetry = async (logId: number) => {
    setRetryingId(logId);
    try {
      const res = await crawlerApi.retry(logId) as AxiosResponse<{ code: number; message?: string }>;
      if (res.data?.code === 200) {
        toast.success('重试任务已启动');
        await fetchSchedules();
        await fetchLogs(logStatusFilter);
        await fetchLogStats();
      } else {
        toast.error(res.data?.message || '重试失败');
      }
    } catch (e: unknown) { toast.error(extractErrorMessage(e, '重试失败')); } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    const ok = await dialog.confirm({
      title: '批量重试',
      content: '将按每个配置最新的失败、部分成功、已取消或已中断 Job 创建重试任务，确定继续？',
      confirmText: '全部重试',
      cancelText: '取消',
    });
    if (!ok) return;
    setRetryAllLoading(true);
    try {
      const res = await crawlerApi.retryAll() as AxiosResponse<{ code: number; data?: { started: number; skipped: number; message?: string } }>;
      if (res.data?.code === 200) {
        const d = res.data.data;
        toast.success(`已启动 ${d?.started || 0} 个重试任务`);
        await fetchSchedules();
        await fetchLogs(logStatusFilter);
        await fetchLogStats();
      } else {
        toast.error('批量重试失败');
      }
    } catch (e: unknown) { toast.error(extractErrorMessage(e, '批量重试失败')); } finally {
      setRetryAllLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, icon: null, className: 'bg-muted text-muted-foreground' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">爬虫管理</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">配置定时爬虫任务，监控抓取进度</p>
        </div>
        <button onClick={handleCreateNew} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
          <Plus className="w-4 h-4" /> 新建配置
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border bg-card">
          <Database className="w-5 h-5 md:w-6 md:h-6 text-primary opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">配置总数</p><p className="text-lg md:text-xl font-bold text-foreground">{stats.total}</p></div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border bg-card">
          <Activity className="w-5 h-5 md:w-6 md:h-6 text-primary opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">运行中</p><p className="text-lg md:text-xl font-bold text-foreground">{stats.running}</p></div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border bg-card">
          <Clock className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">空闲</p><p className="text-lg md:text-xl font-bold text-foreground">{stats.idle}</p></div>
        </div>
      </div>

      {/* Config Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? '编辑配置' : '新建配置'} width="lg"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存配置'}
            </button>
          </>
        }
      >
        <div className="space-y-4 md:space-y-5">
          {/* 基础配置 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">配置名称 <span className="text-destructive">*</span></label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="如：电影每日爬取" className="h-10 px-3 rounded-lg border bg-background text-foreground text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">内容类型</label>
              <Select value={form.contentType} onChange={v => setForm({...form, contentType: v})} options={Object.entries(TYPE_MAP).map(([k, v]) => ({ label: v, value: k }))} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">资源来源</label>
              <Select value={form.sourceSite} onChange={v => setForm({...form, sourceSite: v})} options={sources.length > 0 ? sources.map(s => ({ label: s.name, value: s.name })) : [{ label: '七味网', value: '七味网' }]} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">启用状态</label>
              <div className="flex items-center gap-2 h-10">
                <button type="button" onClick={() => setForm({...form, enabled: form.enabled ? 0 : 1})} className={`w-10 h-5 rounded-full relative transition-colors ${form.enabled ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <span className="text-sm text-muted-foreground">{form.enabled ? '已启用' : '已禁用'}</span>
              </div>
            </div>
          </div>
          {/* Cron 可视化构建器 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">定时规则</label>
            <CronBuilder value={form.cronExpression} onChange={v => setForm({...form, cronExpression: v})} />
          </div>
          {/* 高级筛选（折叠） */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
            >
              <span>高级筛选</span>
              <span className="flex items-center gap-2">
                {selectedGenres.length > 0 && (
                  <span className="text-xs text-primary">已选 {selectedGenres.length} 项</span>
                )}
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </span>
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 space-y-4 border-t">
                {/* 类型筛选（Genre） */}
                <div className="grid gap-2 pt-3">
                  <label className="text-sm font-medium text-foreground">类型筛选（留空爬全部）</label>
                  {genres.length > 0 ? (
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg border bg-background">
                      {genres.map(g => (
                        <label key={g} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedGenres.includes(g)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedGenres(prev => [...prev, g]);
                              } else {
                                setSelectedGenres(prev => prev.filter(x => x !== g));
                              }
                            }}
                            className="rounded accent-primary"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">切换内容类型后自动加载...</p>
                  )}
                  {selectedGenres.length > 0 && (
                    <p className="text-xs text-muted-foreground">已选 {selectedGenres.length} 项: {selectedGenres.join('，')}</p>
                  )}
                </div>
                {/* 优先级 */}
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">优先级</label>
                  <Select value={form.priority} onChange={v => setForm({...form, priority: v})} options={PRIORITY_OPTIONS} />
                </div>
                {/* 每批数量 + 请求间隔 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">每批数量</label>
                    <input type="number" min={1} max={1000} value={form.batchSize} onChange={e => setForm({...form, batchSize: Math.min(1000, Math.max(1, Number(e.target.value)))})} className="h-10 px-3 rounded-lg border bg-background text-foreground text-sm" />
                    <p className="text-xs text-muted-foreground">1-1000</p>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">请求间隔 (ms)</label>
                    <input type="number" min={200} step={100} value={form.rateLimitMs} onChange={e => setForm({...form, rateLimitMs: Math.max(200, Number(e.target.value))})} className="h-10 px-3 rounded-lg border bg-background text-foreground text-sm" />
                    <p className="text-xs text-muted-foreground">最小 200ms</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Table - Desktop / Cards - Mobile */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('name')} className="flex items-center hover:text-foreground transition-colors">
                    名称<SortIcon col="name" />
                  </button>
                  <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      value={nameKeyword}
                      onChange={e => setNameKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setDebouncedKeyword(nameKeyword)}
                      placeholder="Ctrl+F 搜索..."
                      className="h-7 pl-8 pr-7 rounded border bg-background text-foreground text-xs w-full max-w-[160px] focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                    {nameKeyword && (
                      <button onClick={() => { setNameKeyword(''); setDebouncedKeyword(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('contentType')} className="flex items-center hover:text-foreground transition-colors">
                    类型<SortIcon col="contentType" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('cron')} className="flex items-center hover:text-foreground transition-colors">
                    定时<SortIcon col="cron" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">批量</th>
                <th className="text-left p-3 font-medium text-muted-foreground">间隔</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">优先级</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">上次</th>
                <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
                <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /><span className="text-sm">加载中...</span></td></tr>
              ) : sortedSchedules.length === 0 && debouncedKeyword ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">未找到匹配 "{debouncedKeyword}" 的配置</td></tr>
              ) : sortedSchedules.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">暂无配置，点击"新建配置"开始</td></tr>
              ) : sortedSchedules.map((s) => {
                const isRunning = s.status === 'running';
                const isLoading = actionId === s.id;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{s.name}</td>
                    <td className="p-3 text-muted-foreground text-xs">{TYPE_MAP[s.contentType] || s.contentType}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{s.cronExpression}</td>
                    <td className="p-3 text-muted-foreground">{s.batchSize}</td>
                    <td className="p-3 text-muted-foreground">{s.rateLimitMs}ms</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">{PRIORITY_OPTIONS.find(o => o.value === s.priority)?.label || s.priority}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell text-xs">{timeAgo(s.lastRunTime)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isRunning ? 'bg-blue-500/20 text-blue-500' :
                        s.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                        s.status === 'pending_retry' ? 'bg-yellow-500/20 text-yellow-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isRunning ? 'bg-blue-500' :
                          s.status === 'failed' ? 'bg-destructive' :
                          s.status === 'pending_retry' ? 'bg-yellow-500' :
                          'bg-muted-foreground'
                        } ${isRunning ? 'animate-pulse' : ''}`} />
                        {isRunning ? '运行中' : s.status === 'failed' ? '上次失败' : s.status === 'pending_retry' ? '等待重试' : '空闲'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isRunning ? (
                          <button onClick={() => handleStop(s.id)} disabled={isLoading} className="p-1.5 rounded hover:bg-destructive/20 text-destructive disabled:opacity-50" title="停止">
                            <Square className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleStart(s.id)} disabled={isLoading} className="p-1.5 rounded hover:bg-primary/20 text-primary dark:text-primary disabled:opacity-50" title="启动">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleToggle(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title={s.enabled ? '禁用' : '启用'}>
                          {s.enabled ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="编辑">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-destructive/20 text-destructive" title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /><span className="text-sm">加载中...</span></div>
          ) : schedules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无配置，点击"新建配置"开始</div>
          ) : schedules.map((s) => {
            const isRunning = s.status === 'running';
            const isLoading = actionId === s.id;
            return (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{s.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{TYPE_MAP[s.contentType] || s.contentType}</span>
                      <span className="text-xs text-muted-foreground font-mono">{s.cronExpression}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isRunning ? 'bg-blue-500/20 text-blue-500' :
                        s.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-blue-500' : s.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                        {isRunning ? '运行中' : s.status === 'failed' ? '上次失败' : '空闲'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isRunning ? (
                      <button onClick={() => handleStop(s.id)} disabled={isLoading} className="p-2 rounded hover:bg-destructive/20 text-destructive disabled:opacity-50">
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => handleStart(s.id)} disabled={isLoading} className="p-2 rounded hover:bg-primary/20 text-primary disabled:opacity-50">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleEdit(s)} className="p-2 rounded hover:bg-muted text-muted-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 rounded hover:bg-destructive/20 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>批量: {s.batchSize}</span>
                  <span>间隔: {s.rateLimitMs}ms</span>
                  <span>上次: {timeAgo(s.lastRunTime)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Logs Section */}
      <div className="rounded-lg border bg-card">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-foreground">任务日志</span>
            <span className="text-xs text-muted-foreground">({logStats?.total ?? logs.length} 条)</span>
            {retryableLogCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/20 text-destructive">
                {retryableLogCount} 可重试
              </span>
            ) : null}
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showLogs && (
          <div className="border-t">
            {/* 日志统计概览 */}
            {logStats && (
              <div className="p-4 border-b">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'all', label: '全部', count: logStats.total },
                      { key: 'success', label: '成功', count: logStats.byStatus?.success || 0 },
                      { key: 'partial_success', label: '部分成功', count: logStats.byStatus?.partial_success || 0 },
                      { key: 'failed', label: '失败', count: logStats.byStatus?.failed || 0 },
                      { key: 'queued', label: '排队中', count: logStats.byStatus?.queued || 0 },
                      { key: 'running', label: '运行中', count: logStats.byStatus?.running || 0 },
                      { key: 'cancel_requested', label: '正在取消', count: logStats.byStatus?.cancel_requested || 0 },
                      { key: 'cancelled', label: '已取消', count: logStats.byStatus?.cancelled || 0 },
                      { key: 'interrupted', label: '已中断', count: logStats.byStatus?.interrupted || 0 },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setLogStatusFilter(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          logStatusFilter === tab.key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            logStatusFilter === tab.key ? 'bg-primary-foreground/20' : 'bg-background/50'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {retryableLogCount > 0 ? (
                    <button
                      onClick={handleRetryAll}
                      disabled={retryAllLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${retryAllLoading ? 'animate-spin' : ''}`} />
                      重试可恢复任务
                    </button>
                  ) : null}
                </div>
                {/* 队列可视化条 */}
                {logStats.total > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {logStats.byStatus?.success ? (
                      <div
                        className="bg-primary transition-all"
                        style={{ width: `${(logStats.byStatus.success / logStats.total) * 100}%` }}
                        title={`成功 ${logStats.byStatus.success}`}
                      />
                    ) : null}
                    {logStats.byStatus?.failed ? (
                      <div
                        className="bg-destructive transition-all"
                        style={{ width: `${(logStats.byStatus.failed / logStats.total) * 100}%` }}
                        title={`失败 ${logStats.byStatus.failed}`}
                      />
                    ) : null}
                    {logStats.byStatus?.partial_success ? (
                      <div
                        className="bg-amber-500 transition-all"
                        style={{ width: `${(logStats.byStatus.partial_success / logStats.total) * 100}%` }}
                        title={`部分成功 ${logStats.byStatus.partial_success}`}
                      />
                    ) : null}
                    {logStats.byStatus?.queued ? (
                      <div
                        className="bg-slate-500 transition-all"
                        style={{ width: `${(logStats.byStatus.queued / logStats.total) * 100}%` }}
                        title={`排队中 ${logStats.byStatus.queued}`}
                      />
                    ) : null}
                    {logStats.byStatus?.running ? (
                      <div
                        className="bg-blue-500 transition-all"
                        style={{ width: `${(logStats.byStatus.running / logStats.total) * 100}%` }}
                        title={`运行中 ${logStats.byStatus.running}`}
                      />
                    ) : null}
                    {logStats.byStatus?.cancel_requested ? (
                      <div
                        className="bg-orange-500 transition-all"
                        style={{ width: `${(logStats.byStatus.cancel_requested / logStats.total) * 100}%` }}
                        title={`正在取消 ${logStats.byStatus.cancel_requested}`}
                      />
                    ) : null}
                    {logStats.byStatus?.cancelled ? (
                      <div
                        className="bg-orange-600 transition-all"
                        style={{ width: `${(logStats.byStatus.cancelled / logStats.total) * 100}%` }}
                        title={`已取消 ${logStats.byStatus.cancelled}`}
                      />
                    ) : null}
                    {logStats.byStatus?.interrupted ? (
                      <div
                        className="bg-violet-500 transition-all"
                        style={{ width: `${(logStats.byStatus.interrupted / logStats.total) * 100}%` }}
                        title={`已中断 ${logStats.byStatus.interrupted}`}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}
            {logsLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 inline" /> 加载中...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">暂无任务日志</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-muted-foreground">任务</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">类型</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">抓取</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">新增</th>
                        <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">更新</th>
                        <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">耗时</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">开始时间</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-foreground font-medium">
                            <button onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="text-left hover:text-primary transition-colors">
                              <span className="flex items-center gap-1">
                                {expandedLogId === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {log.scheduleName || '-'}
                              </span>
                            </button>
                            {expandedLogId === log.id && log.errorMessage && (
                              <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-1">{log.errorMessage}</p>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{TYPE_MAP[log.contentType] || log.contentType}</td>
                          <td className="p-3">{renderStatusBadge(log.status)}</td>
                          <td className="p-3 text-muted-foreground">{log.itemsCrawled || 0}</td>
                          <td className="p-3 text-primary">+{log.itemsAdded || 0}</td>
                          <td className="p-3 text-primary hidden lg:table-cell">{log.itemsUpdated || 0}</td>
                          <td className="p-3 text-muted-foreground hidden lg:table-cell text-xs">{log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                          <td className="p-3 text-muted-foreground text-xs">{formatTime(log.startedAt || log.queuedAt || null)}</td>
                          <td className="p-3 text-right">
                            {isRetryableJobStatus(log.status) && (
                              <button
                                onClick={() => handleRetry(log.id)}
                                disabled={retryingId === log.id}
                                className="p-1.5 rounded hover:bg-primary/20 text-primary disabled:opacity-50"
                                title="重试此任务"
                              >
                                <RotateCcw className={`w-4 h-4 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Load more */}
                {hasMoreLogs && (
                  <div className="p-4 text-center">
                    <button onClick={() => setLogPage(p => p + 1)} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">
                      加载更多 ({logs.length - paginatedLogs.length} 条剩余)
                    </button>
                  </div>
                )}
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {paginatedLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{log.scheduleName || '-'}</p>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(log.status)}
                          {isRetryableJobStatus(log.status) && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              disabled={retryingId === log.id}
                              className="p-1.5 rounded hover:bg-primary/20 text-primary disabled:opacity-50"
                              title="重试"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>抓取: {log.itemsCrawled || 0}</span>
                        <span className="text-primary">新增: +{log.itemsAdded || 0}</span>
                        <span className="text-primary">更新: {log.itemsUpdated || 0}</span>
                        {log.durationMs && <span>耗时: {(log.durationMs / 1000).toFixed(1)}s</span>}
                        <span>{formatTime(log.startedAt || log.queuedAt || null)}</span>
                      </div>
                      {log.errorMessage && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{log.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* Mobile load more */}
                {hasMoreLogs && paginatedLogs.length <= 10 && (
                  <div className="p-4 text-center">
                    <button onClick={() => setLogPage(p => p + 1)} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">
                      加载更多 ({logs.length - paginatedLogs.length} 条剩余)
                    </button>
                  </div>
                )}
              </>
            )}
            {logs.some(l => l.errorMessage) && (
              <div className="p-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">错误详情</p>
                  {retryableLogCount > 0 ? (
                    <button
                      onClick={handleRetryAll}
                      disabled={retryAllLoading}
                      className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${retryAllLoading ? 'animate-spin' : ''}`} />
                      全部重试
                    </button>
                  ) : null}
                </div>
                {logs.filter(l => l.errorMessage).map((log) => (
                  <div key={log.id} className="mb-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-1">{log.scheduleName} — {formatTime(log.startedAt || log.queuedAt || null)}</p>
                      <p className="text-sm text-destructive break-all">{log.errorMessage}</p>
                    </div>
                    {isRetryableJobStatus(log.status) && (
                      <button
                        onClick={() => handleRetry(log.id)}
                        disabled={retryingId === log.id}
                        className="p-1.5 rounded hover:bg-destructive/20 text-destructive disabled:opacity-50 shrink-0"
                        title="重试"
                      >
                        <RotateCcw className={`w-4 h-4 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
