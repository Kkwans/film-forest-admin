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

// 请求拦截器：自动添加 token
adminClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 响应拦截器：401 时跳转登录
adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || (error.response?.data?.code === 500 && error.response?.data?.message?.includes('未登录'))) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('film-forest:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

/** 内容提交数据（创建/更新通用） */
export interface ContentSubmitData {
  title: string;
  year?: number | null;
  scoreDouban?: number | null;
  scoreImdb?: number | null;
  scoreRt?: number | null;
  genreTagIds?: number[];
  region?: string | null;   // JSON array string
  language?: string | null;
  director?: string | null;
  writer?: string | null;
  actor?: string | null;
  storyline?: string | null;
  duration?: number | null;
  releaseDate?: string | null;
  alias?: string | null;
  status?: number;
  type?: string;
  posterUrl?: string;
  totalEpisode?: number | null;
  seriesName?: string | null;
  seriesOrder?: number | null;
}

export interface ContentStatusBatchResult {
  requested: number;
  updated: number;
  status: number;
}

/** 保存爬虫配置请求体 */
export type SaveScheduleData = { id?: number } & Partial<Omit<CrawlerSchedule, 'id' | 'status' | 'lastRunTime' | 'nextRunTime' | 'totalRuns' | 'totalItems' | 'createdAt' | 'updatedAt'>>;

/** 保存磁力资源请求体 */
export interface SaveMagnetData {
  id?: number;
  contentType: string;
  contentId: number;
  sourceCode?: string;
  title?: string;
  magnetUrl: string;
  resolution?: string;
  hasSubtitle?: boolean;
  isSpecialSub?: boolean;
  sort?: number;
  enabled?: number;
}

/** 保存网盘资源请求体 */
export interface SaveCloudData {
  id?: number;
  contentType: string;
  contentId: number;
  sourceCode?: string;
  title?: string;
  diskType: string;
  url: string;
  password?: string;
  sort?: number;
  enabled?: number;
}

/** 保存资源来源请求体 */
export interface SaveSourceData {
  id?: number;
  code: string;
  name: string;
  url: string;
  enabled?: number;
  sort?: number;
}

export interface SaveOnlineData {
  id?: number;
  contentType: string;
  contentId: number;
  sourceCode?: string;
  sourceName: string;
  sourceUrl: string;
  sourcePageUrl?: string;
  playbackType?: 'HLS' | 'VIDEO' | 'EMBED' | 'EXTERNAL_PAGE' | '';
  season?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string;
  sort?: number;
  enabled?: number;
}

export interface ResourcePageQuery {
  page?: number;
  size?: number;
  keyword?: string;
  contentType?: string;
  contentId?: number;
  source?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'REMOVED';
  resolution?: string;
  diskType?: string;
  sort?: 'createdAt' | 'updatedAt' | 'contentId' | 'title' | 'sort';
  order?: 'asc' | 'desc';
}

export const crawlerApi = {
  /** 获取所有定时配置 */
  listSchedules: () => adminClient.get('/api/crawler/schedules'),

  /** 获取单个配置 */
  getSchedule: (id: number) => adminClient.get(`/api/crawler/schedule/${id}`),

  /** 保存/更新配置 */
  saveSchedule: (data: SaveScheduleData) => adminClient.post('/api/crawler/schedule', data),

  /** 规范化图形向导或 Cron，并返回未来五次运行时间 */
  previewSchedule: (data: CrawlerSchedulePreviewRequest) =>
    adminClient.post('/api/crawler/schedule/preview', data),

  /** 删除配置 */
  deleteSchedule: (id: number) => adminClient.delete(`/api/crawler/schedule/${id}`),

  /** 启动爬虫 */
  start: (id: number) => adminClient.post<ApiEnvelope<CrawlerJobStartResult>>(`/api/crawler/start/${id}`, null, { timeout: 15000 }),

  /** 停止爬虫 */
  stop: (id: number) => adminClient.post(`/api/crawler/stop/${id}`),

  /** 切换启用状态 */
  toggleEnabled: (id: number, enabled: boolean) =>
    adminClient.post(`/api/crawler/toggle/${id}?enabled=${enabled}`),

  /** 获取权威 Job/日志真分页 */
  listLogs: (params?: CrawlerLogQuery) =>
    adminClient.get('/api/crawler/logs', { params: params || {} }),

  /** 获取活动 Job */
  listActiveJobs: () => adminClient.get('/api/crawler/jobs/active'),

  /** 获取单个 Job 详情 */
  getJob: (jobId: number) => adminClient.get<ApiEnvelope<CrawlerTaskLog>>(`/api/crawler/jobs/${jobId}`),

  /** 获取单个 Job 内的条目失败明细 */
  listJobFailures: (jobId: number, params?: CrawlerJobFailureQuery) =>
    adminClient.get<ApiEnvelope<PageData<CrawlerJobItemFailure>>>(`/api/crawler/jobs/${jobId}/failures`, { params: params || {} }),

  /** 获取单个 Job 内成功处理的内容快照 */
  listJobSuccesses: (jobId: number, params?: CrawlerJobSuccessQuery) =>
    adminClient.get<ApiEnvelope<PageData<CrawlerJobItemSuccess>>>(`/api/crawler/jobs/${jobId}/successes`, { params: params || {} }),

  /** 请求取消 Job */
  cancelJob: (jobId: number) => adminClient.post(`/api/crawler/jobs/${jobId}/cancel`),

  /** 获取日志统计 */
  getLogStats: () => adminClient.get('/api/crawler/logs/stats'),

  /** 重试失败任务 */
  retry: (logId: number) => adminClient.post<ApiEnvelope<CrawlerJobStartResult>>(`/api/crawler/retry/${logId}`),

  /** 批量重试所有失败任务 */
  retryAll: () => adminClient.post('/api/crawler/retry-all'),

  /** 获取状态概览 */
  getStatus: () => adminClient.get('/api/crawler/status'),

  /** 获取爬虫每日运行趋势（近7天） */
  getDailyStats: () => adminClient.get('/api/crawler/daily-stats'),

  /** 获取 7/30 天 SQL 聚合运行统计 */
  getOperationsStats: (days: 7 | 30) =>
    adminClient.get('/api/crawler/operations-stats', { params: { days } }),

  /** 获取资源来源列表 */
  listSources: () => adminClient.get('/api/crawler/sources'),

  /** 预览来源查询；只读取少量列表样本，不创建 Job 或推进游标 */
  previewSourceQuery: (data: CrawlerSourceQueryPreviewRequest) =>
    adminClient.post<ApiEnvelope<CrawlerSourceQueryPreview>>('/api/crawler/source-query/preview', data),

  /** 获取跨 Job 续爬游标 */
  getCursor: (scheduleId: number) =>
    adminClient.get<ApiEnvelope<CrawlerScheduleCursor>>(`/api/crawler/schedules/${scheduleId}/cursor`),

  /** 人工重置跨 Job 续爬游标 */
  resetCursor: (scheduleId: number) =>
    adminClient.post<ApiEnvelope<CrawlerScheduleCursor>>(`/api/crawler/schedules/${scheduleId}/cursor/reset`),
};

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface CrawlerJobStartResult {
  jobId: number;
  status: string;
  queuedAt: string;
}

export interface CrawlerSchedule {
  id: number;
  name: string;
  contentType: string;
  crawlMode: 'latest' | 'full';
  sourceSite: string;
  sourceId: number;
  adapterCode: string;
  enabled: number;
  cronExpression: string | null;
  scheduleMode: CrawlerScheduleMode;
  scheduleConfig: Record<string, unknown>;
  timezone: string;
  batchSize: number;
  rateLimitMs: number;
  sourceSort: CrawlerSourceSort;
  sourceFilters: Record<string, string>;
  traversalMode: CrawlerTraversalMode;
  endPolicy: CrawlerEndPolicy;
  newItemLimit: number;
  backfillItemLimit: number;
  manualRunLimit: number;
  configurationStatus: CrawlerConfigurationStatus;
  configurationIssue: string | null;
  queryProfileHash: string | null;
  priority: string;
  genreFilter: string | null;
  genreTagIds: number[];
  status: string;
  latestJobId?: number | null;
  latestResult?: string | null;
  lastRunTime: string | null;
  nextRunTime: string | null;
  totalRuns: number;
  totalItems: number;
  createdAt: string;
  updatedAt: string;
}

export type CrawlerScheduleMode =
  | 'MANUAL'
  | 'INTERVAL'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'CUSTOM_CRON';

export interface CrawlerSchedulePreviewRequest {
  scheduleMode?: CrawlerScheduleMode;
  scheduleConfig?: Record<string, unknown>;
  cronExpression?: string | null;
  timezone?: string;
}

export interface CrawlerSchedulePreview {
  cronExpression: string | null;
  scheduleMode: CrawlerScheduleMode;
  scheduleConfig: Record<string, unknown>;
  timezone: string;
  description: string;
  nextRuns: string[];
}

export interface CrawlerAdapterDescriptor {
  code: string;
  contentType: string;
}

export interface CrawlerSourceDescriptor {
  id: number;
  code: string;
  name: string;
  url: string;
  adapters: CrawlerAdapterDescriptor[];
  capabilities: Record<string, CrawlerSourceCapabilities>;
}

export type CrawlerSourceSort = 'TIME' | 'POPULARITY' | 'RATING';
export type CrawlerTraversalMode = 'CONTINUOUS_SYNC' | 'BACKFILL_CONTINUE' | 'MANUAL_FULL';
export type CrawlerEndPolicy = 'HOLD_COMPLETED' | 'RESTART_CYCLE';
export type CrawlerConfigurationStatus = 'VALIDATED' | 'NEEDS_REVIEW';

export interface CrawlerSourceCapabilities {
  sourceCode: string;
  contentType: string;
  supportedSorts: CrawlerSourceSort[];
  supportedFilters: string[];
  verified: boolean;
  availability: string;
  message: string;
}

export interface CrawlerSourceQueryPreviewRequest {
  sourceCode: string;
  contentType: string;
  sort?: CrawlerSourceSort;
  sourceFilters?: Record<string, string>;
  page?: number;
}

export interface CrawlerSourceQueryPreview {
  status: 'VALIDATED' | 'UNSUPPORTED' | 'SOURCE_UNAVAILABLE' | 'NEEDS_REVIEW';
  sourceCode: string;
  contentType: string;
  sort: CrawlerSourceSort;
  normalizedUri: string | null;
  message: string;
  sampleExternalIds: string[];
  sampleCount: number;
}

export interface CrawlerScheduleCursor {
  id: number;
  scheduleId: number;
  profileHash: string;
  sourceCode: string;
  contentType: string;
  sourceSort: CrawlerSourceSort;
  traversalMode: CrawlerTraversalMode;
  querySnapshot: string | null;
  nextPage: number;
  nextItemIndex: number;
  nextExternalId: string | null;
  lastCommittedExternalId: string | null;
  headWatermark: string | null;
  state: 'ACTIVE' | 'COMPLETE' | 'INVALIDATED' | 'RECOVERY_REQUIRED' | 'SOURCE_UNAVAILABLE';
  cycle: number;
  version: number;
  lastError: string | null;
  lastRunAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CrawlerTaskLog {
  id: number;
  scheduleId: number;
  scheduleName: string;
  contentType: string;
  sourceCode?: string | null;
  sourceSort?: CrawlerSourceSort | null;
  traversalMode?: CrawlerTraversalMode | null;
  queryProfileHash?: string | null;
  querySnapshot?: string | null;
  sourceFilterSnapshot?: string | null;
  configSnapshot?: string | null;
  outcomeCode?: string | null;
  crawlMode?: 'latest' | 'full';
  status: string;
  triggerType?: string;
  retryOfJobId?: number | null;
  cancelRequested?: boolean;
  currentPage?: number | null;
  currentItem?: string | null;
  currentItemTitle?: string | null;
  currentStage?: string | null;
  currentStageProgress?: number | null;
  currentStageMessage?: string | null;
  discoveredCount?: number;
  fetchSucceededCount?: number;
  parseSucceededCount?: number;
  addedCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  filteredCount?: number;
  failedCount?: number;
  pagesScanned?: number;
  listItemsScanned?: number;
  detailAttempted?: number;
  cursorAdvanced?: number;
  newItems?: number;
  backfillItems?: number;
  checkpoint?: string | null;
  heartbeatAt?: string | null;
  progressUpdatedAt?: string | null;
  errorSummary?: string | null;
  queuedAt?: string | null;
  itemsCrawled: number;
  itemsAdded: number;
  itemsUpdated: number;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface PageData<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface CrawlerJobFailureQuery {
  stage?: 'fetch' | 'parse' | 'persistence';
  category?: string;
  retryExhausted?: boolean;
  page?: number;
  size?: number;
}

export interface CrawlerJobSuccessQuery {
  keyword?: string;
  page?: number;
  size?: number;
}

export interface CrawlerJobItemFailure {
  id: number;
  jobId: number;
  sourceCode: string;
  contentType: string;
  externalId: string;
  sourceUrl: string;
  failureStage: 'fetch' | 'parse' | 'persistence';
  errorCategory: string;
  attemptCount: number;
  retryExhausted: boolean;
  diagnostic?: string | null;
  failedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlerJobItemSuccess {
  id: number;
  jobId: number;
  sourceCode: string;
  contentType: string;
  externalId: string;
  sourceUrl: string;
  contentId: number;
  resultType: 'ADDED' | 'UPDATED' | 'UNCHANGED';
  title: string;
  alias?: string | null;
  posterUrl?: string | null;
  year?: number | null;
  directors?: string | null;
  writers?: string | null;
  actors?: string | null;
  genres?: string | null;
  regions?: string | null;
  languages?: string | null;
  releaseDate?: string | null;
  duration?: number | null;
  totalEpisodes?: number | null;
  scoreDouban?: number | null;
  scoreImdb?: number | null;
  scoreRt?: number | null;
  crawledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlerLogQuery {
  scheduleId?: number;
  status?: string;
  source?: string;
  type?: string;
  triggerType?: string;
  from?: string;
  to?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface CrawlerOperationsStats {
  days: 7 | 30;
  jobs: number;
  success: number;
  partial: number;
  failed: number;
  cancelled: number;
  avgDurationMs: number;
  added: number;
  updated: number;
  failedItems: number;
  daily: Array<{
    date: string;
    jobs: number;
    success: number;
    partial: number;
    failed: number;
    cancelled: number;
    added: number;
    updated: number;
    failedItems: number;
  }>;
  sourceHealth: Array<{
    source: string;
    jobs: number;
    success: number;
    partial: number;
    failed: number;
    cancelled: number;
    avgDurationMs: number;
    lastRunAt: string | null;
  }>;
}

export const resourceApi = {
  // 资源统计
  getStats: () => adminClient.get('/api/admin/resources/stats'),
  // 在线资源列表
  listOnline: (params?: ResourcePageQuery) =>
    adminClient.get('/api/admin/resources/online', { params }),
  saveOnline: (data: SaveOnlineData) => adminClient.post('/api/admin/resources/online', data),
  deleteOnline: (id: number) => adminClient.delete(`/api/admin/resources/online/${id}`),
  toggleOnline: (id: number, enabled: boolean) =>
    adminClient.post(`/api/admin/resources/online/${id}/toggle`, null, { params: { enabled } }),
  // 磁力资源列表（分页）
  listMagnet: (params?: ResourcePageQuery) =>
    adminClient.get('/api/admin/resources/magnet', { params }),
  // 磁力资源 CRUD
  saveMagnet: (data: SaveMagnetData) => adminClient.post('/api/admin/resources/magnet', data),
  deleteMagnet: (id: number) => adminClient.delete(`/api/admin/resources/magnet/${id}`),
  toggleMagnet: (id: number, enabled: boolean) =>
    adminClient.post(`/api/admin/resources/magnet/${id}/toggle`, null, { params: { enabled } }),
  // 网盘资源列表（分页）
  listCloud: (params?: ResourcePageQuery) =>
    adminClient.get('/api/admin/resources/cloud', { params }),
  // 网盘资源 CRUD
  saveCloud: (data: SaveCloudData) => adminClient.post('/api/admin/resources/cloud', data),
  deleteCloud: (id: number) => adminClient.delete(`/api/admin/resources/cloud/${id}`),
  toggleCloud: (id: number, enabled: boolean) =>
    adminClient.post(`/api/admin/resources/cloud/${id}/toggle`, null, { params: { enabled } }),

  // 资源来源 CRUD
  listSources: () => adminClient.get('/api/admin/resources/sources'),
  saveSource: (data: SaveSourceData) => adminClient.post('/api/admin/resources/sources', data),
  deleteSource: (id: number) => adminClient.delete(`/api/admin/resources/sources/${id}`),
  toggleSource: (id: number, enabled: boolean) =>
    adminClient.post(`/api/admin/resources/sources/${id}/toggle?enabled=${enabled}`),
};

// 内容管理 API（管理端）
export const contentApi = {
  // 电影
  listMovies: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/movies', { params }),
  getMovie: (id: number) => adminClient.get(`/api/content/movies/${id}`),
  createMovie: (data: ContentSubmitData) => adminClient.post('/api/content/movies', data),
  updateMovie: (id: number, data: ContentSubmitData) => adminClient.put(`/api/content/movies/${id}`, data),
  deleteMovie: (id: number) => adminClient.delete(`/api/content/movies/${id}`),

  // 剧集
  listDramas: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/dramas', { params }),
  getDrama: (id: number) => adminClient.get(`/api/content/dramas/${id}`),
  createDrama: (data: ContentSubmitData) => adminClient.post('/api/content/dramas', data),
  updateDrama: (id: number, data: ContentSubmitData) => adminClient.put(`/api/content/dramas/${id}`, data),
  deleteDrama: (id: number) => adminClient.delete(`/api/content/dramas/${id}`),

  // 综艺
  listVarieties: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/varieties', { params }),
  getVariety: (id: number) => adminClient.get(`/api/content/varieties/${id}`),
  createVariety: (data: ContentSubmitData) => adminClient.post('/api/content/varieties', data),
  updateVariety: (id: number, data: ContentSubmitData) => adminClient.put(`/api/content/varieties/${id}`, data),
  deleteVariety: (id: number) => adminClient.delete(`/api/content/varieties/${id}`),

  // 动漫
  listAnimes: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/animes', { params }),
  getAnime: (id: number) => adminClient.get(`/api/content/animes/${id}`),
  createAnime: (data: ContentSubmitData) => adminClient.post('/api/content/animes', data),
  updateAnime: (id: number, data: ContentSubmitData) => adminClient.put(`/api/content/animes/${id}`, data),
  deleteAnime: (id: number) => adminClient.delete(`/api/content/animes/${id}`),

  // 短剧
  listShortDramas: (params: { page?: number; size?: number; year?: number; keyword?: string }) =>
    adminClient.get('/api/content/short-dramas', { params }),
  getShortDrama: (id: number) => adminClient.get(`/api/content/short-dramas/${id}`),
  createShortDrama: (data: ContentSubmitData) => adminClient.post('/api/content/short-dramas', data),
  updateShortDrama: (id: number, data: ContentSubmitData) => adminClient.put(`/api/content/short-dramas/${id}`, data),
  deleteShortDrama: (id: number) => adminClient.delete(`/api/content/short-dramas/${id}`),

  // 状态切换（通用，只更新 status 字段）
  toggleStatus: (type: string, id: number, status: number) =>
    adminClient.patch(`/api/content/${type}/${id}/status?status=${status}`),

  // 当前页跨类型原子批量状态更新；任何失效目标都会整批回滚
  batchUpdateStatus: (items: Array<{ type: string; id: number }>, status: number) =>
    adminClient.post<ApiEnvelope<ContentStatusBatchResult>>('/api/content/status/batch', { items, status }),

  // 合并列表
  listAll: (params: {
    type?: string;
    status?: number;
    keyword?: string;
    sort?: 'createdAt' | 'updatedAt' | 'year' | 'title' | 'score' | 'status';
    sortDir?: 'asc' | 'desc';
    page?: number;
    size?: number;
  }) =>
    adminClient.get('/api/content/all', { params }),

  // 统计
  getStats: () => adminClient.get('/api/content/stats'),

  // Genre 列表（爬虫配置用）
  getGenres: (contentType: string) => adminClient.get('/api/content/genres', { params: { contentType } }),
};

// 系统设置 API
export const settingsApi = {
  /** 获取所有设置 */
  getSettings: () => adminClient.get('/api/settings'),
  /** 批量保存设置 */
  saveSettings: (data: Record<string, string>) => adminClient.put('/api/settings', data),
  /** 获取单个设置 */
  getSetting: (key: string, defaultValue?: string) =>
    adminClient.get(`/api/settings/${key}`, { params: { defaultValue } }),
  /** 获取数据库元信息 */
  getDbInfo: () => adminClient.get('/api/settings/db-info'),
};

export const layoutApi = {
  saveSidebarPreference: (sidebarCollapsed: boolean) =>
    adminClient.put('/api/auth/preferences/layout', { sidebarCollapsed }),
};

// 数据统计 API
export const statsApi = {
  /** 数据概览（各类型数量 + 7日增长 + 爬虫成功率 + 资源统计） */
  getOverview: () => adminClient.get('/api/stats/overview'),
  /** 内容增长趋势（近N天） */
  getTrend: (days?: number) => adminClient.get('/api/stats/trend', { params: { days } }),
  /** 热门搜索词（近N天，Top M） */
  getHotSearch: (days?: number, limit?: number) => adminClient.get('/api/stats/hot-search', { params: { days, limit } }),
  /** 数据报表 */
  getReport: (days?: number) => adminClient.get('/api/stats/report', { params: { days } }),
  /** 导出概览 CSV */
  exportOverview: () => adminClient.get('/api/stats/export/overview', { responseType: 'blob' }),
  /** 导出内容列表 CSV */
  exportContent: (type?: string) => adminClient.get('/api/stats/export/content', { params: { type }, responseType: 'blob' }),
  /** 导出搜索热词 CSV */
  exportHotSearch: (days?: number) => adminClient.get('/api/stats/export/hot-search', { params: { days }, responseType: 'blob' }),
};

// 用户管理 API
export interface UserItem {
  id: number;
  username: string;
  role: 'USER' | 'ADMIN';
  nickname: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationInvitationItem {
  id: number;
  status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  createdBy: number;
  createdByUsername: string;
  usedBy: number | null;
  usedByUsername: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedRegistrationInvitation {
  token: string;
  expiresAt: string;
}

export const userApi = {
  /** 分页查询用户 */
  list: (params?: { page?: number; size?: number; keyword?: string; status?: number }) =>
    adminClient.get('/api/admin/users', { params }),
  /** 获取单个用户 */
  get: (id: number) => adminClient.get(`/api/admin/users/${id}`),
  /** 创建用户 */
  create: (data: { username: string; password: string; nickname?: string; email?: string; phone?: string; status?: number; role?: UserItem['role'] }) =>
    adminClient.post('/api/admin/users', data),
  /** 更新用户 */
  update: (id: number, data: { username?: string; nickname?: string; email?: string; phone?: string; avatarUrl?: string; status?: number; role?: UserItem['role'] }) =>
    adminClient.put(`/api/admin/users/${id}`, data),
  /** 删除用户 */
  delete: (id: number) => adminClient.delete(`/api/admin/users/${id}`),
  /** 切换用户状态 */
  toggleStatus: (id: number) => adminClient.post(`/api/admin/users/${id}/toggle-status`),
  /** 重置密码 */
  resetPassword: (id: number, newPassword: string) =>
    adminClient.post(`/api/admin/users/${id}/reset-password`, { newPassword }),
  listRegistrationInvitations: () =>
    adminClient.get('/api/admin/registration-invitations'),
  createRegistrationInvitation: () =>
    adminClient.post('/api/admin/registration-invitations'),
  revokeRegistrationInvitation: (id: number) =>
    adminClient.post(`/api/admin/registration-invitations/${id}/revoke`),
};

// 操作日志 API
export interface LogItem {
  id: number;
  userId: number;
  username: string;
  action: string;
  module: string;
  target: string;
  detail: string;
  ip: string;
  status: number;
  errorMessage: string | null;
  createdAt: string;
}

export const logApi = {
  /** 分页查询日志 */
  list: (params?: { page?: number; size?: number; action?: string; module?: string; status?: number; keyword?: string }) =>
    adminClient.get('/api/admin/logs', { params }),
  /** 日志统计 */
  stats: () => adminClient.get('/api/admin/logs/stats'),
};

// 站内通知与邮件告警
export interface AdminNotificationItem {
  id: number;
  userId: number;
  eventType: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  link?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  emailEnabled: number;
  crawlerFailure: number;
  crawlerRecovery: number;
  dataAnomaly: number;
  crawlerSuccess: number;
}

export interface SmtpSettingView {
  configured: boolean;
  enabled: boolean;
  host: string | null;
  port: number | null;
  username: string | null;
  fromEmail: string | null;
  fromName: string | null;
  securityMode: 'NONE' | 'STARTTLS' | 'SSL';
  passwordMask: string | null;
}

export const notificationApi = {
  list: (params?: {
    unreadOnly?: boolean;
    eventType?: string;
    severity?: string;
    keyword?: string;
    page?: number;
    size?: number;
  }) =>
    adminClient.get('/api/admin/notifications', { params }),
  unreadCount: () => adminClient.get('/api/admin/notifications/unread-count'),
  markRead: (id: number) => adminClient.post(`/api/admin/notifications/${id}/read`),
  markAllRead: () => adminClient.post('/api/admin/notifications/read-all'),
  getPreferences: () => adminClient.get('/api/admin/notifications/preferences'),
  savePreferences: (data: NotificationPreference) =>
    adminClient.put('/api/admin/notifications/preferences', data),
  getSmtp: () => adminClient.get('/api/admin/smtp'),
  saveSmtp: (data: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    clearPassword?: boolean;
    fromEmail: string;
    fromName?: string;
    securityMode: 'NONE' | 'STARTTLS' | 'SSL';
    enabled: boolean;
  }) => adminClient.put('/api/admin/smtp', data),
  testSmtpConnection: () => adminClient.post('/api/admin/smtp/test-connection'),
  sendTestMail: (recipient: string) =>
    adminClient.post('/api/admin/smtp/test-mail', { recipient }),
};

// ---- Tags ----

export interface TagItem {
  id: number;
  code?: string;
  name: string;
  color: string;
  sortOrder?: number;
  system?: number;
  usageCount?: number;
  createdAt?: string;
}

export const tagApi = {
  /** 获取所有标签 */
  list: () => adminClient.get('/api/tags'),
  /** 获取指定内容类型的系统标准题材 */
  listStandardGenres: (contentType: string) =>
    adminClient.get('/api/tags/genres', { params: { contentType } }),
  /** 创建标签 */
  create: (data: { name: string; color?: string }) => adminClient.post('/api/tags', data),
  /** 更新标签 */
  update: (id: number, data: { name?: string; color?: string }) => adminClient.put(`/api/tags/${id}`, data),
  /** 删除标签 */
  delete: (id: number) => adminClient.delete(`/api/tags/${id}`),
  /** 获取内容的标签 */
  getContentTags: (contentType: string, contentId: number) => adminClient.get(`/api/tags/content/${contentType}/${contentId}`),
  /** 设置内容的标签 */
  setContentTags: (contentType: string, contentId: number, tagIds: number[]) => adminClient.put(`/api/tags/content/${contentType}/${contentId}`, { tagIds }),
  /** 批量获取多个内容的标签 */
  batchGetContentTags: (items: Array<{ contentType: string; contentId: number }>) =>
    adminClient.post('/api/tags/content/batch', items),
};

export default client;
