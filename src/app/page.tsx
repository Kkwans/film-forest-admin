'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Upload, Eye, Clock } from 'lucide-react';
import { contentApi, crawlerApi } from '@/lib/api';

interface Stats {
  movies: number;
  dramas: number;
  varieties: number;
  animes: number;
  shortDramas: number;
}

interface RecentItem {
  id: number;
  title: string;
  type: string;
  status: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short: '短剧'
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ movies: 0, dramas: 0, varieties: 0, animes: 0, shortDramas: 0 });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [crawlerStatus, setCrawlerStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 真实统计数据
        const statsRes = await contentApi.getStats();
        if (statsRes.data.code === 200) {
          setStats(statsRes.data.data);
        }

        // 真实最近内容（合并5类，取前5条按时间倒序）
        const allRes = await contentApi.listAll({ page: 1, size: 20 });
        if (allRes.data.code === 200) {
          const items = allRes.data.data;
          // 按 createdAt 倒序取前5
          items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRecentItems(items.slice(0, 5));
        }

        // 真实爬虫状态
        const crawlerRes = await crawlerApi.getStatus();
        if (crawlerRes.data.code === 200) {
          setCrawlerStatus(crawlerRes.data.data.schedules || []);
        }
      } catch (e) {
        console.error('fetch dashboard data error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // 每30秒刷新
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  const totalContent = stats.movies + stats.dramas + stats.varieties + stats.animes + stats.shortDramas;

  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return '刚刚';
      if (mins < 60) return `${mins}分钟前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}小时前`;
      return `${Math.floor(hours / 24)}天前`;
    } catch { return dateStr; }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">仪表盘</h1>
        <p className="text-sm text-muted-foreground">欢迎回来，管理员</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">电影总数</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? '-' : stats.movies.toLocaleString()}</p>
              </div>
              <Film className="w-8 h-8 text-emerald-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">剧集总数</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? '-' : stats.dramas.toLocaleString()}</p>
              </div>
              <Film className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">综艺/动漫/短剧</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? '-' : (stats.varieties + stats.animes + stats.shortDramas).toLocaleString()}</p>
              </div>
              <Upload className="w-8 h-8 text-amber-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">内容总量</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? '-' : totalContent.toLocaleString()}</p>
              </div>
              <Eye className="w-8 h-8 text-purple-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Content */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">最近内容</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : recentItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无内容</div>
            ) : (
              <div className="space-y-3">
                {recentItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Film className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[item.type] || item.type} · {getRelativeTime(item.createdAt)}</p>
                      </div>
                    </div>
                    <Badge className={item.status === 1 ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700/50 text-muted-foreground border-zinc-600/30'}>
                      {item.status === 1 ? '已上线' : '已下线'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crawler Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">爬虫状态</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : crawlerStatus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无爬虫配置</div>
            ) : (
              <div className="space-y-4">
                {crawlerStatus.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.name || task.sourceSite + ' - ' + task.contentType}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">上次: {task.lastRunTime ? getRelativeTime(task.lastRunTime) : '从未运行'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={task.status === 'running' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700/50 text-muted-foreground border-zinc-600/30'}>
                        {task.status === 'running' ? '运行中' : task.status === 'idle' ? '空闲' : task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{task.totalItems || 0} 条</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}