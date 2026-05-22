import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankedList } from './RankedList';
import { HoverSyncProvider } from './HoverSyncContext';
import type { DateSuggestion } from '@/types';

const mk = (overrides: Partial<DateSuggestion>): DateSuggestion => ({
  date: '2026-05-01',
  dayOfWeek: 4,
  availableCount: 4,
  maybeCount: 0,
  unavailableCount: 0,
  pendingCount: 0,
  totalPlayers: 5,
  availablePlayers: [],
  maybePlayers: [],
  unavailablePlayers: [],
  pendingPlayers: [],
  earliestStartTime: null,
  latestEndTime: null,
  meetsThreshold: true,
  ...overrides,
});

const renderList = (
  suggestions: DateSuggestion[],
  opts: { autoExpandDate?: string | null } = {}
) =>
  render(
    <HoverSyncProvider>
      <RankedList
        suggestions={suggestions}
        isGm={false}
        gmId="g"
        coGmIds={new Set()}
        use24h={false}
        minPlayersNeeded={3}
        onLockIn={() => {}}
        autoExpandDate={opts.autoExpandDate ?? null}
      />
    </HoverSyncProvider>
  );

describe('RankedList', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders viable rows and hides below-threshold by default in availability mode', () => {
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: true }),
      mk({ date: '2026-05-02', meetsThreshold: false }),
    ];
    renderList(items);
    expect(screen.getByTestId('ranked-list')).toBeInTheDocument();
    expect(screen.queryByTestId('below-threshold-list')).not.toBeInTheDocument();
    expect(screen.getByText(/Fri, May 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Sat, May 2/)).not.toBeInTheDocument();
  });

  it('switching to chronological mode shows all rows in date order with no below-threshold section', async () => {
    const user = userEvent.setup();
    const items = [
      mk({ date: '2026-05-03', availableCount: 4, meetsThreshold: true }),
      mk({ date: '2026-05-01', availableCount: 1, meetsThreshold: false }),
      mk({ date: '2026-05-02', availableCount: 5, meetsThreshold: true }),
    ];
    renderList(items);
    await user.click(screen.getByTestId('sort-by-date'));

    const rows = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row');
    expect(rows.map((r) => r.getAttribute('data-date'))).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    expect(screen.queryByTestId('below-threshold-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('below-threshold-toggle')).not.toBeInTheDocument();
  });

  it('chronological mode preserves the below-threshold visual marker in-place', async () => {
    const user = userEvent.setup();
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: false }),
      mk({ date: '2026-05-02', meetsThreshold: true }),
    ];
    renderList(items);
    await user.click(screen.getByTestId('sort-by-date'));

    const firstRow = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row')[0];
    expect(firstRow).toHaveAttribute('data-date', '2026-05-01');
    expect(within(firstRow).getByText(/Below threshold/i)).toBeInTheDocument();
  });

  it('persists the selected sort mode in localStorage', async () => {
    const user = userEvent.setup();
    renderList([mk({ date: '2026-05-01' })]);
    await user.click(screen.getByTestId('sort-by-date'));
    expect(window.localStorage.getItem('gns:schedule-sort')).toBe('chronological');
  });

  it('hydrates from localStorage on mount', () => {
    window.localStorage.setItem('gns:schedule-sort', 'chronological');
    const items = [
      mk({ date: '2026-05-02', meetsThreshold: true }),
      mk({ date: '2026-05-01', meetsThreshold: false }),
    ];
    renderList(items);
    const rows = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row');
    expect(rows.map((r) => r.getAttribute('data-date'))).toEqual([
      '2026-05-01',
      '2026-05-02',
    ]);
  });

  it('does not render the toggle when there are no suggestions', () => {
    renderList([]);
    expect(screen.queryByTestId('suggestions-sort-toggle')).not.toBeInTheDocument();
  });

  it('exposes "Sort by" as the radiogroup accessible name', () => {
    renderList([mk({ date: '2026-05-01' })]);
    // The visible "Sort by" label is wired to the radiogroup via aria-labelledby,
    // so Testing Library's accessible-name lookup should find it.
    expect(screen.getByRole('radiogroup', { name: 'Sort by' })).toBeInTheDocument();
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('keeps the below-threshold section open on initial mount when autoExpandDate matches', () => {
    // Regression: the sort-mode reset effect must skip the initial render. If
    // it doesn't, the auto-expand effect that opens the below-threshold section
    // for autoExpandDate gets immediately undone in the same commit.
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: true }),
      mk({ date: '2026-05-02', meetsThreshold: false }),
    ];
    renderList(items, { autoExpandDate: '2026-05-02' });
    expect(screen.getByTestId('below-threshold-list')).toBeInTheDocument();
  });
});
