import { describe, it, expect } from 'vitest';
import { describeCalendarCell, tooltipModelToText, type TooltipInputs } from './calendarCellTooltip';

const base: TooltipInputs = {
  date: '2026-09-04',
  isOutOfRange: false,
  isConfirmed: false,
  isPast: false,
  isPlayDay: true,
  isToday: false,
  status: undefined,
  entry: undefined,
  session: undefined,
  gmNote: undefined,
  otherSessions: [],
  isExtraDate: false,
  isGmOrCoGm: false,
  readOnly: false,
  canAddAsExtra: false,
  windowStart: new Date(2026, 7, 1),
  windowEnd: new Date(2026, 10, 20),
  use24h: false,
};

const withEntry = (
  status: 'available' | 'maybe' | 'unavailable',
  extra: Partial<TooltipInputs['entry'] & object> = {},
): TooltipInputs => ({
  ...base,
  status,
  entry: { status, comment: null, available_after: null, available_until: null, ...extra },
});

describe('describeCalendarCell — header and badges', () => {
  it('formats the date as a full weekday label', () => {
    expect(describeCalendarCell(base).dateLabel).toBe('Friday, Sep 4');
  });

  it('badges a scheduled, extra, today cell', () => {
    const m = describeCalendarCell({ ...base, isConfirmed: true, isExtraDate: true, isToday: true });
    expect(m.badges).toEqual(['Scheduled', 'Extra date', 'Today']);
    expect(m.isScheduled).toBe(true);
  });

  it('drops the extra-date badge on past cells', () => {
    const m = describeCalendarCell({ ...base, isExtraDate: true, isPast: true });
    expect(m.badges).not.toContain('Extra date');
  });
});

describe('describeCalendarCell — band', () => {
  it.each([
    ['available', 'Available'],
    ['maybe', 'Maybe'],
    ['unavailable', 'Unavailable'],
  ] as const)('labels a %s play day', (status, label) => {
    const m = describeCalendarCell(withEntry(status));
    expect(m.band).toMatchObject({ label, tone: status, qualifier: null });
  });

  it('labels an unanswered play day', () => {
    expect(describeCalendarCell(base).band).toMatchObject({ label: 'Not set', tone: 'unset' });
  });

  it('labels a non-play day', () => {
    expect(describeCalendarCell({ ...base, isPlayDay: false }).band)
      .toMatchObject({ label: 'Not a play day', tone: 'non-play' });
  });

  it('recalls your answer on a past cell', () => {
    const m = describeCalendarCell({ ...withEntry('available'), isPast: true });
    expect(m.band).toMatchObject({ label: 'Past · you were Available', tone: 'past' });
  });

  it('says only "Past date" when you never answered', () => {
    expect(describeCalendarCell({ ...base, isPast: true }).band.label).toBe('Past date');
  });

  it('names which campaign bound was crossed', () => {
    const before = describeCalendarCell({ ...base, isOutOfRange: true, date: '2026-07-01' });
    expect(before.band).toMatchObject({ label: 'Before campaign start', tone: 'out-of-range' });
    const after = describeCalendarCell({ ...base, isOutOfRange: true, date: '2026-12-04' });
    expect(after.band.label).toBe('After campaign end');
  });

  it('prefers past over non-play, matching calendarCellState precedence', () => {
    const m = describeCalendarCell({ ...base, isPast: true, isPlayDay: false });
    expect(m.band.tone).toBe('past');
  });
});

describe('describeCalendarCell — time qualifier', () => {
  it('renders a two-sided window as a range', () => {
    const m = describeCalendarCell(withEntry('available', { available_after: '18:00', available_until: '22:00' }));
    expect(m.band.qualifier).toBe('6pm–10pm');
  });

  it('renders an open-ended start', () => {
    expect(describeCalendarCell(withEntry('maybe', { available_after: '18:00' })).band.qualifier)
      .toBe('after 6pm');
  });

  it('renders an open-ended end', () => {
    expect(describeCalendarCell(withEntry('available', { available_until: '22:00' })).band.qualifier)
      .toBe('until 10pm');
  });

  it('suppresses the window on unavailable — the editor hides those fields', () => {
    expect(describeCalendarCell(withEntry('unavailable', { available_after: '18:00' })).band.qualifier)
      .toBeNull();
  });

  it('honours the 24h preference', () => {
    const m = describeCalendarCell({ ...withEntry('available', { available_after: '18:00' }), use24h: true });
    expect(m.band.qualifier).toBe('after 18:00');
  });
});

