// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchProjectFilterOptions: vi.fn(),
  captureFormProps: vi.fn(),
  t: (zh: string) => zh,
}));

vi.mock('@/lib/api', () => ({ fetchProjectFilterOptions: mocks.fetchProjectFilterOptions }));
vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: mocks.t, lang: 'zh' }) }));
vi.mock('@/components/common/SubmissionForm', () => ({
  default: (props: unknown) => { mocks.captureFormProps(props); return null; },
}));

import SubmitProjectPage from './SubmitProjectPage';

describe('SubmitProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchProjectFilterOptions.mockResolvedValue([]);
  });

  it('includes the same video upload field in the public project submission payload', async () => {
    render(<SubmitProjectPage />);
    await waitFor(() => expect(mocks.captureFormProps).toHaveBeenCalled());

    const props = mocks.captureFormProps.mock.calls[0][0] as {
      extraDefaults: Record<string, string>;
      renderExtra: (values: Record<string, string>, patch: (value: Record<string, string>) => void) => ReactNode;
      buildPayload: (values: Record<string, string>) => Record<string, unknown>;
    };
    const values = { ...props.extraDefaults, title: '', summary: '', content: '', cover_url: '', video_url: 'https://example.com/video.mp4' };
    const extra = props.renderExtra(values, vi.fn());
    const videoField = Children.toArray(isValidElement(extra)
      ? (extra as ReactElement<{ children: ReactNode }>).props.children
      : extra)[0];

    expect(props.extraDefaults.video_url).toBe('');
    expect(props.buildPayload(values).video_url).toBe(values.video_url);
    expect(isValidElement(videoField) && videoField.props).toMatchObject({
      label: '项目视频',
      folder: 'projects/videos',
      accept: 'video/mp4',
      preview: 'video',
    });
  });
});
