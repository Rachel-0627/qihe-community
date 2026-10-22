import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({ supabase: { from: mocks.from } }));

import { saveProject } from './api';

describe('saveProject idempotent create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({
      select: mocks.select,
      upsert: mocks.upsert,
      insert: mocks.insert,
      update: mocks.update,
    });
    mocks.select.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
  });

  it('upserts a retry with the same stable id instead of inserting another project', async () => {
    await saveProject({ id: 'stable-project-id' }, { idempotentCreate: true });

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'stable-project-id' }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
