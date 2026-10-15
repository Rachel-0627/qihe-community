import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: mocks.from,
  },
}));

import { saveEventFilterOption, saveSiteContent } from './api';

describe('admin save fallback when automatic translation is unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error('Requested function was not found'),
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
  });

  it('still saves a city filter and preserves its existing English name', async () => {
    await expect(saveEventFilterOption({
      group: 'city',
      name: '保定',
      name_en: 'Baoding',
      sort_order: 0,
      is_active: true,
    })).resolves.toBeUndefined();

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: '保定',
      name_en: 'Baoding',
    }));
  });

  it('still saves website copy and preserves its existing English value', async () => {
    await expect(saveSiteContent({
      id: 'footer-tagline',
      section: 'footer',
      key: 'tagline',
      value: '启禾社区',
      value_en: 'QIHE Community',
      image_url: '',
      updated_at: '2026-10-14T00:00:00.000Z',
    })).resolves.toBeUndefined();

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      value: '启禾社区',
      value_en: 'QIHE Community',
    }));
  });
});
