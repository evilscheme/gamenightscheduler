import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui';
import type { ApplyDefaultsResult } from '@/hooks/useAvailability';
import { ApplyDefaultsButton } from './ApplyDefaultsButton';

vi.mock('next/navigation', () => ({
  usePathname: () => '/games/abc',
}));

/** A full result object, so tests only spell out the field under test. */
function result(overrides: Partial<ApplyDefaultsResult> = {}): ApplyDefaultsResult {
  return { hadDefaults: true, filled: 0, replaced: 0, mismatchedDates: [], ...overrides };
}

function renderButton(
  hasDefaults: boolean | null,
  onApplyDefaults: (replaceDates?: string[]) => Promise<ApplyDefaultsResult> = vi.fn(),
) {
  render(
    <ToastProvider>
      <ApplyDefaultsButton onApplyDefaults={onApplyDefaults} hasDefaults={hasDefaults} />
    </ToastProvider>,
  );
  return { onApplyDefaults };
}

const applyButton = () =>
  screen.getByRole('button', { name: /apply my default availability/i });

describe('ApplyDefaultsButton', () => {
  it('disables the button and labels the link "Set up defaults" when there are no saved defaults', () => {
    renderButton(false);
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Set up defaults' })).toBeInTheDocument();
  });

  it('enables the button and labels the link "Edit defaults" when defaults exist', () => {
    renderButton(true);
    expect(applyButton()).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit defaults' })).toBeInTheDocument();
  });

  it('treats hasDefaults=null (still loading) as enabled, matching the has-defaults state', () => {
    renderButton(null);
    expect(applyButton()).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit defaults' })).toBeInTheDocument();
  });

  it('shows a toast after filling blank dates, with no dialog when nothing conflicts', async () => {
    const onApplyDefaults = vi.fn().mockResolvedValue(result({ filled: 2 }));
    renderButton(true, onApplyDefaults);
    await userEvent.click(applyButton());
    expect(await screen.findByText('Filled in 2 dates.')).toBeInTheDocument();
    expect(screen.queryByTestId('replace-defaults-modal')).not.toBeInTheDocument();
  });

  it('prompts for the user to set defaults up when they have none', async () => {
    const onApplyDefaults = vi.fn().mockResolvedValue(result({ hadDefaults: false }));
    renderButton(null, onApplyDefaults);
    await userEvent.click(applyButton());
    expect(await screen.findByText('Set up your default availability first.')).toBeInTheDocument();
  });

  it('reports nothing to do when every eligible date already matches the defaults', async () => {
    const onApplyDefaults = vi.fn().mockResolvedValue(result({ filled: 0 }));
    renderButton(true, onApplyDefaults);
    await userEvent.click(applyButton());
    expect(await screen.findByText(/already applied/i)).toBeInTheDocument();
  });

  it('shows a danger toast when the apply fails', async () => {
    const onApplyDefaults = vi.fn().mockRejectedValue(new Error('nope'));
    renderButton(true, onApplyDefaults);
    await userEvent.click(applyButton());
    expect(await screen.findByText(/could not apply your defaults/i)).toBeInTheDocument();
  });

  describe('when dates disagree with the defaults', () => {
    const mismatchedDates = ['2025-01-03', '2025-01-10'];

    it('opens the dialog instead of claiming the defaults are already applied', async () => {
      const onApplyDefaults = vi.fn().mockResolvedValue(result({ mismatchedDates }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());

      expect(await screen.findByTestId('replace-defaults-modal')).toBeInTheDocument();
      // The old lie: "already applied" when the edited defaults were not applied.
      expect(screen.queryByText(/already applied/i)).not.toBeInTheDocument();
      expect(screen.getByText(/2 dates don't match your defaults/i)).toBeInTheDocument();
    });

    it('reports the fill count inside the dialog rather than as a competing toast', async () => {
      const onApplyDefaults = vi.fn().mockResolvedValue(result({ filled: 3, mismatchedDates }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());

      expect(await screen.findByTestId('replace-defaults-filled')).toHaveTextContent(
        'Filled in 3 blank dates.',
      );
      expect(screen.queryByText('Filled in 3 dates.')).not.toBeInTheDocument();
    });

    it('lists every conflicting date', async () => {
      const onApplyDefaults = vi.fn().mockResolvedValue(result({ mismatchedDates }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());

      const chips = await screen.findByTestId('replace-defaults-dates');
      expect(chips).toHaveTextContent('Fri Jan 3');
      expect(chips).toHaveTextContent('Fri Jan 10');
    });

    it('writes nothing more when the user keeps what they have', async () => {
      const onApplyDefaults = vi.fn().mockResolvedValue(result({ filled: 1, mismatchedDates }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());
      await screen.findByTestId('replace-defaults-modal');

      await userEvent.click(screen.getByRole('button', { name: 'Keep them' }));

      await waitFor(() =>
        expect(screen.queryByTestId('replace-defaults-modal')).not.toBeInTheDocument(),
      );
      // Only the original pass ran — no second call, so nothing was overwritten.
      expect(onApplyDefaults).toHaveBeenCalledTimes(1);
      expect(onApplyDefaults).toHaveBeenCalledWith();
      // The blanks that WERE filled still get confirmed once the dialog is gone.
      expect(await screen.findByText('Filled in 1 date.')).toBeInTheDocument();
    });

    it('stays quiet on dismiss when the first pass filled nothing', async () => {
      const onApplyDefaults = vi.fn().mockResolvedValue(result({ filled: 0, mismatchedDates }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());
      await screen.findByTestId('replace-defaults-modal');

      await userEvent.click(screen.getByRole('button', { name: 'Keep them' }));

      await waitFor(() =>
        expect(screen.queryByTestId('replace-defaults-modal')).not.toBeInTheDocument(),
      );
      expect(screen.queryByText(/filled in/i)).not.toBeInTheDocument();
    });

    it('replaces exactly the listed dates when the user confirms', async () => {
      const onApplyDefaults = vi
        .fn()
        .mockResolvedValueOnce(result({ filled: 1, mismatchedDates }))
        .mockResolvedValueOnce(result({ replaced: 2 }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());
      await screen.findByTestId('replace-defaults-modal');

      await userEvent.click(screen.getByTestId('replace-defaults-confirm'));

      // The confirm passes back the exact dates the dialog listed.
      await waitFor(() => expect(onApplyDefaults).toHaveBeenCalledTimes(2));
      expect(onApplyDefaults).toHaveBeenLastCalledWith(mismatchedDates);
      expect(await screen.findByText('Replaced 2 dates.')).toBeInTheDocument();
      expect(screen.queryByTestId('replace-defaults-modal')).not.toBeInTheDocument();
    });

    it('keeps the dialog open and warns when the replace fails', async () => {
      const onApplyDefaults = vi
        .fn()
        .mockResolvedValueOnce(result({ mismatchedDates }))
        .mockRejectedValueOnce(new Error('nope'));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());
      await screen.findByTestId('replace-defaults-modal');

      await userEvent.click(screen.getByTestId('replace-defaults-confirm'));

      expect(await screen.findByText(/could not apply your defaults/i)).toBeInTheDocument();
      // Still open, so the user can retry without re-running the first pass.
      expect(screen.getByTestId('replace-defaults-modal')).toBeInTheDocument();
    });

    it('singularizes the dialog for a lone conflicting date', async () => {
      const onApplyDefaults = vi
        .fn()
        .mockResolvedValue(result({ mismatchedDates: ['2025-01-03'] }));
      renderButton(true, onApplyDefaults);
      await userEvent.click(applyButton());

      expect(
        await screen.findByText(/1 date doesn't match your defaults/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Replace 1 date' })).toBeInTheDocument();
    });
  });
});
