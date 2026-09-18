import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { invokeAdminUsers } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Trash2, Plus, User } from 'lucide-react';

interface AdminUser {
  id: string;
  username: string | null;
  email: string | null;
  role: string;
  member_tier: string;
  community_identity: string;
  level: number;
  xp: number;
}

// 用户名会被拼成 `${username}@miaoda.com` 当邮箱去调 Supabase Auth，
// 含中文或 @ 等字符会拼出非法邮箱、报出难懂的原始错误。
// 字符集与登录页 (LoginPage) 保持一致，另加 32 位上限作为兜底。
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const MIN_PASSWORD_LENGTH = 6;

export default function AdminAccounts() {
  const { t } = useI18n();
  const { profile, refreshProfile, signOut } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invokeAdminUsers<{ users: AdminUser[] }>('list');
      setUsers(res.users);
    } catch (err) {
      toast.error(t('加载账号失败', 'Failed to load accounts'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsername.trim();
    const password = newPassword.trim();
    if (!username || !password) return;
    if (!USERNAME_PATTERN.test(username)) {
      toast.error(t('用户名需为 3–32 位字母、数字或下划线', 'Username must be 3-32 letters, digits or underscores'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('密码至少 6 位', 'Password must be at least 6 characters'));
      return;
    }
    try {
      await invokeAdminUsers('create', { username, password });
      toast.success(t('管理员账号已创建', 'Admin account created'));
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } catch (err) {
      toast.error((err as Error).message || t('创建失败', 'Create failed'));
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = editUsername.trim();
    if (!editUserId || !username) return;
    if (!USERNAME_PATTERN.test(username)) {
      toast.error(t('用户名需为 3–32 位字母、数字或下划线', 'Username must be 3-32 letters, digits or underscores'));
      return;
    }
    try {
      await invokeAdminUsers('update', { userId: editUserId, username });
      toast.success(t('用户名已更新', 'Username updated'));
      setEditUserId(null);
      setEditUsername('');
      loadUsers();
      if (editUserId === profile?.id) refreshProfile();
    } catch (err) {
      toast.error((err as Error).message || t('更新失败', 'Update failed'));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = resetPassword.trim();
    if (!editUserId || !password) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('密码至少 6 位', 'Password must be at least 6 characters'));
      return;
    }
    try {
      await invokeAdminUsers('updatePassword', { userId: editUserId, password });
      toast.success(t('密码已重置', 'Password reset'));
      setResetPassword('');
      // If current user changes own password, Supabase session may be invalidated.
      if (editUserId === profile?.id) {
        await signOut();
      }
    } catch (err) {
      toast.error((err as Error).message || t('重置失败', 'Reset failed'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t('确定要删除该账号吗？此操作不可撤销。', 'Are you sure you want to delete this account? This cannot be undone.'))) return;
    try {
      await invokeAdminUsers('delete', { userId });
      toast.success(t('账号已删除', 'Account deleted'));
      loadUsers();
    } catch (err) {
      toast.error((err as Error).message || t('删除失败', 'Delete failed'));
    }
  };

  const currentUsername = profile?.username || '';

  return (
    <div className="space-y-10">
      {/* My account */}
      <section>
        <p className="editorial-label text-accent">{t('当前账号', 'Current Account')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('修改管理员账号', 'Modify Admin Account')}</h2>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleUpdateUsername} className="magazine-card space-y-4 p-5">
            <div className="flex items-center gap-2 text-foreground">
              <User className="h-4 w-4 text-accent" />
              <h3 className="font-display text-base font-medium">{t('修改用户名', 'Change Username')}</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('当前用户名', 'Current Username')}</Label>
              <Input value={currentUsername} disabled className="px-3" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('新用户名', 'New Username')}</Label>
              <Input value={editUserId === profile?.id ? editUsername : ''} onChange={(e) => { setEditUserId(profile?.id || null); setEditUsername(e.target.value); }} placeholder={t('输入新用户名', 'Enter new username')} className="px-3" />
            </div>
            <Button type="submit" size="sm" className="font-mono-label text-[10px]">{t('更新用户名', 'Update Username')}</Button>
          </form>

          <form onSubmit={handleResetPassword} className="magazine-card space-y-4 p-5">
            <div className="flex items-center gap-2 text-foreground">
              <RefreshCw className="h-4 w-4 text-accent" />
              <h3 className="font-display text-base font-medium">{t('修改密码', 'Change Password')}</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('新密码', 'New Password')}</Label>
              <Input type="password" value={editUserId === profile?.id ? resetPassword : ''} onChange={(e) => { setEditUserId(profile?.id || null); setResetPassword(e.target.value); }} placeholder={t('至少 6 位字符', 'At least 6 characters')} className="px-3" />
            </div>
            <Button type="submit" size="sm" className="font-mono-label text-[10px]">{t('更新密码', 'Update Password')}</Button>
          </form>
        </div>
      </section>

      {/* Create new admin */}
      <section>
        <p className="editorial-label text-accent">{t('新建账号', 'New Account')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('创建新管理员', 'Create New Admin')}</h2>

        <form onSubmit={handleCreate} className="mt-6 magazine-card space-y-4 p-5 lg:max-w-xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('用户名', 'Username')}</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={t('例如 xinyu123456', 'e.g. xinyu123456')} className="px-3" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('密码', 'Password')}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('至少 6 位字符', 'At least 6 characters')} className="px-3" />
            </div>
          </div>
          <Button type="submit" size="sm" className="gap-1.5 font-mono-label text-[10px]">
            <Plus className="h-3.5 w-3.5" />{t('创建管理员', 'Create Admin')}
          </Button>
        </form>
      </section>

      {/* Admin list */}
      <section>
        <p className="editorial-label text-accent">{t('账号列表', 'Account List')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('管理员账号', 'Admin Accounts')}</h2>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted" />)}
          </div>
        ) : (
          <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('用户名', 'Username')}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('角色', 'Role')}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('会员', 'Tier')}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('等级', 'Level')}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                      {u.username}
                      {u.id === profile?.id && <span className="ml-2 font-mono-label text-[10px] text-accent">{t('当前', 'Current')}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{u.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{u.member_tier}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">Lv.{u.level}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditUserId(u.id); setEditUsername(u.username || ''); setResetPassword(''); }} className="font-mono-label text-[10px]">{t('编辑', 'Edit')}</Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} disabled={u.id === profile?.id} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit dialog inline */}
        {editUserId && (
          <div className="mt-6 magazine-card space-y-4 p-5 lg:max-w-xl">
            <h3 className="font-display text-base font-medium">{t('编辑账号', 'Edit Account')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('新用户名', 'New Username')}</Label>
                <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="px-3" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('新密码', 'New Password')}</Label>
                <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder={t('留空则不修改', 'Leave blank to keep')} className="px-3" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateUsername} className="font-mono-label text-[10px]">{t('保存用户名', 'Save Username')}</Button>
              {resetPassword && <Button size="sm" variant="outline" onClick={handleResetPassword} className="font-mono-label text-[10px]">{t('保存密码', 'Save Password')}</Button>}
              <Button size="sm" variant="ghost" onClick={() => { setEditUserId(null); setEditUsername(''); setResetPassword(''); }} className="font-mono-label text-[10px]">{t('取消', 'Cancel')}</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}