// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ uploadMedia: mocks.uploadMedia }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: (zh: string) => zh }) }));

import MultiImageUploadField from './MultiImageUploadField';

afterEach(cleanup);

describe('MultiImageUploadField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads multiple selected images and appends their URLs in selection order', async () => {
    mocks.uploadMedia.mockImplementation(async (file: File) => `https://cdn.test/${file.name}`);
    const onChange = vi.fn();
    const { container } = render(<MultiImageUploadField label="卡片图片集" value={[]} onChange={onChange} folder="projects/covers" />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error('Multi-image input was not rendered');

    fireEvent.change(input, { target: { files: [new File(['one'], 'one.png', { type: 'image/png' }), new File(['two'], 'two.png', { type: 'image/png' })] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://cdn.test/one.png', 'https://cdn.test/two.png']));
    expect(input.hasAttribute('multiple')).toBe(true);
    expect(mocks.uploadMedia).toHaveBeenCalledTimes(2);
  });
});
