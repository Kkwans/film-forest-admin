'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, HardDrive, Link2, Server, RefreshCw, ExternalLink } from 'lucide-react';
import { resourceApi } from '@/lib/api';

interface ResourceStats {
  online: number;
  magnet: number;
  todayNew: number;
}

interface MagnetResource {
  id: number;
  contentType: string;
  contentId: number;
  episodeId: number | null;
  title: string;
  magnetUrl: string;
  resolution: string;
  hasSubtitle: boolean;
  isSpecialSub: boolean;
  sort: number;
  createdAt: string;
}

const SOURCE_SITES = [
  { name: '七味网', url: 'https://www.qwsect.com', status: 'active' as const },
  { name: '天堂资源', url: '#', status: 'inactive' as const },
  { name: '非凡资源', url: '#', status: 'inactive' as const },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

export default function ResourcesPage() {
  const [stats, setStats] = useState<ResourceStats>({ online: 0, magnet: 0, todayNew: 0 });
  const [magnets, setMagnets] = useState<MagnetResource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, magnetRes] = await Promise.all([
        resourceApi.getStats() as Promise<any>,
        resourceApi.listMagnet() as Promise<any>,
      ]);
      setStats(statsRes.data?.data || { online: 0, magnet: 0, todayNew: 0 });
      setMagnets((magnetRes.data?.data || []).slice(0, 50));
    } catch (e) {
      console.error('fetch resource data error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">资源管理</h1>
          <p className="text-sm text-zinc-500 mt-1">媒体资源存储与来源管理</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '在线资源', value: stats.online, icon: HardDrive, color: 'text-blue-400' },
          { label: '磁力资源', value: stats.magnet, icon: Link2, color: 'text-emerald-400' },
          { label: '今日新增', value: stats.todayNew, icon: Server, color: 'text-amber-400' },
          { label: '总存储', value: `${Math.round(stats.online + stats.magnet)} 条`, icon: Database, color: 'text-purple-400' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Magnet Resource List */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Link2 className="w-5 h-5" /> 磁力资源列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-zinc-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 加载中...
            </div>
          ) : magnets.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-zinc-600">
              <p>暂无磁力资源记录 — 爬虫抓取后自动更新</p>
            </div>
          ) : (
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <div className="min-w-[600px]">
            <div className="hidden md:block grid grid-cols-12 gap-2 text-xs text-zinc-500 px-4 py-2 border-b border-zinc-800">
                <div className="col-span-1">类型</div>
                <div className="col-span-2">标题</div>
                <div className="col-span-2">分辨率</div>
                <div className="col-span-2">字幕</div>
                <div className="col-span-4">磁力链接</div>
                <div className="col-span-1">时间</div>
              </div>
              {magnets.map((m) => (
                <>
                  {/* Desktop row */}
                  <div key={`d-${m.id}`} className="hidden md:flex grid-cols-12 gap-2 items-center px-4 py-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors text-sm">
                    <div className="col-span-1">
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                        {m.contentType}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-white truncate" title={m.title}>{m.title}</div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`text-xs ${
                        m.resolution === '1080P' ? 'border-blue-500 text-blue-400' :
                        m.resolution === '4K' ? 'border-purple-500 text-purple-400' :
                        'border-zinc-700 text-zinc-400'
                      }`}>
                        {m.resolution}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-zinc-400 text-xs">
                      {m.hasSubtitle ? '✅ 有字幕' : '—'}
                    </div>
                    <div className="col-span-4 text-zinc-500 text-xs truncate" title={m.magnetUrl}>
                      {m.magnetUrl ? m.magnetUrl.slice(0, 60) + '...' : '-'}
                    </div>
                    <div className="col-span-1 text-zinc-500 text-xs">
                      {formatDate(m.createdAt)}
                    </div>
                  </div>
                  {/* Mobile card */}
                  <div key={`m-${m.id}`} className="md:hidden flex flex-col gap-2 px-4 py-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors text-sm mb-2">
                    <div className="flex items-center gap-2 justify-between">
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                        {m.contentType}
                      </Badge>
                      <span className="text-zinc-500 text-xs">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="text-white text-sm font-medium truncate">{m.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${
                        m.resolution === '1080P' ? 'border-blue-500 text-blue-400' :
                        m.resolution === '4K' ? 'border-purple-500 text-purple-400' :
                        'border-zinc-700 text-zinc-400'
                      }`}>
                        {m.resolution}
                      </Badge>
                      <span className="text-zinc-400 text-xs">{m.hasSubtitle ? '✅ 有字幕' : '—'}</span>
                    </div>
                    <p className="text-zinc-500 text-xs truncate">{m.magnetUrl ? m.magnetUrl.slice(0, 80) + '...' : '-'}</p>
                  </div>
                </>
              ))}
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resource Sources */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Link2 className="w-5 h-5" /> 资源来源
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SOURCE_SITES.map((source) => (
              <div key={source.name} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${source.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  <span className="text-white font-medium">{source.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {source.url !== '#' && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {source.url}
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    source.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'
                  }`}>
                    {source.status === 'active' ? '已启用' : '未启用'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}