// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ImgHTMLAttributes, ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'user-1' } as { id: string } | null,
    profile: null as { nickname: string | null; username: string | null; avatar_url: string | null; role: string } | null,
    loading: true,
    profileLoading: false,
    signOut: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: (zh: string) => zh, lang: 'zh', toggleLang: vi.fn() }) }));
vi.mock('@/contexts/SiteSettingsContext', () => ({ useSiteSettings: () => ({ brandName: '启禾社区', brandNameEn: 'Qihe Community', navLabels: {} }) }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ onLoadingStatusChange, ...props }: ImgHTMLAttributes<HTMLImageElement> & { onLoadingStatusChange?: (status: string) => void }) => (
    <img {...props} onLoad={() => onLoadingStatusChange?.('loaded')} onError={() => onLoadingStatusChange?.('error')} />
  ),
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

import Header from './Header';

function renderHeader() {
  return render(<MemoryRouter><Header /></MemoryRouter>);
}

describe('Header account loading', () => {
  beforeEach(() => {
    mocks.auth.user = { id: 'user-1' };
    mocks.auth.profile = null;
    mocks.auth.loading = true;
    mocks.auth.profileLoading = false;
    mocks.auth.signOut.mockReset();
    localStorage.clear();
  });
  afterEach(cleanup);

  it('holds a fixed neutral placeholder until the session is known', () => {
    renderHeader();
    expect(screen.getByRole('status', { name: '正在加载账号…' })).toBeTruthy();
    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.queryByText('登录')).toBeNull();
  });

  it('does not show placeholder identity while the profile is loading', () => {
    mocks.auth.loading = false;
    mocks.auth.profileLoading = true;
    renderHeader();
    expect(screen.getByRole('status', { name: '正在加载账号…' })).toBeTruthy();
    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.queryByText('U')).toBeNull();
  });

  it('shows the saved nickname without waiting for the avatar', () => {
    mocks.auth.loading = false;
    mocks.auth.profile = { nickname: '新宇', username: 'xinyu', avatar_url: 'https://example.com/avatar.png', role: 'user' };
    renderHeader();

    expect(screen.getByRole('button', { name: /新宇/ })).toBeTruthy();
    expect(screen.queryByRole('status', { name: '正在加载账号…' })).toBeNull();
  });

  it('shows the previous identity during a profile refresh for the same user', () => {
    localStorage.setItem('qihe.headerIdentity.v1', JSON.stringify({ userId: 'user-1', name: '新宇', avatarUrl: null }));
    mocks.auth.loading = false;
    mocks.auth.profileLoading = true;
    renderHeader();
    expect(screen.getByRole('button', { name: /新宇/ })).toBeTruthy();
    expect(screen.queryByRole('status', { name: '正在加载账号…' })).toBeNull();
  });

  it("does not show another user's cached identity", () => {
    localStorage.setItem('qihe.headerIdentity.v1', JSON.stringify({ userId: 'someone-else', name: '他人', avatarUrl: null }));
    mocks.auth.loading = false;
    mocks.auth.profileLoading = true;
    renderHeader();
    expect(screen.queryByText('他人')).toBeNull();
    expect(screen.getByRole('status', { name: '正在加载账号…' })).toBeTruthy();
  });

  it('uses a neutral account label when no profile was returned', () => {
    mocks.auth.loading = false;
    renderHeader();
    expect(screen.getByRole('button', { name: /账号/ })).toBeTruthy();
    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.queryByText('U')).toBeNull();
  });

  it('shows the saved nickname with a neutral avatar if the image fails', () => {
    mocks.auth.loading = false;
    mocks.auth.profile = { nickname: '新宇', username: 'xinyu', avatar_url: 'https://example.com/avatar.png', role: 'user' };
    const view = renderHeader();
    fireEvent.error(view.container.querySelector('img')!);
    expect(screen.getByRole('button', { name: /新宇/ })).toBeTruthy();
    expect(screen.queryByText('新', { exact: true })).toBeNull();
  });

  it('shows the sign-in action only after confirming there is no session', () => {
    mocks.auth.loading = false;
    mocks.auth.user = null;
    renderHeader();
    expect(screen.getByText('登录')).toBeTruthy();
    expect(screen.queryByRole('status', { name: '正在加载账号…' })).toBeNull();
  });
});
