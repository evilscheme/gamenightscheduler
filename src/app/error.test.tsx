import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './error';

describe('app error boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a recoverable message and retries on click', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorBoundary error={new Error('boom')} retry={retry} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('logs the error it caught', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    render(<ErrorBoundary error={err} retry={() => {}} />);
    expect(spy).toHaveBeenCalledWith(err);
  });
});
