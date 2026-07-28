import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionDetailsModal } from './SessionDetailsModal';
import type { GameSession } from '@/types';

// Regression test for: React Query's refetchOnWindowFocus gives `session`
// (and `suggestion`) a new object identity on every focus refetch. The old
// implementation seeded form state from an effect keyed on those objects, so
// a focus refetch mid-edit silently wiped whatever the user had typed.

function buildSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'session-1',
    game_id: 'game-1',
    date: '2026-08-01',
    start_time: '19:00:00',
    end_time: '22:00:00',
    status: 'confirmed',
    confirmed_by: 'user-1',
    location: 'Original place',
    notes: 'Original notes',
    created_at: null,
    ...overrides,
  };
}

describe('SessionDetailsModal', () => {
  it('keeps typed location/notes when session prop is replaced with a new-but-equal object', () => {
    const session = buildSession();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();

    const { rerender } = render(
      <SessionDetailsModal
        open
        date={session.date}
        mode="edit"
        session={session}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const locationInput = screen.getByTestId('session-details-location');
    const notesInput = screen.getByTestId('session-details-notes');

    fireEvent.change(locationInput, { target: { value: "Tom's basement" } });
    fireEvent.change(notesInput, { target: { value: 'Bring snacks' } });

    expect(locationInput).toHaveValue("Tom's basement");
    expect(notesInput).toHaveValue('Bring snacks');

    // Simulate a React Query refetch (e.g. window focus) that returns a
    // deep-equal but referentially new session object.
    const refetchedSession = buildSession();
    expect(refetchedSession).not.toBe(session);
    expect(refetchedSession).toEqual(session);

    rerender(
      <SessionDetailsModal
        open
        date={refetchedSession.date}
        mode="edit"
        session={refetchedSession}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(locationInput).toHaveValue("Tom's basement");
    expect(notesInput).toHaveValue('Bring snacks');
  });
});
