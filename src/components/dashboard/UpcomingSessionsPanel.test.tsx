import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpcomingSessionsPanel } from './UpcomingSessionsPanel';
import type { UpcomingSessionRow } from '@/lib/upcomingSessions';
import type { GameSession } from '@/types';

const mkRow = (overrides: Partial<UpcomingSessionRow> & { id: string }): UpcomingSessionRow => {
  const session: GameSession = {
    id: overrides.id,
    game_id: overrides.gameId ?? 'g1',
    date: '2026-06-10',
    start_time: '19:00:00',
    end_time: '22:00:00',
    status: 'confirmed',
    confirmed_by: 'u1',
    location: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    // Spread last so explicitly-provided values (including null) win over defaults.
    ...overrides.session,
  };
  return {
    session,
    gameId: overrides.gameId ?? 'g1',
    gameName: overrides.gameName ?? 'Curse of Strahd',
    gameTimezone: overrides.gameTimezone ?? null,
    dayHighlight: overrides.dayHighlight ?? null,
  };
};

describe('UpcomingSessionsPanel', () => {
  it('renders the empty message when there are no rows', () => {
    render(<UpcomingSessionsPanel rows={[]} use24h={false} />);
    expect(screen.getByText(/no upcoming sessions/i)).toBeInTheDocument();
  });

  it('renders game name, date/time, and a link to the game', () => {
    render(
      <UpcomingSessionsPanel
        rows={[mkRow({ id: 's1', gameId: 'g42', gameName: 'Heist Crew' })]}
        use24h={false}
      />
    );
    expect(screen.getByText('Heist Crew')).toBeInTheDocument();
    const link = screen.getByTestId('upcoming-session');
    expect(link).toHaveAttribute('href', '/games/g42');
    expect(within(link).getByText(/7pm/i)).toBeInTheDocument();
  });

  it('shows "time TBD" when there is no start time', () => {
    render(
      <UpcomingSessionsPanel
        rows={[mkRow({ id: 's1', session: { start_time: null } as GameSession })]}
        use24h={false}
      />
    );
    expect(screen.getByText(/time TBD/i)).toBeInTheDocument();
  });

  it('only renders location and notes when present', () => {
    const { rerender } = render(
      <UpcomingSessionsPanel rows={[mkRow({ id: 's1' })]} use24h={false} />
    );
    expect(screen.queryByText(/bring dice/i)).not.toBeInTheDocument();
    rerender(
      <UpcomingSessionsPanel
        rows={[mkRow({ id: 's1', session: { location: "Tom's", notes: 'bring dice' } as GameSession })]}
        use24h={false}
      />
    );
    expect(screen.getByText("Tom's")).toBeInTheDocument();
    expect(screen.getByText('bring dice')).toBeInTheDocument();
  });

  it('shows the game timezone and a "for you" conversion when the user is in a different timezone', () => {
    render(
      <UpcomingSessionsPanel
        rows={[
          mkRow({
            id: 's1',
            gameTimezone: 'America/Los_Angeles',
            session: { date: '2026-06-10', start_time: '19:00:00', end_time: '22:00:00' } as GameSession,
          }),
        ]}
        use24h={false}
        userTimezone="America/New_York"
      />
    );
    const link = screen.getByTestId('upcoming-session');
    // Game-local time labelled with the game's tz abbreviation...
    expect(within(link).getByText(/PDT/)).toBeInTheDocument();
    // ...plus the viewer's own time.
    expect(within(link).getByText(/for you/i)).toBeInTheDocument();
    expect(within(link).getByText(/EDT/)).toBeInTheDocument();
  });

  it('stays compact (no tz abbreviation) when the user shares the game timezone', () => {
    render(
      <UpcomingSessionsPanel
        rows={[mkRow({ id: 's1', gameTimezone: 'America/Los_Angeles' })]}
        use24h={false}
        userTimezone="America/Los_Angeles"
      />
    );
    const link = screen.getByTestId('upcoming-session');
    expect(within(link).getByText(/7pm/i)).toBeInTheDocument();
    expect(within(link).queryByText(/for you/i)).not.toBeInTheDocument();
  });

  it('renders a Today badge for today-highlighted rows', () => {
    render(
      <UpcomingSessionsPanel rows={[mkRow({ id: 's1', dayHighlight: 'today' })]} use24h={false} />
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('soft-caps at 5 rows with a working show more / show less toggle', async () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      mkRow({ id: `s${i}`, session: { date: `2026-06-1${i}` } as GameSession })
    );
    render(<UpcomingSessionsPanel rows={rows} use24h={false} />);
    expect(screen.getAllByTestId('upcoming-session')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getAllByTestId('upcoming-session')).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getAllByTestId('upcoming-session')).toHaveLength(5);
  });

  it('does not render the toggle when there are 5 or fewer rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => mkRow({ id: `s${i}` }));
    render(<UpcomingSessionsPanel rows={rows} use24h={false} />);
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });
});
