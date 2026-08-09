'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ChartNoAxesCombined, Eye, EyeOff, Loader2, ShieldCheck, TreePine } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 已登录则跳转首页
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();

          if (!cancelled && data.code === 200) {
            router.push('/');
          }
        } catch {
          // 无法确认已有会话时仍允许用户重新登录。
        }
      }

      if (!cancelled) {
        setCheckingAuth(false);
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.warning('请输入用户名和密码');
      return;
    }
    if (loading) return;

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.code === 200) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        toast.success('登录成功');
        router.push('/');
      } else {
        toast.error(data.message || '登录失败');
      }
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '网络错误，请重试'));
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="正在检查登录状态">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(24rem,0.9fr)_minmax(30rem,1.1fr)]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <aside className="relative hidden overflow-hidden border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg">
              <TreePine className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">影视森林</p>
              <p className="text-sm text-sidebar-foreground/60">运营控制台</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.035em] text-balance xl:text-5xl">
            让内容、资源与爬虫运行状态清晰可控
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-sidebar-foreground/68 text-pretty">
            在同一个工作区维护影视内容、追踪采集任务，并及时处理数据质量问题。
          </p>
        </div>
        <div className="grid gap-3">
          {[
            { icon: Activity, text: '追踪爬虫任务与异常状态' },
            { icon: ChartNoAxesCombined, text: '核对内容与资源数据趋势' },
            { icon: ShieldCheck, text: '仅向授权管理员开放' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3 border-t border-sidebar-border py-3 text-sm text-sidebar-foreground/72">
              <item.icon className="size-4 text-sidebar-primary" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-dvh items-center justify-center px-5 py-16 sm:px-8 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <TreePine className="size-6" />
            </span>
            <p className="text-sm font-medium text-primary">影视森林</p>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">登录管理后台</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">使用管理员账号继续进入运营控制台。</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">用户名</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="h-11"
                autoComplete="username"
                autoFocus
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">密码</span>
              <span className="relative block">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="h-11 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  登录中
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <p className="mt-8 text-xs leading-5 text-muted-foreground">
            该入口仅供授权管理员使用。登录行为会被记录到操作日志。
          </p>
        </div>
      </section>
    </div>
  );
}
