// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchSiteContent: vi.fn(),
  saveSiteContent: vi.fn(),
  reloadSiteContent: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchSiteContent: mocks.fetchSiteContent,
  saveSiteContent: mocks.saveSiteContent,
}));

vi.mock('@/contexts/I18nContext', () => ({
  useI18n: () => ({ t: (zh: string) => zh }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: 'admin' } }),
}));

vi.mock('@/contexts/SiteContentContext', () => ({
  useSiteContent: () => ({ reload: mocks.reloadSiteContent }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

import AdminContent from './AdminContent';

describe('AdminContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchSiteContent.mockResolvedValue([{
      id: 'footer-tagline',
      section: 'footer',
      key: 'tagline',
      value: '更新后的页脚文案',
      value_en: 'Updated footer copy',
      image_url: '',
      updated_at: '2026-10-14T00:00:00.000Z',
    }]);
    mocks.saveSiteContent.mockResolvedValue(undefined);
    mocks.reloadSiteContent.mockResolvedValue(undefined);
  });

  it('reloads the shared site content after a successful save', async () => {
    const user = userEvent.setup();
    render(<AdminContent />);

    const field = await screen.findByLabelText('页脚品牌介绍');
    await user.clear(field);
    await user.type(field, '新的页脚文案');
    await user.click(screen.getByRole('button', { name: '保存全部更改' }));

    await waitFor(() => expect(mocks.saveSiteContent).toHaveBeenCalledOnce());
    expect(mocks.reloadSiteContent).toHaveBeenCalledOnce();
  });
});
