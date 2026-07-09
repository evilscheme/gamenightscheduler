import { describe, it, expect, vi, afterEach } from 'vitest';
import { toLocalDateString, getTodayLocalDate } from './date';

describe('toLocalDateString', () => {
  it('formats a date as YYYY-MM-DD from local components', () => {
    expect(toLocalDateString(new Date(2026, 5, 3))).toBe('2026-06-03');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalDateString(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('uses the LOCAL calendar date, not the UTC one, near midnight', () => {
    // 00:30 local on Jan 1. In any timezone east of UTC, toISOString() would
    // still say Dec 31 — the exact bug this helper exists to avoid. The local
    // formatter must report the components the Date was constructed with.
    const justAfterMidnight = new Date(2026, 0, 1, 0, 30);
    expect(toLocalDateString(justAfterMidnight)).toBe('2026-01-01');

    // 23:30 local on Dec 31: west of UTC, toISOString() would say Jan 1.
    const justBeforeMidnight = new Date(2026, 11, 31, 23, 30);
    expect(toLocalDateString(justBeforeMidnight)).toBe('2026-12-31');
  });
});

describe('getTodayLocalDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 18, 0));
    expect(getTodayLocalDate()).toBe('2026-04-15');
  });

  it('agrees with toLocalDateString(new Date())', () => {
    expect(getTodayLocalDate()).toBe(toLocalDateString(new Date()));
  });
});
