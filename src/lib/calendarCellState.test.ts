import { describe, it, expect } from 'vitest';
import { calendarCellState, type CalendarCellInputs } from './calendarCellState';

const STRIPES =
  'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]';
const CLICKABLE =
  'cursor-pointer hover:ring-2 hover:ring-primary/50 hover:scale-105 transition-transform';
/** Scheduled cells stay transparent so the star carries the colour — outline only. */
const MAYBE_OUTLINE = 'border-2 border-dashed border-cal-available-ink';
/** Unscheduled play days add a wash so a maybe reads as answered, not as a gap. */
const MAYBE_WASHED = `bg-cal-available-ink/15 ${MAYBE_OUTLINE}`;
const TODAY_RING = 'shadow-[0_0_0_3px_var(--primary)] font-bold z-10';

function cell(overrides: Partial<CalendarCellInputs>) {
  return calendarCellState({
    isOutOfRange: false,
    isConfirmed: false,
    isPast: false,
    isPlayDay: false,
    isToday: false,
    status: undefined,
    ...overrides,
  });
}

describe('calendarCellState — base states', () => {
  it('out-of-range', () => {
    expect(cell({ isOutOfRange: true })).toEqual({
      bgColor: 'cal-out-of-range',
      textColor: 'text-cal-disabled-text',
      cursor: 'cursor-default',
      todayStyles: '',
      starFill: '',
      dataStatus: 'out-of-range',
    });
  });

  it('in-range non-play day (disabled stripes)', () => {
    expect(cell({})).toEqual({
      bgColor: STRIPES,
      textColor: 'text-cal-disabled-text',
      cursor: 'cursor-default',
      todayStyles: '',
      starFill: '',
      dataStatus: 'disabled',
    });
  });

  it('past non-confirmed day dims the text', () => {
    expect(cell({ isPast: true })).toEqual({
      bgColor: STRIPES,
      textColor: 'text-cal-disabled-text/50',
      cursor: 'cursor-default',
      todayStyles: '',
      starFill: '',
      dataStatus: 'past',
    });
  });

  it('past play day is still "past" (not clickable)', () => {
    const s = cell({ isPast: true, isPlayDay: true });
    expect(s.cursor).toBe('cursor-default');
    expect(s.dataStatus).toBe('past');
  });
});

describe('calendarCellState — future play day', () => {
  it.each([
    ['available', 'bg-cal-available-bg', 'text-cal-available-text font-medium'],
    ['maybe', MAYBE_WASHED, 'text-cal-available-ink font-medium'],
    ['unavailable', 'bg-cal-unavailable-bg', 'text-cal-unavailable-text font-medium'],
  ] as const)('%s', (status, bg, text) => {
    expect(cell({ isPlayDay: true, status })).toEqual({
      bgColor: bg,
      textColor: text,
      cursor: CLICKABLE,
      todayStyles: '',
      starFill: '',
      dataStatus: status,
    });
  });

  it('unset (not today) gets solid empty styling', () => {
    expect(cell({ isPlayDay: true })).toEqual({
      bgColor: 'bg-cal-empty-bg',
      textColor: 'text-cal-empty-text',
      cursor: CLICKABLE,
      todayStyles: '',
      starFill: '',
      dataStatus: 'unset',
    });
  });

  it('unset today gets solid bg + today ring', () => {
    expect(cell({ isPlayDay: true, isToday: true })).toEqual({
      bgColor: 'bg-cal-empty-bg',
      textColor: 'text-cal-empty-text',
      cursor: CLICKABLE,
      todayStyles: TODAY_RING,
      starFill: '',
      dataStatus: 'unset',
    });
  });
});

describe('calendarCellState — confirmed sessions', () => {
  it.each([
    ['available', '', 'text-cal-available-text font-semibold', 'fill-cal-available-bg'],
    ['maybe', MAYBE_OUTLINE, 'text-cal-available-text font-semibold', 'fill-cal-available-bg'],
    ['unavailable', '', 'text-cal-unavailable-text font-semibold', 'fill-cal-unavailable-bg'],
  ] as const)('future confirmed, %s', (status, bg, text, star) => {
    expect(cell({ isConfirmed: true, isPlayDay: true, status })).toEqual({
      bgColor: bg,
      textColor: text,
      cursor: CLICKABLE,
      todayStyles: '',
      starFill: star,
      dataStatus: 'scheduled',
    });
  });

  it('scheduled maybes skip the wash so it cannot tint the area behind the star', () => {
    for (const isPast of [false, true]) {
      const s = cell({ isConfirmed: true, isPlayDay: true, isPast, status: 'maybe' });
      expect(s.bgColor).toBe(MAYBE_OUTLINE);
      expect(s.bgColor).not.toContain('bg-cal-available-ink');
    }
    // ...while the same status on an unscheduled play day does get it.
    expect(cell({ isPlayDay: true, status: 'maybe' }).bgColor).toBe(MAYBE_WASHED);
  });

  it('future confirmed, unset (not today) inverts the pairing: dark star, light number', () => {
    const s = cell({ isConfirmed: true, isPlayDay: true });
    expect(s.bgColor).toBe('');
    expect(s.textColor).toBe('text-cal-empty-bg font-semibold');
    expect(s.starFill).toBe('fill-cal-empty-text');
    expect(s.dataStatus).toBe('scheduled');
  });

  it('future confirmed, unset today keeps the ring', () => {
    const s = cell({ isConfirmed: true, isPlayDay: true, isToday: true });
    expect(s.bgColor).toBe('');
    expect(s.todayStyles).toBe(TODAY_RING);
  });

  it.each([
    ['available', '', 'fill-cal-available-bg'],
    ['maybe', MAYBE_OUTLINE, 'fill-cal-available-bg'],
    ['unavailable', '', 'fill-cal-unavailable-bg'],
  ] as const)('past confirmed keeps %s star color but dims text', (status, bg, star) => {
    expect(cell({ isConfirmed: true, isPast: true, status })).toEqual({
      bgColor: bg,
      textColor: 'text-cal-disabled-text/50 font-semibold',
      cursor: 'cursor-default',
      todayStyles: '',
      starFill: star,
      dataStatus: 'scheduled',
    });
  });

  it('past confirmed, unset uses the dark-ink star', () => {
    const s = cell({ isConfirmed: true, isPast: true });
    expect(s.bgColor).toBe('');
    expect(s.starFill).toBe('fill-cal-empty-text');
    expect(s.dataStatus).toBe('scheduled');
  });
});
