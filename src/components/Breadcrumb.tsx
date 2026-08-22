'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';

/** 路由 -> 面包屑标签映射 */
const ROUTE_LABELS: Record<string, string> = {
  '/': '仪表盘',
  '/content': '内容管理',
  '/crawler': '爬虫管理',
  '/stats': '数据统计',
  '/resources': '资源管理',
  '/tags': '标签管理',
  '/users': '用户管理',
  '/logs': '操作日志',
  '/settings': '系统设置',
  '/notifications': '通知中心',
};

const CRAWLER_TABS: Record<string, string> = {
  config: '任务配置',
  jobs: '运行任务',
  logs: '执行日志',
  stats: '运行统计',
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const [crawlerTab, setCrawlerTab] = useState('config');

  useEffect(() => {
    const syncTab = () => {
      if (window.location.pathname !== '/crawler') return;
      setCrawlerTab(new URLSearchParams(window.location.search).get('tab') || 'config');
    };
    syncTab();
    window.addEventListener('popstate', syncTab);
    window.addEventListener('filmforest:crawler-navigation', syncTab);
    return () => {
      window.removeEventListener('popstate', syncTab);
      window.removeEventListener('filmforest:crawler-navigation', syncTab);
    };
  }, [pathname]);

  // 登录页不显示面包屑
  if (pathname === '/login') return null;

  const currentLabel = ROUTE_LABELS[pathname];
  if (!currentLabel) return null;

  // 首页只显示首页图标，不显示完整面包屑
  const isHome = pathname === '/';

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="面包屑导航">
      <Link
        href="/"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        {!isHome && <span>主页</span>}
      </Link>
      {!isHome && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-foreground font-medium">{currentLabel}</span>
          {pathname === '/crawler' && crawlerTab !== 'config' && CRAWLER_TABS[crawlerTab] && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-foreground font-medium">{CRAWLER_TABS[crawlerTab]}</span>
            </>
          )}
        </>
      )}
    </nav>
  );
}
