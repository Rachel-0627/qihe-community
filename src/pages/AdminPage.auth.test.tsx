// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'admin-1' } as { id: string } | null,
    profile: null as { role: string } | null,
    loading: false,
    profileLoading: false,
    profileError: null as Error | null,
    refreshProfile: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: (zh: string) => zh }) }));
vi.mock('@/components/admin/AdminAccounts', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminAssistant', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminBenefits', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminContentHub', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminCopywriting', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminOverview', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminSubmissions', () => ({ default: () => null }));

import AdminPage from './AdminPage';

function CurrentPath() {
  return <span data-testid="current-path">{useLocation().pathname}</span>;
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <CurrentPath />
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<p>login-page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminPage profile access states', () => {
  beforeEach(() => {
    mocks.auth.user = { id: 'admin-1' };
    mocks.auth.profile = null;
    mocks.auth.loading = false;
    mocks.auth.profileLoading = false;
    mocks.auth.profileError = null;
    mocks.auth.refreshProfile.mockReset();
  });
  afterEach(cleanup);

  it('shows the read error and offers a retry action', () => {
    mocks.auth.profileError = new Error('temporary profile failure');
    renderAdmin();

    expect(screen.getByRole('alert').textContent).toContain('temporary profile failure');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(mocks.auth.refreshProfile).toHaveBeenCalledTimes(1);
  });

  it('shows an explicit message when the profile does not exist', () => {
    renderAdmin();
    expect(screen.getByRole('status').textContent).toContain('未找到当前账号的用户资料');
    expect(screen.queryByText('加载中…')).toBeNull();
  });

  it('keeps displaying a loading state while a slow profile request is pending', () => {
    mocks.auth.profileLoading = true;
    renderAdmin();
    expect(screen.getByText('正在读取用户资料…')).toBeTruthy();
  });

  it('redirects signed-out users and denies admin controls to non-admin users', async () => {
    mocks.auth.user = null;
    renderAdmin();
    await waitFor(() => expect(screen.getByTestId('current-path').textContent).toBe('/login'));
    cleanup();

    mocks.auth.user = { id: 'member-1' };
    mocks.auth.profile = { role: 'user' };
    renderAdmin();
    expect(screen.getByRole('alert').textContent).toContain('没有管理员权限');
    expect(screen.queryByText('管理控制台')).toBeNull();
  });

  it('allows an administrator with a loaded profile to enter the console', () => {
    mocks.auth.profile = { role: 'admin' };
    renderAdmin();
    expect(screen.getByText('管理控制台')).toBeTruthy();
    expect(screen.getByText('工作台')).toBeTruthy();
  });
});
