'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Film, Upload, BarChart3, Settings, Database, Menu, X } from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/content', label: '内容管理', icon: Film },
  { href: '/crawler', label: '爬虫管理', icon: Upload },
  { href: '/stats', label: '数据统计', icon: BarChart3 },
  { href: '/resources', label: '资源管理', icon: Database },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button — visible only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-[60] p-2 rounded-lg bg-zinc-800 border border-zinc-700 md:hidden"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5 text-zinc-300" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-[56]
          w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:translate-x-0 md:block
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 md:hidden">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <p className="font-bold text-white">影视森林</p>
              <p className="text-xs text-zinc-500">管理后台</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded text-zinc-400 hover:text-white"
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <span className="text-2xl">🌲</span>
          <div>
            <p className="font-bold text-white">影视森林</p>
            <p className="text-xs text-zinc-500">管理后台</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">v0.1.0</p>
        </div>
      </aside>
    </>
  );
}