'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useDialog } from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash2, Eye, Inbox, X, Loader2 } from 'lucide-react';
import { contentApi, tagApi, type TagItem } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Pagination from '@/components/Pagination';
import { extractErrorMessage } from '@/lib/utils';
import {
  ContentFormFields,
  EditForm,
  ContentType,
  EMPTY_FORM,
  buildSubmitData,
  parseJsonArray,
  TYPE_LABELS,
  TYPE_ICON_EMOJI,
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
  status: number;
  createdAt: string;
  updatedAt: string;
}
type FilterType = 'all' | ContentType;
type StatusFilter = 'all' | '1' | '0';
type SortField = 'createdAt' | 'updatedAt' | 'year' | 'title' | 'score' | 'status';
type SortDirection = 'asc' | 'desc';

/** 渲染内容的标签 */
function ContentTags({ item, allTags, contentTagMap }: { item: ContentRecord; allTags: TagItem[]; contentTagMap: Record<string, number[]> }) {
  const tagIds = contentTagMap[`${item.type}-${item.id}`];
  if (!tagIds || tagIds.length === 0) return null;
  const tags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as TagItem[];
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

/** 标签选择器组件 */
function TagSelector({ allTags, selectedIds, onChange }: { allTags: TagItem[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const toggleTag = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map(tag => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleTag(tag.id)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-[color,background-color,border-color] ${
            selectedIds.includes(tag.id)
              ? 'text-white shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          style={selectedIds.includes(tag.id) ? { backgroundColor: tag.color || '#6B7280' } : {}}
        >
          {tag.name}
        </button>
      ))}
      {allTags.length === 0 && (
        <p className="text-xs text-muted-foreground">暂无标签，请先创建标签</p>
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
  const pageSize = 20;
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
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [contentTagMap, setContentTagMap] = useState<Record<string, number[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
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
      setItems(Array.isArray(result.records) ? result.records : []);
      setTotal(Number(result.total) || 0);
    } catch (e: unknown) {
      if (requestId === fetchRequestRef.current) {
        toast.error(extractErrorMessage(e, '数据加载失败'));
      }
    } finally {
      if (requestId === fetchRequestRef.current) {
        setLoading(false);
      }
    }
  }, [typeFilter, statusFilter, debouncedKeyword, sortField, sortDirection, page, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchItems(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  // Stats per type
  const [stats, setStats] = useState({ movies: 0, dramas: 0, varieties: 0, animes: 0, shortDramas: 0 });
  useEffect(() => {
    contentApi.getStats().then(res => {
      if (res.data?.code === 200) setStats(res.data.data);
    }).catch((e: unknown) => toast.error(extractErrorMessage(e, '加载统计数据失败')));
  }, []);

  // Load all tags
  useEffect(() => {
    tagApi.list().then(res => {
      if (res.data?.code === 200) setAllTags(res.data.data || []);
    }).catch((e: unknown) => toast.error(extractErrorMessage(e, '标签加载失败')));
  }, []);

  const filtered = items;

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
  }, [items, allTags]);

  const typeCountMap: Record<string, number> = {
    movie: stats.movies,
    drama: stats.dramas,
    variety: stats.varieties,
    anime: stats.animes,
    short_drama: stats.shortDramas,
  };

  // ========== 表单验证 ==========
  const validateForm = (form: EditForm): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = '请输入标题';
    if (form.year && (isNaN(Number(form.year)) || Number(form.year) < 1888 || Number(form.year) > 2099)) errors.year = '请输入有效年份 (1888-2099)';
    if (form.scoreDouban && (isNaN(Number(form.scoreDouban)) || Number(form.scoreDouban) < 0 || Number(form.scoreDouban) > 10)) errors.scoreDouban = '评分范围 0-10';
    if (form.scoreImdb && (isNaN(Number(form.scoreImdb)) || Number(form.scoreImdb) < 0 || Number(form.scoreImdb) > 10)) errors.scoreImdb = '评分范围 0-10';
    if (form.scoreRt && (isNaN(Number(form.scoreRt)) || Number(form.scoreRt) < 0 || Number(form.scoreRt) > 100)) errors.scoreRt = '评分范围 0-100';
    if (form.duration && (isNaN(Number(form.duration)) || Number(form.duration) < 0)) errors.duration = '请输入有效时长';
    return errors;
  };

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
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        setItems(items.filter(i => !(i.id === id && i.type === type)));
        setTotal(t => t - 1);
        toast.success('已删除');
      } else {
        toast.error(res?.data?.message || '删除失败');
      }
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

  const handleCreateNew = () => {
    setCreatingNew(true);
    setEditForm(EMPTY_FORM);
    setFormErrors({});
    setSelectedTagIds([]);
  };

  const handleSaveNew = async () => {
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
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        // Save tag associations if any selected
        if (selectedTagIds.length > 0) {
          const newId = res.data.data?.id;
          if (newId) {
            try { await tagApi.setContentTags(editForm.type, newId, selectedTagIds); } catch (e: unknown) { toast.error(extractErrorMessage(e, '标签关联失败')); }
          }
        }
        setCreatingNew(false);
        setFormErrors({});
        toast.success('创建成功');
        fetchItems();
      } else {
        toast.error(res?.data?.message || '创建失败');
      }
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '创建失败，请检查网络'));
    } finally {
      setSavingNew(false);
    }
  };

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
    setEditingItem(fullItem);
    setFormErrors({});
    // Load tags for this content
    try {
      const tagRes = await tagApi.getContentTags(fullItem.type, fullItem.id);
      if (tagRes.data?.code === 200 && Array.isArray(tagRes.data.data)) {
        setSelectedTagIds(tagRes.data.data.map((t: TagItem) => t.id));
      } else {
        setSelectedTagIds([]);
      }
    } catch (e: unknown) { setSelectedTagIds([]); }
    setEditForm({
      title: fullItem.title || '',
      posterUrl: fullItem.posterUrl || '',
      year: String(fullItem.year || ''),
      scoreDouban: String(fullItem.scoreDouban || ''),
      scoreImdb: String(fullItem.scoreImdb || ''),
      scoreRt: String(fullItem.scoreRt || ''),
      genre: parseJsonArray(fullItem.genre),
      region: parseJsonArray(fullItem.region),
      language: parseJsonArray(fullItem.language),
      director: parseJsonArray(fullItem.director),
      writer: parseJsonArray(fullItem.writer),
      actor: parseJsonArray(fullItem.actor),
      storyline: fullItem.storyline || '',
      duration: String(fullItem.duration || ''),
      releaseDate: fullItem.releaseDate || '',
      alias: parseJsonArray(fullItem.alias),
      status: fullItem.status,
      type: fullItem.type,
    });
  };

  const handleSaveEdit = async () => {
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
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        // Save tag associations
        try { await tagApi.setContentTags(editingItem.type, editingItem.id, selectedTagIds); } catch (e: unknown) { toast.error(extractErrorMessage(e, '标签关联失败')); }
        setEditingItem(null);
        setFormErrors({});
        toast.success('已保存');
        fetchItems();
      } else {
        toast.error(res?.data?.message || '保存失败');
      }
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '保存失败，请检查网络'));
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    handleSaveEditRef.current = handleSaveEdit;
  }, [handleSaveEdit]);

  const handleToggleStatus = async (item: ContentRecord) => {
    const key = `${item.type}-${item.id}`;
    const newStatus = item.status === 1 ? 0 : 1;
    // Optimistic update
    setItems(prev => prev.map(i => (i.id === item.id && i.type === item.type) ? { ...i, status: newStatus } : i));
    setTogglingIds(prev => new Set(prev).add(key));
    // Use dedicated status toggle API (only updates status field)
    try {
      const res = await contentApi.toggleStatus(item.type, item.id, newStatus);
      if (res?.data?.code === 200 || res?.data?.code === 0) {
        toast.success(newStatus === 1 ? '已上线' : '已下线');
      } else {
        // Revert optimistic update
        setItems(prev => prev.map(i => (i.id === item.id && i.type === item.type) ? { ...i, status: item.status } : i));
        toast.error('更新状态失败');
      }
    } catch (e: unknown) {
      // Revert optimistic update
      setItems(prev => prev.map(i => (i.id === item.id && i.type === item.type) ? { ...i, status: item.status } : i));
      toast.error(extractErrorMessage(e, '更新状态失败'));
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // ========== 批量操作 ==========
  const toggleSelectItem = (key: string) => {
    setSelectedKeys(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const toggleSelectAll = () => {
    const visibleKeys = filtered.map(i => `${i.type}-${i.id}`);
    setSelectedKeys(previous => {
      const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => previous.has(key));
      const next = new Set(previous);
      visibleKeys.forEach(key => allVisibleSelected ? next.delete(key) : next.add(key));
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (batchProcessing) return;
    const ok = await dialog.confirm({
      title: '批量删除',
      content: `确定删除选中的 ${selectedKeys.size} 条内容？删除后不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    setBatchProcessing(true);
    const entries = Array.from(selectedKeys).map(key => {
      const [type, idStr] = key.split('-');
      return { type: type as ContentType, id: Number(idStr) };
    });
    const results = await Promise.allSettled(
      entries.map(e => dispatchByType(e.type, {
        movie: () => contentApi.deleteMovie(e.id),
        drama: () => contentApi.deleteDrama(e.id),
        variety: () => contentApi.deleteVariety(e.id),
        anime: () => contentApi.deleteAnime(e.id),
        short_drama: () => contentApi.deleteShortDrama(e.id),
      }))
    );
    const successCount = results.reduce((acc, r, i) => {
      if (r.status === 'fulfilled' && (r.value?.data?.code === 200 || r.value?.data?.code === 0)) return acc + 1;
      return acc;
    }, 0);
    setTotal(t => Math.max(0, t - successCount));
    toast.success(`成功删除 ${successCount} 条内容`);
    // 清理已删除条目的标签缓存
    setContentTagMap(prev => {
      const next = { ...prev };
      for (const key of selectedKeys) { delete next[key]; }
      return next;
    });
    setSelectedKeys(new Set());
    setBatchProcessing(false);
    fetchItems();
  };

  const handleBatchToggleStatus = async (newStatus: number) => {
    if (selectedKeys.size === 0) return;
    if (batchProcessing) return;
    setBatchProcessing(true);
    const entries = Array.from(selectedKeys)
      .map(key => {
        const [type, idStr] = key.split('-');
        const id = Number(idStr);
        const item = filtered.find(i => i.id === id && i.type === type);
        return { type: type as ContentType, id, item };
      })
      .filter(e => e.item && e.item.status !== newStatus);
    const results = await Promise.allSettled(
      entries.map(e => contentApi.toggleStatus(e.type, e.id, newStatus))
    );
    const successCount = results.reduce((acc, r) => {
      if (r.status === 'fulfilled' && (r.value?.data?.code === 200 || r.value?.data?.code === 0)) return acc + 1;
      return acc;
    }, 0);
    toast.success(`成功${newStatus === 1 ? '上线' : '下线'} ${successCount} 条内容`);
    // 清理已操作条目的标签缓存，确保刷新后标签一致
    setContentTagMap(prev => {
      const next = { ...prev };
      for (const e of entries) { delete next[`${e.type}-${e.id}`]; }
      return next;
    });
    setSelectedKeys(new Set());
    setBatchProcessing(false);
    fetchItems();
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
        {[
          { label: '电影', key: 'movie', icon: '🎬', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: '剧集', key: 'drama', icon: '📺', color: 'text-violet-500', bg: 'bg-violet-500/10' },
          { label: '综艺', key: 'variety', icon: '🎤', color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: '动漫', key: 'anime', icon: '🎯', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: '短剧', key: 'short_drama', icon: '⚡', color: 'text-rose-500', bg: 'bg-rose-500/10' },
        ].map((stat) => (
          <Card key={stat.key} className="bg-card border-border hover:border-foreground/10 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200 group">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center text-base`}>{stat.icon}</div>
                <span className={`text-2xl font-bold ${stat.color} tabular-nums`}>{typeCountMap[stat.key] ?? '-'}</span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batch Action Bar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-primary">已选 {selectedKeys.size} 项</span>
          <div className="flex-1" />
          <button
            onClick={() => handleBatchToggleStatus(1)}
            disabled={batchProcessing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            {batchProcessing ? '处理中...' : '批量上线'}
          </button>
          <button
            onClick={() => handleBatchToggleStatus(0)}
            disabled={batchProcessing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
          >
            {batchProcessing ? '处理中...' : '批量下线'}
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
              onChange={(v) => { setTypeFilter(v as FilterType); setPage(1); }}
              options={[{ label: '全部分类', value: 'all' }, { label: '电影', value: 'movie' }, { label: '剧集', value: 'drama' }, { label: '综艺', value: 'variety' }, { label: '动漫', value: 'anime' }, { label: '短剧', value: 'short_drama' }]}
              className="w-36"
            />
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
              options={[{ label: '全部状态', value: 'all' }, { label: '已上线', value: '1' }, { label: '已下线', value: '0' }]}
              className="w-36"
            />
            <Select
              value={sortField}
              onChange={(v) => { setSortField(v as SortField); setPage(1); }}
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
              onChange={(v) => { setSortDirection(v as SortDirection); setPage(1); }}
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
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.posterUrl || `https://picsum.photos/seed/${item.type}${item.id}/100/150`}
                            alt={item.title}
                            className="w-11 h-[60px] object-cover rounded-md ring-1 ring-black/5 shadow-sm"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.type}${item.id}/100/150`; }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground max-w-48 truncate group-hover:text-primary transition-colors">{item.title}</p>
                            <ContentTags item={item} allTags={allTags} contentTagMap={contentTagMap} />
                            <p className="text-xs text-muted-foreground mt-0.5">{item.createdAt?.slice(0, 10)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-foreground">
                          {TYPE_ICON_EMOJI[item.type] || ''} {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {item.year || '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.scoreDouban ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            ⭐ {item.scoreDouban}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingIds.has(`${item.type}-${item.id}`)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-[color,background-color,box-shadow] disabled:opacity-50 ${item.status === 1 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80 ring-1 ring-border'}`}
                        >
                          {togglingIds.has(`${item.type}-${item.id}`) ? (
                            <Loader2 className="w-1.5 h-1.5 animate-spin" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 1 ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                          )}
                          {item.status === 1 ? '已上线' : '已下线'}
                        </button>
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
              filtered.map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-4 hover:bg-muted/30 transition-[background-color] duration-150 active:bg-muted/50">
                  <div className="flex items-start gap-3">
                    <img
                      src={item.posterUrl || `https://picsum.photos/seed/${item.type}${item.id}/100/150`}
                      alt={item.title}
                      className="w-12 h-[66px] object-cover rounded-md ring-1 ring-black/5 shadow-sm shrink-0"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.type}${item.id}/100/150`; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <ContentTags item={item} allTags={allTags} contentTagMap={contentTagMap} />
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{TYPE_ICON_EMOJI[item.type]} {TYPE_LABELS[item.type]}</span>
                        {item.year && <span className="text-xs text-muted-foreground">{item.year}</span>}
                        {item.scoreDouban && (
                          <span className="inline-flex items-center text-xs font-bold text-amber-600 dark:text-amber-400">⭐ {item.scoreDouban}</span>
                        )}
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingIds.has(`${item.type}-${item.id}`)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-[color,background-color] disabled:opacity-50 ${item.status === 1 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 1 ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                          {item.status === 1 ? '已上线' : '已下线'}
                        </button>
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination - 放在表格下方 */}
      {!loading && total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页
          </p>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="内容详情" width="lg">
        {detailItem && (
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <img
                src={detailItem.posterUrl || `https://picsum.photos/seed/${detailItem.type}${detailItem.id}/200/300`}
                alt={detailItem.title}
                className="w-32 h-44 object-cover rounded-lg"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${detailItem.type}${detailItem.id}/200/300`; }}
              />
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-bold text-foreground">{detailItem.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-muted text-muted-foreground">{TYPE_LABELS[detailItem.type]}</Badge>
                  {detailItem.year && <Badge className="bg-muted text-muted-foreground">{detailItem.year}</Badge>}
                  {detailItem.scoreDouban && <Badge className="bg-primary/20 text-primary">豆瓣 {detailItem.scoreDouban}</Badge>}
                  {detailItem.scoreImdb && <Badge className="bg-muted text-muted-foreground">IMDb {detailItem.scoreImdb}</Badge>}
                  {detailItem.scoreRt && <Badge className="bg-destructive/20 text-destructive">RT {detailItem.scoreRt}%</Badge>}
                  <Badge className={detailItem.status === 1 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}>
                    {detailItem.status === 1 ? '已上线' : '已下线'}
                  </Badge>
                </div>
                {/* Tags in detail */}
                {(() => {
                  const tagIds = contentTagMap[`${detailItem.type}-${detailItem.id}`];
                  if (!tagIds || tagIds.length === 0) return null;
                  const tags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as TagItem[];
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tags.map(tag => (
                        <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color || '#6B7280' }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {detailItem.genre && <div><span className="text-muted-foreground">类型: </span><span className="text-foreground">{parseJsonArray(detailItem.genre)}</span></div>}
              {detailItem.region && <div><span className="text-muted-foreground">地区: </span><span className="text-foreground">{parseJsonArray(detailItem.region)}</span></div>}
              {detailItem.language && <div><span className="text-muted-foreground">语言: </span><span className="text-foreground">{parseJsonArray(detailItem.language)}</span></div>}
              {detailItem.director && <div><span className="text-muted-foreground">导演: </span><span className="text-foreground">{parseJsonArray(detailItem.director)}</span></div>}
              {detailItem.writer && <div><span className="text-muted-foreground">编剧: </span><span className="text-foreground">{parseJsonArray(detailItem.writer)}</span></div>}
              {detailItem.actor && <div className="col-span-2"><span className="text-muted-foreground">演员: </span><span className="text-foreground">{parseJsonArray(detailItem.actor)}</span></div>}
              {detailItem.duration && <div><span className="text-muted-foreground">时长: </span><span className="text-foreground">{detailItem.duration}分钟</span></div>}
              {detailItem.releaseDate && <div><span className="text-muted-foreground">上映: </span><span className="text-foreground">{detailItem.releaseDate}</span></div>}
              {detailItem.alias && <div className="col-span-2"><span className="text-muted-foreground">又名: </span><span className="text-foreground">{parseJsonArray(detailItem.alias)}</span></div>}
            </div>
            {detailItem.storyline && (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">剧情简介:</p>
                <p className="text-foreground leading-relaxed">{detailItem.storyline}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <p>ID: {detailItem.id} | 创建: {detailItem.createdAt?.slice(0, 19)} | 更新: {detailItem.updatedAt?.slice(0, 19)}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal open={creatingNew} onClose={() => { setCreatingNew(false); setFormErrors({}); }} title="新增内容" width="lg"
        footer={
          <>
            <button onClick={() => { setCreatingNew(false); setFormErrors({}); }} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">取消</button>
            <button onClick={handleSaveNew} disabled={savingNew} className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              {savingNew && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingNew ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <ContentFormFields form={editForm} onChange={(f) => { setEditForm(f); setFormErrors({}); }} errors={formErrors} />
        {allTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-sm font-medium text-foreground mb-2 block">🏷️ 内容标签</label>
            <TagSelector allTags={allTags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingItem} onClose={() => { setEditingItem(null); setFormErrors({}); }} title="编辑内容" width="lg"
        footer={
          <>
            <button onClick={() => { setEditingItem(null); setFormErrors({}); }} className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors">取消</button>
            <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingEdit ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <ContentFormFields form={editForm} onChange={(f) => { setEditForm(f); setFormErrors({}); }} showStatus errors={formErrors} />
        {allTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-sm font-medium text-foreground mb-2 block">🏷️ 内容标签</label>
            <TagSelector allTags={allTags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
          </div>
        )}
      </Modal>
    </div>
  );
}
