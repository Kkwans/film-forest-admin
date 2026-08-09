'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, History, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import Breadcrumb from './Breadcrumb';
import { useAuth } from './auth-provider';
import { notificationApi } from '@/lib/api';

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationApi.unreadCount();
      if (response.data?.code === 200) setUnreadCount(Number(response.data.data?.count || 0));
    } catch {
      // 顶栏计数不可用不应干扰管理端主流程。
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadUnreadCount(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadUnreadCount();
    }, 30_000);
    const refresh = () => void loadUnreadCount();
    window.addEventListener('filmforest:notifications-changed', refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener('filmforest:notifications-changed', refresh);
    };
  }, [loadUnreadCount]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background/88 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 md:hidden" />
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <Link
          href="/notifications"
          className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={unreadCount > 0 ? `通知中心，${unreadCount} 条未读` : '通知中心'}
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 h-4.5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/logs"
          className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="操作日志"
        >
          <History className="size-[18px]" />
        </Link>
        <div className="ml-1 hidden items-center gap-2.5 border-l border-border pl-3 md:flex">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <User className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {user?.nickname || user?.username || '管理员'}
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="退出登录"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