describe('describeCalendarCell — rows', () => {
  it('lists the confirmed session time', () => {
    const m = describeCalendarCell({
      ...base,
      isConfirmed: true,
      session: { date: '2026-09-04', start_time: '19:00', end_time: '23:00' } as never,
    });
    expect(m.rows).toContainEqual({ label: 'Session', value: '7pm–11pm' });
  });

  it('lists your own note and the GM note separately', () => {
    const m = describeCalendarCell({
      ...withEntry('maybe', { comment: 'Might be late' }),
      gmNote: 'Bring snacks!',
    });
    expect(m.rows).toContainEqual({ label: 'Note', value: 'Might be late' });
    expect(m.rows).toContainEqual({ label: 'GM', value: 'Bring snacks!' });
  });

  it('lists one row per conflicting game', () => {
    const m = describeCalendarCell({
      ...base,
      otherSessions: [
        { gameId: 'a', gameName: 'Curse of Strahd', startTime: '19:00', endTime: null },
        { gameId: 'b', gameName: 'Blades', startTime: null, endTime: null },
      ],
    });
    expect(m.rows).toContainEqual({ label: 'Also', value: 'Curse of Strahd, from 7pm' });
    expect(m.rows).toContainEqual({ label: 'Also', value: 'Blades' });
  });

  it('gives the campaign bound that was crossed, not both', () => {
    const after = describeCalendarCell({ ...base, isOutOfRange: true, date: '2026-12-04' });
    expect(after.rows).toContainEqual({ label: 'Campaign ends', value: 'Nov 20' });
    expect(after.rows.some((r) => r.label === 'Campaign starts')).toBe(false);
  });

  it('emits no rows when there is nothing to say', () => {
    expect(describeCalendarCell(base).rows).toEqual([]);
  });
});

describe('describeCalendarCell — hints', () => {
  it.each([
    [undefined, 'Click to mark Available'],
    ['available', 'Click to mark Unavailable'],
    ['unavailable', 'Click to mark Maybe'],
    ['maybe', 'Click to mark Available'],
  ] as const)('states the next status after %s', (status, hint) => {
    const input = status ? withEntry(status) : base;
    expect(describeCalendarCell(input).hints).toContain(hint);
  });

  it('offers the GM the add-extra affordance on a non-play day', () => {
    const m = describeCalendarCell({ ...base, isPlayDay: false, isGmOrCoGm: true, canAddAsExtra: true });
    expect(m.hints).toContain('GM · click + to add as an extra date');
    expect(m.hints.some((h) => h.startsWith('Click to mark'))).toBe(false);
  });

  it('offers the GM the remove affordance on an extra date', () => {
    const m = describeCalendarCell({ ...base, isExtraDate: true, isGmOrCoGm: true });
    expect(m.hints).toContain('GM · click ✕ to remove this extra date');
  });

  it('gives a plain member no GM hints', () => {
    const m = describeCalendarCell({ ...base, isPlayDay: false, canAddAsExtra: false });
    expect(m.hints).toEqual([]);
  });

  it.each([
    ['readOnly', { readOnly: true }],
    ['past', { isPast: true }],
    ['out-of-range', { isOutOfRange: true }],
  ])('suppresses all hints when %s', (_name, patch) => {
    expect(describeCalendarCell({ ...withEntry('available'), ...patch }).hints).toEqual([]);
  });
});

describe('tooltipModelToText', () => {
  it('folds the qualifier into the status line', () => {
    const text = tooltipModelToText(describeCalendarCell(withEntry('available', { available_after: '14:00' })));
    expect(text).toContain('Your status: Available after 2pm');
  });

  it('omits "Your status" for states you cannot answer', () => {
    const text = tooltipModelToText(describeCalendarCell({ ...base, isPlayDay: false }));
    expect(text).toContain('Not a play day');
    expect(text).not.toContain('Your status');
  });

  it('preserves the phrasings the confirmed-availability E2E asserts', () => {
    const text = tooltipModelToText(describeCalendarCell({
      ...withEntry('maybe'),
      isConfirmed: true,
      session: { date: '2026-09-04', start_time: '19:00', end_time: '23:00' } as never,
    }));
    expect(text).toContain('Session confirmed');
    expect(text).toContain('7pm');
    expect(text).toContain('11pm');
    expect(text).toContain('Your status: Maybe');
  });
});
