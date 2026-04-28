import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Upload, Eye, Clock } from 'lucide-react';

const STATS = [
  { label: '电影总数', value: '1,234', icon: Film, color: 'text-emerald-400' },
  { label: '剧集总数', value: '567', icon: Film, color: 'text-blue-400' },
  { label: '今日新增', value: '+23', icon: Upload, color: 'text-amber-400' },
  { label: '总浏览量', value: '12.3万', icon: Eye, color: 'text-purple-400' },
];

const RECENT_ITEMS = [
  { title: '流浪地球3', type: 'movie', status: 'pending', time: '5分钟前' },
  { title: '繁花', type: 'drama', status: 'approved', time: '15分钟前' },
  { title: '奔跑吧兄弟10', type: 'variety', status: 'approved', time: '30分钟前' },
  { title: '咒术回战3', type: 'anime', status: 'pending', time: '1小时前' },
  { title: '霸道总裁爱上我', type: 'short', status: 'rejected', time: '2小时前' },
];

const CRAWLER_TASKS = [
  { name: '七味网 - 电影', status: 'running', count: 1234, lastRun: '10分钟前' },
  { name: '七味网 - 剧集', status: 'idle', count: 567, lastRun: '1小时前' },
  { name: '七味网 - 综艺', status: 'idle', count: 89, lastRun: '2小时前' },
];

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">仪表盘</h1>
        <p className="text-sm text-zinc-500">欢迎回来，管理员</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Content */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">最近内容</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RECENT_ITEMS.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                      <Film className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.type} · {item.time}</p>
                    </div>
                  </div>
                  <Badge className={
                    item.status === 'approved' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' :
                    item.status === 'pending' ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' :
                    'bg-red-600/20 text-red-400 border-red-500/30'
                  }>
                    {item.status === 'approved' ? '已通过' : item.status === 'pending' ? '待审核' : '已拒绝'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Crawler Status */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">爬虫状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {CRAWLER_TASKS.map((task) => (
                <div key={task.name} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span className="text-xs text-zinc-500">上次: {task.lastRun}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={task.status === 'running' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'}>
                      {task.status === 'running' ? '运行中' : '空闲'}
                    </Badge>
                    <span className="text-xs text-zinc-500">{task.count} 条</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}