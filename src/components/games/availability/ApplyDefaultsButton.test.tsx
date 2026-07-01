import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui';
import { ApplyDefaultsButton } from './ApplyDefaultsButton';

vi.mock('next/navigation', () => ({
  usePathname: () => '/games/abc',
}));

function renderButton(hasDefaults: boolean | null, onApplyDefaults = vi.fn()) {
  render(
    <ToastProvider>
      <ApplyDefaultsButton onApplyDefaults={onApplyDefaults} hasDefaults={hasDefaults} />
    </ToastProvider>,
  );
  return { onApplyDefaults };
}

describe('ApplyDefaultsButton', () => {
  it('disables the button and labels the link "Set up defaults" when there are no saved defaults', () => {
    renderButton(false);
    expect(screen.getByRole('button', { name: /apply my default availability/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Set up defaults' })).toBeInTheDocument();
  });

  it('enables the button and labels the link "Edit defaults" when defaults exist', () => {
    renderButton(true);
    expect(screen.getByRole('button', { name: /apply my default availability/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit defaults' })).toBeInTheDocument();
  });

  it('treats hasDefaults=null (still loading) as enabled, matching the has-defaults state', () => {
    renderButton(null);
    expect(screen.getByRole('button', { name: /apply my default availability/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit defaults' })).toBeInTheDocument();
  });

  it('shows a toast after successfully applying defaults', async () => {
    const onApplyDefaults = vi.fn().mockResolvedValue({ hadDefaults: true, filled: 2 });
    renderButton(true, onApplyDefaults);
    await userEvent.click(screen.getByRole('button', { name: /apply my default availability/i }));
    expect(await screen.findByText('Filled in 2 dates.')).toBeInTheDocument();
  });
});
