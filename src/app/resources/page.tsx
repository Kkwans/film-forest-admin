'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  Ban,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  Eye,
  HardDrive,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from 'lucide-react';
import type { AxiosResponse } from 'axios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { useDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  crawlerApi,
  resourceApi,
  type CrawlerSourceDescriptor,
  type ResourcePageQuery,
  type SaveCloudData,
  type SaveMagnetData,
  type SaveOnlineData,
  type SaveSourceData,
} from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

type ResourceKind = 'online' | 'magnet' | 'cloud';
type ResourceStatus = 'ACTIVE' | 'DISABLED' | 'REMOVED';

interface ResourceStats {
  online: number;
  magnet: number;
  cloud: number;
  todayNew: number;
}

interface BaseResource {
  id: number;
  contentType: string;
  contentId: number;
  sourceCode?: string;
  enabled?: number;
  removedAt?: string | null;
  sort?: number;
  createdAt?: string;
  updatedAt?: string;
  resourceKey?: string;
  rawText?: string;
  lastSeenAt?: string;
  contentTitle?: string | null;
  contentAlias?: string | null;
  contentPosterUrl?: string | null;
  contentYear?: number | null;
  contentReleaseDate?: string | null;
}

interface OnlineResource extends BaseResource {
  season?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  sourceName: string;
  sourceUrl: string;
  sourcePageUrl?: string;
  playbackType?: 'HLS' | 'VIDEO' | 'EMBED' | 'EXTERNAL_PAGE' | '';
}

interface MagnetResource extends BaseResource {
  title?: string;
  magnetUrl: string;
  resolution?: string;
  hasSubtitle?: boolean;
  isSpecialSub?: boolean;
}

interface CloudResource extends BaseResource {
  title?: string;
  diskType?: string;
  url: string;
  password?: string;
}

type ResourceRecord = OnlineResource | MagnetResource | CloudResource;

interface ResourceSource {
  id: number;
  code: string;
  name: string;
  url: string;
  enabled: number;
  sort: number;
}

interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

interface ResourceFilter {
  keyword: string;
  contentType: string;
  source: string;
  status: string;
  variant: string;
  sort: string;
}

interface ResourcePageState {
  records: ResourceRecord[];
  total: number;
  current: number;
  pages: number;
  loading: boolean;
  loaded: boolean;
}

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

const PAGE_SIZE = 20;
const INPUT_CLASS = 'h-9 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25';

const KIND_META = {
  online: { label: '在线资源', icon: RadioTower },
  magnet: { label: '磁力资源', icon: Link2 },
  cloud: { label: '网盘资源', icon: Cloud },
} satisfies Record<ResourceKind, { label: string; icon: typeof Link2 }>;

const CONTENT_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'movie', label: '电影' },
  { value: 'drama', label: '剧集' },
  { value: 'variety', label: '综艺' },
  { value: 'anime', label: '动漫' },
  { value: 'short_drama', label: '短剧' },
];

const CONTENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_TYPE_OPTIONS.filter(option => option.value).map(option => [option.value, option.label]),
);

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'ACTIVE', label: '正常' },
  { value: 'DISABLED', label: '已禁用' },
  { value: 'REMOVED', label: '来源失效' },
];

const RESOLUTION_OPTIONS = [
  { value: '', label: '全部清晰度' },
  { value: '4K', label: '4K' },
  { value: '2160P', label: '2160P' },
  { value: '1080P', label: '1080P' },
  { value: '720P', label: '720P' },
  { value: 'BluRay', label: 'BluRay' },
];

const DISK_TYPE_OPTIONS = [
  { value: '', label: '全部网盘' },
  { value: 'baidu', label: '百度网盘' },
  { value: 'quark', label: '夸克网盘' },
  { value: 'thunder', label: '迅雷网盘' },
  { value: 'uc', label: 'UC 网盘' },
  { value: 'ali', label: '阿里网盘' },
  { value: '123', label: '123 网盘' },
];

const DISK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DISK_TYPE_OPTIONS.filter(option => option.value).map(option => [option.value, option.label]),
);

const PLAYBACK_TYPE_OPTIONS = [
  { value: '', label: '自动识别' },
  { value: 'HLS', label: 'HLS 串流（m3u8）' },
  { value: 'VIDEO', label: '视频直链（mp4/webm）' },
  { value: 'EMBED', label: '可嵌入播放器' },
  { value: 'EXTERNAL_PAGE', label: '仅外部页面' },
];

const PLAYBACK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PLAYBACK_TYPE_OPTIONS.filter(option => option.value).map(option => [option.value, option.label]),
);

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: '最近创建' },
  { value: 'updatedAt:desc', label: '最近更新' },
  { value: 'contentId:asc', label: '内容 ID' },
  { value: 'title:asc', label: '标题' },
  { value: 'sort:asc', label: '资源顺序' },
];

function blankFilter(): ResourceFilter {
  return { keyword: '', contentType: '', source: '', status: '', variant: '', sort: 'createdAt:desc' };
}

function blankPage(): ResourcePageState {
  return { records: [], total: 0, current: 1, pages: 0, loading: false, loaded: false };
}

