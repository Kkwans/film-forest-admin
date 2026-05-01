'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Database, Bell, Shield, Palette, Globe } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">系统设置</h1>
        <p className="text-sm text-zinc-500 mt-1">配置系统参数与偏好</p>
      </div>

      {/* System */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5" /> 基础设置
          </CardTitle>
          <CardDescription className="text-zinc-500">站点基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-zinc-300">站点名称</Label>
            <Input defaultValue="影视森林" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">站点描述</Label>
            <Input defaultValue="影视资源聚合平台" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">版权信息</Label>
            <Input defaultValue="© 2026 影视森林. 仅供学习交流." className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">保存</Button>
        </CardContent>
      </Card>

      {/* Database */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5" /> 数据库配置
          </CardTitle>
          <CardDescription className="text-zinc-500">当前使用共享 MySQL 实例</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-zinc-300">主机地址</Label>
            <Input defaultValue="192.168.5.110:3306" readOnly className="bg-zinc-800/50 border-zinc-700 text-zinc-400" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">数据库名</Label>
            <Input defaultValue="film_forest" readOnly className="bg-zinc-800/50 border-zinc-700 text-zinc-400" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">字符集</Label>
            <Input defaultValue="utf8mb4" readOnly className="bg-zinc-800/50 border-zinc-700 text-zinc-400" />
          </div>
        </CardContent>
      </Card>

      {/* Crawler Settings */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5" /> 爬虫设置
          </CardTitle>
          <CardDescription className="text-zinc-500">默认爬虫参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-zinc-300">请求间隔 (ms)</Label>
            <Input defaultValue="2000" type="number" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">每批数量</Label>
            <Input defaultValue="20" type="number" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">默认优先级</Label>
            <Input defaultValue="by_score" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">保存</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5" /> 通知设置
          </CardTitle>
          <CardDescription className="text-zinc-500">爬虫完成通知</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">爬取完成通知</p>
              <p className="text-sm text-zinc-500">每次爬虫完成后发送通知</p>
            </div>
            <button className="w-12 h-6 rounded-full bg-emerald-600 relative">
              <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">错误告警</p>
              <p className="text-sm text-zinc-500">爬虫出错时发送通知</p>
            </div>
            <button className="w-12 h-6 rounded-full bg-zinc-700 relative">
              <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-zinc-400" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5" /> 安全设置
          </CardTitle>
          <CardDescription className="text-zinc-500">管理端访问控制</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-zinc-300">管理端路径</Label>
            <Input defaultValue="/admin" readOnly className="bg-zinc-800/50 border-zinc-700 text-zinc-400" />
          </div>
          <div className="grid gap-2">
            <Label className="text-zinc-300">修改密码</Label>
            <Input type="password" placeholder="新密码" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white">更新密码</Button>
        </CardContent>
      </Card>
    </div>
  );
}