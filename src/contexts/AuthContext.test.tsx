// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  maybeSingle: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  },
}));

import { AuthProvider, useAuth } from './AuthContext';

const user = { id: 'admin-1' };
const adminProfile = { id: user.id, role: 'admin', nickname: 'Admin' };

function AuthState() {
  const { user: currentUser, profile, loading, profileLoading, profileError, refreshProfile } = useAuth();
  return (
    <div>
      <span>{loading ? 'session-loading' : 'session-ready'}</span>
      <span>{profileLoading ? 'profile-loading' : 'profile-ready'}</span>
      <span>{currentUser ? 'signed-in' : 'signed-out'}</span>
      <span>{profile ? profile.role : 'profile-missing'}</span>
      {profileError && <span role="alert">{profileError.message}</span>}
      <button onClick={() => void refreshProfile()}>重试</button>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('AuthProvider profile loading', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { user } } });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  });

  it('shows the profile read error and loads the profile after retry', async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'profile request failed' } })
      .mockResolvedValueOnce({ data: adminProfile, error: null });

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect((await screen.findByRole('alert')).textContent).toContain('profile request failed');
    expect(screen.getByText('profile-missing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByText('admin')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('finishes loading and exposes a missing profile when no row exists', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect(await screen.findByText('profile-ready')).toBeTruthy();
    expect(screen.getByText('profile-missing')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps profile loading visible until a slow profile request resolves', async () => {
    const pending = deferred<{ data: typeof adminProfile; error: null }>();
    mocks.maybeSingle.mockReturnValue(pending.promise);

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect(await screen.findByText('profile-loading')).toBeTruthy();
    expect(screen.getByText('session-ready')).toBeTruthy();
    await act(async () => pending.resolve({ data: adminProfile, error: null }));
    expect(await screen.findByText('admin')).toBeTruthy();
    expect(screen.getByText('profile-ready')).toBeTruthy();
  });
});
