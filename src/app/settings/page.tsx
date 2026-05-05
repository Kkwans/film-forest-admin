'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Database, Bell, Shield } from 'lucide-react';

const STORAGE_KEYS = {
  siteName: 'ff_site_name',
  siteDesc: 'ff_site_desc',
  copyright: 'ff_copyright',
  notifyOnComplete: 'ff_notify_complete',
  notifyOnError: 'ff_notify_error',
};

export default function SettingsPage() {
  const [siteName, setSiteName] = useState('影视森林');
  const [siteDesc, setSiteDesc] = useState('影视资源聚合平台');
  const [copyright, setCopyright] = useState('© 2026 影视森林. 仅供学习交流.');
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSiteName(localStorage.getItem(STORAGE_KEYS.siteName) || '影视森林');
    setSiteDesc(localStorage.getItem(STORAGE_KEYS.siteDesc) || '影视资源聚合平台');
    setCopyright(localStorage.getItem(STORAGE_KEYS.copyright) || '© 2026 影视森林. 仅供学习交流.');
    setNotifyOnComplete(localStorage.getItem(STORAGE_KEYS.notifyOnComplete) !== 'false');
    setNotifyOnError(localStorage.getItem(STORAGE_KEYS.notifyOnError) === 'true');
  }, []);

  const handleSaveAll = () => {
    localStorage.setItem(STORAGE_KEYS.siteName, siteName);
    localStorage.setItem(STORAGE_KEYS.siteDesc, siteDesc);
    localStorage.setItem(STORAGE_KEYS.copyright, copyright);
    localStorage.setItem(STORAGE_KEYS.notifyOnComplete, String(notifyOnComplete));
    localStorage.setItem(STORAGE_KEYS.notifyOnError, String(notifyOnError));
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">系统设置</h1>
          <p className="text-sm text-muted-foreground mt-1">配置系统参数与偏好</p>
        </div>
        {saved && <span className="text-emerald-500 text-sm">✓ 已保存</span>}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5" /> 基础设置
          </CardTitle>
          <CardDescription className="text-muted-foreground">站点基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-foreground">站点名称</Label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">站点描述</Label>
            <Input value={siteDesc} onChange={(e) => setSiteDesc(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">版权信息</Label>
            <Input value={copyright} onChange={(e) => setCopyright(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Database className="w-5 h-5" /> 数据库配置
          </CardTitle>
          <CardDescription className="text-muted-foreground">当前使用共享 MySQL 实例</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-foreground">主机地址</Label>
            <Input defaultValue="192.168.5.110:3306" readOnly className="bg-muted/50 border-border text-muted-foreground" />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">数据库名</Label>
            <Input defaultValue="film_forest" readOnly className="bg-muted/50 border-border text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" /> 通知设置
          </CardTitle>
          <CardDescription className="text-muted-foreground">爬虫完成通知</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground font-medium">爬取完成通知</p>
              <p className="text-sm text-muted-foreground">每次爬虫完成后发送通知</p>
            </div>
            <button onClick={() => setNotifyOnComplete(!notifyOnComplete)} className={`w-12 h-6 rounded-full relative transition-colors ${notifyOnComplete ? 'bg-emerald-600' : 'bg-muted'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifyOnComplete ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground font-medium">错误告警</p>
              <p className="text-sm text-muted-foreground">爬虫出错时发送通知</p>
            </div>
            <button onClick={() => setNotifyOnError(!notifyOnError)} className={`w-12 h-6 rounded-full relative transition-colors ${notifyOnError ? 'bg-emerald-600' : 'bg-muted'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifyOnError ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" /> 安全设置
          </CardTitle>
          <CardDescription className="text-muted-foreground">管理端访问控制</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-foreground">管理端路径</Label>
            <Input defaultValue="/admin" readOnly className="bg-muted/50 border-border text-muted-foreground" />
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground">修改密码</Label>
            <Input type="password" placeholder="新密码" className="bg-background border-border text-foreground" />
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white">更新密码</Button>
        </CardContent>
      </Card>

      <Button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 text-white w-fit">
        {saving ? '保存中...' : '保存全部设置'}
      </Button>
    </div>
  );
}
