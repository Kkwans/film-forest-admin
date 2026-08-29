'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AxiosResponse } from 'axios';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  CalendarPlus,
  CheckCircle2,
  CirclePause,
  Clock3,
  Database,
  Film,
  Library,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { contentApi, crawlerApi, statsApi } from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

interface Overview {
  typeCounts: Record<string, number>;
  weekGrowth: Record<string, number>;
  totalContent: number;
  totalWeekGrowth: number;
  totalUsers: number;
  crawler: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    successRate: number;
    totalItemsCrawled: number;
  };
  resources: { online: number; magnet: number; cloud: number; total: number };
}

interface RecentItem {
  id: number;
  title: string;
  year?: number | null;
  type: string;
  status: number;
  createdAt: string;
  scoreDouban?: number | null;
}

interface CrawlerScheduleItem {
  id: number;
  name: string;
  contentType: string;
  status?: string | null;
  latestResult?: string | null;
  enabled: number;
  totalRuns: number;
  totalItems: number;
  lastRunTime?: string | null;
  nextRunTime?: string | null;
}

const EMPTY_OVERVIEW: Overview = {
  typeCounts: {}, weekGrowth: {}, totalContent: 0, totalWeekGrowth: 0, totalUsers: 0,
  crawler: { totalRuns: 0, successRuns: 0, failedRuns: 0, successRate: 0, totalItemsCrawled: 0 },
  resources: { online: 0, magnet: 0, cloud: 0, total: 0 },
};

const CONTENT_TYPES = [
  { code: 'movie', label: '电影', icon: Film, color: 'bg-sky-500' },
  { code: 'drama', label: '剧集', icon: Library, color: 'bg-violet-500' },
  { code: 'variety', label: '综艺', icon: Sparkles, color: 'bg-amber-500' },
  { code: 'anime', label: '动漫', icon: Boxes, color: 'bg-rose-500' },
  { code: 'short_drama', label: '短剧', icon: Activity, color: 'bg-emerald-500' },
] as const;

const CONTENT_TYPE_ALIASES: Record<string, string> = {
  movie: 'movie',
  drama: 'drama',
  variety: 'variety',
  anime: 'anime',
  short: 'short_drama',
  short_drama: 'short_drama',
  'short-drama': 'short_drama',
};

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>, fallback: string): T {
  if (response.data?.code !== 200) throw new Error(response.data?.message || fallback);
  return response.data.data;
}

function contentTypeDefinition(value?: string | null) {
  if (!value) return undefined;
  const canonical = CONTENT_TYPE_ALIASES[value.trim().toLowerCase()] || value;
  return CONTENT_TYPES.find(entry => entry.code === canonical);
}

function contentTypeLabel(value?: string | null): string {
  return contentTypeDefinition(value)?.label || value || '未知类型';
}

function recentContentTime(value?: string | null): string {
  if (!value) return '入库时间未知';
  const match = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2})/);
  if (match) return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;

  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(time);
}

function shortScheduleTime(value?: string | null): string {
  if (!value) return '未安排';
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(time);
}

