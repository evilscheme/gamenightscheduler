import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui';
import { CalendarSubscribeButton } from './CalendarSubscribeButton';

function renderWithToast(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('CalendarSubscribeButton', () => {
  it('renders nothing while the webcal URL is not yet known', () => {
    const { container } = renderWithToast(<CalendarSubscribeButton webcalUrl="" />);
    expect(container.querySelector('[data-testid="calendar-subscribe"]')).toBeNull();
  });

  it('renders a labeled webcal:// subscribe link', () => {
    renderWithToast(
      <CalendarSubscribeButton webcalUrl="webcal://example.com/api/games/calendar/abc" />
    );
    const link = screen.getByTestId('calendar-subscribe-link');
    expect(link).toHaveAttribute('href', 'webcal://example.com/api/games/calendar/abc');
    expect(link).toHaveTextContent('Subscribe');
  });

  it('copies the URL to the clipboard via the fallback button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderWithToast(<CalendarSubscribeButton webcalUrl="webcal://example.com/feed" />);
    await userEvent.click(screen.getByTestId('calendar-subscribe-copy'));
    expect(writeText).toHaveBeenCalledWith('webcal://example.com/feed');
  });
});
