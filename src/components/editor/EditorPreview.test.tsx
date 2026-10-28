// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import EditorPreview from './EditorPreview';

afterEach(cleanup);

describe('EditorPreview HTML boundary', () => {
  it('renders only sanitized editor HTML', () => {
    const { container, getByText } = render(
      <EditorPreview
        title="Preview"
        summary="Summary"
        content={'<h2>Safe heading</h2><img src=x onerror="alert(1)"><script>alert(1)</script><p>Safe body</p>'}
      />,
    );

    expect(getByText('Safe heading').tagName).toBe('H2');
    expect(getByText('Safe body').tagName).toBe('P');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });
});
