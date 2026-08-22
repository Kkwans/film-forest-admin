import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, StopCircle, XCircle } from 'lucide-react';
import { InfoHint, TooltipText } from '@/components/ui/tooltip';

const STATUS: Record<string, { label: string; icon: ReactNode; className: string }> = {
  queued: { label: '排队中', icon: <Clock3 className="size-3" />, className: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  running: { label: '运行中', icon: <Loader2 className="size-3 animate-spin" />, className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
  cancel_requested: { label: '正在取消', icon: <Loader2 className="size-3 animate-spin" />, className: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' },
  success: { label: '成功', icon: <CheckCircle2 className="size-3" />, className: 'bg-primary/15 text-primary' },
  partial_success: { label: '部分成功', icon: <AlertTriangle className="size-3" />, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  failed: { label: '失败', icon: <XCircle className="size-3" />, className: 'bg-destructive/15 text-destructive' },
  cancelled: { label: '已取消', icon: <StopCircle className="size-3" />, className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  interrupted: { label: '已中断', icon: <AlertTriangle className="size-3" />, className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
};

export const CONTENT_TYPES = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'drama' },
  { label: '综艺', value: 'variety' },
  { label: '动漫', value: 'anime' },
  { label: '短剧', value: 'short_drama' },
];

export const JOB_STATUSES = [
  { label: '全部状态', value: 'all' },
  { label: '排队中', value: 'queued' },
  { label: '运行中', value: 'running' },
  { label: '正在取消', value: 'cancel_requested' },
  { label: '成功', value: 'success' },
  { label: '部分成功', value: 'partial_success' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
  { label: '已中断', value: 'interrupted' },
];

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">尚未运行</span>;
  const config = STATUS[status] ?? { label: status, icon: null, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.icon}{config.label}
    </span>
  );
}

export function contentTypeLabel(value?: string | null) {
  return CONTENT_TYPES.find(item => item.value === value)?.label ?? value ?? '-';
}

export const SOURCE_SORT_LABELS: Record<string, string> = {
  TIME: '按更新时间',
  RATING: '按评分',
  POPULARITY: '按热度',
};

export function sourceSortLabel(value?: string | null) {
  return value ? SOURCE_SORT_LABELS[value] ?? value : '-';
}

export const TRAVERSAL_MODE_LABELS: Record<string, string> = {
  CONTINUOUS_SYNC: '持续同步',
  BACKFILL_CONTINUE: '历史回填续爬',
  MANUAL_FULL: '人工全量扫描',
};

export function traversalModeLabel(value?: string | null) {
  return value ? TRAVERSAL_MODE_LABELS[value] ?? value : '-';
}

export function parseCrawlerTime(value: string) {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
}

export function formatCrawlerTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(parseCrawlerTime(value));
}

export function formatDuration(value?: number | null) {
  if (value == null) return '-';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} 秒`;
  return `${Math.floor(value / 60_000)} 分 ${Math.round((value % 60_000) / 1000)} 秒`;
}

export function elapsedFor(startedAt?: string | null, queuedAt?: string | null, durationMs?: number | null) {
  if (durationMs != null) return formatDuration(durationMs);
  const start = startedAt || queuedAt;
  return start ? formatDuration(Math.max(0, Date.now() - parseCrawlerTime(start).getTime())) : '-';
}

export function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-[13px] font-medium text-foreground/75">
        <span>{label}</span>
        {help && <InfoHint label={label} content={help} />}
      </p>
      {children}
    </div>
  );
}

export const crawlerPanelClass = 'rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.02]';
export const crawlerInsetClass = 'rounded-xl border border-border bg-muted/20';
export const crawlerDetailFieldClass = 'flex h-7 min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs';

export function CrawlerDetailField({
  label,
  children,
  title,
}: {
  label: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className={crawlerDetailFieldClass}>
      <dt className="shrink-0 text-foreground/60">{label}：</dt>
      <dd className="min-w-0 truncate text-foreground">
        {title ? <TooltipText className="truncate" content={title}>{children}</TooltipText> : children}
      </dd>
    </div>
  );
}

export const inputClass = 'h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';
