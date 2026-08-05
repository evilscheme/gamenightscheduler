import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DateSuggestion } from '@/types';

// jsdom never computes layout, so HTMLElement.prototype.offsetParent is
// always null. The popover's useLayoutEffect uses offsetParent !== null to
// pick the visible calendar cell among duplicate mobile/desktop renders, so
// without this stub it never finds a "visible" element and coords stay null.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return this.parentNode;
    },
    configurable: true,
  });
});

// jsdom does not implement window.matchMedia. Stub it per-test so
// useHoverCapable's useSyncExternalStore has something to read/subscribe to.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// CalendarHoverPopover caches its MediaQueryList in a module-level variable
// the first time it's read, so each test needs a fresh module instance for
// its own matchMedia stub to take effect.
async function loadComponents() {
  vi.resetModules();
  const { CalendarHoverPopover } = await import('./CalendarHoverPopover');
  const { CalendarCell } = await import('./CalendarCell');
  const { HoverSyncProvider } = await import('./HoverSyncContext');
  return { CalendarHoverPopover, CalendarCell, HoverSyncProvider };
}

const mk = (overrides: Partial<DateSuggestion> = {}): DateSuggestion => ({
  date: '2026-05-01',
  dayOfWeek: 4,
  availableCount: 3,
  maybeCount: 0,
  unavailableCount: 0,
  pendingCount: 0,
  totalPlayers: 3,
  availablePlayers: [],
  maybePlayers: [],
  unavailablePlayers: [],
  pendingPlayers: [],
  earliestStartTime: null,
  latestEndTime: null,
  meetsThreshold: true,
  threshold: 3,
  ...overrides,
});

describe('CalendarHoverPopover', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // Renders a real calendar cell alongside the popover, both sharing a
  // HoverSyncProvider, so hovering the cell drives the popover the same way
  // it does in the real calendar (data-testid/data-date match up, and coords
  // come from the cell's real bounding rect via useLayoutEffect).
  async function renderWithCell(suggestions: DateSuggestion[]) {
    const { CalendarHoverPopover, CalendarCell, HoverSyncProvider } = await loadComponents();
    return render(
      <HoverSyncProvider>
        <CalendarCell
          date="2026-05-01"
          day={1}
          isPlayDay
          isScheduled={false}
          isPast={false}
          state="unknown"
          showPending={false}
          title=""
        />
        <CalendarHoverPopover suggestions={suggestions} scheduledDates={new Set()} />
      </HoverSyncProvider>
    );
  }

  it('renders nothing when the device is not hover-capable, even with an active hover', async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    await renderWithCell([mk()]);

    await user.hover(screen.getByTestId('calendar-cell'));

    expect(screen.queryByTestId('calendar-hover-popover')).not.toBeInTheDocument();
  });

  it('renders nothing when hover-capable but no date is hovered', async () => {
    stubMatchMedia(true);
    await renderWithCell([mk()]);

    expect(screen.queryByTestId('calendar-hover-popover')).not.toBeInTheDocument();
  });

  it('renders the popover with matching content when hover-capable with an active date and coords', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    await renderWithCell([
      mk({
        date: '2026-05-01',
        availableCount: 3,
        maybeCount: 1,
        unavailableCount: 2,
        pendingCount: 1,
      }),
    ]);

    await user.hover(screen.getByTestId('calendar-cell'));

    const popover = await waitFor(() => screen.getByTestId('calendar-hover-popover'));
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent('Fri, May 1');
    expect(popover).toHaveTextContent('Available · 3');
    expect(popover).toHaveTextContent('Maybe · 1');
    expect(popover).toHaveTextContent("Can't make it · 2");
    expect(popover).toHaveTextContent('No response · 1');
  });

  it('renders nothing for a hovered date that has neither a suggestion nor a scheduled session', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    // No suggestions supplied at all, so the hovered date matches nothing.
    await renderWithCell([]);

    await user.hover(screen.getByTestId('calendar-cell'));

    expect(screen.queryByTestId('calendar-hover-popover')).not.toBeInTheDocument();
  });
});
