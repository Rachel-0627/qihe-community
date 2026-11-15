// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostCard from './PostCard';
import { toggleDiscussionReaction } from '@/lib/discussionApi';

vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: (zh: string) => zh, lang: 'zh' }) }));
vi.mock('@/lib/discussionApi', () => ({
  commentCountOf: () => 2,
  reactionCountOf: () => 3,
  toggleDiscussionReaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/communityConnectionsApi', () => ({ reportCommunityItem: vi.fn() }));

const item = {
  id: 'post-1', title: '测试帖子', body: '分享一条真实讨论', cover_url: '', images: [], author_id: 'author-1',
  author_name: '小禾', author_avatar: '', is_pinned: false, category: '实践分享', created_at: new Date().toISOString(), updated_at: '',
};

afterEach(() => cleanup());

describe('PostCard discussion controls', () => {
  it('shows category, comment and reaction counts', () => {
    render(<MemoryRouter><PostCard item={item} userId="viewer-1" /></MemoryRouter>);
    expect(screen.getByText('实践分享')).toBeTruthy();
    expect(screen.getByText('2 条回应')).toBeTruthy();
    expect(screen.getByText('3 赞')).toBeTruthy();
  });

  it('sends a like toggle for a signed in member', async () => {
    render(<MemoryRouter><PostCard item={item} userId="viewer-1" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '3 赞' }));
    expect(toggleDiscussionReaction).toHaveBeenCalledWith('viewer-1', 'post-1', 'like', false);
  });
});
