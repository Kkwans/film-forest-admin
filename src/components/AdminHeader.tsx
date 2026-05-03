'use client';

import { Bell, User } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AdminHeader() {
  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="w-8 md:hidden" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center"
          aria-label="通知"
        >
          <Bell className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center"
          aria-label="用户"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
