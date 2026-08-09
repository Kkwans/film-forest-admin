'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Inbox, Download, FileText, Loader2 } from 'lucide-react';
import { statsApi, contentApi, crawlerApi, type CrawlerSchedule } from '@/lib/api';
import type { AxiosResponse } from 'axios';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ---- Types ----
interface Stats { movies: number; dramas: number; varieties: number; animes: number; shortDramas: number; }
interface DailyStatsItem { date: string; dateLabel: string; runs: number; items: number; added: number; updated: number; }
interface CrawlerStats { total: number; running: number; idle: number; totalRuns: number; totalItems: number; schedules: CrawlerScheduleItem[]; }
interface CrawlerScheduleItem { name: string; contentType: string; totalRuns: number; totalItems: number; status: string; }
interface CrawlerStatusResult { code: number; data: CrawlerStatusResponse; }
interface CrawlerStatusResponse { total: number; running: number; idle: number; schedules: CrawlerScheduleItem[]; }
interface ApiResult<T> { code: number; data: T; }

interface OverviewData {
  typeCounts: Record<string, number>;
  totalContent: number;
  weekGrowth: Record<string, number>;
  totalWeekGrowth: number;
  crawler: { totalRuns: number; successRuns: number; failedRuns: number; successRate: number; totalItemsCrawled: number; };
  resources: { online: number; magnet: number; cloud: number; total: number; };
  totalUsers: number;
}

interface TrendData {
  dates: string[];
  series: Record<string, Record<string, number>>;
  labels: Record<string, string>;
}

interface HotSearchItem {
  keyword: string;
  count: number;
  lastSearchAt: string;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];
const TYPE_LABELS: Record<string, string> = { movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short_drama: '短剧', short: '短剧' };
const TYPE_ICONS: Record<string, string> = { movie: '🎬', drama: '📺', variety: '🎤', anime: '🎯', short_drama: '⚡' };
const TYPE_ORDER = ['movie', 'drama', 'variety', 'anime', 'short_drama'];

interface ReportData {
  days: number;
  startDate: string;
  endDate: string;
  typeGrowth: Array<{ type: string; label: string; count: number }>;
  crawlerEfficiency: { totalRuns: number; successRuns: number; failedRuns: number; totalItems: number; totalAdded: number; totalUpdated: number; avgDurationMs: number; successRate: number; };
  qualityStats: Array<{ type: string; label: string; total: number; highScore: number; midScore: number; lowScore: number; avgScore: number; }>;
  dailyTrend: { dates: string[]; totals: number[]; };
}

