'use client';

import { Bell, User } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

export default function AdminHeader() {
  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6">
      {/* Mobile placeholder for sidebar toggle - sidebar has its own toggle */}
      <div className="w-10 md:hidden" />

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="通知"
        >
          <Bell className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="用户"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}