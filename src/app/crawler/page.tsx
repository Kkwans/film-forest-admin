'use client';

import { useEffect, useState, useCallback } from 'react';
import { crawlerApi, type CrawlerSchedule } from '@/lib/api';
import { Play, Square, ToggleLeft, ToggleRight, Clock, Activity, Database, Plus, Pencil, Trash2, X, Save, RefreshCw } from 'lucide-react';

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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

const PRIORITY_OPTIONS = [
  { label: '按评分从高到低', value: 'by_score' },
  { label: '按热度从高到低', value: 'by_hot' },
];

const CRON_PRESETS = [
  { label: '每30分钟', value: '*/30 * * * *' },
  { label: '每1小时', value: '0 * * * *' },
  { label: '每6小时', value: '0 */6 * * *' },
  { label: '每12小时', value: '0 */12 * * *' },
  { label: '每天凌晨2点', value: '0 2 * * *' },
  { label: '每周一凌晨2点', value: '0 2 * * 1' },
];

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
  sourceSite: 'pkmp4',
  cronExpression: '0 2 * * *',
  batchSize: 20,
  rateLimitMs: 1000,
  priority: 'by_score',
  genreFilter: '',
  enabled: 1,
};

export default function CrawlerPage() {
  const [schedules, setSchedules] = useState<CrawlerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, running: 0, idle: 0 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await crawlerApi.getStatus() as any;
      const data = res.data?.schedules || [];
      setSchedules(data);
      setStats({
        total: data.length,
        running: data.filter((s: any) => s.status === 'running').length,
        idle: data.filter((s: any) => s.status !== 'running').length,
      });
    } catch (e) {
      console.error('fetch schedules error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleStart = async (id: number) => {
    setActionId(id);
    try { await crawlerApi.start(id); await fetchSchedules(); } catch (e) { console.error(e); } finally { setActionId(null); }
  };

  const handleStop = async (id: number) => {
    setActionId(id);
    try { await crawlerApi.stop(id); await fetchSchedules(); } catch (e) { console.error(e); } finally { setActionId(null); }
  };

  const handleToggle = async (schedule: CrawlerSchedule) => {
    try { await crawlerApi.toggleEnabled(schedule.id, schedule.enabled !== 1); await fetchSchedules(); } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此配置？')) return;
    try { await crawlerApi.deleteSchedule(id); await fetchSchedules(); } catch (e) { console.error(e); }
  };

  const handleEdit = (schedule: CrawlerSchedule) => {
    setForm({
      id: schedule.id,
      name: schedule.name,
      contentType: schedule.contentType,
      sourceSite: schedule.sourceSite,
      cronExpression: schedule.cronExpression,
      batchSize: schedule.batchSize,
      rateLimitMs: schedule.rateLimitMs,
      priority: schedule.priority,
      genreFilter: schedule.genreFilter || '',
      enabled: schedule.enabled,
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await crawlerApi.saveSchedule(form);
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchSchedules();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleCreateNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">爬虫管理</h1>
          <p className="text-sm text-muted-foreground mt-1">配置定时爬虫任务，监控抓取进度</p>
        </div>
        <button onClick={handleCreateNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
          <Plus className="w-4 h-4" /> 新建配置
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Database className="w-6 h-6 text-emerald-500 opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">配置总数</p><p className="text-xl font-bold text-foreground">{stats.total}</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Activity className="w-6 h-6 text-amber-500 opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">运行中</p><p className="text-xl font-bold text-foreground">{stats.running}</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Clock className="w-6 h-6 text-zinc-500 opacity-60 shrink-0" />
          <div><p className="text-xs text-muted-foreground">空闲</p><p className="text-xl font-bold text-foreground">{stats.idle}</p></div>
        </div>
      </div>

      {/* Config Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">{editingId ? '编辑配置' : '新建配置'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">配置名称</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="如：电影每日爬取" className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">内容类型</label>
                <select value={form.contentType} onChange={e => setForm({...form, contentType: e.target.value})} className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm">
                  {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">优先级</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm">
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">类型筛选（可选，留空爬全部）</label>
                <input value={form.genreFilter} onChange={e => setForm({...form, genreFilter: e.target.value})} placeholder="如：爱情,科幻（逗号分隔）" className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">定时规则</label>
                <select value={form.cronExpression} onChange={e => setForm({...form, cronExpression: e.target.value})} className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm">
                  {CRON_PRESETS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">每批数量</label>
                  <input type="number" min={1} max={1000} value={form.batchSize} onChange={e => setForm({...form, batchSize: Math.min(1000, Math.max(1, Number(e.target.value)))})} className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm" />
                  <p className="text-xs text-muted-foreground">1-1000</p>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">请求间隔 (ms)</label>
                  <input type="number" min={200} step={100} value={form.rateLimitMs} onChange={e => setForm({...form, rateLimitMs: Math.max(200, Number(e.target.value))})} className="h-9 px-3 rounded-lg border bg-background text-foreground text-sm" />
                  <p className="text-xs text-muted-foreground">最小 200ms</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">启用</label>
                <button type="button" onClick={() => setForm({...form, enabled: form.enabled ? 0 : 1})} className={`w-10 h-5 rounded-full relative transition-colors ${form.enabled ? 'bg-emerald-600' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.enabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="text-left p-3 font-medium text-muted-foreground">名称</th>
              <th className="text-left p-3 font-medium text-muted-foreground">类型</th>
              <th className="text-left p-3 font-medium text-muted-foreground">定时</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">批量</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">间隔</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">优先级</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">上次</th>
              <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
              <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">暂无配置，点击"新建配置"开始</td></tr>
            ) : schedules.map((s) => {
              const isRunning = s.status === 'running';
              const isLoading = actionId === s.id;
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium text-foreground">{s.name}</td>
                  <td className="p-3 text-muted-foreground text-xs">{TYPE_MAP[s.contentType] || s.contentType}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{s.cronExpression}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{s.batchSize}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{s.rateLimitMs}ms</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">{PRIORITY_OPTIONS.find(o => o.value === s.priority)?.label || s.priority}</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell text-xs">{timeAgo(s.lastRunTime)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isRunning ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      {isRunning ? '运行中' : '空闲'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRunning ? (
                        <button onClick={() => handleStop(s.id)} disabled={isLoading} className="p-1.5 rounded hover:bg-red-500/20 text-red-500 disabled:opacity-50" title="停止">
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleStart(s.id)} disabled={isLoading} className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 disabled:opacity-50" title="启动">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleToggle(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title={s.enabled ? '禁用' : '启用'}>
                        {s.enabled ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="编辑">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-500" title="删除">
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
    </div>
  );
}
