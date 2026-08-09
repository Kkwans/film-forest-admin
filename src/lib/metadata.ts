/** 站点名称 */
export const SITE_NAME = '影视森林管理后台';

/** 路由 → 页面标题映射 */
export const PAGE_TITLES: Record<string, string> = {
  '/': '仪表盘',
  '/content': '内容管理',
  '/crawler': '爬虫管理',
  '/stats': '数据统计',
  '/resources': '资源管理',
  '/tags': '标签管理',
  '/users': '用户管理',
  '/logs': '操作日志',
  '/notifications': '通知中心',
  '/settings': '系统设置',
  '/login': '登录',
};

/** 获取完整页面标题（页面名 - 管理后台） */
export function getFullTitle(pathname: string): string {
  const pageTitle = PAGE_TITLES[pathname] || '页面不存在';
  return `${pageTitle} - ${SITE_NAME}`;
}
