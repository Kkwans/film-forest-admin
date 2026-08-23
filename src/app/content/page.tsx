'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useDialog } from '@/components/ui/dialog';
import {
  CirclePlay,
  Edit,
  Eye,
  Film,
  ImageOff,
  Inbox,
  Loader2,
  Plus,
  Radio,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Tv,
  X,
  type LucideIcon,
} from 'lucide-react';
import { contentApi, tagApi, type TagItem } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Pagination from '@/components/Pagination';
import { PageSizeControl } from '@/components/PageSizeControl';
import { extractErrorMessage } from '@/lib/utils';
import { useListPageSize } from '@/hooks/useListPageSize';
import {
  ContentFormFields,
  EditForm,
  ContentType,
  EMPTY_FORM,
  buildSubmitData,
  parseJsonArray,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from '@/components/ContentFormFields';

// ========== 类型分发工具 ==========

/** 根据内容类型分发 API 调用 */
function dispatchByType<T>(
  type: ContentType,
  handlers: {
    movie: () => T;
    drama: () => T;
    variety: () => T;
    anime: () => T;
    short_drama: () => T;
  }
): T {
  return handlers[type]();
}



// ========== 类型定义 ==========
interface ContentRecord {
  id: number;
  title: string;
  type: ContentType;
  posterUrl?: string;
  year?: number;
  scoreDouban?: number;
  scoreImdb?: number;
  scoreRt?: number;
  genre?: string;
  region?: string;
  language?: string;
  director?: string;
  writer?: string;
  actor?: string;
  storyline?: string;
  duration?: number;
  releaseDate?: string;
  alias?: string;
  totalEpisode?: number;
  seriesName?: string;
  seriesOrder?: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}
interface MutationResponse {
  data?: {
    code?: number;
    message?: string;
  };
}
type FilterType = 'all' | ContentType;
type StatusFilter = 'all' | '0' | '1' | '2';
type SortField = 'createdAt' | 'updatedAt' | 'year' | 'title' | 'score' | 'status';
type SortDirection = 'asc' | 'desc';

const TYPE_PRESENTATION: Record<ContentType, { icon: LucideIcon; color: string; background: string }> = {
  movie: { icon: Film, color: 'text-sky-700 dark:text-sky-300', background: 'bg-sky-500/10' },
  drama: { icon: Tv, color: 'text-violet-700 dark:text-violet-300', background: 'bg-violet-500/10' },
  variety: { icon: Radio, color: 'text-amber-700 dark:text-amber-300', background: 'bg-amber-500/10' },
  anime: { icon: Sparkles, color: 'text-emerald-700 dark:text-emerald-300', background: 'bg-emerald-500/10' },
  short_drama: { icon: Smartphone, color: 'text-rose-700 dark:text-rose-300', background: 'bg-rose-500/10' },
};

function ContentPoster({ url, title, className }: { url?: string; title: string; className: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  const canShowImage = Boolean(url) && failedUrl !== url;
  return (
    <div className={`overflow-hidden border border-border bg-muted/45 ${className}`}>
      {canShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- 海报来源由爬虫或管理员配置，域名不固定。
        <img
          src={url}
          alt={`${title}海报`}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailedUrl(url || '')}
        />
      ) : (
        <div className="grid size-full place-items-center gap-1 p-2 text-center text-muted-foreground">
          <ImageOff className="size-5" />
          <span className="text-[10px] leading-tight">暂无海报</span>
        </div>
      )}
    </div>
  );
}