function requireData<T>(response: AxiosResponse<ApiEnvelope<T>>, fallback: string): T {
  if (response.data?.code !== 200) throw new Error(response.data?.message || fallback);
  return response.data.data;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function resourceStatus(resource: BaseResource): ResourceStatus {
  if (resource.removedAt) return 'REMOVED';
  return resource.enabled === 0 ? 'DISABLED' : 'ACTIVE';
}

function StatusBadge({ resource }: { resource: BaseResource }) {
  const status = resourceStatus(resource);
  const styles = status === 'ACTIVE'
    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
    : status === 'REMOVED'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : 'bg-muted text-muted-foreground';
  const label = status === 'ACTIVE' ? '正常' : status === 'REMOVED' ? '来源失效' : '已禁用';
  return <Badge className={styles}>{label}</Badge>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid min-w-0 gap-1.5"><span className="text-sm font-medium text-foreground">{label}</span>{children}{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</label>;
}

function resourceTitle(kind: ResourceKind, resource: ResourceRecord): string {
  if (kind === 'online') {
    const online = resource as OnlineResource;
    const prefix = [online.season ? `第 ${online.season} 季` : '', online.episodeNumber ? `第 ${online.episodeNumber} 集` : ''].filter(Boolean).join(' · ');
    return [prefix, online.episodeTitle].filter(Boolean).join(' · ') || online.sourceName || '在线资源';
  }
  if (kind === 'magnet') return (resource as MagnetResource).title || '磁力资源';
  return (resource as CloudResource).title || '网盘资源';
}

function resourceVariant(kind: ResourceKind, resource: ResourceRecord): string {
  if (kind === 'online') {
    const online = resource as OnlineResource;
    return [online.sourceName || '在线播放', PLAYBACK_TYPE_LABELS[online.playbackType || ''] || online.playbackType]
      .filter(Boolean).join(' · ');
  }
  if (kind === 'magnet') {
    const magnet = resource as MagnetResource;
    return [magnet.resolution, magnet.hasSubtitle ? '有字幕' : '', magnet.isSpecialSub ? '特效字幕' : ''].filter(Boolean).join(' · ') || '未标注';
  }
  const cloud = resource as CloudResource;
  return DISK_TYPE_LABELS[cloud.diskType || ''] || cloud.diskType || '未标注';
}

function resourceLink(kind: ResourceKind, resource: ResourceRecord): string {
  if (kind === 'online') return (resource as OnlineResource).sourceUrl;
  if (kind === 'magnet') return (resource as MagnetResource).magnetUrl;
  return (resource as CloudResource).url;
}

function contentAssociation(resource: BaseResource): string {
  const title = resource.contentTitle?.trim();
  if (!title) return `${CONTENT_TYPE_LABELS[resource.contentType] || resource.contentType} #${resource.contentId}`;
  return resource.contentYear ? `${title}（${resource.contentYear}）` : title;
}

function contentAlias(value?: string | null): string {
  if (!value) return '—';
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string' && item.trim()).join(' / ') || '—';
  } catch {
    // 兼容历史单值别名。
  }
  return value;
}

function ContentAssociation({ resource }: { resource: Partial<BaseResource> }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-medium text-primary">关联内容</p>
      <p className="mt-1 truncate font-medium text-foreground">
        {resource.contentTitle || '尚未读取内容名称'}
        {resource.contentYear ? `（${resource.contentYear}）` : ''}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {CONTENT_TYPE_LABELS[resource.contentType || ''] || resource.contentType || '未选择类型'} · 内容 #{resource.contentId || '—'}
      </p>
      {resource.contentAlias && <p className="mt-1 truncate text-xs text-muted-foreground">别名：{contentAlias(resource.contentAlias)}</p>}
    </div>
  );
}

