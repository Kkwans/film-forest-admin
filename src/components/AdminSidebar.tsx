'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Film, Upload, BarChart3, Settings, Database, Users, FileText, Tags, Menu, X, TreePine } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/content', label: '内容管理', icon: Film },
  { href: '/crawler', label: '爬虫管理', icon: Upload },
  { href: '/stats', label: '数据统计', icon: BarChart3 },
  { href: '/resources', label: '资源管理', icon: Database },
  { href: '/tags', label: '标签管理', icon: Tags },
  { href: '/users', label: '用户管理', icon: Users },
  { href: '/logs', label: '操作日志', icon: FileText },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = () => setMobileOpen(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [isMobile, mobileOpen]);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-popover text-foreground shadow-md transition-colors hover:bg-accent md:hidden"
        aria-label="打开主导航"
        aria-controls={drawerId}
        aria-expanded={mobileOpen}
      >
        <Menu className="size-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-50 cursor-default bg-black/45 backdrop-blur-[2px] md:hidden"
          onClick={closeDrawer}
          aria-label="关闭主导航"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={drawerRef}
        id={drawerId}
        aria-label="主导航"
        role={isMobile && mobileOpen ? 'dialog' : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        inert={isMobile && !mobileOpen ? true : undefined}
        className={`
          fixed inset-y-0 left-0 z-[51] flex w-64 flex-col border-r border-sidebar-border bg-sidebar
          transform shadow-2xl transition-transform duration-200 ease-out
          md:relative md:z-auto md:translate-x-0 md:shadow-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <TreePine className="size-5" />
            </div>
            <div>
              <p className="font-bold text-sidebar-foreground">影视森林</p>
              <p className="text-xs text-sidebar-foreground/50">管理后台</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeDrawer}
            className="flex size-9 items-center justify-center rounded-xl text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="关闭主导航"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden items-center gap-3 border-b border-sidebar-border px-5 py-5 md:flex">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <TreePine className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-sidebar-foreground">影视森林</p>
            <p className="text-xs text-sidebar-foreground/55">运营控制台</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/50">工作区</p>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeDrawer}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/68 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                )}
                <span className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary/12 text-sidebar-primary'
                    : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'
                }`}>
                  <item.icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-xs text-sidebar-foreground/55">影视森林 · 授权访问</p>
        </div>
      </aside>
    </>
  );
}
