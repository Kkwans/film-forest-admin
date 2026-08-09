'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tags, Plus, Pencil, Trash2, Search, Loader2, Inbox, Tag, X, Hash } from 'lucide-react';
import { tagApi, type TagItem } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useDialog } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#84CC16', '#E11D48',
];

export default function TagsPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] });
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tagApi.list();
      if (res.data?.code === 200) {
        setTags(res.data.data || []);
      }
    } catch (e: unknown) { toast.error(extractErrorMessage(e, '加载标签失败')); } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const filtered = keyword
    ? tags.filter(t => t.name.toLowerCase().includes(keyword.toLowerCase()))
    : tags;

  const openCreateModal = () => {
    setEditingTag(null);
    setForm({ name: '', color: PRESET_COLORS[0] });
    setShowModal(true);
  };

  const openEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setForm({ name: tag.name, color: tag.color || PRESET_COLORS[0] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('标签名称不能为空');
      return;
    }
    if (form.name.length > 20) {
      toast.error('标签名称不超过 20 个字符');
      return;
    }
    // Check duplicate name
    const duplicate = tags.find(t => t.name === form.name.trim() && t.id !== editingTag?.id);
    if (duplicate) {
      toast.error('标签名称已存在');
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      if (editingTag) {
        await tagApi.update(editingTag.id, { name: form.name.trim(), color: form.color });
        toast.success('标签已更新');
      } else {
        await tagApi.create({ name: form.name.trim(), color: form.color });
        toast.success('标签已创建');
      }
      setShowModal(false);
      loadTags();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '操作失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagItem) => {
    const ok = await dialog.confirm({
      title: '删除标签',
      content: `确定要删除标签「${tag.name}」吗？关联的内容不会被删除，但会失去该标签标记。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await tagApi.delete(tag.id);
      toast.success('标签已删除');
      loadTags();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '删除失败'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Tags className="w-6 h-6" /> 标签管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">管理内容标签，用于分类和筛选影视资源</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-[color,background-color,box-shadow]"
        >
          <Plus className="w-4 h-4" /> 新建标签
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">标签总数</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? <Skeleton className="h-6 w-12" /> : tags.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">有内容的标签</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? <Skeleton className="h-6 w-12" /> : tags.filter(t => (t.usageCount ?? 0) > 0).length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Hash className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hidden sm:block">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">总使用次数</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? <Skeleton className="h-6 w-12" /> : tags.reduce((sum, t) => sum + (t.usageCount ?? 0), 0)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <span className="text-lg">🔗</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchRef}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索标签名称... (Ctrl+F)"
              className="h-10 pl-10 pr-9 rounded-lg border bg-background text-foreground text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]"
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
        </CardContent>
      </Card>

      {/* Tags Grid */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">{keyword ? `未找到匹配「${keyword}」的标签` : '暂无标签'}</p>
              {!keyword && (
                <button onClick={openCreateModal} className="text-xs text-primary hover:underline mt-2">
                  创建第一个标签 →
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(tag => (
                <div
                  key={tag.id}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border hover:border-foreground/10 hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: tag.color || PRESET_COLORS[0] }}
                  >
                    {tag.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tag.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(tag.usageCount ?? 0) > 0
                        ? `${tag.usageCount} 个内容`
                        : '暂无关联内容'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEditModal(tag)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTag ? '编辑标签' : '新建标签'}
        width="sm"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm rounded-lg border bg-background text-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />保存中...</>
              ) : editingTag ? '保存修改' : '创建标签'}
            </button>
          </>
        }
      >
        <div className="space-y-5 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">
              标签名称 <span className="text-destructive">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如：经典、高分、科幻..."
              maxLength={20}
              className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-muted-foreground">不超过 20 个字符</p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">标签颜色</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-lg transition-[transform,box-shadow] ${form.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">预览</label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: form.color }}
              >
                {form.name || '标签名称'}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
