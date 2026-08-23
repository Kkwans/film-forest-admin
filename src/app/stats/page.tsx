'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosResponse } from 'axios';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileText,
  Film,
  Inbox,
  Link2,
  Loader2,
  RadioTower,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { crawlerApi, statsApi } from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

interface ApiEnvelope<T> { code: number; message?: string; data: T }
interface OverviewData {
  typeCounts: Record<string, number>;
  totalContent: number;
  weekGrowth: Record<string, number>;
  totalWeekGrowth: number;
  crawler: { totalRuns: number; successRuns: number; failedRuns: number; successRate: number; totalItemsCrawled: number };
  resources: { online: number; magnet: number; cloud: number; total: number };
  totalUsers: number;
}
interface TrendData { dates: string[]; series: Record<string, Record<string, number>> }
interface DailyOperation { date: string; jobs: number; success: number; partial: number; failed: number; cancelled: number; added: number; updated: number; failedItems: number }
interface SourceHealth { source: string; jobs: number; success: number; partial: number; failed: number; cancelled: number; avgDurationMs: number; lastRunAt?: string | null }
interface OperationsData {
  days: number; jobs: number; success: number; partial: number; failed: number; cancelled: number;
  avgDurationMs: number; added: number; updated: number; failedItems: number;
  daily: DailyOperation[]; sourceHealth: SourceHealth[];
}
interface HotSearchItem { keyword: string; count: number; lastSearchAt?: string | null }
interface ReportData {
  qualityStats: Array<{ type: string; label: string; total: number; highScore: number; midScore: number; lowScore: number; avgScore: number }>;
}

const TYPE_ORDER = ['movie', 'drama', 'variety', 'anime', 'short_drama'] as const;
const TYPE_LABELS: Record<string, string> = { movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short_drama: '短剧' };
const COLORS = ['#0f766e', '#7c3aed', '#d97706', '#e11d48', '#0284c7'];
const CHART_STYLE = { backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' };

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>, fallback: string): T {
  if (response.data?.code !== 200) throw new Error(response.data?.message || fallback);
  return response.data.data;
}

function fillDaily(days: 7 | 30, rows: DailyOperation[]): DailyOperation[] {
  const byDate = new Map(rows.map(row => [row.date, row]));
  const result: DailyOperation[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    result.push(byDate.get(key) || { date: key, jobs: 0, success: 0, partial: 0, failed: 0, cancelled: 0, added: 0, updated: 0, failedItems: 0 });
  }
  return result;
}

function EmptyChart({ label }: { label: string }) {
  return <div className="grid h-72 place-items-center text-center text-sm text-muted-foreground"><div><Inbox className="mx-auto size-10 opacity-40" /><p className="mt-2">{label}</p></div></div>;
}