export default function ResourcesPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [activeKind, setActiveKind] = useState<ResourceKind>('online');
  const [stats, setStats] = useState<ResourceStats>({ online: 0, magnet: 0, cloud: 0, todayNew: 0 });
  const [baseLoading, setBaseLoading] = useState(true);
  const [sources, setSources] = useState<ResourceSource[]>([]);
  const [adapterMap, setAdapterMap] = useState<Record<string, string[]>>({});
  const [pages, setPages] = useState<Record<ResourceKind, ResourcePageState>>({
    online: blankPage(), magnet: blankPage(), cloud: blankPage(),
  });
  const [draftFilters, setDraftFilters] = useState<Record<ResourceKind, ResourceFilter>>({
    online: blankFilter(), magnet: blankFilter(), cloud: blankFilter(),
  });
  const [appliedFilters, setAppliedFilters] = useState<Record<ResourceKind, ResourceFilter>>({
    online: blankFilter(), magnet: blankFilter(), cloud: blankFilter(),
  });
  const [editingOnline, setEditingOnline] = useState<Partial<OnlineResource> | null>(null);
  const [editingMagnet, setEditingMagnet] = useState<Partial<MagnetResource> | null>(null);
  const [editingCloud, setEditingCloud] = useState<Partial<CloudResource> | null>(null);
  const [editingSource, setEditingSource] = useState<Partial<ResourceSource> | null>(null);
  const [detailResource, setDetailResource] = useState<{ kind: ResourceKind; resource: ResourceRecord } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const sourceOptions = useMemo(() => [
    { value: '', label: '全部来源' },
    ...sources.map(source => ({ value: source.code, label: `${source.name} · ${source.code}` })),
  ], [sources]);

  const defaultSourceCode = sources.find(source => source.enabled === 1)?.code || 'pkmp4';

  const fetchBaseData = useCallback(async () => {
    setBaseLoading(true);
    try {
      const [statsResponse, sourceResponse] = await Promise.all([
        resourceApi.getStats() as Promise<AxiosResponse<ApiEnvelope<ResourceStats>>>,
        resourceApi.listSources() as Promise<AxiosResponse<ApiEnvelope<ResourceSource[]>>>,
      ]);
      setStats(requireData(statsResponse, '资源统计加载失败'));
      setSources(requireData(sourceResponse, '资源来源加载失败'));
      try {
        const catalogResponse = await crawlerApi.listSources() as AxiosResponse<ApiEnvelope<CrawlerSourceDescriptor[]>>;
        const catalog = requireData(catalogResponse, '来源适配器加载失败');
        setAdapterMap(Object.fromEntries(catalog.map(source => [
          source.code,
          source.adapters.map(adapter => `${CONTENT_TYPE_LABELS[adapter.contentType] || adapter.contentType} · ${adapter.code}`),
        ])));
      } catch (error: unknown) {
        setAdapterMap({});
        toast.warning(extractErrorMessage(error, '来源适配器加载失败'));
      }
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '资源基础数据加载失败'));
    } finally {
      setBaseLoading(false);
    }
  }, [toast]);

  const fetchResourcePage = useCallback(async (kind: ResourceKind, page: number, filter: ResourceFilter) => {
    setPages(previous => ({ ...previous, [kind]: { ...previous[kind], loading: true } }));
    const [sort, order] = filter.sort.split(':') as [ResourcePageQuery['sort'], ResourcePageQuery['order']];
    const params: ResourcePageQuery = {
      page,
      size: PAGE_SIZE,
      keyword: filter.keyword.trim() || undefined,
      contentType: filter.contentType || undefined,
      source: filter.source || undefined,
      status: (filter.status || undefined) as ResourcePageQuery['status'],
      resolution: kind === 'magnet' ? filter.variant || undefined : undefined,
      diskType: kind === 'cloud' ? filter.variant || undefined : undefined,
      sort,
      order,
    };
    try {
      const response = (kind === 'online'
        ? await resourceApi.listOnline(params)
        : kind === 'magnet'
          ? await resourceApi.listMagnet(params)
          : await resourceApi.listCloud(params)) as AxiosResponse<ApiEnvelope<PageResult<ResourceRecord>>>;
      const result = requireData(response, `${KIND_META[kind].label}加载失败`);
      setPages(previous => ({
        ...previous,
        [kind]: {
          records: Array.isArray(result.records) ? result.records : [],
          total: Number(result.total) || 0,
          current: Number(result.current) || page,
          pages: Number(result.pages) || 0,
          loading: false,
          loaded: true,
        },
      }));
    } catch (error: unknown) {
      setPages(previous => ({ ...previous, [kind]: { ...previous[kind], loading: false, loaded: true } }));
      toast.error(extractErrorMessage(error, `${KIND_META[kind].label}加载失败`));
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchBaseData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchBaseData]);

  const activePage = pages[activeKind];
  useEffect(() => {
    if (activePage.loaded || activePage.loading) return;
    const timer = window.setTimeout(
      () => void fetchResourcePage(activeKind, 1, appliedFilters[activeKind]),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [activeKind, activePage.loaded, activePage.loading, appliedFilters, fetchResourcePage]);

  const updateDraftFilter = (patch: Partial<ResourceFilter>) => {
    setDraftFilters(previous => ({
      ...previous,
      [activeKind]: { ...previous[activeKind], ...patch },
    }));
  };

  const applyFilter = () => {
    const next = { ...draftFilters[activeKind] };
    setAppliedFilters(previous => ({ ...previous, [activeKind]: next }));
    void fetchResourcePage(activeKind, 1, next);
  };

  const resetFilter = () => {
    const next = blankFilter();
    setDraftFilters(previous => ({ ...previous, [activeKind]: next }));
    setAppliedFilters(previous => ({ ...previous, [activeKind]: next }));
    void fetchResourcePage(activeKind, 1, next);
  };

  const refreshCurrent = async () => {
    await Promise.all([
      fetchBaseData(),
      fetchResourcePage(activeKind, activePage.current, appliedFilters[activeKind]),
    ]);
  };

  const openAdd = () => {
    if (activeKind === 'online') {
      setEditingOnline({ contentType: 'movie', contentId: 0, sourceCode: defaultSourceCode, sourceName: '', sourceUrl: '', sourcePageUrl: '', playbackType: undefined, season: 1, sort: 0, enabled: 1 });
    } else if (activeKind === 'magnet') {
      setEditingMagnet({ contentType: 'movie', contentId: 0, sourceCode: defaultSourceCode, title: '', magnetUrl: '', resolution: '', hasSubtitle: false, isSpecialSub: false, sort: 0, enabled: 1 });
    } else {
      setEditingCloud({ contentType: 'movie', contentId: 0, sourceCode: defaultSourceCode, title: '', diskType: 'baidu', url: '', password: '', sort: 0, enabled: 1 });
    }
  };

  const saveResource = async (kind: ResourceKind) => {
    const draft = kind === 'online' ? editingOnline : kind === 'magnet' ? editingMagnet : editingCloud;
    if (!draft?.contentId || !draft.contentType) {
      toast.warning('请选择内容类型并填写有效的内容 ID');
      return;
    }
    if (kind === 'online' && !(editingOnline?.sourceName?.trim() && editingOnline.sourceUrl?.trim())) {
      toast.warning('请填写播放来源名称和 URL');
      return;
    }
    if (kind === 'magnet' && !editingMagnet?.magnetUrl?.trim()) {
      toast.warning('请填写磁力链接');
      return;
    }
    if (kind === 'cloud' && !editingCloud?.url?.trim()) {
      toast.warning('请填写网盘分享链接');
      return;
    }
    setSaving(true);
    try {
      const response = (kind === 'online'
        ? await resourceApi.saveOnline(editingOnline as SaveOnlineData)
        : kind === 'magnet'
          ? await resourceApi.saveMagnet(editingMagnet as SaveMagnetData)
          : await resourceApi.saveCloud(editingCloud as SaveCloudData)) as AxiosResponse<ApiEnvelope<ResourceRecord>>;
      requireData(response, '资源保存失败');
      setEditingOnline(null);
      setEditingMagnet(null);
      setEditingCloud(null);
      toast.success(draft.id ? '资源已更新' : '资源已创建');
      await Promise.all([
        fetchResourcePage(kind, draft.id ? pages[kind].current : 1, appliedFilters[kind]),
        fetchBaseData(),
      ]);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '资源保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleResource = async (kind: ResourceKind, resource: ResourceRecord) => {
    const restore = resourceStatus(resource) !== 'ACTIVE';
    setActionId(resource.id);
    try {
      const response = (kind === 'online'
        ? await resourceApi.toggleOnline(resource.id, restore)
        : kind === 'magnet'
          ? await resourceApi.toggleMagnet(resource.id, restore)
          : await resourceApi.toggleCloud(resource.id, restore)) as AxiosResponse<ApiEnvelope<boolean>>;
      if (!requireData(response, '资源状态更新失败')) throw new Error('资源不存在或状态未更新');
      toast.success(restore ? '资源已恢复' : '资源已禁用');
      await fetchResourcePage(kind, pages[kind].current, appliedFilters[kind]);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '资源状态更新失败'));
    } finally {
      setActionId(null);
    }
  };

  const deleteResource = async (kind: ResourceKind, resource: ResourceRecord) => {
    const confirmed = await dialog.confirm({
      title: `删除${KIND_META[kind].label}`,
      content: `确定删除“${resourceTitle(kind, resource)}”？该操作不会删除关联内容。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!confirmed) return;
    setActionId(resource.id);
    try {
      const response = (kind === 'online'
        ? await resourceApi.deleteOnline(resource.id)
        : kind === 'magnet'
          ? await resourceApi.deleteMagnet(resource.id)
          : await resourceApi.deleteCloud(resource.id)) as AxiosResponse<ApiEnvelope<boolean>>;
      if (!requireData(response, '资源删除失败')) throw new Error('资源不存在或已删除');
      toast.success('资源已删除');
      await Promise.all([
        fetchResourcePage(kind, pages[kind].current, appliedFilters[kind]),
        fetchBaseData(),
      ]);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '资源删除失败'));
    } finally {
      setActionId(null);
    }
  };

  const editResource = (kind: ResourceKind, resource: ResourceRecord) => {
    if (kind === 'online') setEditingOnline({ ...(resource as OnlineResource) });
    if (kind === 'magnet') setEditingMagnet({ ...(resource as MagnetResource) });
    if (kind === 'cloud') setEditingCloud({ ...(resource as CloudResource) });
  };

  const copyResourceLink = async (kind: ResourceKind, resource: ResourceRecord) => {
    try {
      await navigator.clipboard.writeText(resourceLink(kind, resource));
      toast.success('资源链接已复制');
    } catch {
      toast.error('复制失败，请在详情中手工复制');
    }
  };

  const saveSource = async () => {
    if (!editingSource) return;
    const code = editingSource.code?.trim().toLowerCase() || '';
    if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code)) {
      toast.warning('来源编码需为 2-50 位小写字母、数字、下划线或短横线');
      return;
    }
    if (!editingSource.name?.trim() || !editingSource.url?.trim()) {
      toast.warning('请填写来源名称和链接');
      return;
    }
    setSaving(true);
    try {
      const payload: SaveSourceData = {
        id: editingSource.id,
        code,
        name: editingSource.name.trim(),
        url: editingSource.url.trim(),
        enabled: editingSource.enabled ?? 0,
        sort: editingSource.sort ?? 0,
      };
      const response = await resourceApi.saveSource(payload) as AxiosResponse<ApiEnvelope<ResourceSource>>;
      requireData(response, '来源保存失败');
      setEditingSource(null);
      toast.success('来源已保存');
      await fetchBaseData();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '来源保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = async (source: ResourceSource) => {
    setActionId(source.id);
    try {
      const response = await resourceApi.toggleSource(source.id, source.enabled !== 1) as AxiosResponse<ApiEnvelope<boolean>>;
      if (!requireData(response, '来源状态更新失败')) throw new Error('来源不存在或状态未更新');
      toast.success(source.enabled === 1 ? '来源已禁用' : '来源已启用');
      await fetchBaseData();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '来源状态更新失败'));
    } finally {
      setActionId(null);
    }
  };

  const deleteSource = async (source: ResourceSource) => {
    const confirmed = await dialog.confirm({
      title: '删除资源来源',
      content: `确定删除“${source.name}”？若已有爬虫适配器或资源引用，服务端会拒绝该操作。`,
      confirmText: '删除', cancelText: '取消', variant: 'danger',
    });
    if (!confirmed) return;
    setActionId(source.id);
    try {
      const response = await resourceApi.deleteSource(source.id) as AxiosResponse<ApiEnvelope<boolean>>;
      if (!requireData(response, '来源删除失败')) throw new Error('来源不存在或无法删除');
      toast.success('来源已删除');
      await fetchBaseData();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '来源删除失败'));
    } finally {
      setActionId(null);
    }
  };

  const currentFilter = draftFilters[activeKind];
  const activeMeta = KIND_META[activeKind];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Resource operations</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">资源管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">分页管理在线播放、磁力、网盘资源及其爬取来源。</p>
        </div>
        <Button variant="outline" onClick={() => void refreshCurrent()} disabled={baseLoading || activePage.loading}>
          <RefreshCw className={baseLoading || activePage.loading ? 'animate-spin' : ''} />刷新当前视图
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '在线资源', value: stats.online, icon: RadioTower },
          { label: '磁力资源', value: stats.magnet, icon: Link2 },
          { label: '网盘资源', value: stats.cloud, icon: Database },
          { label: '今日新增', value: stats.todayNew, icon: HardDrive },
        ].map(item => <Card key={item.label} className="border-border bg-card"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{baseLoading ? '-' : item.value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="size-5" /></span></CardContent></Card>)}
      </div>

      <Card className="overflow-visible border-border bg-card">
        <CardContent className="p-0">
          <div className="flex overflow-x-auto border-b border-border p-2" role="tablist" aria-label="资源类型">
            {(Object.keys(KIND_META) as ResourceKind[]).map(kind => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              return <button key={kind} type="button" role="tab" aria-selected={activeKind === kind} onClick={() => setActiveKind(kind)} className={`flex min-w-max items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeKind === kind ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" />{meta.label}</button>;
            })}
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="relative sm:col-span-2 xl:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={currentFilter.keyword} onChange={event => updateDraftFilter({ keyword: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') applyFilter(); }} placeholder="搜索标题、链接或原始文本" className={`${INPUT_CLASS} pl-9`} />
              </div>
              <Select value={currentFilter.contentType} onChange={contentType => updateDraftFilter({ contentType })} options={CONTENT_TYPE_OPTIONS} />
              <Select value={currentFilter.source} onChange={source => updateDraftFilter({ source })} options={sourceOptions} searchable />
              <Select value={currentFilter.status} onChange={status => updateDraftFilter({ status })} options={STATUS_OPTIONS} />
              {activeKind === 'magnet' ? <Select value={currentFilter.variant} onChange={variant => updateDraftFilter({ variant })} options={RESOLUTION_OPTIONS} /> : activeKind === 'cloud' ? <Select value={currentFilter.variant} onChange={variant => updateDraftFilter({ variant })} options={DISK_TYPE_OPTIONS} /> : <Select value={currentFilter.sort} onChange={sort => updateDraftFilter({ sort })} options={SORT_OPTIONS} />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeKind !== 'online' && <Select value={currentFilter.sort} onChange={sort => updateDraftFilter({ sort })} options={SORT_OPTIONS} className="w-36" size="sm" />}
              <Button size="sm" onClick={applyFilter} disabled={activePage.loading}>应用筛选</Button>
              <Button size="sm" variant="outline" onClick={resetFilter} disabled={activePage.loading}>重置</Button>
              <span className="ml-auto text-xs text-muted-foreground">共 {activePage.total} 条</span>
              <Button size="sm" onClick={openAdd}><Plus />新增{activeMeta.label}</Button>
            </div>

            {activePage.loading ? (
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin" />加载 {activeMeta.label}</span></div>
            ) : activePage.records.length === 0 ? (
              <div className="grid min-h-64 place-items-center text-center"><div><ArchiveRestore className="mx-auto size-10 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium text-foreground">当前条件下没有{activeMeta.label}</p><p className="mt-1 text-xs text-muted-foreground">资源会在爬虫解析或管理员录入后出现在这里。</p></div></div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1100px] table-fixed text-sm">
                    <colgroup><col className="w-[23%]" /><col className="w-[9%]" /><col className="w-[24%]" /><col className="w-[15%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[10%]" /></colgroup>
                    <thead><tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground"><th className="px-3 py-2.5">关联内容</th><th className="px-3 py-2.5 text-center">来源</th><th className="px-3 py-2.5">资源 / 剧集</th><th className="px-3 py-2.5">规格</th><th className="px-3 py-2.5 text-center">状态</th><th className="px-3 py-2.5 text-center">更新时间</th><th className="px-3 py-2.5 text-center">操作</th></tr></thead>
                    <tbody>{activePage.records.map(resource => <tr key={resource.id} className="border-b border-border/60 align-middle hover:bg-muted/25"><td className="max-w-56 px-3 py-3"><p className="truncate font-medium text-foreground" title={contentAssociation(resource)}>{contentAssociation(resource)}</p><p className="mt-1 text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[resource.contentType] || resource.contentType} · 内容 #{resource.contentId} · 资源 #{resource.id}</p></td><td className="px-3 py-3 text-center"><div className="flex justify-center"><Badge variant="outline">{resource.sourceCode || '手工录入'}</Badge></div></td><td className="max-w-72 px-3 py-3"><p className="truncate font-medium text-foreground" title={resourceTitle(activeKind, resource)}>{resourceTitle(activeKind, resource)}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={resourceLink(activeKind, resource)}>{resourceLink(activeKind, resource)}</p></td><td className="px-3 py-3 text-xs text-muted-foreground">{resourceVariant(activeKind, resource)}</td><td className="px-3 py-3 text-center"><div className="flex justify-center"><StatusBadge resource={resource} /></div></td><td className="px-3 py-3 text-center text-xs tabular-nums text-muted-foreground">{formatDate(resource.updatedAt || resource.createdAt)}</td><td className="px-3 py-3"><div className="flex justify-center gap-1"><Button variant="ghost" size="icon" title="查看详情" aria-label="查看详情" onClick={() => setDetailResource({ kind: activeKind, resource })}><Eye /></Button><Button variant="ghost" size="icon" title="复制链接" aria-label="复制链接" onClick={() => void copyResourceLink(activeKind, resource)}><Copy /></Button><Button variant="ghost" size="icon" title="编辑" aria-label="编辑" onClick={() => editResource(activeKind, resource)}><Pencil /></Button><Button variant="ghost" size="icon" title={resourceStatus(resource) === 'ACTIVE' ? '禁用' : '恢复'} aria-label={resourceStatus(resource) === 'ACTIVE' ? '禁用' : '恢复'} disabled={actionId === resource.id} onClick={() => void toggleResource(activeKind, resource)}>{resourceStatus(resource) === 'ACTIVE' ? <Ban /> : <CheckCircle2 />}</Button><Button variant="destructive" size="icon" title="删除" aria-label="删除" disabled={actionId === resource.id} onClick={() => void deleteResource(activeKind, resource)}><Trash2 /></Button></div></td></tr>)}</tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:hidden">{activePage.records.map(resource => <article key={resource.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{CONTENT_TYPE_LABELS[resource.contentType] || resource.contentType}</Badge><StatusBadge resource={resource} /></div><h3 className="mt-2 break-words text-sm font-semibold text-foreground">{contentAssociation(resource)}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{resourceTitle(activeKind, resource)} · {resource.sourceCode || '手工录入'}</p><p className="mt-1 text-xs text-muted-foreground">内容 #{resource.contentId} · 资源 #{resource.id}</p></div><Button variant="ghost" size="icon" title="查看详情" onClick={() => setDetailResource({ kind: activeKind, resource })}><Eye /></Button></div><p className="mt-3 text-xs text-muted-foreground">{resourceVariant(activeKind, resource)} · {formatDate(resource.updatedAt || resource.createdAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyResourceLink(activeKind, resource)}><Copy />复制</Button><Button size="sm" variant="outline" onClick={() => editResource(activeKind, resource)}><Pencil />编辑</Button><Button size="sm" variant="outline" disabled={actionId === resource.id} onClick={() => void toggleResource(activeKind, resource)}>{resourceStatus(resource) === 'ACTIVE' ? <Ban /> : <CheckCircle2 />}{resourceStatus(resource) === 'ACTIVE' ? '禁用' : '恢复'}</Button><Button size="sm" variant="destructive" disabled={actionId === resource.id} onClick={() => void deleteResource(activeKind, resource)}><Trash2 />删除</Button></div></article>)}</div>
              </>
            )}

            {activePage.pages > 1 && <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">第 {activePage.current} / {activePage.pages} 页</p><Pagination currentPage={activePage.current} totalPages={activePage.pages} onPageChange={page => void fetchResourcePage(activeKind, page, appliedFilters[activeKind])} /></div>}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-foreground">资源来源</h2><p className="text-sm text-muted-foreground">一个来源可关联多个内容类型适配器；本轮只启用七味网生产适配器。</p></div><Button onClick={() => setEditingSource({ code: '', name: '', url: '', enabled: 0, sort: sources.length * 10 })}><Plus />新增扩展位</Button></div>
        <div className="grid gap-3 lg:grid-cols-2">{sources.length === 0 && !baseLoading ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">暂无资源来源</CardContent></Card> : sources.map(source => <Card key={source.id} className="border-border bg-card"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">{source.name}</h3><Badge variant="outline">{source.code}</Badge>{source.code === 'pkmp4' && <Badge className="bg-primary/10 text-primary">生产来源</Badge>}<Badge className={source.enabled === 1 ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}>{source.enabled === 1 ? '已启用' : '已禁用'}</Badge></div><a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"><ExternalLink className="size-3" />{source.url}</a></div><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Server className="size-4" /></span></div><div className="mt-3 flex flex-wrap gap-1.5">{(adapterMap[source.code] || []).map(adapter => <span key={adapter} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{adapter}</span>)}{source.enabled === 1 && !adapterMap[source.code]?.length && <span className="text-xs text-amber-700 dark:text-amber-300">尚未关联可用适配器</span>}{source.enabled !== 1 && <span className="text-xs text-muted-foreground">启用后才进入爬虫来源目录</span>}</div><div className="mt-4 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setEditingSource({ ...source })}><Pencil />编辑</Button><Button size="sm" variant="outline" disabled={actionId === source.id} onClick={() => void toggleSource(source)}>{source.enabled === 1 ? <Ban /> : <CheckCircle2 />}{source.enabled === 1 ? '禁用' : '启用'}</Button><Button size="sm" variant="destructive" disabled={source.code === 'pkmp4' || actionId === source.id} title={source.code === 'pkmp4' ? '生产来源不可删除' : '删除来源'} onClick={() => void deleteSource(source)}><Trash2 />删除</Button></div></CardContent></Card>)}</div>
      </section>

      <Modal open={!!editingOnline} onClose={() => setEditingOnline(null)} title={editingOnline?.id ? '编辑在线资源' : '新增在线资源'} description="关联内容、来源和具体剧集；保存后仅刷新当前资源页。" width="lg" footer={<><Button variant="outline" onClick={() => setEditingOnline(null)}>取消</Button><Button disabled={saving} onClick={() => void saveResource('online')}>{saving && <Loader2 className="animate-spin" />}保存</Button></>}>
        {editingOnline && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><ContentAssociation resource={editingOnline} /></div>
            <Field label="内容类型"><Select value={editingOnline.contentType || 'movie'} onChange={contentType => setEditingOnline(current => ({ ...current, contentType }))} options={CONTENT_TYPE_OPTIONS.filter(option => option.value)} /></Field>
            <Field label="内容 ID"><input type="number" min={1} value={editingOnline.contentId || ''} onChange={event => setEditingOnline(current => ({ ...current, contentId: Number(event.target.value) }))} className={INPUT_CLASS} /></Field>
            <Field label="来源编码"><Select value={editingOnline.sourceCode || ''} onChange={sourceCode => setEditingOnline(current => ({ ...current, sourceCode }))} options={sourceOptions.filter(option => option.value)} searchable /></Field>
            <Field label="来源显示名称"><input value={editingOnline.sourceName || ''} onChange={event => setEditingOnline(current => ({ ...current, sourceName: event.target.value }))} className={INPUT_CLASS} placeholder="例如：七味线路" /></Field>
            <Field label="播放类型" hint="HLS/视频直链使用站内播放器；可嵌入播放器使用安全 iframe；外部页面仅作为降级跳转。">
              <Select value={editingOnline.playbackType || ''} onChange={playbackType => setEditingOnline(current => ({ ...current, playbackType: playbackType as OnlineResource['playbackType'] }))} options={PLAYBACK_TYPE_OPTIONS} />
            </Field>
            <Field label="季"><input type="number" min={1} value={editingOnline.season || ''} onChange={event => setEditingOnline(current => ({ ...current, season: Number(event.target.value) || undefined }))} className={INPUT_CLASS} /></Field>
            <div className="sm:col-span-2">
              <Field label="真实播放 URL" hint="填写 m3u8、mp4/webm、可嵌入播放器地址或只能外跳的页面地址。">
                <input type="url" value={editingOnline.sourceUrl || ''} onChange={event => setEditingOnline(current => ({ ...current, sourceUrl: event.target.value }))} className={INPUT_CLASS} placeholder="https://..." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="来源详情页 URL（可选）" hint="用于溯源和播放失败时降级；不要把来源详情页误填为真实媒体地址。">
                <input type="url" value={editingOnline.sourcePageUrl || ''} onChange={event => setEditingOnline(current => ({ ...current, sourcePageUrl: event.target.value }))} className={INPUT_CLASS} placeholder="https://.../detail/..." />
              </Field>
            </div>
            <Field label="集 / 期"><input type="number" min={0} value={editingOnline.episodeNumber || ''} onChange={event => setEditingOnline(current => ({ ...current, episodeNumber: Number(event.target.value) || undefined }))} className={INPUT_CLASS} /></Field>
            <Field label="集标题"><input value={editingOnline.episodeTitle || ''} onChange={event => setEditingOnline(current => ({ ...current, episodeTitle: event.target.value }))} className={INPUT_CLASS} /></Field>
            <Field label="排序"><input type="number" value={editingOnline.sort ?? 0} onChange={event => setEditingOnline(current => ({ ...current, sort: Number(event.target.value) }))} className={INPUT_CLASS} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!editingMagnet} onClose={() => setEditingMagnet(null)} title={editingMagnet?.id ? '编辑磁力资源' : '新增磁力资源'} width="lg" footer={<><Button variant="outline" onClick={() => setEditingMagnet(null)}>取消</Button><Button disabled={saving} onClick={() => void saveResource('magnet')}>{saving && <Loader2 className="animate-spin" />}保存</Button></>}>
        {editingMagnet && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><ContentAssociation resource={editingMagnet} /></div><Field label="内容类型"><Select value={editingMagnet.contentType || 'movie'} onChange={contentType => setEditingMagnet(current => ({ ...current, contentType }))} options={CONTENT_TYPE_OPTIONS.filter(option => option.value)} /></Field><Field label="内容 ID"><input type="number" min={1} value={editingMagnet.contentId || ''} onChange={event => setEditingMagnet(current => ({ ...current, contentId: Number(event.target.value) }))} className={INPUT_CLASS} /></Field><Field label="来源编码"><Select value={editingMagnet.sourceCode || ''} onChange={sourceCode => setEditingMagnet(current => ({ ...current, sourceCode }))} options={sourceOptions.filter(option => option.value)} searchable /></Field><Field label="清晰度"><Select value={editingMagnet.resolution || ''} onChange={resolution => setEditingMagnet(current => ({ ...current, resolution }))} options={RESOLUTION_OPTIONS} /></Field><div className="sm:col-span-2"><Field label="资源标题"><input value={editingMagnet.title || ''} onChange={event => setEditingMagnet(current => ({ ...current, title: event.target.value }))} className={INPUT_CLASS} /></Field></div><div className="sm:col-span-2"><Field label="磁力链接"><input value={editingMagnet.magnetUrl || ''} onChange={event => setEditingMagnet(current => ({ ...current, magnetUrl: event.target.value }))} className={INPUT_CLASS} /></Field></div><Field label="排序"><input type="number" value={editingMagnet.sort ?? 0} onChange={event => setEditingMagnet(current => ({ ...current, sort: Number(event.target.value) }))} className={INPUT_CLASS} /></Field><div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-foreground"><input type="checkbox" checked={!!editingMagnet.hasSubtitle} onChange={event => setEditingMagnet(current => ({ ...current, hasSubtitle: event.target.checked }))} className="accent-primary" />包含字幕</label><label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-foreground"><input type="checkbox" checked={!!editingMagnet.isSpecialSub} onChange={event => setEditingMagnet(current => ({ ...current, isSpecialSub: event.target.checked }))} className="accent-primary" />特效字幕</label></div></div>}
      </Modal>

      <Modal open={!!editingCloud} onClose={() => setEditingCloud(null)} title={editingCloud?.id ? '编辑网盘资源' : '新增网盘资源'} width="lg" footer={<><Button variant="outline" onClick={() => setEditingCloud(null)}>取消</Button><Button disabled={saving} onClick={() => void saveResource('cloud')}>{saving && <Loader2 className="animate-spin" />}保存</Button></>}>
        {editingCloud && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><ContentAssociation resource={editingCloud} /></div><Field label="内容类型"><Select value={editingCloud.contentType || 'movie'} onChange={contentType => setEditingCloud(current => ({ ...current, contentType }))} options={CONTENT_TYPE_OPTIONS.filter(option => option.value)} /></Field><Field label="内容 ID"><input type="number" min={1} value={editingCloud.contentId || ''} onChange={event => setEditingCloud(current => ({ ...current, contentId: Number(event.target.value) }))} className={INPUT_CLASS} /></Field><Field label="来源编码"><Select value={editingCloud.sourceCode || ''} onChange={sourceCode => setEditingCloud(current => ({ ...current, sourceCode }))} options={sourceOptions.filter(option => option.value)} searchable /></Field><Field label="网盘类型"><Select value={editingCloud.diskType || ''} onChange={diskType => setEditingCloud(current => ({ ...current, diskType }))} options={DISK_TYPE_OPTIONS.filter(option => option.value)} /></Field><div className="sm:col-span-2"><Field label="资源标题"><input value={editingCloud.title || ''} onChange={event => setEditingCloud(current => ({ ...current, title: event.target.value }))} className={INPUT_CLASS} /></Field></div><div className="sm:col-span-2"><Field label="分享链接"><input type="url" value={editingCloud.url || ''} onChange={event => setEditingCloud(current => ({ ...current, url: event.target.value }))} className={INPUT_CLASS} /></Field></div><Field label="提取密码"><input value={editingCloud.password || ''} onChange={event => setEditingCloud(current => ({ ...current, password: event.target.value }))} className={INPUT_CLASS} /></Field><Field label="排序"><input type="number" value={editingCloud.sort ?? 0} onChange={event => setEditingCloud(current => ({ ...current, sort: Number(event.target.value) }))} className={INPUT_CLASS} /></Field></div>}
      </Modal>

      <Modal open={!!editingSource} onClose={() => setEditingSource(null)} title={editingSource?.id ? '编辑资源来源' : '新增资源来源扩展位'} description="新增来源不会自动生成爬虫适配器；来源编码保存后保持稳定。" width="md" footer={<><Button variant="outline" onClick={() => setEditingSource(null)}>取消</Button><Button disabled={saving} onClick={() => void saveSource()}>{saving && <Loader2 className="animate-spin" />}保存来源</Button></>}>
        {editingSource && <div className="grid gap-4"><Field label="稳定编码" hint="小写字母、数字、下划线或短横线；保存后不可修改。"><input value={editingSource.code || ''} disabled={!!editingSource.id} onChange={event => setEditingSource(current => ({ ...current, code: event.target.value.toLowerCase() }))} className={INPUT_CLASS} placeholder="example-source" /></Field><Field label="来源名称"><input value={editingSource.name || ''} onChange={event => setEditingSource(current => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} /></Field><Field label="来源链接"><input type="url" value={editingSource.url || ''} onChange={event => setEditingSource(current => ({ ...current, url: event.target.value }))} className={INPUT_CLASS} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="排序"><input type="number" value={editingSource.sort ?? 0} onChange={event => setEditingSource(current => ({ ...current, sort: Number(event.target.value) }))} className={INPUT_CLASS} /></Field><Field label="状态"><Select value={String(editingSource.enabled ?? 0)} onChange={enabled => setEditingSource(current => ({ ...current, enabled: Number(enabled) }))} options={[{ value: '0', label: '先保持禁用' }, { value: '1', label: '启用' }]} /></Field></div></div>}
      </Modal>

      <Modal open={!!detailResource} onClose={() => setDetailResource(null)} title="资源详情" width="lg">
        {detailResource && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{KIND_META[detailResource.kind].label}</Badge>
              <StatusBadge resource={detailResource.resource} />
              <Badge variant="outline">{CONTENT_TYPE_LABELS[detailResource.resource.contentType] || detailResource.resource.contentType}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
              <div className="flex h-24 w-16 items-center justify-center overflow-hidden rounded-xl bg-muted text-[10px] text-muted-foreground">
                {detailResource.resource.contentPosterUrl ? <img src={detailResource.resource.contentPosterUrl} alt="" className="h-full w-full object-cover" /> : '无海报'}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{contentAssociation(detailResource.resource)}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">资源：{resourceTitle(detailResource.kind, detailResource.resource)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">别名：{contentAlias(detailResource.resource.contentAlias)} · 内容 #{detailResource.resource.contentId} · 资源 #{detailResource.resource.id}</p>
              </div>
            </div>
            <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">资源 ID</dt><dd className="mt-1 text-foreground">{detailResource.resource.id}</dd></div>
              <div><dt className="text-xs text-muted-foreground">关联内容</dt><dd className="mt-1 text-foreground">{contentAssociation(detailResource.resource)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">内容别名</dt><dd className="mt-1 break-words text-foreground">{contentAlias(detailResource.resource.contentAlias)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">内容日期</dt><dd className="mt-1 text-foreground">{detailResource.resource.contentReleaseDate || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">来源编码</dt><dd className="mt-1 text-foreground">{detailResource.resource.sourceCode || '手工录入'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">排序</dt><dd className="mt-1 text-foreground">{detailResource.resource.sort ?? 0}</dd></div>
              <div><dt className="text-xs text-muted-foreground">最近发现</dt><dd className="mt-1 text-foreground">{formatDate(detailResource.resource.lastSeenAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">最近更新</dt><dd className="mt-1 text-foreground">{formatDate(detailResource.resource.updatedAt || detailResource.resource.createdAt)}</dd></div>
              {detailResource.kind === 'online' && <div><dt className="text-xs text-muted-foreground">播放类型</dt><dd className="mt-1 text-foreground">{PLAYBACK_TYPE_LABELS[(detailResource.resource as OnlineResource).playbackType || ''] || '自动识别'}</dd></div>}
              {detailResource.kind === 'online' && <div><dt className="text-xs text-muted-foreground">来源名称</dt><dd className="mt-1 text-foreground">{(detailResource.resource as OnlineResource).sourceName || '—'}</dd></div>}
              {detailResource.kind === 'online' && <div><dt className="text-xs text-muted-foreground">剧集信息</dt><dd className="mt-1 text-foreground">{resourceTitle(detailResource.kind, detailResource.resource)}</dd></div>}
              {detailResource.kind === 'magnet' && <div><dt className="text-xs text-muted-foreground">字幕</dt><dd className="mt-1 text-foreground">{(detailResource.resource as MagnetResource).hasSubtitle ? '包含字幕' : '无字幕标记'}{(detailResource.resource as MagnetResource).isSpecialSub ? ' · 特效字幕' : ''}</dd></div>}
              {detailResource.kind === 'cloud' && <div><dt className="text-xs text-muted-foreground">网盘类型</dt><dd className="mt-1 text-foreground">{DISK_TYPE_LABELS[(detailResource.resource as CloudResource).diskType || ''] || (detailResource.resource as CloudResource).diskType || '—'}</dd></div>}
            </dl>
            <div>
              <p className="text-xs text-muted-foreground">{detailResource.kind === 'online' ? '真实播放 URL' : '资源链接'}</p>
              <p className="mt-1 break-all rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground">{resourceLink(detailResource.kind, detailResource.resource)}</p>
            </div>
            {detailResource.kind === 'online' && (detailResource.resource as OnlineResource).sourcePageUrl && (
              <div>
                <p className="text-xs text-muted-foreground">来源详情页</p>
                <a href={(detailResource.resource as OnlineResource).sourcePageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm font-medium text-primary hover:underline">
                  {(detailResource.resource as OnlineResource).sourcePageUrl}<ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>
            )}
            {detailResource.kind === 'cloud' && (detailResource.resource as CloudResource).password && (
              <div><p className="text-xs text-muted-foreground">提取密码</p><p className="mt-1 font-mono text-sm text-foreground">{(detailResource.resource as CloudResource).password}</p></div>
            )}
            {detailResource.resource.rawText && (
              <div><p className="text-xs text-muted-foreground">来源原始文本</p><p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/20 p-3 text-xs text-foreground">{detailResource.resource.rawText}</p></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
