import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoading } from './PageState';

// The real LoadingSpinner is the canvas-2D d20, which jsdom can't render.
vi.mock('./LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));

describe('PageLoading', () => {
  it('renders a full-page spinner without a message by default', () => {
    const { container } = render(<PageLoading />);
    expect(container.firstElementChild?.className).toContain('min-h-[calc(100vh-4rem)]');
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders the optional message under the spinner', () => {
    render(<PageLoading message="Deleting your account…" />);
    expect(screen.getByText('Deleting your account…')).toBeInTheDocument();
  });
});
