'use client';

import { Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminHeader() {
  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <Input
        placeholder="搜索内容、资源..."
        className="w-64 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
      />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Bell className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <User className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}