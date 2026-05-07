import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GameForm, type GameFormState } from './GameForm';

vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    weekStartDay: 0,
    timezone: null,
    use24h: false,
  }),
}));

const baseInitial: GameFormState = {
  name: 'Initial Game',
  description: '',
  playDays: [],
  adHocOnly: false,
  windowMonths: 2,
  defaultStartTime: '18:00',
  defaultEndTime: '22:00',
  timezone: 'America/Los_Angeles',
  useCustomStart: false,
  useCustomEnd: false,
  campaignStartDate: '',
  campaignEndDate: '',
  minPlayersNeeded: 0,
};

function renderForm(overrides: Partial<GameFormState> = {}, mode: 'create' | 'edit' = 'create') {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <GameForm
      mode={mode}
      initial={{ ...baseInitial, ...overrides }}
      busy={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { ...result, onSubmit, onCancel };
}

describe('GameForm', () => {
  it('clears selected play days when ad-hoc scheduling is enabled', () => {
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Friday' }));
    expect(screen.getByRole('button', { name: 'Friday' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('switch', { name: /ad-hoc scheduling/i }));
    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        adHocOnly: true,
        playDays: [],
      }),
    );
  });

  it('clears campaign date values when custom date switches are disabled', () => {
    const { container, onSubmit } = renderForm();

    fireEvent.click(screen.getByRole('switch', { name: /custom start date/i }));
    fireEvent.change(container.querySelector('#campaign-start')!, {
      target: { value: '2026-06-01' },
    });

    fireEvent.click(screen.getByRole('switch', { name: /custom end date/i }));
    fireEvent.change(container.querySelector('#campaign-end')!, {
      target: { value: '2026-09-01' },
    });

    fireEvent.click(screen.getByRole('switch', { name: /custom start date/i }));
    fireEvent.click(screen.getByRole('switch', { name: /custom end date/i }));
    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        useCustomStart: false,
        campaignStartDate: '',
        useCustomEnd: false,
        campaignEndDate: '',
      }),
    );
  });

  it('submits minimum players needed from edit mode', () => {
    const { container, onSubmit } = renderForm({ minPlayersNeeded: 2 }, 'edit');

    const minPlayersInput = container.querySelector('input[type="number"]')!;
    fireEvent.change(minPlayersInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        minPlayersNeeded: 5,
      }),
    );
  });
});
