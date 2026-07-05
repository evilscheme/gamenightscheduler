import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScheduledRow } from './ScheduledRow';
import type { GameSession } from '@/types';

const mkSession = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: 's1',
  game_id: 'g1',
  date: '2026-08-15',
  start_time: '19:00:00',
  end_time: '22:00:00',
  status: 'confirmed',
  confirmed_by: 'u1',
  location: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const baseProps = {
  suggestion: undefined,
  timezone: null,
  userTimezone: null,
  use24h: false,
  isGm: false,
  gmId: 'g1',
  coGmIds: new Set<string>(),
  playDateNote: null,
  onDownloadIcs: () => {},
  onRequestCancel: () => {},
};

const renderRow = (props: Partial<React.ComponentProps<typeof ScheduledRow>> = {}) =>
  render(
    <ul>
      <ScheduledRow session={mkSession()} {...baseProps} {...props} />
    </ul>
  );

describe('ScheduledRow', () => {
  it('caps an upcoming confirmed session with the primary "Confirmed" band', () => {
    renderRow();
    const band = screen.getByTestId('session-confirmed-band');
    expect(band).toBeInTheDocument();
    // The band owns the "Confirmed" label and the date so a locked-in session is
    // unmistakable next to the neutral suggestion cards.
    expect(within(band).getByText('Confirmed')).toBeInTheDocument();
    expect(within(band).getByText(/Aug 15/)).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-row')).toBeInTheDocument();
  });

  it('does not show the band for past sessions (they stay muted)', () => {
    renderRow({ past: true });
    expect(screen.queryByTestId('session-confirmed-band')).not.toBeInTheDocument();
    expect(screen.getByTestId('past-session-row')).toBeInTheDocument();
    // The date is still shown inline in the muted past layout.
    expect(screen.getByText(/Aug 15/)).toBeInTheDocument();
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
  });
});
