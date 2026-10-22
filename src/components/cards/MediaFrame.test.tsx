// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MediaFrame from './MediaFrame';

afterEach(cleanup);

describe('MediaFrame', () => {
  it('autoplays a muted looping video instead of showing a cover image', () => {
    render(<MediaFrame src="" videoSrc="https://example.com/project.mp4" alt="Project" />);

    const video = screen.getByTestId('media-frame-video');
    expect(video.getAttribute('src')).toBe('https://example.com/project.mp4');
    expect(video.hasAttribute('autoplay')).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.classList.contains('object-contain')).toBe(true);
    expect(screen.queryByText('No Image')).toBeNull();
  });

  it('shows a user-uploaded image when there is no video', () => {
    render(<MediaFrame src="https://example.com/cover.jpg" alt="Project" />);

    expect(screen.getByRole('img', { name: 'Project' }).getAttribute('src')).toBe('https://example.com/cover.jpg');
    expect(screen.queryByTestId('media-frame-video')).toBeNull();
  });

  it('uses video playback when both a cover image and video are present', () => {
    render(<MediaFrame src="https://example.com/cover.jpg" videoSrc="https://example.com/project.mp4" alt="Project" />);

    expect(screen.getByTestId('media-frame-video')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
