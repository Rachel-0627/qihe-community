// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: (zh: string) => zh }) }));

import ProjectCardMedia from './ProjectCardMedia';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProjectCardMedia', () => {
  it('lets visitors switch between gallery images manually', () => {
    render(
      <MemoryRouter>
        <ProjectCardMedia id="project-1" title="Project" galleryUrls={['first.jpg', 'second.jpg']} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '下一张图片' }));
    expect(screen.getByRole('img', { name: 'Project' }).getAttribute('src')).toBe('second.jpg');
  });

  it('lets visitors swipe to the next gallery image', () => {
    const { container } = render(
      <MemoryRouter>
        <ProjectCardMedia id="project-1" title="Project" galleryUrls={['first.jpg', 'second.jpg']} />
      </MemoryRouter>
    );
    const frame = container.querySelector('.touch-pan-y');
    if (!frame) throw new Error('Project media frame was not rendered');

    fireEvent.touchStart(frame, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 100 }] });

    expect(screen.getByRole('img', { name: 'Project' }).getAttribute('src')).toBe('second.jpg');
  });

  it('automatically rotates images at the configured interval', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <ProjectCardMedia id="project-1" title="Project" galleryUrls={['first.jpg', 'second.jpg']} />
      </MemoryRouter>
    );

    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.getByRole('img', { name: 'Project' }).getAttribute('src')).toBe('second.jpg');
  });
});
