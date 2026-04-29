import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('RankedList', () => {
  it('renders viable rows and hides below-threshold by default', () => {
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: true }),
      mk({ date: '2026-05-02', meetsThreshold: false }),
    ];
    render(
      <HoverSyncProvider>
        <RankedList
          suggestions={items}
          isGm={false}
          gmId="g"
          coGmIds={new Set()}
          use24h={false}
          minPlayersNeeded={3}
          onLockIn={() => {}}
          autoExpandDate={null}
        />
      </HoverSyncProvider>
    );
    expect(screen.getByTestId('ranked-list')).toBeInTheDocument();
    expect(screen.queryByTestId('below-threshold-list')).not.toBeInTheDocument();
    // Viable row renders with its formatted date
    expect(screen.getByText(/Fri, May 1/)).toBeInTheDocument();
    // Below-threshold row is not in the DOM (list collapsed)
    expect(screen.queryByText(/Sat, May 2/)).not.toBeInTheDocument();
  });
});
