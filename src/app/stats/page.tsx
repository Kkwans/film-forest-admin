'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Film, Eye } from 'lucide-react';
import { contentApi } from '@/lib/api';

interface Stats {
  movies: number;
  dramas: number;
  varieties: number;
  animes: number;
  shortDramas: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats>({ movies: 0, dramas: 0, varieties: 0, animes: 0, shortDramas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await contentApi.getStats();
        if (res.data.code === 200) {
          setStats(res.data.data);
        }
      } catch (e) {
        console.error('fetch stats error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const total = stats.movies + stats.dramas + stats.varieties + stats.animes + stats.shortDramas;

  const statsItems = [
    { label: '电影总数', value: stats.movies, icon: Film, color: 'text-blue-400' },
    { label: '剧集总数', value: stats.dramas, icon: Film, color: 'text-purple-400' },
    { label: '综艺总数', value: stats.varieties, icon: Eye, color: 'text-emerald-400' },
    { label: '动漫总数', value: stats.animes, icon: TrendingUp, color: 'text-amber-400' },
    { label: '短剧总数', value: stats.shortDramas, icon: Film, color: 'text-red-400' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">数据统计</h1>
        <p className="text-sm text-zinc-500 mt-1">内容数据概览</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsItems.map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {loading ? '-' : stat.value.toLocaleString()}
                  </p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total + Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> 内容总量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-4">
              {loading ? '-' : total.toLocaleString()}
            </div>
            <div className="space-y-2">
              {total > 0 && statsItems.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{stat.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stat.color.replace('text-', 'bg-')}`}
                        style={{ width: `${(stat.value / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-white font-medium">{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5" /> 资源分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statsItems.map((stat) => {
                const pct = total > 0 ? ((stat.value / total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={stat.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-400">{stat.label}</span>
                      <span className="text-zinc-300">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stat.color.replace('text-', 'bg-')}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}