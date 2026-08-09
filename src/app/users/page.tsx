'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Search, Pencil, Trash2, Key, Loader2, Shield, ShieldOff, X } from 'lucide-react';
import { userApi, type UserItem } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useDialog } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import Pagination from '@/components/Pagination';

interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export default function UsersPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', nickname: '', email: '', phone: '', status: 1 });
  const [saving, setSaving] = useState(false);

  // Password reset modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Escape key to close modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showResetModal) { setShowResetModal(false); }
        else if (showModal) { setShowModal(false); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal, showResetModal]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.list({ page, size, keyword: debouncedKeyword || undefined });
      if (res.data?.code === 200) {
        const data = res.data.data as PageResult<UserItem>;
        setUsers(data.records);
        setTotal(data.total);
      }
    } catch (e: unknown) { toast.error(extractErrorMessage(e, '加载用户列表失败')); } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const handleSearch = () => { setPage(1); };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', confirmPassword: '', nickname: '', email: '', phone: '', status: 1 });
    setShowModal(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setForm({ username: user.username, password: '', confirmPassword: '', nickname: user.nickname || '', email: user.email || '', phone: user.phone || '', status: user.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingUser && !form.username.trim()) { toast.error('用户名不能为空'); return; }
    if (!editingUser && !form.password.trim()) { toast.error('密码不能为空'); return; }
    if (!editingUser && form.password.length < 6) { toast.error('密码长度至少 6 位'); return; }
    if (!editingUser && form.password !== form.confirmPassword) { toast.error('两次密码不一致'); return; }

    setSaving(true);
    try {
      if (editingUser) {
        await userApi.update(editingUser.id, {
          nickname: form.nickname || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          status: form.status,
        });
        toast.success('用户已更新');
      } else {
        await userApi.create({
          username: form.username,
          password: form.password,
          nickname: form.nickname || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          status: form.status,
        });
        toast.success('用户已创建');
      }
      setShowModal(false);
      loadUsers();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '操作失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    const ok = await dialog.confirm({
      title: '删除用户',
      content: `确定要删除用户「${user.username}」吗？此操作不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await userApi.delete(user.id);
      toast.success('用户已删除');
      loadUsers();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '删除失败'));
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    try {
      await userApi.toggleStatus(user.id);
      toast.success(user.status === 1 ? '已禁用' : '已启用');
      loadUsers();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '操作失败'));
    }
  };

  const openResetPassword = (user: UserItem) => {
    setResetUserId(user.id);
    setResetUsername(user.username);
    setNewPassword('');
    setShowResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) { toast.error('密码长度至少 6 位'); return; }
    if (!resetUserId) return;
    try {
      await userApi.resetPassword(resetUserId, newPassword);
      toast.success('密码已重置');
      setShowResetModal(false);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '重置失败'));
    }
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6" /> 用户管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">管理系统用户账号、权限和状态</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-[color,background-color,box-shadow]">
          <UserPlus className="w-4 h-4" /> 新建用户
        </button>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchRef}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜索用户名、昵称、邮箱、手机号... (Ctrl+F)"
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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground text-sm">加载中...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">暂无用户数据</p>
            </div>
          ) : (
            <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">用户名</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">昵称</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">邮箱</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">手机号</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">状态</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">创建时间</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{user.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.nickname || '-'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.email || '-'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.phone || '-'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge variant={user.status === 1 ? 'default' : 'destructive'}>
                          {user.status === 1 ? '正常' : '禁用'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleToggleStatus(user)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title={user.status === 1 ? '禁用' : '启用'}>
                            {user.status === 1 ? <ShieldOff className="w-4 h-4 text-destructive" /> : <Shield className="w-4 h-4 text-emerald-500" />}
                          </button>
                          <button onClick={() => openResetPassword(user)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="重置密码">
                            <Key className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => openEditModal(user)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="编辑">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(user)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="删除">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {users.map(user => (
                <div key={user.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.nickname || '-'}</p>
                      </div>
                    </div>
                    <Badge variant={user.status === 1 ? 'default' : 'destructive'} className="shrink-0">
                      {user.status === 1 ? '正常' : '禁用'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                    {user.email && <span>📧 {user.email}</span>}
                    {user.phone && <span>📱 {user.phone}</span>}
                    <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggleStatus(user)} className="p-2 rounded-lg hover:bg-muted transition-colors" title={user.status === 1 ? '禁用' : '启用'}>
                      {user.status === 1 ? <ShieldOff className="w-4 h-4 text-destructive" /> : <Shield className="w-4 h-4 text-emerald-500" />}
                    </button>
                    <button onClick={() => openResetPassword(user)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="重置密码">
                      <Key className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => openEditModal(user)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="编辑">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(user)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="删除">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">共 {total} 条，第 {page}/{totalPages} 页</p>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingUser ? '编辑用户' : '新建用户'}>
          <div className="space-y-4 p-1">
            {!editingUser && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">用户名 <span className="text-destructive">*</span></label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="3~30 位" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
              </div>
            )}
            {!editingUser && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">密码 <span className="text-destructive">*</span></label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="至少 6 位" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
              </div>
            )}
            {!editingUser && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">确认密码 <span className="text-destructive">*</span></label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="再次输入密码" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">昵称</label>
              <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} placeholder="显示名称" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">邮箱</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="可选" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">手机号</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="可选" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">状态</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, status: 1 }))} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.status === 1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'}`}>
                  正常
                </button>
                <button onClick={() => setForm(f => ({ ...f, status: 0 }))} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.status === 0 ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'}`}>
                  禁用
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />保存中...</> : editingUser ? '保存修改' : '创建用户'}
              </button>
            </div>
          </div>
        </Modal>

      {/* Reset Password Modal */}
      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title={`重置密码 — ${resetUsername}`}>
          <div className="space-y-4 p-1">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">新密码</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 6 位" className="h-10 px-4 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-[border-color,box-shadow,background-color]" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-colors">取消</button>
              <button onClick={handleResetPassword} className="px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">确认重置</button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
