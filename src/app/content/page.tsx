'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Film, Search, Plus, Edit, Trash2, Eye, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { contentApi } from '@/lib/api';

interface ContentRecord {
  id: number;
  title: string;
  type: 'movie' | 'drama' | 'variety' | 'anime' | 'short_drama';
  posterUrl?: string;
  year?: number;
  scoreDouban?: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short_drama: '短剧'
};

const TYPE_COLORS: Record<string, string> = {
  movie: 'text-blue-400', drama: 'text-purple-400', variety: 'text-amber-400', anime: 'text-red-400', short_drama: 'text-emerald-400'
};

type FilterType = 'all' | 'movie' | 'drama' | 'variety' | 'anime' | 'short_drama';
type StatusFilter = 'all' | '1' | '0';

export default function ContentPage() {
  const [items, setItems] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let records: ContentRecord[] = [];
      let totalCount = 0;
      const types: FilterType[] = typeFilter === 'all'
        ? ['movie', 'drama', 'variety', 'anime', 'short_drama']
        : [typeFilter];

      const results = await Promise.allSettled(
        types.map(t => {
          const params: any = { page: 1, size: 200 };
          if (keyword) params.keyword = keyword;
          switch (t) {
            case 'movie': return contentApi.listMovies(params);
            case 'drama': return contentApi.listDramas(params);
            case 'variety': return contentApi.listVarieties(params);
            case 'anime': return contentApi.listAnimes(params);
            case 'short_drama': return contentApi.listShortDramas(params);
          }
        })
      );

      let idx = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const res = result.value;
          if (res.data?.code === 200) {
            const recs: ContentRecord[] = (res.data.data.records || []).map((r: any) => ({
              ...r,
              type: types[idx],
            }));
            records.push(...recs);
            totalCount += res.data.data.total || 0;
          }
        }
        idx++;
      }

      // Filter by status
      if (statusFilter !== 'all') {
        records = records.filter(i => String(i.status) === statusFilter);
      }

      // Sort by createdAt desc
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setItems(records);
      setTotal(totalCount);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, keyword]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Stats per type
  const [stats, setStats] = useState({ movies: 0, dramas: 0, varieties: 0, animes: 0, shortDramas: 0 });
  useEffect(() => {
    contentApi.getStats().then(res => {
      if (res.data?.code === 200) setStats(res.data.data);
    }).catch(() => {});
  }, []);

  const filtered = items;
  const typeCountMap: Record<string, number> = {
    movie: stats.movies,
    drama: stats.dramas,
    variety: stats.varieties,
    anime: stats.animes,
    short_drama: stats.shortDramas,
  };

  const handleDelete = async (id: number, type: string) => {
    if (!confirm('确定删除此内容？')) return;
    try {
      let res;
      switch (type) {
        case 'movie': res = await contentApi.deleteMovie(id); break;
        case 'drama': res = await contentApi.deleteDrama(id); break;
        case 'variety': res = await contentApi.deleteVariety(id); break;
        case 'anime': res = await contentApi.deleteAnime(id); break;
        case 'short_drama': res = await contentApi.deleteShortDrama(id); break;
      }
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        setItems(items.filter(i => !(i.id === id && i.type === type)));
        setTotal(t => t - 1);
      } else {
        alert('删除失败');
      }
    } catch {
      alert('删除失败');
    }
  };

  const handleToggleStatus = async (item: ContentRecord) => {
    const newStatus = item.status === 1 ? 0 : 1;
    try {
      let res;
      const data = { ...item, status: newStatus };
      switch (item.type) {
        case 'movie': res = await contentApi.updateMovie(item.id, data); break;
        case 'drama': res = await contentApi.updateDrama(item.id, data); break;
        case 'variety': res = await contentApi.updateVariety(item.id, data); break;
        case 'anime': res = await contentApi.updateAnime(item.id, data); break;
        case 'short_drama': res = await contentApi.updateShortDrama(item.id, data); break;
      }
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        setItems(items.map(i => i.id === item.id && i.type === item.type ? { ...i, status: newStatus } : i));
      } else {
        alert('更新状态失败');
      }
    } catch {
      alert('更新状态失败');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">内容管理</h1>
          <p className="text-sm text-zinc-500 mt-1">管理影视资源内容，审核状态</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-500">
          <Plus className="w-4 h-4 mr-2" /> 新增内容
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '电影', key: 'movie', color: 'text-blue-400' },
          { label: '剧集', key: 'drama', color: 'text-purple-400' },
          { label: '综艺', key: 'variety', color: 'text-amber-400' },
          { label: '动漫/短剧', key: 'anime', color: 'text-red-400' },
        ].map((stat) => (
          <Card key={stat.key} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">{stat.label}</span>
              <span className={`text-xl font-bold ${stat.color}`}>{typeCountMap[stat.key] ?? '-'}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="搜索标题..."
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as FilterType); setPage(1); }}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="all">全部分类</option>
              <option value="movie">电影</option>
              <option value="drama">剧集</option>
              <option value="variety">综艺</option>
              <option value="anime">动漫</option>
              <option value="short_drama">短剧</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="all">全部状态</option>
              <option value="1">已上线</option>
              <option value="0">已下线</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchItems} className="border-zinc-700 text-zinc-400 hover:text-white">
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">
            内容列表 ({loading ? '...' : filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 text-red-400 text-sm bg-red-900/20 border-b border-zinc-800">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">内容</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">分类</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">年份</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">评分</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">上线状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无内容</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.posterUrl || `https://picsum.photos/seed/${item.type}${item.id}/100/150`}
                            alt={item.title}
                            className="w-10 h-14 object-cover rounded"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.type}${item.id}/100/150`; }}
                          />
                          <div>
                            <p className="text-sm font-medium text-white max-w-48 truncate">{item.title}</p>
                            <p className="text-xs text-zinc-500">{item.createdAt?.slice(0, 10)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${TYPE_COLORS[item.type] || 'text-zinc-400'}`}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {item.year || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.scoreDouban ? (
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30">
                            {item.scoreDouban}
                          </Badge>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`flex items-center gap-1 text-sm ${item.status === 1 ? 'text-emerald-400' : 'text-zinc-600'}`}
                        >
                          {item.status === 1
                            ? <ToggleRight className="w-5 h-5" />
                            : <ToggleLeft className="w-5 h-5" />}
                          {item.status === 1 ? '已上线' : '已下线'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" title="预览">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" title="编辑">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.type)}
                            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}