import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TooltipModel } from '@/lib/calendarCellTooltip';
import { calendarCellState, type CalendarCellInputs } from '@/lib/calendarCellState';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return this.parentNode; },
    configurable: true,
  });
});

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

async function loadTooltip() {
  vi.resetModules();
  return (await import('./DayTooltip')).DayTooltip;
}

const model: TooltipModel = {
  dateLabel: 'Friday, Sep 4',
  badges: ['Extra date'],
  isScheduled: false,
  band: { label: 'Maybe', qualifier: '6pm–10pm', tone: 'maybe' },
  rows: [
    { label: 'Note', value: 'Might be late' },
    { label: 'GM', value: 'Bring snacks!' },
  ],
  hints: ['Click to mark Available'],
};

function mountCell(date: string) {
  const el = document.createElement('button');
  el.setAttribute('data-date', date);
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 500, width: 40, height: 40, bottom: 540, right: 140 }) as DOMRect;
  document.body.appendChild(el);
}

beforeEach(() => {
  document.body.innerHTML = '';
  stubMatchMedia(true);
});

describe('DayTooltip', () => {
  it('renders nothing when nothing is hovered', async () => {
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={null} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders nothing on a touch device', async () => {
    stubMatchMedia(false);
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the date, badges, band, rows and hint', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);

    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Friday, Sep 4');
    expect(tip).toHaveTextContent('Extra date');
    expect(tip).toHaveTextContent('Maybe');
    expect(tip).toHaveTextContent('6pm–10pm');
    expect(tip).toHaveTextContent('Might be late');
    expect(tip).toHaveTextContent('Bring snacks!');
    expect(tip).toHaveTextContent('Click to mark Available');
  });

  it('paints the maybe band with the dashed ink outline the cell uses', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);
    expect(screen.getByTestId('day-tooltip-band').className)
      .toContain('bg-cal-available-ink/15 text-cal-available-ink border-y-2 border-dashed border-cal-available-ink');
  });

  it('paints the past band with the same out-of-range utility the cell uses', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    const pastModel: TooltipModel = {
      ...model,
      band: { label: 'Past · you were Available', qualifier: null, tone: 'past' },
    };
    render(<DayTooltip hover={{ date: '2026-09-04', model: pastModel }} />);
    // A past cell is out-of-range by construction (windowStart is clamped to
    // today), so calendarCellState paints it with cal-out-of-range.
    expect(screen.getByTestId('day-tooltip-band').className).toContain('cal-out-of-range');
  });

  it('paints the out-of-range band with the cell out-of-range utility', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    const outOfRangeModel: TooltipModel = {
      ...model,
      band: { label: 'Before campaign start', qualifier: null, tone: 'out-of-range' },
    };
    render(<DayTooltip hover={{ date: '2026-09-04', model: outOfRangeModel }} />);
    expect(screen.getByTestId('day-tooltip-band').className).toContain('cal-out-of-range');
  });

  it('never intercepts the pointer', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);
    expect(screen.getByRole('tooltip').className).toContain('pointer-events-none');
  });
});

// Extracts cal-* tokens and CSS custom properties from a class string.
function tokensOf(classes: string): string[] {
  return [
    ...(classes.match(/cal-[a-z-]+/g) ?? []),
    ...(classes.match(/var\(--[a-z-]+\)/g) ?? []),
  ];
}

const CELL_INPUTS: Record<string, CalendarCellInputs> = {
  available:     { isOutOfRange: false, isConfirmed: false, isPast: false, isPlayDay: true,  isToday: false, status: 'available' },
  maybe:         { isOutOfRange: false, isConfirmed: false, isPast: false, isPlayDay: true,  isToday: false, status: 'maybe' },
  unavailable:   { isOutOfRange: false, isConfirmed: false, isPast: false, isPlayDay: true,  isToday: false, status: 'unavailable' },
  unset:         { isOutOfRange: false, isConfirmed: false, isPast: false, isPlayDay: true,  isToday: false, status: undefined },
  'non-play':    { isOutOfRange: false, isConfirmed: false, isPast: false, isPlayDay: false, isToday: false, status: undefined },
  // A past date is out-of-range by construction (getSchedulingWindow clamps
  // windowStart to today), which is exactly why calendarCellState never sees
  // isPast without isOutOfRange in the real app — but as a pure function it
  // still needs isOutOfRange: true here to reach the cal-out-of-range branch,
  // same as the tooltip model's own `past` tone does at the model layer.
  past:          { isOutOfRange: true,  isConfirmed: false, isPast: true,  isPlayDay: false, isToday: false, status: undefined },
  'out-of-range': { isOutOfRange: true,  isConfirmed: false, isPast: false, isPlayDay: false, isToday: false, status: undefined },
};

describe('BAND_STYLES stays bound to the cell it describes', () => {
  it.each(Object.keys(CELL_INPUTS))('band %s reuses the cell fill tokens', async (tone) => {
    const { BAND_STYLES } = await import('./DayTooltip');
    const cellTokens = tokensOf(calendarCellState(CELL_INPUTS[tone]).bgColor);
    const bandTokens = tokensOf(BAND_STYLES[tone as keyof typeof BAND_STYLES]);
    expect(cellTokens.length).toBeGreaterThan(0);
    for (const token of cellTokens) expect(bandTokens).toContain(token);
  });
});
