'use client';

import { useEffect, useState, useCallback } from 'react';
import { crawlerApi, type CrawlerSchedule } from '@/lib/api';
import { Play, Square, ToggleLeft, ToggleRight, Clock, Activity, Database } from 'lucide-react';

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

const TYPE_MAP: Record<string, string> = {
  movie: '🎬 电影', drama: '📺 剧集', variety: '🎤 综艺', anime: '🎯 动漫', short: '⚡ 短剧'
};

const PRIORITY_MAP: Record<string, string> = {
  by_score: '按评分', by_hot: '按热度'
};

export default function CrawlerPage() {
  const [schedules, setSchedules] = useState<CrawlerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, running: 0, idle: 0 });

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await crawlerApi.getStatus() as any;
      const data = res.data?.schedules || [];
      setSchedules(data);
      setStats({
        total: data.length,
        running: data.filter((s: any) => s.status === 'running').length,
        idle: data.filter((s: any) => s.status === 'idle').length,
      });
    } catch (e) {
      console.error('fetch schedules error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleStart = async (id: number) => {
    setActionId(id);
    try {
      await crawlerApi.start(id);
      await fetchSchedules();
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleStop = async (id: number) => {
    setActionId(id);
    try {
      await crawlerApi.stop(id);
      await fetchSchedules();
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleToggle = async (schedule: CrawlerSchedule) => {
    const newEnabled = schedule.enabled === 1 ? 0 : 1;
    try {
      await crawlerApi.toggleEnabled(schedule.id, newEnabled === 1);
      await fetchSchedules();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">爬虫管理</h1>
        <p className="text-sm text-muted-foreground mt-1">配置定时爬虫任务，监控抓取进度</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Database className="w-8 h-8 text-emerald-500 opacity-60 shrink-0" />
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">配置总数</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Activity className="w-8 h-8 text-amber-500 opacity-60 shrink-0" />
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">运行中</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.running}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Clock className="w-8 h-8 text-zinc-500 opacity-60 shrink-0" />
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">空闲</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.idle}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto -webkit-overflow-scrolling-touch">
        <div className="min-w-[700px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="text-left p-3 font-medium text-muted-foreground">配置名称</th>
              <th className="text-left p-3 font-medium text-muted-foreground">类型</th>
              <th className="text-left p-3 font-medium text-muted-foreground">定时间隔</th>
              <th className="text-left p-3 font-medium text-muted-foreground">每次爬取</th>
              <th className="text-left p-3 font-medium text-muted-foreground">请求间隔</th>
              <th className="text-left p-3 font-medium text-muted-foreground">优先级</th>
              <th className="text-left p-3 font-medium text-muted-foreground">上次执行</th>
              <th className="text-left p-3 font-medium text-muted-foreground">累计</th>
              <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
              <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">暂无配置</td></tr>
            ) : schedules.map((s) => {
              const isRunning = s.status === 'running';
              const isLoading = actionId === s.id;
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium text-foreground">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{TYPE_MAP[s.contentType] || s.contentType}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{s.cronExpression}</td>
                  <td className="p-3 text-muted-foreground">{s.batchSize} 条/次</td>
                  <td className="p-3 text-muted-foreground">{s.rateLimitMs} ms</td>
                  <td className="p-3 text-muted-foreground">{PRIORITY_MAP[s.priority] || s.priority}</td>
                  <td className="p-3 text-muted-foreground">{timeAgo(s.lastRunTime)}</td>
                  <td className="p-3 text-muted-foreground">{s.totalRuns}次 / {s.totalItems}条</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700/50 text-zinc-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                      {isRunning ? '运行中' : '空闲'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRunning ? (
                        <button
                          onClick={() => handleStop(s.id)}
                          disabled={isLoading}
                          className="p-1.5 rounded hover:bg-red-500/20 text-red-400 disabled:opacity-50 transition-colors"
                          title="停止"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart(s.id)}
                          disabled={isLoading}
                          className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50 transition-colors"
                          title="启动"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggle(s)}
                        className="p-1.5 rounded hover:bg-zinc-700/50 text-muted-foreground transition-colors"
                        title={s.enabled ? '禁用' : '启用'}
                      >
                        {s.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}