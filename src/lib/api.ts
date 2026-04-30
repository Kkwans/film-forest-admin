import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://100.106.29.60:8081';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const crawlerApi = {
  /** 获取所有定时配置 */
  listSchedules: () => client.get('/api/crawler/schedules'),

  /** 获取单个配置 */
  getSchedule: (id: number) => client.get(`/api/crawler/schedule/${id}`),

  /** 保存/更新配置 */
  saveSchedule: (data: any) => client.post('/api/crawler/schedule', data),

  /** 删除配置 */
  deleteSchedule: (id: number) => client.delete(`/api/crawler/schedule/${id}`),

  /** 启动爬虫 */
  start: (id: number) => client.post(`/api/crawler/start/${id}`),

  /** 停止爬虫 */
  stop: (id: number) => client.post(`/api/crawler/stop/${id}`),

  /** 切换启用状态 */
  toggleEnabled: (id: number, enabled: boolean) =>
    client.post(`/api/crawler/toggle/${id}?enabled=${enabled}`),

  /** 获取任务日志 */
  listLogs: (scheduleId?: number) =>
    client.get('/api/crawler/logs', { params: scheduleId ? { scheduleId } : {} }),

  /** 获取状态概览 */
  getStatus: () => client.get('/api/crawler/status'),
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

export default client;