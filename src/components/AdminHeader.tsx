'use client';

import { History, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import Breadcrumb from './Breadcrumb';
import { useAuth } from './auth-provider';

export default function AdminHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background/88 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 md:hidden" />
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
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
