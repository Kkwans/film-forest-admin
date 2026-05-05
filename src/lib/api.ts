import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL || '';

const adminClient = axios.create({
  baseURL: ADMIN_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const crawlerApi = {
  /** 获取所有定时配置 */
  listSchedules: () => adminClient.get('/api/crawler/schedules'),

  /** 获取单个配置 */
  getSchedule: (id: number) => adminClient.get(`/api/crawler/schedule/${id}`),

  /** 保存/更新配置 */
  saveSchedule: (data: any) => adminClient.post('/api/crawler/schedule', data),

  /** 删除配置 */
  deleteSchedule: (id: number) => adminClient.delete(`/api/crawler/schedule/${id}`),

  /** 启动爬虫 */
  start: (id: number) => adminClient.post(`/api/crawler/start/${id}`),

  /** 停止爬虫 */
  stop: (id: number) => adminClient.post(`/api/crawler/stop/${id}`),

  /** 切换启用状态 */
  toggleEnabled: (id: number, enabled: boolean) =>
    adminClient.post(`/api/crawler/toggle/${id}?enabled=${enabled}`),

  /** 获取任务日志 */
  listLogs: (scheduleId?: number) =>
    adminClient.get('/api/crawler/logs', { params: scheduleId ? { scheduleId } : {} }),

  /** 获取状态概览 */
  getStatus: () => adminClient.get('/api/crawler/status'),
};

export interface CrawlerSchedule {
  id: number;
  name: string;
  contentType: string;
  sourceSite: string;
  enabled: number;
  cronExpression: string;
  batchSize: number;
  rateLimitMs: number;
  priority: string;
  genreFilter: string | null;
  status: string;
  lastRunTime: string | null;
  nextRunTime: string | null;
  totalRuns: number;
  totalItems: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlerTaskLog {
  id: number;
  scheduleId: number;
  scheduleName: string;
  contentType: string;
  status: string;
  itemsCrawled: number;
  itemsAdded: number;
  itemsUpdated: number;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export const resourceApi = {
  // 资源统计
  getStats: () => adminClient.get('/api/admin/resources/stats'),
  // 在线资源列表
  listOnline: (contentType?: string, contentId?: number) =>
    adminClient.get('/api/admin/resources/online', { params: { contentType, contentId } }),
  // 磁力资源列表
  listMagnet: (contentType?: string, contentId?: number) =>
    adminClient.get('/api/admin/resources/magnet', { params: { contentType, contentId } }),
};

// 内容管理 API（管理端）
export const contentApi = {
  // 电影
  listMovies: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/movies', { params }),
  getMovie: (id: number) => adminClient.get(`/api/content/movies/${id}`),
  createMovie: (data: any) => adminClient.post('/api/content/movies', data),
  updateMovie: (id: number, data: any) => adminClient.put(`/api/content/movies/${id}`, data),
  deleteMovie: (id: number) => adminClient.delete(`/api/content/movies/${id}`),

  // 剧集
  listDramas: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/dramas', { params }),
  getDrama: (id: number) => adminClient.get(`/api/content/dramas/${id}`),
  createDrama: (data: any) => adminClient.post('/api/content/dramas', data),
  updateDrama: (id: number, data: any) => adminClient.put(`/api/content/dramas/${id}`, data),
  deleteDrama: (id: number) => adminClient.delete(`/api/content/dramas/${id}`),

  // 综艺
  listVarieties: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/varieties', { params }),
  getVariety: (id: number) => adminClient.get(`/api/content/varieties/${id}`),
  createVariety: (data: any) => adminClient.post('/api/content/varieties', data),
  updateVariety: (id: number, data: any) => adminClient.put(`/api/content/varieties/${id}`, data),
  deleteVariety: (id: number) => adminClient.delete(`/api/content/varieties/${id}`),

  // 动漫
  listAnimes: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/animes', { params }),
  getAnime: (id: number) => adminClient.get(`/api/content/animes/${id}`),
  createAnime: (data: any) => adminClient.post('/api/content/animes', data),
  updateAnime: (id: number, data: any) => adminClient.put(`/api/content/animes/${id}`, data),
  deleteAnime: (id: number) => adminClient.delete(`/api/content/animes/${id}`),

  // 短剧
  listShortDramas: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/short-dramas', { params }),
  getShortDrama: (id: number) => adminClient.get(`/api/content/short-dramas/${id}`),
  createShortDrama: (data: any) => adminClient.post('/api/content/short-dramas', data),
  updateShortDrama: (id: number, data: any) => adminClient.put(`/api/content/short-dramas/${id}`, data),
  deleteShortDrama: (id: number) => adminClient.delete(`/api/content/short-dramas/${id}`),

  // 合并列表
  listAll: (params: { type?: string; page?: number; size?: number }) =>
    adminClient.get('/api/content/all', { params }),

  // 统计
  getStats: () => adminClient.get('/api/content/stats'),
};

export default client;