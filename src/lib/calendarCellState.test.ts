import { describe, it, expect } from 'vitest';
import { calendarCellState, type CalendarCellInputs } from './calendarCellState';

const STRIPES =
  'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]';
const CLICKABLE =
  'cursor-pointer hover:ring-2 hover:ring-primary/50 hover:scale-105 transition-transform';
const UNSET_DASHED = 'bg-cal-unset-bg border-2 border-dashed border-cal-unset-border';
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
      dataStatus: 'out-of-range',
    });
  });

  it('in-range non-play day (disabled stripes)', () => {
    expect(cell({})).toEqual({
      bgColor: STRIPES,
      textColor: 'text-cal-disabled-text',
      cursor: 'cursor-default',
      todayStyles: '',
      dataStatus: 'disabled',
    });
  });

  it('past non-confirmed day dims the text', () => {
    expect(cell({ isPast: true })).toEqual({
      bgColor: STRIPES,
      textColor: 'text-cal-disabled-text/50',
      cursor: 'cursor-default',
      todayStyles: '',
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
    ['maybe', 'bg-cal-maybe-bg', 'text-cal-maybe-text font-medium'],
    ['unavailable', 'bg-cal-unavailable-bg/60', 'text-cal-unavailable-text font-medium'],
  ] as const)('%s', (status, bg, text) => {
    expect(cell({ isPlayDay: true, status })).toEqual({
      bgColor: bg,
      textColor: text,
      cursor: CLICKABLE,
      todayStyles: '',
      dataStatus: status,
    });
  });

  it('unset (not today) gets the dashed unset treatment', () => {
    expect(cell({ isPlayDay: true })).toEqual({
      bgColor: UNSET_DASHED,
      textColor: 'text-cal-unset-text',
      cursor: CLICKABLE,
      todayStyles: '',
      dataStatus: 'unset',
    });
  });

  it('unset today gets solid bg + today ring', () => {
    expect(cell({ isPlayDay: true, isToday: true })).toEqual({
      bgColor: 'bg-cal-unset-bg',
      textColor: 'text-cal-unset-text',
      cursor: CLICKABLE,
      todayStyles: TODAY_RING,
      dataStatus: 'unset',
    });
  });
});

describe('calendarCellState — confirmed sessions', () => {
  it.each([
    ['available', 'bg-cal-available-bg', 'text-cal-available-text font-semibold'],
    ['maybe', 'bg-cal-maybe-bg', 'text-cal-maybe-text font-semibold'],
    ['unavailable', 'bg-cal-unavailable-bg/60', 'text-cal-unavailable-text font-semibold'],
  ] as const)('future confirmed, %s', (status, bg, text) => {
    expect(cell({ isConfirmed: true, isPlayDay: true, status })).toEqual({
      bgColor: bg,
      textColor: text,
      cursor: CLICKABLE,
      todayStyles: '',
      dataStatus: 'scheduled',
    });
  });

  it('future confirmed, unset (not today) is dashed + semibold unset text', () => {
    const s = cell({ isConfirmed: true, isPlayDay: true });
    expect(s.bgColor).toBe(UNSET_DASHED);
    expect(s.textColor).toBe('text-cal-unset-text font-semibold');
    expect(s.dataStatus).toBe('scheduled');
  });

  it('future confirmed, unset today is solid', () => {
    const s = cell({ isConfirmed: true, isPlayDay: true, isToday: true });
    expect(s.bgColor).toBe('bg-cal-unset-bg');
    expect(s.todayStyles).toBe(TODAY_RING);
  });

  it.each([
    ['available', 'bg-cal-available-bg'],
    ['maybe', 'bg-cal-maybe-bg'],
    ['unavailable', 'bg-cal-unavailable-bg/60'],
  ] as const)('past confirmed keeps %s color but dims text', (status, bg) => {
    expect(cell({ isConfirmed: true, isPast: true, status })).toEqual({
      bgColor: bg,
      textColor: 'text-cal-disabled-text/50 font-semibold',
      cursor: 'cursor-default',
      todayStyles: '',
      dataStatus: 'scheduled',
    });
  });

  it('past confirmed, unset uses solid unset bg', () => {
    const s = cell({ isConfirmed: true, isPast: true });
    expect(s.bgColor).toBe('bg-cal-unset-bg');
    expect(s.dataStatus).toBe('scheduled');
  });
});
