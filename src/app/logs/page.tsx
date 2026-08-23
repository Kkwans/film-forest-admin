'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Loader2, Activity, CheckCircle2, XCircle, Filter, X } from 'lucide-react';
import { logApi, type LogItem } from '@/lib/api';
import { Select } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { PageSizeControl } from '@/components/PageSizeControl';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { useListPageSize } from '@/hooks/useListPageSize';

interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

interface LogStats {
  total: number;
  today: number;
  failed: number;
}

const ACTION_OPTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'];
const MODULE_OPTIONS = ['', 'USER', 'CONTENT', 'CRAWLER', 'RESOURCE', 'SETTING'];

const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建', UPDATE: '更新', DELETE: '删除', LOGIN: '登录', EXPORT: '导出',
};
const MODULE_LABELS: Record<string, string> = {
  USER: '用户', CONTENT: '内容', CRAWLER: '爬虫', RESOURCE: '资源', SETTING: '设置',
};

export default function LogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const { size, saving: pageSizeSaving, updateSize: updatePageSize } = useListPageSize('operationLogs');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LogStats>({ total: 0, today: 0, failed: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

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

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, size };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (actionFilter) params.action = actionFilter;
      if (moduleFilter) params.module = moduleFilter;
      if (statusFilter !== '') params.status = statusFilter;
      const res = await logApi.list(params);
      if (res.data?.code === 200) {
        const data = res.data.data as PageResult<LogItem>;
        setLogs(data.records);
        setTotal(data.total);
      }
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '加载日志失败'));
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, actionFilter, moduleFilter, statusFilter, toast]);

  const loadStats = useCallback(async () => {
    try {
      const res = await logApi.stats();
      if (res.data?.code === 200) setStats(res.data.data);
    } catch { /* 统计失败不阻断日志列表。 */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStats]);

  const handleReset = () => {
    setKeyword(''); setActionFilter(''); setModuleFilter(''); setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <FileText className="w-6 h-6" /> 操作日志
          </h1>
          <p className="text-sm text-muted-foreground mt-1">系统操作审计记录</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">总日志</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.total.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">今日操作</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.today.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">失败操作</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.failed.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchRef}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜索用户名、目标、详情... (Ctrl+F)"
                className="h-10 pl-10 pr-9 rounded-lg border bg-background text-foreground text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]"
              />
              {keyword && (
                <button
                  onClick={() => { setKeyword(''); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
                  title="清除搜索"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${showFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
              <Filter className="w-4 h-4" /> 筛选
            </button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">操作类型</label>
                <Select
                  value={actionFilter}
                  onChange={v => { setActionFilter(v); setPage(1); }}
                  options={ACTION_OPTIONS.map(a => ({ label: a ? ACTION_LABELS[a] : '全部', value: a }))}
                  className="w-28"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">操作模块</label>
                <Select
                  value={moduleFilter}
                  onChange={v => { setModuleFilter(v); setPage(1); }}
                  options={MODULE_OPTIONS.map(m => ({ label: m ? MODULE_LABELS[m] : '全部', value: m }))}
                  className="w-28"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">状态</label>
                <Select
                  value={statusFilter === '' ? '' : String(statusFilter)}
                  onChange={v => { setStatusFilter(v === '' ? '' : Number(v)); setPage(1); }}
                  options={[{ label: '全部', value: '' }, { label: '成功', value: '1' }, { label: '失败', value: '0' }]}
                  className="w-24"
                />
              </div>
              <button onClick={handleReset} className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                重置
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground text-sm">加载中...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">暂无日志数据</p>
            </div>
          ) : (<>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">时间</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">用户</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">类型</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">模块</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">目标</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">详情</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}</td>
                      <td className="px-5 py-3 text-foreground font-medium">{log.username || '-'}</td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="outline" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-xs text-muted-foreground">{MODULE_LABELS[log.module] || log.module}</span>
                      </td>
                      <td className="px-5 py-3 text-foreground max-w-[200px] truncate">{log.target || '-'}</td>
                      <td className="px-5 py-3 text-muted-foreground max-w-[250px] truncate text-xs">{log.detail || '-'}</td>
                      <td className="px-5 py-3 text-center">
                        {log.status === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> 成功</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive" title={log.errorMessage || ''}><XCircle className="w-3.5 h-3.5" /> 失败</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {logs.map(log => (
                <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(log.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{log.username || '-'}</span>
                    </div>
                    {log.status === 1 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> 成功</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive shrink-0" title={log.errorMessage || ''}><XCircle className="w-3.5 h-3.5" /> 失败</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge variant="outline" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                    <span className="text-xs text-muted-foreground">{MODULE_LABELS[log.module] || log.module}</span>
                    {log.target && <span className="text-xs text-foreground truncate max-w-[160px]">{log.target}</span>}
                  </div>
                  {log.detail && <p className="text-xs text-muted-foreground truncate">{log.detail}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}</p>
                </div>
              ))}
            </div>
          </>)}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageSizeControl value={size} saving={pageSizeSaving} onChange={async value => { await updatePageSize(value); setPage(1); }} />
          <p className="text-sm text-muted-foreground">共 {total} 条，第 {page}/{totalPages} 页</p>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
