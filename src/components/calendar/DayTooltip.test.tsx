import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TooltipModel } from '@/lib/calendarCellTooltip';

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

  it('paints past and non-play bands with the same muted stripe the cells use', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);
    const { BAND_STYLES } = await import('./DayTooltip');
    expect(BAND_STYLES.past).toBe(BAND_STYLES['non-play']);
    expect(BAND_STYLES.past).toContain('var(--muted)');
    expect(BAND_STYLES.past).not.toContain('cal-out-of-range');
  });

  it('paints the out-of-range band with the cell out-of-range utility', async () => {
    const { BAND_STYLES } = await import('./DayTooltip');
    expect(BAND_STYLES['out-of-range']).toContain('cal-out-of-range');
  });

  it('never intercepts the pointer', async () => {
    mountCell('2026-09-04');
    const DayTooltip = await loadTooltip();
    render(<DayTooltip hover={{ date: '2026-09-04', model }} />);
    expect(screen.getByRole('tooltip').className).toContain('pointer-events-none');
  });
});