/** 饼图 Tooltip — 提取到组件外部避免重渲染 */
function PieTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ name: string; value: number }>; total: number }) {
  if (active && payload?.length) {
    const d = payload[0];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    return (<div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg"><p className="text-foreground text-sm font-medium">{d.name}</p><p className="text-muted-foreground text-xs">{d.value.toLocaleString()} 条 ({pct}%)</p></div>);
  }
  return null;
}

export default function StatsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [crawlerStats, setCrawlerStats] = useState<CrawlerStats>({ total: 0, running: 0, idle: 0, totalRuns: 0, totalItems: 0, schedules: [] });
  const [dailyStats, setDailyStats] = useState<DailyStatsItem[]>([]);
  const [hotSearch, setHotSearch] = useState<HotSearchItem[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'charts' | 'report'>('charts');
  const [exporting, setExporting] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [reportDays, setReportDays] = useState(30);
  const toast = useToast();

  const downloadCsv = useCallback(async (fetchFn: () => Promise<AxiosResponse<Blob>>, filename: string, label: string) => {
    setExporting(label);
    try {
      const res = await fetchFn();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${label}导出成功`);
    } catch (e: unknown) {
      toast.error(`${label}导出失败`);
    } finally {
      setExporting(null);
    }
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, trendRes, crawlerRes, dailyRes, hotSearchRes] = await Promise.all([
          statsApi.getOverview() as Promise<AxiosResponse<ApiResult<OverviewData>>>,
          statsApi.getTrend(30) as Promise<AxiosResponse<ApiResult<TrendData>>>,
          crawlerApi.getStatus() as Promise<AxiosResponse<CrawlerStatusResult>>,
          crawlerApi.getDailyStats() as Promise<AxiosResponse<ApiResult<DailyStatsItem[]>>>,
          statsApi.getHotSearch(30, 15) as Promise<AxiosResponse<ApiResult<HotSearchItem[]>>>,
        ]);

        if (overviewRes.data?.code === 200) setOverview(overviewRes.data.data);
        if (trendRes.data?.code === 200) setTrend(trendRes.data.data);
        if (crawlerRes.data?.code === 200) {
          const d = crawlerRes.data.data;
          const schedules = d.schedules || [];
          setCrawlerStats({
            total: d.total || 0, running: d.running || 0, idle: d.idle || 0,
            totalRuns: schedules.reduce((s: number, x: CrawlerScheduleItem) => s + (x.totalRuns || 0), 0),
            totalItems: schedules.reduce((s: number, x: CrawlerScheduleItem) => s + (x.totalItems || 0), 0),
            schedules,
          });
        }
        if (dailyRes.data?.code === 200) setDailyStats(dailyRes.data.data || []);
        if (hotSearchRes.data?.code === 200) setHotSearch(hotSearchRes.data.data || []);
      } catch (e: unknown) {
        toast.error(extractErrorMessage(e, '统计数据加载失败'));
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // ---- Derived data ----
  const total = overview?.totalContent ?? 0;
  const pieData = overview ? TYPE_ORDER.map(t => ({ name: TYPE_LABELS[t] || t, value: overview.typeCounts[t] || 0 })).filter(d => d.value > 0) : [];
  const barData = crawlerStats.schedules.map(s => ({ name: (TYPE_LABELS[s.contentType] || s.contentType).replace(/.*\s/, ''), runs: s.totalRuns || 0, items: s.totalItems || 0 }));
  const contentStats = overview ? TYPE_ORDER.map(t => ({ label: TYPE_LABELS[t] || t, value: overview.typeCounts[t] || 0, icon: TYPE_ICONS[t] || '📄', growth: overview.weekGrowth[t] || 0 })) : [];

  // Build trend chart data from the new trend API
  const trendChartData = trend ? trend.dates.map(date => {
    const point: Record<string, string | number> = { date: date.slice(5) }; // MM-DD
    for (const t of TYPE_ORDER) {
      point[TYPE_LABELS[t] || t] = trend.series[t]?.[date] || 0;
    }
    return point;
  }) : [];



  useEffect(() => {
    if (activeTab === 'report' && !report && !loading) {
      statsApi.getReport(reportDays).then(res => {
        if (res.data?.code === 200) setReport(res.data.data);
      }).catch((e: unknown) => toast.error(extractErrorMessage(e, '报表数据加载失败')));
    }
  }, [activeTab, reportDays, report, loading]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header with tabs and export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">数据统计</h1>
          <p className="text-sm text-muted-foreground">内容数据与爬虫运行详细分析</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'charts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> 图表</span>
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'report' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> 报表</span>
            </button>
          </div>
          {/* Export dropdown - click-based for mobile compatibility */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={exporting !== null}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting ? '导出中...' : '导出'}
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button onClick={() => { downloadCsv(statsApi.exportOverview, 'film-forest-overview.csv', '概览数据'); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">📊 概览数据</button>
                    <button onClick={() => { downloadCsv(() => statsApi.exportContent(), 'film-forest-content-all.csv', '全部内容'); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">📋 全部内容</button>
                    <button onClick={() => { downloadCsv(() => statsApi.exportContent('movie'), 'film-forest-movies.csv', '电影列表'); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">🎬 电影列表</button>
                    <button onClick={() => { downloadCsv(() => statsApi.exportContent('drama'), 'film-forest-dramas.csv', '剧集列表'); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">📺 剧集列表</button>
                    <button onClick={() => { downloadCsv(() => statsApi.exportHotSearch(30), 'film-forest-hot-search.csv', '搜索热词'); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">🔥 搜索热词</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="stat-card relative overflow-hidden rounded-xl bg-card border border-primary/20 p-4 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <span className="text-lg">📊</span>
            </div>
            <p className="text-xs text-primary/70 mb-1 font-medium">内容总量</p>
            <p className="text-xl font-bold text-primary tabular-nums">{loading ? <Skeleton className="h-5 w-14" /> : total.toLocaleString()}</p>
            {overview && overview.totalWeekGrowth > 0 && <p className="text-xs mt-1 text-emerald-500 font-medium">+{overview.totalWeekGrowth} 本周</p>}
          </div>
        </div>
        <div className="stat-card relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2">
              <span className="text-lg">🤖</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">爬虫成功率</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{loading ? <Skeleton className="h-5 w-14" /> : `${overview?.crawler.successRate ?? 0}%`}</p>
            <p className="text-xs mt-1 text-muted-foreground">{overview?.crawler.totalRuns ?? 0} 次运行</p>
          </div>
        </div>
        <div className="stat-card relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
              <span className="text-lg">📦</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">资源总数</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{loading ? <Skeleton className="h-5 w-14" /> : (overview?.resources.total ?? 0).toLocaleString()}</p>
            <p className="text-xs mt-1 text-muted-foreground">在线 {overview?.resources.online ?? 0} · 磁力 {overview?.resources.magnet ?? 0}</p>
          </div>
        </div>
        <div className="stat-card relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
              <span className="text-lg">👥</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">用户数</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{loading ? <Skeleton className="h-5 w-14" /> : (overview?.totalUsers ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Content Type Cards (charts tab only) */}
      {activeTab === 'charts' && <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {contentStats.map((stat, i) => (
          <div key={stat.label} className="relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:border-foreground/10 transition-colors group">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-foreground">{loading ? <Skeleton className="h-5 w-14" /> : stat.value.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              {total > 0 && <span className="text-xs" style={{ color: COLORS[i] }}>{((stat.value / total) * 100).toFixed(1)}%</span>}
              {stat.growth > 0 && <span className="text-xs text-green-500 ml-auto">+{stat.growth}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Content Growth Trend (30 days) */}
      <ErrorBoundary moduleName="内容增长趋势">
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-primary" /> 内容增长趋势（近30天）</h3></div>
        <div className="p-5">
          {loading ? <div className="h-64 flex items-center justify-center"><Skeleton className="w-full h-48" /></div>
          : !trend || trendChartData.length === 0 || trendChartData.every(d => TYPE_ORDER.every(t => (d[TYPE_LABELS[t] || t] as number) === 0)) ?
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><Inbox className="w-10 h-10 mb-2 opacity-40" /><p className="text-sm">暂无增长数据</p></div>
          : (<ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip isAnimationActive={false} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
                {TYPE_ORDER.map((t, i) => (
                  <Line key={t} type="monotone" dataKey={TYPE_LABELS[t] || t} stroke={COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>)}
        </div>
      </div>

      </ErrorBoundary>

      {/* Crawler Trend Line Chart (7 days) */}
      <ErrorBoundary moduleName="爬虫运行趋势">
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-blue-500" /> 爬虫运行趋势（近7天）</h3></div>
        <div className="p-5">
          {loading ? <div className="h-64 flex items-center justify-center"><Skeleton className="w-full h-48" /></div>
          : dailyStats.length === 0 || dailyStats.every(d => d.runs === 0) ? <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><Inbox className="w-10 h-10 mb-2 opacity-40" /><p className="text-sm">暂无运行数据</p></div>
          : (<ResponsiveContainer width="100%" height={280}><LineChart data={dailyStats} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} /><YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip isAnimationActive={false} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} /><Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} /><Line type="monotone" dataKey="items" name="抓取量" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="added" name="新增" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="updated" name="更新" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="runs" name="运行次数" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4, fill: '#8B5CF6' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>)}
        </div>
      </div>
      </ErrorBoundary>

      {/* Hot Search Keywords */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-amber-500" /> 热门搜索词（近30天）
          </h3>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : hotSearch.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
              <Inbox className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">暂无搜索数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {hotSearch.map((item, i) => {
                const maxCount = hotSearch[0]?.count || 1;
                const pct = (item.count / maxCount) * 100;
                const barColors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                const colorClass = barColors[i % barColors.length];
                return (
                  <div key={item.keyword} className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-foreground/10 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <span className="text-sm font-medium text-foreground truncate">{item.keyword}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-[width] duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{item.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <ErrorBoundary moduleName="内容分布图表">
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-violet-500" /> 内容分布</h3></div>
          <div className="p-5 flex flex-col items-center">
            {loading ? <div className="h-64 flex items-center justify-center"><Skeleton className="w-48 h-48 rounded-full" /></div>
            : pieData.length === 0 ? <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><Inbox className="w-10 h-10 mb-2 opacity-40" /><p className="text-sm">暂无数据</p></div>
            : (<><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">{pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip isAnimationActive={false} content={<PieTooltip total={total} />} /></PieChart></ResponsiveContainer><div className="flex flex-wrap justify-center gap-4 mt-2">{pieData.map((d, i) => <div key={d.name} className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} /><span className="text-muted-foreground">{d.name}</span><span className="text-foreground font-medium">{d.value}</span></div>)}</div></>)}
          </div>
        </div>
        </ErrorBoundary>
        {/* Bar Chart */}
        <ErrorBoundary moduleName="爬虫运行统计">
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-emerald-500" /> 爬虫运行统计</h3></div>
          <div className="p-5">
            {loading ? <div className="h-64 flex items-center justify-center"><div className="flex items-end gap-3 h-48">{[60, 100, 80, 120, 70].map((h, i) => <Skeleton key={i} className="w-12 rounded-t" style={{ height: `${h}px` }} />)}</div></div>
            : barData.length === 0 ? <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><Inbox className="w-10 h-10 mb-2 opacity-40" /><p className="text-sm">暂无爬虫配置</p></div>
            : (<ResponsiveContainer width="100%" height={260}><BarChart data={barData} barGap={4} barCategoryGap="20%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} /><YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip isAnimationActive={false} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} /><Bar dataKey="runs" name="运行次数" fill="#3B82F6" radius={[4, 4, 0, 0]} /><Bar dataKey="items" name="抓取量" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}
          </div>
        </div>
        </ErrorBoundary>
      </div>

      {/* Content Distribution Bars */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-rose-500" /> 内容占比详情</h3></div>
        <div className="p-5">
          <div className="text-3xl font-bold text-foreground mb-6">{loading ? <Skeleton className="h-8 w-24 inline-block" /> : total.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">内容总量</span></div>
          <div className="space-y-4">
            {total > 0 && contentStats.map((stat, i) => { const pct = (stat.value / total) * 100; return (
              <div key={stat.label}><div className="flex justify-between text-sm mb-2"><div className="flex items-center gap-2"><span className="text-lg">{stat.icon}</span><span className="text-muted-foreground">{stat.label}</span></div><div className="flex items-center gap-2"><span className="text-foreground font-medium">{stat.value.toLocaleString()}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS[i] + '20', color: COLORS[i] }}>{pct.toFixed(1)}%</span></div></div><div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS[i] }} /></div></div>
            ); })}
          </div>
        </div>
      </div>

      {/* Crawler Details */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60"><h3 className="font-semibold text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-blue-500" /> 爬虫配置详情</h3></div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crawlerStats.schedules.map((s) => { const isRunning = s.status === 'running'; const pct = crawlerStats.totalItems > 0 ? ((s.totalItems || 0) / crawlerStats.totalItems * 100) : 0; return (
            <div key={s.name} className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-foreground/10 transition-colors">
              <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} /><span className="text-sm font-medium text-foreground truncate">{s.name}</span></div><span className={`text-xs px-2 py-0.5 rounded-full ${isRunning ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{isRunning ? '运行中' : '空闲'}</span></div>
              <div className="grid grid-cols-2 gap-3 mb-3"><div><p className="text-xs text-muted-foreground">运行次数</p><p className="text-lg font-bold text-foreground">{s.totalRuns?.toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">抓取量</p><p className="text-lg font-bold text-foreground">{s.totalItems?.toLocaleString()}</p></div></div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
              <p className="text-xs text-muted-foreground mt-1">占比 {pct.toFixed(1)}%</p>
            </div>
          ); })}
        </div>
      </div>
      </>}

      {/* ===== Report Tab ===== */}
      {activeTab === 'report' && <>
        {/* Report period selector */}
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => { if (reportDays !== d) { setReportDays(d); setReport(null); } }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${reportDays === d ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-foreground/20'}`}>
              近{d}天
            </button>
          ))}
        </div>

        {!report ? (
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : <>
          {/* Report: Type Growth */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-primary" /> 内容增长报告（近{report.days}天：{report.startDate} ~ {report.endDate}）
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {report.typeGrowth.map((item, i) => (
                  <div key={item.type} className="p-4 rounded-xl bg-secondary/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-2xl font-bold text-foreground">{item.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">新增内容</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Report: Crawler Efficiency */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-blue-500" /> 爬虫效率报告
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">总运行次数</p>
                  <p className="text-xl font-bold text-foreground">{report.crawlerEfficiency.totalRuns.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">成功率</p>
                  <p className="text-xl font-bold text-emerald-500">{report.crawlerEfficiency.successRate}%</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">总抓取量</p>
                  <p className="text-xl font-bold text-foreground">{report.crawlerEfficiency.totalItems.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">平均耗时</p>
                  <p className="text-xl font-bold text-foreground">{(report.crawlerEfficiency.avgDurationMs / 1000).toFixed(1)}s</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">新增内容</p>
                  <p className="text-xl font-bold text-emerald-500">{report.crawlerEfficiency.totalAdded.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">更新内容</p>
                  <p className="text-xl font-bold text-amber-500">{report.crawlerEfficiency.totalUpdated.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">成功次数</p>
                  <p className="text-xl font-bold text-foreground">{report.crawlerEfficiency.successRuns.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">失败次数</p>
                  <p className="text-xl font-bold text-rose-500">{report.crawlerEfficiency.failedRuns.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Report: Content Quality */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-violet-500" /> 内容质量报告（豆瓣评分分布）
              </h3>
            </div>
            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">类型</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">总量</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">均分</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">高分(≥8)</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">中分(5-8)</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">低分{'<'}5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.qualityStats.map(q => (
                      <tr key={q.type} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2.5 px-3 font-medium text-foreground">{q.label}</td>
                        <td className="py-2.5 px-3 text-right text-foreground">{q.total.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`font-medium ${q.avgScore >= 7 ? 'text-emerald-500' : q.avgScore >= 5 ? 'text-amber-500' : 'text-rose-500'}`}>
                            {q.avgScore > 0 ? q.avgScore.toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-500">{q.highScore.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-amber-500">{q.midScore.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-rose-500">{q.lowScore.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Report: Daily Trend */}
          {report.dailyTrend && (
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-amber-500" /> 每日新增趋势
                </h3>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={report.dailyTrend.dates.map((d, i) => ({ date: d, 新增: report.dailyTrend.totals[i] }))} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip isAnimationActive={false} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
                    <Bar dataKey="新增" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>}
      </>}
    </div>
  );
}