function TypeLabel({ type }: { type: ContentType }) {
  const meta = TYPE_PRESENTATION[type];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${meta.background} ${meta.color}`}>
      <Icon className="size-3.5" />{TYPE_LABELS[type]}
    </span>
  );
}

function isMutationSuccess(response: MutationResponse | undefined): boolean {
  return response?.data?.code === 200;
}

function mutationFailureMessage(response: MutationResponse | undefined, fallback: string): string {
  return response?.data?.message?.trim() || fallback;
}

/** 渲染内容的标签 */
function ContentTags({ item, allTags, contentTagMap }: { item: ContentRecord; allTags: TagItem[]; contentTagMap: Record<string, number[]> }) {
  const tagIds = contentTagMap[`${item.type}-${item.id}`];
  if (!tagIds || tagIds.length === 0) return null;
  const tags = tagIds
    .map(id => allTags.find(tag => tag.id === id && tag.system === 1))
    .filter(Boolean) as TagItem[];
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 3).map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
          style={{ backgroundColor: tag.color || '#6B7280' }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

export default function ContentPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [items, setItems] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { size: pageSize, saving: pageSizeSaving, updateSize: updatePageSize } = useListPageSize('content');
  const fetchRequestRef = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  // Refs for keyboard shortcuts to avoid stale closure
  const handleSaveEditRef = useRef<() => Promise<void>>(async () => {});
  const handleSaveNewRef = useRef<() => Promise<void>>(async () => {});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [standardGenres, setStandardGenres] = useState<TagItem[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const [contentTagMap, setContentTagMap] = useState<Record<string, number[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
      setSelectedKeys(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Keyboard shortcut: Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchItems = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;
    setLoading(true);
    try {
      const response = await contentApi.listAll({
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : Number(statusFilter),
        keyword: debouncedKeyword || undefined,
        sort: sortField,
        sortDir: sortDirection,
        page,
        size: pageSize,
      });
      if (requestId !== fetchRequestRef.current) return;
      if (response.data?.code !== 200) {
        throw new Error(response.data?.message || '数据加载失败');
      }
      const result = response.data.data as {
        records?: ContentRecord[];
        total?: number;
      };
      const nextTotal = Number(result.total) || 0;
      const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
      setTotal(nextTotal);
      if (page > lastPage) {
        setItems([]);
        setSelectedKeys(new Set());
        setPage(lastPage);
        return;
      }
      setItems(Array.isArray(result.records) ? result.records : []);
    } catch (e: unknown) {
      if (requestId === fetchRequestRef.current) {
        toast.error(extractErrorMessage(e, '数据加载失败'));
      }
    } finally {
      if (requestId === fetchRequestRef.current) {
        setLoading(false);
      }
    }
  }, [typeFilter, statusFilter, debouncedKeyword, sortField, sortDirection, page, pageSize, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchItems(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  // Stats per type
  const [stats, setStats] = useState({ movies: 0, dramas: 0, varieties: 0, animes: 0, shortDramas: 0 });
  const fetchStats = useCallback(async () => {
    try {
      const response = await contentApi.getStats();
      if (response.data?.code !== 200) {
        throw new Error(response.data?.message || '加载统计数据失败');
      }
      setStats(response.data.data);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '加载统计数据失败'));
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchStats(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStats]);

  const refreshContentData = useCallback(async () => {
    await Promise.all([fetchItems(), fetchStats()]);
  }, [fetchItems, fetchStats]);

  // Load all tags
  useEffect(() => {
    tagApi.list().then(res => {
      if (res.data?.code === 200) setAllTags(res.data.data || []);
    }).catch((e: unknown) => toast.error(extractErrorMessage(e, '标签加载失败')));
  }, [toast]);

  const filtered = items;
  const visibleKeySet = useMemo(
    () => new Set(filtered.map(item => `${item.type}-${item.id}`)),
    [filtered]
  );
  const visibleSelectedKeys = useMemo(
    () => new Set([...selectedKeys].filter(key => visibleKeySet.has(key))),
    [selectedKeys, visibleKeySet]
  );

  // Load tags for visible items (batch API)
  useEffect(() => {
    if (items.length === 0 || allTags.length === 0) return;
    const loadItemTags = async () => {
      // Filter items that haven't been loaded yet
      const toLoad = items.filter(item => !contentTagMap[`${item.type}-${item.id}`]);
      if (toLoad.length === 0) return;
      try {
        const res = await tagApi.batchGetContentTags(
          toLoad.map(item => ({ contentType: item.type, contentId: item.id }))
        );
        if (res.data?.code === 200 && res.data.data) {
          const map: Record<string, number[]> = {};
          for (const [key, tags] of Object.entries(res.data.data)) {
            if (Array.isArray(tags)) {
              map[key] = tags.map((t: TagItem) => t.id);
            }
          }
          if (Object.keys(map).length > 0) {
            setContentTagMap(prev => ({ ...prev, ...map }));
          }
        }
      } catch (e: unknown) { toast.error(extractErrorMessage(e, '加载标签失败')); }
    };
    loadItemTags();
  }, [items, allTags, contentTagMap, toast]);

  const typeCountMap: Record<string, number> = {
    movie: stats.movies,
    drama: stats.dramas,
    variety: stats.varieties,
    anime: stats.animes,
    short_drama: stats.shortDramas,
  };

  // ========== 表单验证 ==========
  const validateForm = useCallback((form: EditForm): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = '请输入标题';
    if (form.year && (isNaN(Number(form.year)) || Number(form.year) < 1888 || Number(form.year) > 2099)) errors.year = '请输入有效年份 (1888-2099)';
    if (form.scoreDouban && (isNaN(Number(form.scoreDouban)) || Number(form.scoreDouban) < 0 || Number(form.scoreDouban) > 10)) errors.scoreDouban = '评分范围 0-10';
    if (form.scoreImdb && (isNaN(Number(form.scoreImdb)) || Number(form.scoreImdb) < 0 || Number(form.scoreImdb) > 10)) errors.scoreImdb = '评分范围 0-10';
    if (form.scoreRt && (isNaN(Number(form.scoreRt)) || Number(form.scoreRt) < 0 || Number(form.scoreRt) > 100)) errors.scoreRt = '评分范围 0-100';
    if (form.duration && (isNaN(Number(form.duration)) || Number(form.duration) < 0)) errors.duration = '请输入有效时长';
    if (form.totalEpisode && (!Number.isInteger(Number(form.totalEpisode)) || Number(form.totalEpisode) < 0)) errors.totalEpisode = '请输入有效集数';
    if (form.seriesOrder && (!Number.isInteger(Number(form.seriesOrder)) || Number(form.seriesOrder) < 1)) errors.seriesOrder = '系列序号应为正整数';
    return errors;
  }, []);

  // ========== 操作处理 ==========
  const handleDelete = async (id: number, type: ContentRecord['type']) => {
    const ok = await dialog.confirm({ title: '删除内容', content: '确定删除此内容？删除后不可恢复。', confirmText: '删除', cancelText: '取消', variant: 'danger' });
    if (!ok) return;
    const key = `${type}-${id}`;
    setDeletingIds(prev => new Set(prev).add(key));
    try {
      const res = await dispatchByType(type, {
        movie: () => contentApi.deleteMovie(id),
        drama: () => contentApi.deleteDrama(id),
        variety: () => contentApi.deleteVariety(id),
        anime: () => contentApi.deleteAnime(id),
        short_drama: () => contentApi.deleteShortDrama(id),
      });
      if (!isMutationSuccess(res)) {
        throw new Error(mutationFailureMessage(res, '删除失败'));
      }
      setSelectedKeys(previous => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
      setContentTagMap(previous => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      await refreshContentData();
      toast.success('已删除');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '删除失败，请检查网络'));
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const [editingItem, setEditingItem] = useState<ContentRecord | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [detailItem, setDetailItem] = useState<ContentRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);

  useEffect(() => {
    if (!creatingNew && !editingItem) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setGenresLoading(true);
      tagApi.listStandardGenres(editForm.type)
        .then(response => {
          if (cancelled) return;
          if (response.data?.code !== 200) throw new Error(response.data?.message || '标准题材加载失败');
          setStandardGenres(Array.isArray(response.data.data) ? response.data.data : []);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setStandardGenres([]);
            toast.error(extractErrorMessage(error, '标准题材加载失败'));
          }
        })
        .finally(() => { if (!cancelled) setGenresLoading(false); });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [creatingNew, editForm.type, editingItem, toast]);

  const handleCreateNew = () => {
    setCreatingNew(true);
    setEditForm({ ...EMPTY_FORM, genreTagIds: [] });
    setFormErrors({});
  };

  const handleSaveNew = useCallback(async () => {
    const errors = validateForm(editForm);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.warning('请检查表单中的错误');
      return;
    }
    setSavingNew(true);
    const data = buildSubmitData(editForm);
    try {
      const res = await dispatchByType(editForm.type, {
        movie: () => contentApi.createMovie(data),
        drama: () => contentApi.createDrama(data),
        variety: () => contentApi.createVariety(data),
        anime: () => contentApi.createAnime(data),
        short_drama: () => contentApi.createShortDrama(data),
      });
      if (!isMutationSuccess(res)) {
        throw new Error(mutationFailureMessage(res, '创建失败'));
      }
      setCreatingNew(false);
      setFormErrors({});
      await refreshContentData();
      toast.success('创建成功');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '创建失败，请检查网络'));
    } finally {
      setSavingNew(false);
    }
  }, [editForm, refreshContentData, toast, validateForm]);

  useEffect(() => {
    handleSaveNewRef.current = handleSaveNew;
  }, [handleSaveNew]);

  const loadFullContent = async (item: ContentRecord): Promise<ContentRecord> => {
    const response = await dispatchByType(item.type, {
      movie: () => contentApi.getMovie(item.id),
      drama: () => contentApi.getDrama(item.id),
      variety: () => contentApi.getVariety(item.id),
      anime: () => contentApi.getAnime(item.id),
      short_drama: () => contentApi.getShortDrama(item.id),
    });
    if (response.data?.code !== 200 || !response.data.data) {
      throw new Error(response.data?.message || '内容详情加载失败');
    }
    return { ...(response.data.data as ContentRecord), type: item.type };
  };

  const handleDetailClick = async (item: ContentRecord) => {
    try {
      setDetailItem(await loadFullContent(item));
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '内容详情加载失败'));
    }
  };

  const handleEditClick = async (item: ContentRecord) => {
    let fullItem: ContentRecord;
    try {
      fullItem = await loadFullContent(item);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '内容详情加载失败'));
      return;
    }
    setFormErrors({});
    // 只回填系统标准题材；自定义标签不属于 genre 编辑契约。
    let genreTagIds: string[] = [];
    try {
      const tagRes = await tagApi.getContentTags(fullItem.type, fullItem.id);
      if (tagRes.data?.code === 200 && Array.isArray(tagRes.data.data)) {
        genreTagIds = tagRes.data.data
          .filter((tag: TagItem) => tag.system === 1)
          .map((tag: TagItem) => String(tag.id));
      }
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '内容题材加载失败'));
    }
    setEditForm({
      title: fullItem.title || '',
      posterUrl: fullItem.posterUrl || '',
      year: String(fullItem.year || ''),
      scoreDouban: String(fullItem.scoreDouban || ''),
      scoreImdb: String(fullItem.scoreImdb || ''),
      scoreRt: String(fullItem.scoreRt || ''),
      genreTagIds,
      region: parseJsonArray(fullItem.region),
      language: parseJsonArray(fullItem.language),
      director: parseJsonArray(fullItem.director),
      writer: parseJsonArray(fullItem.writer),
      actor: parseJsonArray(fullItem.actor),
      storyline: fullItem.storyline || '',
      duration: String(fullItem.duration || ''),
      totalEpisode: String(fullItem.totalEpisode || ''),
      releaseDate: fullItem.releaseDate || '',
      alias: parseJsonArray(fullItem.alias),
      seriesName: fullItem.seriesName || '',
      seriesOrder: String(fullItem.seriesOrder || ''),
      status: fullItem.status,
      type: fullItem.type,
    });
    setEditingItem(fullItem);
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingItem) return;
    const errors = validateForm(editForm);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.warning('请检查表单中的错误');
      return;
    }
    setSavingEdit(true);
    const data = buildSubmitData(editForm);
    try {
      const res = await dispatchByType(editingItem.type, {
        movie: () => contentApi.updateMovie(editingItem.id, data),
        drama: () => contentApi.updateDrama(editingItem.id, data),
        variety: () => contentApi.updateVariety(editingItem.id, data),
        anime: () => contentApi.updateAnime(editingItem.id, data),
        short_drama: () => contentApi.updateShortDrama(editingItem.id, data),
      });
      if (!isMutationSuccess(res)) {
        throw new Error(mutationFailureMessage(res, '保存失败'));
      }
      const contentKey = `${editingItem.type}-${editingItem.id}`;
      setContentTagMap(previous => {
        const next = { ...previous };
        delete next[contentKey];
        return next;
      });
      setEditingItem(null);
      setFormErrors({});
      await refreshContentData();
      toast.success('已保存');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '保存失败，请检查网络'));
    } finally {
      setSavingEdit(false);
    }
  }, [editForm, editingItem, refreshContentData, toast, validateForm]);

  useEffect(() => {
    handleSaveEditRef.current = handleSaveEdit;
  }, [handleSaveEdit]);

  const handleSetStatus = async (item: ContentRecord, newStatus: number) => {
    if (item.status === newStatus) return;
    const key = `${item.type}-${item.id}`;
    setTogglingIds(prev => new Set(prev).add(key));
    try {
      const res = await contentApi.toggleStatus(item.type, item.id, newStatus);
      if (!isMutationSuccess(res)) {
        throw new Error(mutationFailureMessage(res, '更新状态失败'));
      }
      await refreshContentData();
      toast.success(`状态已更新为“${STATUS_LABELS[newStatus]}”`);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '更新状态失败'));
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // ========== 批量操作 ==========
  const toggleSelectItem = (key: string) => {
    setSelectedKeys(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const toggleSelectAll = () => {
    const visibleKeys = filtered.map(i => `${i.type}-${i.id}`);
    setSelectedKeys(previous => {
      const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => previous.has(key));
      return allVisibleSelected ? new Set() : new Set(visibleKeys);
    });
  };

  const handleBatchDelete = async () => {
    if (visibleSelectedKeys.size === 0) return;
    if (batchProcessing) return;
    const ok = await dialog.confirm({
      title: '批量删除',
      content: `确定删除当前页选中的 ${visibleSelectedKeys.size} 条内容？删除后不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    setBatchProcessing(true);
    try {
      const entries = Array.from(visibleSelectedKeys).map(key => {
        const [type, idStr] = key.split('-');
        return { key, type: type as ContentType, id: Number(idStr) };
      });
      const results = await Promise.allSettled(
        entries.map(entry => dispatchByType(entry.type, {
          movie: () => contentApi.deleteMovie(entry.id),
          drama: () => contentApi.deleteDrama(entry.id),
          variety: () => contentApi.deleteVariety(entry.id),
          anime: () => contentApi.deleteAnime(entry.id),
          short_drama: () => contentApi.deleteShortDrama(entry.id),
        }))
      );
      const succeededKeys = new Set<string>();
      const failedKeys = new Set<string>();
      let firstFailure = '';
      results.forEach((result, index) => {
        const entry = entries[index];
        if (result.status === 'fulfilled' && isMutationSuccess(result.value)) {
          succeededKeys.add(entry.key);
          return;
        }
        failedKeys.add(entry.key);
        if (!firstFailure) {
          firstFailure = result.status === 'fulfilled'
            ? mutationFailureMessage(result.value, '服务器拒绝删除')
            : extractErrorMessage(result.reason, '删除请求失败');
        }
      });

      setContentTagMap(previous => {
        const next = { ...previous };
        succeededKeys.forEach(key => delete next[key]);
        return next;
      });
      setSelectedKeys(failedKeys);
      if (succeededKeys.size > 0) await refreshContentData();

      if (failedKeys.size === 0) {
        toast.success(`成功删除 ${succeededKeys.size} 条内容`);
      } else if (succeededKeys.size > 0) {
        toast.warning(`已删除 ${succeededKeys.size} 条，失败 ${failedKeys.size} 条：${firstFailure}`);
      } else {
        toast.error(`批量删除失败：${firstFailure}`);
      }
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchSetStatus = async (newStatus: number) => {
    if (visibleSelectedKeys.size === 0) return;
    if (batchProcessing) return;
    const entries = Array.from(visibleSelectedKeys)
      .map(key => {
        const [type, idStr] = key.split('-');
        const id = Number(idStr);
        const item = filtered.find(i => i.id === id && i.type === type);
        return { key, type: type as ContentType, id, item };
      })
      .filter(e => e.item && e.item.status !== newStatus);
    if (entries.length === 0) {
      setSelectedKeys(new Set());
      toast.info(`所选内容已经全部是“${STATUS_LABELS[newStatus]}”`);
      return;
    }
    const ok = await dialog.confirm({
      title: `批量设为${STATUS_LABELS[newStatus]}`,
      content: `确定将当前页选中的 ${entries.length} 条内容设为“${STATUS_LABELS[newStatus]}”？`,
      confirmText: '确认更新',
      cancelText: '取消',
      variant: newStatus === 1 ? 'default' : 'warning',
    });
    if (!ok) return;

    setBatchProcessing(true);
    try {
      const response = await contentApi.batchUpdateStatus(
        entries.map(entry => ({ type: entry.type, id: entry.id })),
        newStatus,
      );
      if (!isMutationSuccess(response)) {
        throw new Error(mutationFailureMessage(response, '服务器拒绝批量更新状态'));
      }
      const updated = Number(response.data?.data?.updated);
      if (updated !== entries.length) throw new Error('服务器返回的更新数量与请求不一致');
      setSelectedKeys(new Set());
      await refreshContentData();
      toast.success(`已将 ${updated} 条内容设为“${STATUS_LABELS[newStatus]}”`);
    } catch (error: unknown) {
      toast.error(`批量状态更新失败：${extractErrorMessage(error, '请求失败，所选内容未变更')}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  // Keyboard shortcut: Ctrl+Enter to save in modal, Escape to close
  useEffect(() => {
    if (!editingItem && !creatingNew && !detailItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailItem) setDetailItem(null);
        else if (creatingNew) { setCreatingNew(false); setFormErrors({}); }
        else if (editingItem) { setEditingItem(null); setFormErrors({}); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (editingItem) handleSaveEditRef.current();
        else if (creatingNew) handleSaveNewRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingItem, creatingNew, detailItem]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">内容管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理影视资源内容，审核状态</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" /> 新增内容
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(TYPE_PRESENTATION) as ContentType[]).map(type => {
          const meta = TYPE_PRESENTATION[type];
          const Icon = meta.icon;
          return <Card key={type} className="border-border bg-card transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`grid size-9 place-items-center rounded-xl ${meta.background} ${meta.color}`}><Icon className="size-4" /></div>
                <span className={`text-2xl font-bold tabular-nums ${meta.color}`}>{typeCountMap[type] ?? '-'}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[type]}</span>
            </CardContent>
          </Card>;
        })}
      </div>

      {/* Batch Action Bar */}
      {visibleSelectedKeys.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm font-medium text-primary">已选 {visibleSelectedKeys.size} 项（仅当前页）</span>
          <div className="flex-1" />
          <button
            onClick={() => handleBatchSetStatus(1)}
            disabled={batchProcessing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            {batchProcessing ? '处理中...' : '批量上线'}
          </button>
          <button
            onClick={() => handleBatchSetStatus(2)}
            disabled={batchProcessing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
          >
            {batchProcessing ? '处理中...' : '批量下线'}
          </button>
          <button
            onClick={() => handleBatchSetStatus(0)}
            disabled={batchProcessing}
            className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {batchProcessing ? '处理中...' : '转为草稿'}
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={batchProcessing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
          >
            {batchProcessing ? '处理中...' : '批量删除'}
          </button>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* Filters - overflow-visible 使下拉菜单不被 Card 的 overflow-hidden 裁剪 */}
      <Card className="bg-card border-border overflow-visible">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="搜索标题... (Ctrl+F)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9 pr-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              {keyword && (
                <button
                  onClick={() => { setKeyword(''); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
                  title="清除搜索"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v as FilterType); setPage(1); setSelectedKeys(new Set()); }}
              options={[{ label: '全部分类', value: 'all' }, { label: '电影', value: 'movie' }, { label: '剧集', value: 'drama' }, { label: '综艺', value: 'variety' }, { label: '动漫', value: 'anime' }, { label: '短剧', value: 'short_drama' }]}
              className="w-36"
            />
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); setSelectedKeys(new Set()); }}
              options={[{ label: '全部状态', value: 'all' }, ...STATUS_OPTIONS]}
              className="w-36"
            />
            <Select
              value={sortField}
              onChange={(v) => { setSortField(v as SortField); setPage(1); setSelectedKeys(new Set()); }}
              options={[
                { label: '最近更新', value: 'updatedAt' },
                { label: '创建时间', value: 'createdAt' },
                { label: '年份', value: 'year' },
                { label: '标题', value: 'title' },
                { label: '评分', value: 'score' },
                { label: '状态', value: 'status' },
              ]}
              className="w-36"
            />
            <Select
              value={sortDirection}
              onChange={(v) => { setSortDirection(v as SortDirection); setPage(1); setSelectedKeys(new Set()); }}
              options={[{ label: '降序', value: 'desc' }, { label: '升序', value: 'asc' }]}
              className="w-28"
            />
            <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading} className="border-border text-muted-foreground hover:text-foreground">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '刷新'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border overflow-visible">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary" />
            内容列表 ({loading ? '...' : total || filtered.length})
            {debouncedKeyword && !loading && (
              <span className="text-xs font-normal text-muted-foreground ml-1">— 搜索 &ldquo;{debouncedKeyword}&rdquo;</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b-2 border-border bg-muted/40">
                  <th className="text-center px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(item => selectedKeys.has(`${item.type}-${item.id}`))}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                      aria-label={filtered.length > 0 && filtered.every(item => selectedKeys.has(`${item.type}-${item.id}`)) ? '取消选择当前页全部内容' : '选择当前页全部内容'}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">内容</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">分类</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">年份</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">评分</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="w-10 h-14 rounded shrink-0" /><div><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-3 w-16" /></div></div></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-8 rounded" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Skeleton className="w-7 h-7 rounded" /><Skeleton className="w-7 h-7 rounded" /><Skeleton className="w-7 h-7 rounded" /></div></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">{debouncedKeyword ? `未找到匹配 "${debouncedKeyword}" 的内容` : '暂无内容'}</p>
                      {debouncedKeyword && (
                        <button onClick={() => setKeyword('')} className="text-xs text-primary hover:underline mt-2">清除搜索</button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const itemKey = `${item.type}-${item.id}`;
                    const isSelected = selectedKeys.has(itemKey);
                    return (
                    <tr key={itemKey} className={`border-b border-border/40 hover:bg-muted/40 even:bg-muted/10 transition-[background-color] duration-150 ${isSelected ? 'bg-primary/5' : ''}`}>
                      <td className="text-center px-3 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(itemKey)}
                          className="rounded border-border"
                          aria-label={`${isSelected ? '取消选择' : '选择'}《${item.title}》`}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <ContentPoster url={item.posterUrl} title={item.title} className="h-[60px] w-11 shrink-0 rounded-lg" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground max-w-48 truncate group-hover:text-primary transition-colors">{item.title}</p>
                            <ContentTags item={item} allTags={allTags} contentTagMap={contentTagMap} />
                            <p className="text-xs text-muted-foreground mt-0.5">{item.createdAt?.slice(0, 10)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <TypeLabel type={item.type} />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {item.year || '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.scoreDouban ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                            <Star className="size-3 fill-current" /> {item.scoreDouban}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Select
                          value={String(item.status)}
                          onChange={value => void handleSetStatus(item, Number(value))}
                          options={STATUS_OPTIONS}
                          size="sm"
                          disabled={togglingIds.has(`${item.type}-${item.id}`)}
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDetailClick(item)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="详情">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditClick(item)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="编辑">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.type)}
                            disabled={deletingIds.has(`${item.type}-${item.id}`)}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="删除"
                          >
                            {deletingIds.has(`${item.type}-${item.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-16 rounded shrink-0" />
                    <div className="flex-1"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-20" /></div>
                  </div>
                  <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-12 rounded-full" /></div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{debouncedKeyword ? `未找到匹配 "${debouncedKeyword}" 的内容` : '暂无内容'}</p>
                {debouncedKeyword && (
                  <button onClick={() => setKeyword('')} className="text-xs text-primary hover:underline mt-2">清除搜索</button>
                )}
              </div>
            ) : (
              filtered.map((item) => {
                const itemKey = `${item.type}-${item.id}`;
                const isSelected = selectedKeys.has(itemKey);
                return (
                <div key={itemKey} className={`p-4 transition-[background-color] duration-150 hover:bg-muted/30 active:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(itemKey)}
                      className="mt-1 size-4 shrink-0 rounded border-border"
                      aria-label={`${isSelected ? '取消选择' : '选择'}《${item.title}》`}
                    />
                    <ContentPoster url={item.posterUrl} title={item.title} className="h-[66px] w-12 shrink-0 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <ContentTags item={item} allTags={allTags} contentTagMap={contentTagMap} />
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <TypeLabel type={item.type} />
                        {item.year && <span className="text-xs text-muted-foreground">{item.year}</span>}
                        {item.scoreDouban && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300"><Star className="size-3 fill-current" />{item.scoreDouban}</span>
                        )}
                        <Select
                          value={String(item.status)}
                          onChange={value => void handleSetStatus(item, Number(value))}
                          options={STATUS_OPTIONS}
                          size="sm"
                          disabled={togglingIds.has(`${item.type}-${item.id}`)}
                          className="w-24"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{item.createdAt?.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => handleDetailClick(item)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="详情">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEditClick(item)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary" title="编辑">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id, item.type)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination - 放在表格下方 */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageSizeControl value={pageSize} saving={pageSizeSaving} onChange={async value => { await updatePageSize(value); setPage(1); setSelectedKeys(new Set()); }} />
          <p className="text-sm text-muted-foreground">
            共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页
          </p>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={(nextPage) => { setPage(nextPage); setSelectedKeys(new Set()); }}
          />
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="内容详情" width="xl">
        {detailItem && (
          <div className="space-y-6 py-1">
            <div className="flex flex-col gap-5 sm:flex-row">
              <ContentPoster url={detailItem.posterUrl} title={detailItem.title} className="aspect-[2/3] w-28 shrink-0 self-center rounded-xl sm:w-32 sm:self-start" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{TYPE_LABELS[detailItem.type]} #{detailItem.id}</p>
                  <h3 className="mt-1 break-words text-xl font-bold text-foreground">{detailItem.title}</h3>
                  {detailItem.alias && <p className="mt-1 text-sm text-muted-foreground">{parseJsonArray(detailItem.alias)}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TypeLabel type={detailItem.type} />
                  {detailItem.year && <Badge className="bg-muted text-muted-foreground">{detailItem.year}</Badge>}
                  <Badge className={detailItem.status === 1 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : detailItem.status === 2 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}>
                    <CirclePlay className="mr-1 size-3" />{STATUS_LABELS[detailItem.status] || '未知状态'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailItem.scoreDouban != null && <Badge className="bg-primary/10 text-primary">豆瓣 {detailItem.scoreDouban}</Badge>}
                  {detailItem.scoreImdb != null && <Badge className="bg-muted text-muted-foreground">IMDb {detailItem.scoreImdb}</Badge>}
                  {detailItem.scoreRt != null && <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300">RT {detailItem.scoreRt}%</Badge>}
                </div>
                <ContentTags item={detailItem} allTags={allTags} contentTagMap={contentTagMap} />
              </div>
            </div>

            <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              {detailItem.genre && <div><dt className="text-xs text-muted-foreground">题材</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.genre)}</dd></div>}
              {detailItem.region && <div><dt className="text-xs text-muted-foreground">地区</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.region)}</dd></div>}
              {detailItem.language && <div><dt className="text-xs text-muted-foreground">语言</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.language)}</dd></div>}
              {detailItem.director && <div><dt className="text-xs text-muted-foreground">导演</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.director)}</dd></div>}
              {detailItem.writer && <div><dt className="text-xs text-muted-foreground">编剧</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.writer)}</dd></div>}
              {detailItem.actor && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">演员</dt><dd className="mt-1 text-foreground">{parseJsonArray(detailItem.actor)}</dd></div>}
              {detailItem.duration != null && <div><dt className="text-xs text-muted-foreground">时长</dt><dd className="mt-1 text-foreground">{detailItem.duration} 分钟</dd></div>}
              {detailItem.totalEpisode != null && <div><dt className="text-xs text-muted-foreground">总集数 / 期数</dt><dd className="mt-1 text-foreground">{detailItem.totalEpisode}</dd></div>}
              {detailItem.releaseDate && <div><dt className="text-xs text-muted-foreground">上映 / 首播</dt><dd className="mt-1 text-foreground">{detailItem.releaseDate}</dd></div>}
              {detailItem.seriesName && <div><dt className="text-xs text-muted-foreground">系列</dt><dd className="mt-1 text-foreground">{detailItem.seriesName}{detailItem.seriesOrder ? ` · 第 ${detailItem.seriesOrder} 部` : ''}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">海报状态</dt><dd className="mt-1 text-foreground">{detailItem.posterUrl ? '已配置来源海报' : '尚未配置'}</dd></div>
            </dl>

            <section className="rounded-xl border border-border p-4">
              <h4 className="text-sm font-semibold text-foreground">剧情简介</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{detailItem.storyline || '暂无简介'}</p>
            </section>

            <p className="text-xs text-muted-foreground">创建于 {detailItem.createdAt?.slice(0, 19) || '-'} · 更新于 {detailItem.updatedAt?.slice(0, 19) || '-'}</p>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal open={creatingNew} onClose={() => { setCreatingNew(false); setFormErrors({}); }} title="新增内容" width="lg"
        footer={
          <>
            <button onClick={() => { setCreatingNew(false); setFormErrors({}); }} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">取消</button>
            <button onClick={handleSaveNew} disabled={savingNew || genresLoading} className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              {savingNew && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingNew ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <ContentFormFields
          form={editForm}
          onChange={(form) => { setEditForm(form); setFormErrors({}); }}
          standardGenres={standardGenres}
          genresLoading={genresLoading}
          errors={formErrors}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingItem} onClose={() => { setEditingItem(null); setFormErrors({}); }} title="编辑内容" width="lg"
        footer={
          <>
            <button onClick={() => { setEditingItem(null); setFormErrors({}); }} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">取消</button>
            <button onClick={handleSaveEdit} disabled={savingEdit || genresLoading} className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingEdit ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <ContentFormFields
          form={editForm}
          onChange={(form) => { setEditForm(form); setFormErrors({}); }}
          standardGenres={standardGenres}
          genresLoading={genresLoading}
          showStatus
          lockType
          errors={formErrors}
        />
      </Modal>
    </div>
  );
}
