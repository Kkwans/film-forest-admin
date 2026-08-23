export const CRAWLER_PROGRESS_STAGES = [
  { value: 'FETCHING', label: '读取详情', percent: 10 },
  { value: 'BASIC_INFO', label: '基础信息', percent: 25 },
  { value: 'MAGNET', label: '磁力链接', percent: 40 },
  { value: 'CLOUD', label: '网盘资源', percent: 55 },
  { value: 'ONLINE', label: '在线播放', percent: 85 },
  { value: 'SAVING', label: '保存影片', percent: 95 },
  { value: 'COMPLETED', label: '已完成', percent: 100 },
] as const;

const CRAWLER_ERROR_MESSAGES: Record<string, string> = {
  'Job progress stalled': '任务进度长时间未推进',
  'Job heartbeat expired': '任务心跳已超时',
  'CrawlerFetchException: List fetch failed: NETWORK_ERROR': '来源列表请求失败：网络异常',
  'CrawlerFetchException: 恢复分页时列表读取失败: NETWORK_ERROR': '恢复分页时列表请求失败：网络异常',
  'CrawlerFetchException: 恢复分页时列表读取失败: CANCELLED': '恢复分页时列表请求被取消',
  'IllegalArgumentException: Unexpected pkmp4 page kind: expected=LIST, actual=UNKNOWN': '来源列表结构无法识别，需检查来源页面结构',
};

const FETCH_ERROR_LABELS: Record<string, string> = {
  NETWORK_ERROR: '网络异常',
  CANCELLED: '请求被取消',
  SERVER_ERROR: '来源服务器错误',
  CHALLENGE_PAGE: '来源要求访问验证',
  FORBIDDEN: '来源拒绝访问',
  TIMEOUT: '请求超时',
  INVALID_CONTENT_TYPE: '返回内容类型异常',
  EMPTY_BODY: '来源返回内容为空',
};

export function crawlerStageLabel(value?: string | null) {
  if (!value) return '准备中';
  return CRAWLER_PROGRESS_STAGES.find(stage => stage.value === value)?.label ?? value;
}

export function crawlerStageProgress(value?: string | null, fallback = 0) {
  if (!value) return fallback;
  return CRAWLER_PROGRESS_STAGES.find(stage => stage.value === value)?.percent ?? fallback;
}

export function crawlerStageIndex(value?: string | null) {
  if (!value) return -1;
  return CRAWLER_PROGRESS_STAGES.findIndex(stage => stage.value === value);
}

export function crawlerErrorMessage(value?: string | null) {
  const message = value?.trim();
  if (!message) return '';
  const exact = CRAWLER_ERROR_MESSAGES[message];
  if (exact) return exact;

  const fetchMatch = message.match(/(?:List fetch failed|恢复分页时列表读取失败):\s*([A-Z_]+)/);
  if (fetchMatch) {
    const prefix = message.includes('恢复分页') ? '恢复分页时列表请求失败' : '来源列表请求失败';
    return `${prefix}：${FETCH_ERROR_LABELS[fetchMatch[1]] ?? '来源请求异常'}`;
  }
  if (message.startsWith('Job ')) return `任务异常：${message.slice(4)}`;
  if (message.startsWith('CrawlerFetchException:')) return '来源请求失败，请检查来源可用性和网络连接';
  if (message.startsWith('CrawlerSourceStructureException:')) return '来源页面结构发生变化，需检查来源解析器';
  return message;
}
