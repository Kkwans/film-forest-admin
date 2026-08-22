'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  MailCheck,
  RotateCcw,
  Search,
  Settings,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { useToast } from '@/components/ui/toast';
import {
  notificationApi,
  type AdminNotificationItem,
  type PageData,
} from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

const severityStyle = {
  ERROR: { icon: CircleAlert, box: 'bg-destructive/10 text-destructive', label: '错误' },
  WARNING: { icon: AlertTriangle, box: 'bg-amber-500/12 text-amber-700 dark:text-amber-300', label: '警告' },
  SUCCESS: { icon: CheckCircle2, box: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', label: '恢复' },
  INFO: { icon: Info, box: 'bg-sky-500/12 text-sky-700 dark:text-sky-300', label: '信息' },
} as const;

const EVENT_OPTIONS = [
  { label: '全部事件', value: 'all' },
  { label: '爬虫失败', value: 'CRAWLER_FAILED' },
  { label: '爬虫中断', value: 'CRAWLER_INTERRUPTED' },
  { label: '爬虫恢复', value: 'CRAWLER_RECOVERED' },
  { label: '数据异常', value: 'DATA_ANOMALY' },
  { label: '任务成功', value: 'CRAWLER_SUCCESS' },
];

const SEVERITY_OPTIONS = [
  { label: '全部级别', value: 'all' },
  { label: '错误', value: 'ERROR' },
  { label: '警告', value: 'WARNING' },
  { label: '恢复', value: 'SUCCESS' },
  { label: '信息', value: 'INFO' },
];

const eventLabels: Record<string, string> = Object.fromEntries(
  EVENT_OPTIONS.filter(option => option.value !== 'all').map(option => [option.value, option.label]),
);

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [eventType, setEventType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const announceChange = () => window.dispatchEvent(new Event('filmforest:notifications-changed'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listResponse, countResponse] = await Promise.all([
        notificationApi.list({
          page,
          size: 20,
          unreadOnly,
          eventType: eventType === 'all' ? undefined : eventType,
          severity: severity === 'all' ? undefined : severity,
          keyword: keyword || undefined,
        }),
        notificationApi.unreadCount(),
      ]);
      if (listResponse.data?.code === 200) {
        const data = listResponse.data.data as PageData<AdminNotificationItem>;
        setItems(data.records || []);
        setPages(Math.max(1, Number(data.pages || 1)));
        setTotal(Number(data.total || 0));
      }
      if (countResponse.data?.code === 200) {
        setUnreadCount(Number(countResponse.data.data?.count || 0));
      }
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '加载通知失败'));
    } finally {
      setLoading(false);
    }
  }, [eventType, keyword, page, severity, toast, unreadOnly]);

  const activeAdvancedFilters = eventType !== 'all' || severity !== 'all' || Boolean(keyword);

  const resetAdvancedFilters = () => {
    setEventType('all');
    setSeverity('all');
    setKeywordDraft('');
    setKeyword('');
    setPage(1);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const markRead = async (item: AdminNotificationItem) => {
    if (item.readAt) return;
    try {
      await notificationApi.markRead(item.id);
      setItems(current => current.map(entry => entry.id === item.id
        ? { ...entry, readAt: new Date().toISOString() }
        : entry));
      setUnreadCount(current => Math.max(0, current - 1));
      announceChange();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '标记通知失败'));
    }
  };

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      const readAt = new Date().toISOString();
      setItems(current => current.map(entry => ({ ...entry, readAt: entry.readAt || readAt })));
      setUnreadCount(0);
      announceChange();
      toast.success('所有通知已标记为已读');
      if (unreadOnly) await load();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '全部已读失败'));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">通知中心</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">聚合爬虫故障、恢复与数据质量告警</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/settings#notifications" />}>
            <Settings />通知偏好
          </Button>
          <Button variant="outline" size="sm" disabled={unreadCount === 0 || markingAll} onClick={markAllRead}>
            {markingAll ? <Loader2 className="animate-spin" /> : <Check />}
            全部已读
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div><p className="text-xs text-muted-foreground">未读通知</p><p className="mt-1 text-2xl font-bold">{unreadCount}</p></div>
            <Bell className="size-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div><p className="text-xs text-muted-foreground">当前结果</p><p className="mt-1 text-2xl font-bold">{total}</p></div>
            <MailCheck className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div><p className="text-xs text-muted-foreground">默认策略</p><p className="mt-1 text-sm font-semibold">异常必达，成功静默</p></div>
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b border-border" role="tablist" aria-label="通知筛选">
        {[
          { value: false, label: '全部通知' },
          { value: true, label: `仅未读${unreadCount ? ` (${unreadCount})` : ''}` },
        ].map(option => (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={unreadOnly === option.value}
            onClick={() => { setUnreadOnly(option.value); setPage(1); }}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              unreadOnly === option.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-border bg-card/70 p-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem_auto] md:items-end"
        onSubmit={event => {
          event.preventDefault();
          setKeyword(keywordDraft.trim());
          setPage(1);
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">通知内容</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={keywordDraft}
              onChange={event => setKeywordDraft(event.target.value)}
              placeholder="搜索标题或详情"
              maxLength={100}
              className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">事件类型</span>
          <Select
            value={eventType}
            options={EVENT_OPTIONS}
            onChange={value => { setEventType(value); setPage(1); }}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">通知级别</span>
          <Select
            value={severity}
            options={SEVERITY_OPTIONS}
            onChange={value => { setSeverity(value); setPage(1); }}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm"><Search />查询</Button>
          {activeAdvancedFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={resetAdvancedFilters}>
              <RotateCcw />重置
            </Button>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />加载通知…
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Bell className="size-6" />
            </span>
            <p className="font-semibold text-foreground">
              {activeAdvancedFilters ? '没有符合当前条件的通知' : unreadOnly ? '没有未读通知' : '还没有通知'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {activeAdvancedFilters ? '可调整事件、级别或关键词后重新查询。' : '爬虫出现失败、中断或恢复时会在这里留下可追踪记录。'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(item => {
              const style = severityStyle[item.severity] || severityStyle.INFO;
              const Icon = style.icon;
              return (
                <article
                  key={item.id}
                  className={`group grid gap-3 p-4 transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-start sm:p-5 ${
                    item.readAt ? 'bg-card' : 'bg-primary/[0.035] hover:bg-primary/[0.06]'
                  }`}
                >
                  <span className={`flex size-10 items-center justify-center rounded-xl ${style.box}`}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">{item.title}</h2>
                      {!item.readAt && <span className="size-2 rounded-full bg-primary" aria-label="未读" />}
                      <Badge variant="outline" className="font-normal">{style.label}</Badge>
                      <Badge variant="secondary" className="font-normal">
                        {eventLabels[item.eventType] || item.eventType}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.message}</p>
                    <time className="mt-2 block text-xs text-muted-foreground/75" dateTime={item.createdAt}>
                      {formatDate(item.createdAt)}
                    </time>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-self-start sm:justify-self-end">
                    {!item.readAt && (
                      <Button variant="ghost" size="sm" onClick={() => void markRead(item)}>
                        <Check />标记已读
                      </Button>
                    )}
                    {item.link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={item.link} onClick={() => void markRead(item)} />}
                      >
                        查看详情<ChevronRight />
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
    </div>
  );
}