function contentStatus(status: number) {
  if (status === 1) return { label: '已上线', className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' };
  if (status === 2) return { label: '已下线', className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' };
  return { label: '草稿', className: 'bg-muted text-muted-foreground' };
}

function crawlerState(item: CrawlerScheduleItem) {
  const value = (item.latestResult || item.status || 'idle').toLowerCase();
  if (value === 'running' || value === 'queued') return { value, label: value === 'queued' ? '排队中' : '运行中', tone: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' };
  if (value === 'failed' || value === 'partial') return { value, label: value === 'partial' ? '部分成功' : '失败', tone: 'text-destructive', dot: 'bg-destructive' };
  if (value === 'cancelled') return { value, label: '已取消', tone: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
  if (value === 'success') return { value, label: '最近成功', tone: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' };
  return { value, label: item.enabled === 1 ? '待命' : '已停用', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' };
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [schedules, setSchedules] = useState<CrawlerScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loadIssue, setLoadIssue] = useState('');

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      statsApi.getOverview() as Promise<AxiosResponse<ApiEnvelope<Overview>>>,
      contentApi.listAll({ page: 1, size: 5, sort: 'createdAt', sortDir: 'desc' }) as Promise<AxiosResponse<ApiEnvelope<{ records: RecentItem[] } | RecentItem[]>>>,
      crawlerApi.getStatus() as Promise<AxiosResponse<ApiEnvelope<{ schedules: CrawlerScheduleItem[] }>>>,
    ]);
    const issues: string[] = [];
    try {
      if (results[0].status === 'fulfilled') setOverview(unwrap(results[0].value, '运营概览加载失败'));
      else throw results[0].reason;
    } catch (error: unknown) { issues.push(extractErrorMessage(error, '运营概览加载失败')); }
    try {
      if (results[1].status === 'fulfilled') {
        const data = unwrap(results[1].value, '最近内容加载失败');
        setRecentItems(Array.isArray(data) ? data.slice(0, 5) : (data.records || []).slice(0, 5));
      } else throw results[1].reason;
    } catch (error: unknown) { issues.push(extractErrorMessage(error, '最近内容加载失败')); }
    try {
      if (results[2].status === 'fulfilled') setSchedules(unwrap(results[2].value, '爬虫状态加载失败').schedules || []);
      else throw results[2].reason;
    } catch (error: unknown) { issues.push(extractErrorMessage(error, '爬虫状态加载失败')); }
    setLoadIssue(issues.join('；'));
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void fetchData(), 0);
    const interval = autoRefresh ? window.setInterval(() => void fetchData(), 30_000) : null;
    return () => {
      window.clearTimeout(initial);
      if (interval) window.clearInterval(interval);
    };
  }, [autoRefresh, fetchData]);

  const activeJobs = schedules.filter(item => ['running', 'queued'].includes(crawlerState(item).value)).length;
  const abnormalJobs = schedules.filter(item => ['failed', 'partial'].includes(crawlerState(item).value)).length;
  const recentSchedules = useMemo(() => [...schedules]
    .sort((a, b) => new Date(b.lastRunTime || 0).getTime() - new Date(a.lastRunTime || 0).getTime())
    .slice(0, 6), [schedules]);

  const metricCards = [
    { label: '内容总量', value: overview.totalContent, note: `近 7 天 +${overview.totalWeekGrowth}`, icon: Film, href: '/content', tone: 'bg-primary/10 text-primary' },
    { label: '活动任务', value: activeJobs, note: `${schedules.length} 个计划`, icon: Bot, href: '/crawler', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
    { label: '异常摘要', value: abnormalJobs, note: abnormalJobs ? '需要处理' : '当前无异常', icon: ShieldAlert, href: '/crawler', tone: abnormalJobs ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    { label: '资源总量', value: overview.resources.total, note: `在线 ${overview.resources.online}`, icon: Database, href: '/resources', tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
    { label: '爬虫成功率', value: `${Number(overview.crawler.successRate || 0).toFixed(1)}%`, note: `${overview.crawler.totalRuns} 次运行`, icon: CheckCircle2, href: '/stats', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    { label: '用户总数', value: overview.totalUsers, note: '注册账号', icon: Users, href: '/users', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operations overview</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">运营仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">优先呈现正在运行、需要处理和最近发生的事项。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" aria-pressed={autoRefresh} onClick={() => setAutoRefresh(value => !value)}>
            {autoRefresh ? <Activity className="text-primary" /> : <CirclePause />}{autoRefresh ? '自动刷新' : '已暂停'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />刷新
          </Button>
        </div>
      </header>

      {loadIssue && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>部分数据暂不可用：{loadIssue}</span></div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {metricCards.map(metric => <Link key={metric.label} href={metric.href} className="group rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className={`grid size-9 place-items-center rounded-xl ${metric.tone}`}><metric.icon className="size-4" /></span><ArrowRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" /></div><p className="mt-4 text-xs font-medium text-muted-foreground">{metric.label}</p>{loading ? <Skeleton className="mt-1 h-7 w-16" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</p>}<p className="mt-1 text-xs text-muted-foreground">{metric.note}</p></Link>)}
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-foreground">最近任务</h2>
            <p className="text-xs text-muted-foreground">状态来自最近一次权威 Job；展示最近运行、累计运行和下一次调度。</p>
          </div>
          <Link href="/crawler" className="flex items-center gap-1 text-xs font-medium text-primary">管理任务<ArrowRight className="size-3" /></Link>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid gap-0 bg-card sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(item => <Skeleton key={item} className="h-[6.5rem] w-full rounded-none" />)}
            </div>
          ) : recentSchedules.length === 0 ? (
            <div className="grid min-h-32 place-items-center p-6 text-center">
              <div><Bot className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-2 text-sm font-medium text-foreground">尚未创建爬虫计划</p><Link href="/crawler" className="mt-1 inline-flex text-xs text-primary">创建第一个计划</Link></div>
            </div>
          ) : (
            <div className={`grid gap-0 bg-card ${recentSchedules.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
              {recentSchedules.map(item => {
                const state = crawlerState(item);
                return (
                  <Link key={item.id} href="/crawler" className="flex h-[6.5rem] min-w-0 flex-col justify-between border-b border-border/70 bg-card p-4 hover:bg-muted/25 sm:border-r">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${state.dot} ${state.value === 'running' ? 'animate-pulse' : ''}`} />
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${state.tone}`}>{state.label}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{contentTypeLabel(item.contentType)} · {item.totalRuns || 0} 次运行 · {item.totalItems || 0} 条</p>
                    <div className="flex items-center justify-between gap-3 text-[11px] tabular-nums text-muted-foreground">
                      <span className="truncate">上次 {shortScheduleTime(item.lastRunTime)}</span>
                      <span className="truncate text-right">下次 {shortScheduleTime(item.nextRunTime)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold text-foreground">最近内容</h2><p className="text-xs text-muted-foreground">按入库时间展示最近内容，状态保持明确三态。</p></div><Link href="/content" className="flex items-center gap-1 text-xs font-medium text-primary">内容管理<ArrowRight className="size-3" /></Link></div>
          <CardContent className="p-0">
            {loading ? <div className="grid grid-cols-1 gap-0 bg-card">{Array.from({ length: 5 }, (_, index) => index + 1).map(item => <Skeleton key={item} className="h-20 w-full rounded-none" />)}</div> : recentItems.length === 0 ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">暂无内容，等待受控爬取或手工录入。</div> : <div className="grid grid-cols-1 gap-0 bg-card">{recentItems.map(item => { const status = contentStatus(item.status); const type = contentTypeDefinition(item.type); const Icon = type?.icon || Film; return <Link key={`${item.type}-${item.id}`} href="/content" className="flex h-20 min-h-20 min-w-0 items-center gap-3 border-b border-border/70 bg-card p-4 hover:bg-muted/25"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{item.title}{item.year != null ? `（${item.year}）` : ''}</p><p className="mt-1 truncate text-xs text-muted-foreground">{contentTypeLabel(item.type)}{item.scoreDouban ? ` · 豆瓣 ${item.scoreDouban}` : ''} · 入库 {recentContentTime(item.createdAt)}</p></div><Badge className={status.className}>{status.label}</Badge></Link>; })}</div>}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold text-foreground">内容结构</h2><p className="text-xs text-muted-foreground">按内容类型查看当前总量和近 7 天变化。</p></div><Link href="/stats" className="flex items-center gap-1 text-xs font-medium text-primary">详细统计<ArrowRight className="size-3" /></Link></div>
          <CardContent className="p-0">
            {CONTENT_TYPES.map(type => { const value = Number(overview.typeCounts[type.code] || 0); const growth = Number(overview.weekGrowth[type.code] || 0); const percent = overview.totalContent ? value * 100 / overview.totalContent : 0; return <div key={type.code} className="flex h-20 min-h-20 flex-col justify-center gap-1.5 border-b border-border/70 px-5 last:border-b-0"><div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2"><span className={`size-2 rounded-full ${type.color}`} /><span className="truncate text-sm text-foreground">{type.label}</span><span className="text-sm font-semibold tabular-nums text-foreground">{loading ? '-' : value.toLocaleString()}</span><span className="w-16 text-right text-xs tabular-nums text-muted-foreground">+{growth}/7天</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${type.color}`} style={{ width: `${Math.max(percent, value > 0 ? 1 : 0)}%` }} /></div><p className="text-right text-[11px] tabular-nums text-muted-foreground">{percent.toFixed(1)}%</p></div>; })}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" />{lastRefresh ? `最近刷新：${lastRefresh.toLocaleTimeString('zh-CN', { hour12: false })}` : '正在获取运营数据'}</div><div className="ml-auto flex flex-wrap gap-2"><Link href="/crawler" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground hover:bg-muted"><CalendarPlus className="size-3.5" />新建爬虫计划</Link><Link href="/resources" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground hover:bg-muted"><Database className="size-3.5" />管理资源</Link></div></div>
    </div>
  );
}
