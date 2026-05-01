'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Film, Search, Plus, Edit, Trash2, Eye, ToggleLeft, ToggleRight, MoreHorizontal } from 'lucide-react';

interface ContentItem {
  id: number;
  title: string;
  type: 'movie' | 'drama' | 'variety' | 'anime' | 'short';
  cover?: string;
  year: number;
  region: string;
  rating?: number;
  status: number; // 0=下线 1=上线
  verifyStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short: '短剧'
};

const TYPE_COLORS: Record<string, string> = {
  movie: 'text-blue-400', drama: 'text-purple-400', variety: 'text-amber-400', anime: 'text-red-400', short: 'text-emerald-400'
};

// Mock data
const MOCK_DATA: ContentItem[] = [
  { id: 1, title: '流浪地球3', type: 'movie', cover: 'https://picsum.photos/seed/m1/300/450', year: 2026, region: '大陆', rating: 9.2, status: 1, verifyStatus: 'approved', createdAt: '2026-04-30' },
  { id: 2, title: '满江红2', type: 'movie', cover: 'https://picsum.photos/seed/m2/300/450', year: 2026, region: '大陆', rating: 8.8, status: 1, verifyStatus: 'approved', createdAt: '2026-04-29' },
  { id: 3, title: '咒术回战3', type: 'anime', cover: 'https://picsum.photos/seed/a1/300/450', year: 2026, region: '日本', rating: 9.1, status: 1, verifyStatus: 'pending', createdAt: '2026-04-30' },
  { id: 4, title: '繁花', type: 'drama', cover: 'https://picsum.photos/seed/d1/300/450', year: 2025, region: '大陆', rating: 8.5, status: 1, verifyStatus: 'approved', createdAt: '2026-04-28' },
  { id: 5, title: '奔跑吧兄弟10', type: 'variety', cover: 'https://picsum.photos/seed/v1/300/450', year: 2026, region: '大陆', rating: 7.8, status: 0, verifyStatus: 'pending', createdAt: '2026-04-27' },
  { id: 6, title: '霸道总裁爱上我', type: 'short', cover: 'https://picsum.photos/seed/s1/300/450', year: 2026, region: '大陆', status: 1, verifyStatus: 'rejected', createdAt: '2026-04-25' },
];

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifyFilter, setVerifyFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = items.filter((item) => {
    if (keyword && !item.title.includes(keyword)) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (statusFilter !== 'all' && String(item.status) !== statusFilter) return false;
    if (verifyFilter !== 'all' && item.verifyStatus !== verifyFilter) return false;
    return true;
  });

  const handleDelete = (id: number) => {
    if (!confirm('确定删除此内容？')) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const handleToggleStatus = (id: number) => {
    setItems(items.map((i) => i.id === id ? { ...i, status: i.status === 1 ? 0 : 1 } : i));
  };

  const verifyBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
      case 'pending': return 'bg-amber-600/20 text-amber-400 border-amber-500/30';
      case 'rejected': return 'bg-red-600/20 text-red-400 border-red-500/30';
      default: return '';
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
        <Button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-500">
          <Plus className="w-4 h-4 mr-2" /> 新增内容
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '电影', count: items.filter((i) => i.type === 'movie').length, color: 'text-blue-400' },
          { label: '剧集', count: items.filter((i) => i.type === 'drama').length, color: 'text-purple-400' },
          { label: '综艺', count: items.filter((i) => i.type === 'variety').length, color: 'text-amber-400' },
          { label: '动漫/短剧', count: items.filter((i) => i.type === 'anime' || i.type === 'short').length, color: 'text-red-400' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">{stat.label}</span>
              <span className={`text-xl font-bold ${stat.color}`}>{stat.count}</span>
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
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="all">全部分类</option>
              <option value="movie">电影</option>
              <option value="drama">剧集</option>
              <option value="variety">综艺</option>
              <option value="anime">动漫</option>
              <option value="short">短剧</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="all">全部状态</option>
              <option value="1">已上线</option>
              <option value="0">已下线</option>
            </select>
            <select
              value={verifyFilter}
              onChange={(e) => setVerifyFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="all">全部审核</option>
              <option value="approved">已通过</option>
              <option value="pending">待审核</option>
              <option value="rejected">已拒绝</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">内容列表 ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">内容</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">分类</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">年份/地区</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">评分</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">上线状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">审核状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.cover || `https://picsum.photos/seed/${item.type}${item.id}/100/150`}
                          alt={item.title}
                          className="w-10 h-14 object-cover rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <p className="text-xs text-zinc-500">{item.createdAt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${TYPE_COLORS[item.type]}`}>
                        {TYPE_LABELS[item.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {item.year} · {item.region}
                    </td>
                    <td className="px-4 py-3">
                      {item.rating ? (
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30">
                          {item.rating}
                        </Badge>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(item.id)}
                        className={`flex items-center gap-1 text-sm ${item.status === 1 ? 'text-emerald-400' : 'text-zinc-600'}`}
                      >
                        {item.status === 1 ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {item.status === 1 ? '已上线' : '已下线'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border ${verifyBadgeClass(item.verifyStatus)}`}>
                        {item.verifyStatus === 'approved' ? '已通过' : item.verifyStatus === 'pending' ? '待审核' : '已拒绝'}
                      </Badge>
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
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无内容</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}