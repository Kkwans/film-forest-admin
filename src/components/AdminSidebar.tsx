'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Film, Upload, BarChart3, Settings, Database, Users, FileText, Tags, Menu, X, TreePine, Bell, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { layoutApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { UI_LAYER_CLASSES } from '@/components/ui/layers';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/content', label: '内容管理', icon: Film },
  { href: '/crawler', label: '爬虫管理', icon: Upload },
  { href: '/stats', label: '数据统计', icon: BarChart3 },
  { href: '/resources', label: '资源管理', icon: Database },
  { href: '/tags', label: '标签管理', icon: Tags },
  { href: '/users', label: '用户管理', icon: Users },
  { href: '/notifications', label: '通知中心', icon: Bell },
  { href: '/logs', label: '操作日志', icon: FileText },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(Boolean(user?.adminSidebarCollapsed));
  const [savingPreference, setSavingPreference] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setMobileOpen(false), []);

  const toggleCollapsed = async () => {
    if (savingPreference) return;
    const next = !collapsed;
    setCollapsed(next);
    setSavingPreference(true);
    try {
      await layoutApi.saveSidebarPreference(next);
    } catch {
      setCollapsed(!next);
      toast.error('侧栏偏好保存失败，请重试');
    } finally {
      setSavingPreference(false);
    }
  };

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
      )).filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!drawerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
  }, [closeDrawer, isMobile, mobileOpen]);

  const desktopCollapsed = collapsed && !isMobile;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`fixed top-3 left-3 ${UI_LAYER_CLASSES.sidebarTrigger} flex size-10 items-center justify-center rounded-xl border border-border bg-popover text-foreground shadow-md transition-colors hover:bg-accent md:hidden`}
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
          tabIndex={-1}
          className={`fixed inset-0 ${UI_LAYER_CLASSES.sidebarTrigger} cursor-default bg-black/45 backdrop-blur-[2px] md:hidden`}
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
          fixed inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar
          ${UI_LAYER_CLASSES.sidebar} transform shadow-2xl transition-[width,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none
          md:relative md:z-auto md:translate-x-0 md:shadow-none
          ${desktopCollapsed ? 'md:w-20' : 'md:w-64'}
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
        <div className={`hidden items-center border-b border-sidebar-border py-5 md:flex ${desktopCollapsed ? 'justify-center px-3' : 'gap-3 px-5'}`}>
          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <TreePine className="size-5" />
          </div>
          {!desktopCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-tight text-sidebar-foreground">影视森林</p>
              <p className="text-xs text-sidebar-foreground/55">运营控制台</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${desktopCollapsed ? 'px-2' : 'px-3'}`}>
          {!desktopCollapsed && <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/50">工作区</p>}
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeDrawer}
                aria-current={isActive ? 'page' : undefined}
                title={desktopCollapsed ? item.label : undefined}
                className={`group flex min-h-11 items-center rounded-xl text-sm font-medium transition-[color,background-color,box-shadow] ${
                  desktopCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  isActive
                    ? `${desktopCollapsed ? 'bg-transparent shadow-none' : 'bg-sidebar-primary shadow-sm'} text-sidebar-primary-foreground`
                    : 'text-sidebar-foreground/68 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                }`}
              >
                <span className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? `${desktopCollapsed ? 'bg-sidebar-primary shadow-sm' : 'bg-white/14'} text-current`
                    : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'
                }`}>
                  <item.icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className={desktopCollapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-sidebar-border py-4 ${desktopCollapsed ? 'px-2' : 'px-4'}`}>
          <button
            type="button"
            onClick={() => void toggleCollapsed()}
            disabled={savingPreference}
            className={`hidden min-h-10 w-full items-center rounded-xl text-xs font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50 md:flex ${
              desktopCollapsed ? 'justify-center px-2' : 'gap-2 px-3'
            }`}
            aria-label={desktopCollapsed ? '展开侧边菜单' : '折叠侧边菜单'}
            title={desktopCollapsed ? '展开侧边菜单' : undefined}
          >
            {desktopCollapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!desktopCollapsed && <span>折叠侧边菜单</span>}
          </button>
          <p className={`mt-3 text-xs text-sidebar-foreground/55 md:mt-2 ${desktopCollapsed ? 'hidden' : ''}`}>影视森林 · 授权访问</p>
        </div>
      </aside>
    </>
  );
}
