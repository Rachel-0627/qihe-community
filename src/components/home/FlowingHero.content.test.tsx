// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteContentProvider } from '@/contexts/SiteContentContext';
import FlowingHero from './FlowingHero';

const mocks = vi.hoisted(() => ({ fetchSiteContent: vi.fn() }));

vi.mock('@/lib/api', () => ({ fetchSiteContent: mocks.fetchSiteContent }));
vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'zh', t: (zh: string) => zh }) }));
vi.mock('gsap', () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }));
vi.mock('./CommunityNetwork', () => ({ default: () => <div data-testid="community-network" /> }));

describe('FlowingHero content loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never shows a superseded hard-coded headline while admin copy loads', async () => {
    let resolveRows!: (rows: Array<{ section: string; key: string; value: string; value_en: string }>) => void;
    mocks.fetchSiteContent.mockImplementation(() => new Promise((resolve) => { resolveRows = resolve; }));

    render(<SiteContentProvider><FlowingHero /></SiteContentProvider>);

    expect(screen.queryByText('探索 AI 的边界')).toBeNull();
    expect(screen.queryByText('共建创新社区')).toBeNull();

    resolveRows([
      { section: 'hero', key: 'title', value: '后台最新标题', value_en: 'Current admin headline' },
      { section: 'hero', key: 'subtitle', value: '后台最新副标题', value_en: 'Current admin subtitle' },
    ]);

    await waitFor(() => expect(screen.getByText('后台最新标题')).not.toBeNull());
    expect(screen.getByText('后台最新副标题')).not.toBeNull();
  });
});