function ChartCard({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <Card className="flex flex-col overflow-hidden border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold text-foreground">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{note}</p></div><CardContent className="p-4 sm:p-5">{children}</CardContent></Card>;
}

export default function StatsPage() {
  const toast = useToast();
  const [days, setDays] = useState<7 | 30>(30);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [hotSearch, setHotSearch] = useState<HotSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadIssue, setLoadIssue] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      statsApi.getOverview() as Promise<AxiosResponse<ApiEnvelope<OverviewData>>>,
      statsApi.getTrend(days) as Promise<AxiosResponse<ApiEnvelope<TrendData>>>,
      crawlerApi.getOperationsStats(days) as Promise<AxiosResponse<ApiEnvelope<OperationsData>>>,
      statsApi.getReport(days) as Promise<AxiosResponse<ApiEnvelope<ReportData>>>,
      statsApi.getHotSearch(30, 10) as Promise<AxiosResponse<ApiEnvelope<HotSearchItem[]>>>,
    ]);
    const issues: string[] = [];
    const apply = <T,>(index: number, fallback: string, setter: (value: T) => void) => {
      const result = results[index];
      try {
        if (result.status !== 'fulfilled') throw result.reason;
        setter(unwrap(result.value as AxiosResponse<ApiEnvelope<T>>, fallback));
      } catch (error: unknown) { issues.push(extractErrorMessage(error, fallback)); }
    };
    apply<OverviewData>(0, '概览加载失败', setOverview);
    apply<TrendData>(1, '内容趋势加载失败', setTrend);
    apply<OperationsData>(2, '爬虫统计加载失败', setOperations);
    apply<ReportData>(3, '质量报表加载失败', setReport);
    apply<HotSearchItem[]>(4, '搜索统计加载失败', setHotSearch);
    setLoadIssue(issues.join('；'));
    setLoading(false);
  }, [days]);

  useEffect(() => { const timer = window.setTimeout(() => void fetchData(), 0); return () => window.clearTimeout(timer); }, [fetchData]);

  const downloadCsv = async (request: () => Promise<AxiosResponse<Blob>>, filename: string) => {
    setExporting(true);
    try {
      const response = await request();
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('导出任务已完成');
    } catch (error: unknown) { toast.error(extractErrorMessage(error, '导出失败')); }
    finally { setExporting(false); }
  };

  const totalContent = Number(overview?.totalContent || 0);
  const contentDistribution = TYPE_ORDER.map((type, index) => ({
    type, name: TYPE_LABELS[type], value: Number(overview?.typeCounts[type] || 0),
    growth: Number(overview?.weekGrowth[type] || 0), color: COLORS[index],
  }));
  const pieData = contentDistribution.filter(item => item.value > 0);
  const trendData = useMemo(() => (trend?.dates || []).map(date => {
    const point: Record<string, string | number> = { date: date.slice(5) };
    TYPE_ORDER.forEach(type => { point[TYPE_LABELS[type]] = Number(trend?.series[type]?.[date] || 0); });
    return point;
  }), [trend]);
  const dailyData = useMemo(() => fillDaily(days, operations?.daily || []).map(row => ({ ...row, dateLabel: row.date.slice(5) })), [days, operations]);
  const terminalJobs = (operations?.success || 0) + (operations?.partial || 0) + (operations?.failed || 0) + (operations?.cancelled || 0);
  const successRate = terminalJobs ? (operations?.success || 0) * 100 / terminalJobs : 0;
  const metrics = [
    { label: '内容总量', value: totalContent.toLocaleString(), note: `近 ${days} 天趋势见下方`, icon: Film, tone: 'bg-primary/10 text-primary' },
    { label: '终态成功率', value: `${successRate.toFixed(1)}%`, note: `${operations?.success || 0} / ${terminalJobs} 个终态 Job`, icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    { label: '平均耗时', value: `${((operations?.avgDurationMs || 0) / 1000).toFixed(1)}s`, note: `${operations?.jobs || 0} 个 Job`, icon: Timer, tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
    { label: '数据变更', value: ((operations?.added || 0) + (operations?.updated || 0)).toLocaleString(), note: `新增 ${operations?.added || 0} · 更新 ${operations?.updated || 0}`, icon: Activity, tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
    { label: '失败条目', value: (operations?.failedItems || 0).toLocaleString(), note: `失败 Job ${operations?.failed || 0}`, icon: AlertTriangle, tone: (operations?.failedItems || 0) > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground' },
    { label: '可用资源', value: Number(overview?.resources.total || 0).toLocaleString(), note: `在线 ${overview?.resources.online || 0} · 磁力 ${overview?.resources.magnet || 0} · 网盘 ${overview?.resources.cloud || 0}`, icon: Database, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Analytics workspace</p><h1 className="mt-1 text-2xl font-bold text-foreground">数据统计</h1><p className="mt-1 text-sm text-muted-foreground">面向分析与排障的详细趋势，不重复仪表盘的即时运营摘要。</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-border bg-muted/35 p-1" aria-label="统计周期">{([7, 30] as const).map(value => <button key={value} type="button" onClick={() => setDays(value)} className={`h-7 rounded-lg px-3 text-xs font-semibold ${days === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-pressed={days === value}>近 {value} 天</button>)}</div><Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />刷新</Button><DropdownMenu><DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30" disabled={exporting}>{exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}导出</DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuGroup><DropdownMenuLabel>CSV 数据</DropdownMenuLabel><DropdownMenuItem onClick={() => void downloadCsv(statsApi.exportOverview as () => Promise<AxiosResponse<Blob>>, 'film-forest-overview.csv')}><BarChart3 />运营概览</DropdownMenuItem><DropdownMenuItem onClick={() => void downloadCsv(() => statsApi.exportContent() as Promise<AxiosResponse<Blob>>, 'film-forest-content.csv')}><FileText />全部内容</DropdownMenuItem><DropdownMenuItem onClick={() => void downloadCsv(() => statsApi.exportHotSearch(30) as Promise<AxiosResponse<Blob>>, 'film-forest-hot-search.csv')}><Search />搜索热词</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
      </header>

      {loadIssue && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>部分统计暂不可用：{loadIssue}</span></div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{metrics.map(metric => <Card key={metric.label} className="border-border bg-card"><CardContent className="p-4"><span className={`grid size-9 place-items-center rounded-xl ${metric.tone}`}><metric.icon className="size-4" /></span><p className="mt-3 text-xs text-muted-foreground">{metric.label}</p>{loading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{metric.value}</p>}<p className="mt-1 truncate text-xs text-muted-foreground" title={metric.note}>{metric.note}</p></CardContent></Card>)}</div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ChartCard title="内容增长趋势" note={`按内容类型统计近 ${days} 天每日新增`}>
          {loading ? <Skeleton className="h-72 w-full" /> : !trendData.some(point => TYPE_ORDER.some(type => Number(point[TYPE_LABELS[type]]) > 0)) ? <EmptyChart label="当前周期没有新增内容" /> : <ResponsiveContainer width="100%" height={288}><LineChart data={trendData} margin={{ left: -14, right: 8, top: 8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip isAnimationActive={false} contentStyle={CHART_STYLE} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />{TYPE_ORDER.map((type, index) => <Line key={type} type="monotone" dataKey={TYPE_LABELS[type]} stroke={COLORS[index]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />)}</LineChart></ResponsiveContainer>}
        </ChartCard>
        <ChartCard title="Job 每日结果" note="成功、部分成功、失败和取消按日堆叠；零值日期也保留">
          {loading ? <Skeleton className="h-72 w-full" /> : !dailyData.some(row => row.jobs > 0) ? <EmptyChart label="当前周期没有爬虫 Job" /> : <ResponsiveContainer width="100%" height={288}><BarChart data={dailyData} margin={{ left: -14, right: 8, top: 8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip isAnimationActive={false} contentStyle={CHART_STYLE} cursor={{ fill: 'var(--muted)', opacity: 0.25 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} /><Bar dataKey="success" name="成功" stackId="jobs" fill="#059669" isAnimationActive={false} /><Bar dataKey="partial" name="部分成功" stackId="jobs" fill="#d97706" isAnimationActive={false} /><Bar dataKey="failed" name="失败" stackId="jobs" fill="#dc2626" isAnimationActive={false} /><Bar dataKey="cancelled" name="取消" stackId="jobs" fill="#64748b" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>}
        </ChartCard>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ChartCard title="爬取数据变化" note="新增、更新和单条失败按日对比">
          {loading ? <Skeleton className="h-72 w-full" /> : !dailyData.some(row => row.added + row.updated + row.failedItems > 0) ? <EmptyChart label="当前周期没有数据变更" /> : <ResponsiveContainer width="100%" height={288}><LineChart data={dailyData} margin={{ left: -14, right: 8, top: 8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip isAnimationActive={false} contentStyle={CHART_STYLE} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} /><Line type="monotone" dataKey="added" name="新增" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="updated" name="更新" stroke="#0284c7" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="failedItems" name="失败条目" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>}
        </ChartCard>
        <ChartCard title="内容分布" note="所有类型均展示真实占比，零值明确显示为 0.0%">
          {loading ? <Skeleton className="h-72 w-full" /> : totalContent === 0 ? <EmptyChart label="暂无内容数据" /> : <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2} isAnimationActive={false}>{pieData.map(item => <Cell key={item.type} fill={item.color} />)}</Pie><Tooltip isAnimationActive={false} contentStyle={CHART_STYLE} formatter={(value, name) => [`${Number(value).toLocaleString()} 条 · ${(Number(value) * 100 / totalContent).toFixed(1)}%`, name]} /></PieChart></ResponsiveContainer><div className="space-y-2">{contentDistribution.map(item => <div key={item.type} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-muted-foreground">{item.name}</span><span className="font-medium tabular-nums text-foreground">{item.value.toLocaleString()} · {(item.value * 100 / totalContent).toFixed(1)}%</span></div>)}</div></div>}
        </ChartCard>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ChartCard title="可用资源结构" note="仅统计已启用、未删除且未被来源判定失效的资源">
          <div className="grid grid-cols-3 gap-3">{[
            { label: '在线', value: overview?.resources.online || 0, icon: RadioTower, tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
            { label: '磁力', value: overview?.resources.magnet || 0, icon: Link2, tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
            { label: '网盘', value: overview?.resources.cloud || 0, icon: Cloud, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
          ].map(item => <div key={item.label} className="rounded-xl border border-border bg-muted/20 p-4"><span className={`grid size-8 place-items-center rounded-lg ${item.tone}`}><item.icon className="size-4" /></span><p className="mt-3 text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{loading ? '-' : Number(item.value).toLocaleString()}</p></div>)}</div>
        </ChartCard>
        <ChartCard title="热门搜索" note="近 30 天真实搜索日志 Top 10">
          {loading ? <Skeleton className="h-44 w-full" /> : hotSearch.length === 0 ? <div className="grid h-44 place-items-center text-sm text-muted-foreground">暂无搜索日志</div> : <div className="grid gap-2 sm:grid-cols-2">{hotSearch.map((item, index) => <div key={item.keyword} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-background text-xs font-bold text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.keyword}</span><Badge variant="outline">{item.count}</Badge></div>)}</div>}
        </ChartCard>
      </div>

      <ChartCard title="来源健康度" note={`近 ${days} 天按来源聚合运行结果与平均耗时`}>
        {loading ? <Skeleton className="h-40 w-full" /> : !operations?.sourceHealth.length ? <div className="grid h-36 place-items-center text-sm text-muted-foreground">暂无来源运行记录</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/20"><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-3 py-2.5 text-left font-medium">来源</th><th className="px-3 py-2.5 text-center font-medium">Job</th><th className="px-3 py-2.5 text-center font-medium">成功</th><th className="px-3 py-2.5 text-center font-medium">部分成功</th><th className="px-3 py-2.5 text-center font-medium">失败</th><th className="px-3 py-2.5 text-center font-medium">取消</th><th className="px-3 py-2.5 text-center font-medium">平均耗时</th></tr></thead><tbody className="divide-y divide-border/45">{operations.sourceHealth.map(source => <tr key={source.source} className="transition-colors hover:bg-muted/15"><td className="px-3 py-3 font-medium text-foreground">{source.source}</td><td className="px-3 py-3 text-center tabular-nums text-foreground">{source.jobs}</td><td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-300">{source.success}</td><td className="px-3 py-3 text-center tabular-nums text-amber-700 dark:text-amber-300">{source.partial}</td><td className="px-3 py-3 text-center tabular-nums text-destructive">{source.failed}</td><td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{source.cancelled}</td><td className="px-3 py-3 text-center tabular-nums text-foreground">{(source.avgDurationMs / 1000).toFixed(1)}s</td></tr>)}</tbody></table></div>}
      </ChartCard>

      <ChartCard title="内容质量" note="豆瓣评分完整性与区间分布，用于发现爬取字段缺失">
        {loading ? <Skeleton className="h-48 w-full" /> : !report?.qualityStats?.length ? <div className="grid h-36 place-items-center text-sm text-muted-foreground">暂无质量统计</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/20"><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-3 py-2.5 text-left font-medium">类型</th><th className="px-3 py-2.5 text-center font-medium">总量</th><th className="px-3 py-2.5 text-center font-medium">均分</th><th className="px-3 py-2.5 text-center font-medium">高分 ≥ 8</th><th className="px-3 py-2.5 text-center font-medium">中分 5–8</th><th className="px-3 py-2.5 text-center font-medium">低分 &lt; 5</th></tr></thead><tbody className="divide-y divide-border/45">{report.qualityStats.map(item => <tr key={item.type} className="transition-colors hover:bg-muted/15"><td className="px-3 py-3 font-medium text-foreground">{item.label || TYPE_LABELS[item.type] || item.type}</td><td className="px-3 py-3 text-center tabular-nums text-foreground">{item.total}</td><td className="px-3 py-3 text-center tabular-nums text-foreground">{item.avgScore > 0 ? item.avgScore.toFixed(1) : '—'}</td><td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-300">{item.highScore}</td><td className="px-3 py-3 text-center tabular-nums text-amber-700 dark:text-amber-300">{item.midScore}</td><td className="px-3 py-3 text-center tabular-nums text-destructive">{item.lowScore}</td></tr>)}</tbody></table></div>}
      </ChartCard>
    </div>
  );
}
