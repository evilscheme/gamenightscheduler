import { describe, it, expect } from "vitest";
import { getSchedulingWindow } from "./scheduling";
import { addMonths, format, lastDayOfMonth, parseISO, startOfDay, subDays } from "date-fns";
import type { SchedulingWindowMonths } from "./constants";

// Helper to create a local-midnight date from a YYYY-MM-DD string.
// Uses parseISO (which treats date-only strings as local time) instead of
// new Date() (which treats them as UTC).
function localDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/** ISO string (YYYY-MM-DD) for a date */
function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Helper to make a minimal game object for testing
function makeGame(overrides: {
  scheduling_window_months?: SchedulingWindowMonths;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
}) {
  return {
    scheduling_window_months: 2 as SchedulingWindowMonths,
    campaign_start_date: null as string | null,
    campaign_end_date: null as string | null,
    ...overrides,
  };
}

describe("getSchedulingWindow", () => {
  // Use a fixed reference date: 2025-01-15 (Wednesday), local midnight
  const referenceDate = localDate("2025-01-15");

  // ─── Basic window (no campaign dates) ──────────────────────────

  it("returns today to end of window when no campaign dates set", () => {
    const game = makeGame({});
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // 2 months ahead from Jan 15 = end of March
    expect(end).toEqual(localDate("2025-03-31"));
  });

  it("respects different scheduling_window_months values", () => {
    const game = makeGame({ scheduling_window_months: 6 });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // 6 months ahead from Jan 15 = end of July
    expect(end).toEqual(localDate("2025-07-31"));
  });

  // ─── Campaign start date ───────────────────────────────────────

  it("uses campaign_start_date when it is in the future", () => {
    const game = makeGame({ campaign_start_date: "2025-02-01" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Start date is in the future, so use it; window extends 2 months from Feb 1
    expect(start).toEqual(localDate("2025-02-01"));
    expect(end).toEqual(localDate("2025-04-30"));
  });

  it("uses today when campaign_start_date is in the past", () => {
    const game = makeGame({ campaign_start_date: "2025-01-01" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Start date is in the past, so use today
    expect(start).toEqual(localDate("2025-01-15"));
    expect(end).toEqual(localDate("2025-03-31"));
  });

  it("uses today when campaign_start_date is exactly today", () => {
    const game = makeGame({ campaign_start_date: "2025-01-15" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // max(today, today) = today
    expect(start).toEqual(localDate("2025-01-15"));
    expect(end).toEqual(localDate("2025-03-31"));
  });

  // ─── Campaign end date ─────────────────────────────────────────

  it("caps end at campaign_end_date when it is before the window end", () => {
    const game = makeGame({ campaign_end_date: "2025-02-28" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // Campaign ends Feb 28, which is before the window end (Mar 31)
    expect(end).toEqual(localDate("2025-02-28"));
  });

  it("uses window end when campaign_end_date is after it", () => {
    const game = makeGame({ campaign_end_date: "2025-12-31" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // Campaign ends Dec 31, but window end (Mar 31) is sooner
    expect(end).toEqual(localDate("2025-03-31"));
  });

  it("returns empty range when campaign_end_date is before today", () => {
    const game = makeGame({ campaign_end_date: "2025-01-10" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // End is before start — consumers should handle this as empty
    expect(end).toEqual(localDate("2025-01-10"));
  });

  it("returns single-day range when campaign_end_date equals today", () => {
    const game = makeGame({ campaign_end_date: "2025-01-15" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    expect(end).toEqual(localDate("2025-01-15"));
  });

  // ─── Both campaign dates ───────────────────────────────────────

  it("handles both campaign dates set", () => {
    const game = makeGame({
      campaign_start_date: "2025-02-01",
      campaign_end_date: "2025-02-28",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-02-01"));
    expect(end).toEqual(localDate("2025-02-28"));
  });

  it("handles single-day campaign (start equals end)", () => {
    const game = makeGame({
      campaign_start_date: "2025-02-14",
      campaign_end_date: "2025-02-14",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-02-14"));
    expect(end).toEqual(localDate("2025-02-14"));
  });

  // ─── Future campaign start (the bug fix) ───────────────────────

  it("shows future months when campaign starts after today", () => {
    const game = makeGame({
      scheduling_window_months: 1,
      campaign_start_date: "2025-04-01",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Window extends 1 month from Apr 1 (the effective start)
    expect(start).toEqual(localDate("2025-04-01"));
    expect(end).toEqual(localDate("2025-05-31"));
  });

  it("computes window end relative to future campaign start, not today", () => {
    // Campaign starts 6 months out with a 2-month window
    const game = makeGame({
      scheduling_window_months: 2,
      campaign_start_date: "2025-07-01",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Window extends 2 months from Jul 1
    expect(start).toEqual(localDate("2025-07-01"));
    expect(end).toEqual(localDate("2025-09-30"));
  });

  it("caps future campaign window at campaign_end_date", () => {
    const game = makeGame({
      scheduling_window_months: 6,
      campaign_start_date: "2025-04-01",
      campaign_end_date: "2025-06-15",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Window would go to Oct 31 but campaign ends Jun 15
    expect(start).toEqual(localDate("2025-04-01"));
    expect(end).toEqual(localDate("2025-06-15"));
  });

  it("handles 12-month window with future campaign start", () => {
    const game = makeGame({
      scheduling_window_months: 12,
      campaign_start_date: "2025-06-01",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // 12 months from Jun 1 = end of Jun 2026
    expect(start).toEqual(localDate("2025-06-01"));
    expect(end).toEqual(localDate("2026-06-30"));
  });

  // ─── Month boundary edge cases ─────────────────────────────────

  it("handles campaign start at end of month (Jan 31 + 1 month = Feb 28)", () => {
    const game = makeGame({
      scheduling_window_months: 1,
      campaign_start_date: "2025-01-31",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // addMonths(Jan 31, 1) = Feb 28 (date-fns clamps to valid date)
    // lastDayOfMonth(Feb 28) = Feb 28
    expect(start).toEqual(localDate("2025-01-31"));
    expect(end).toEqual(localDate("2025-02-28"));
  });

  it("handles past start with future end (start falls back to today)", () => {
    const game = makeGame({
      campaign_start_date: "2024-06-01",
      campaign_end_date: "2025-03-01",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Campaign started in the past → start = today, window from today
    // Window end = lastDayOfMonth(today + 2) = Mar 31
    // But campaign_end is Mar 1 < Mar 31 → end = Mar 1
    expect(start).toEqual(localDate("2025-01-15"));
    expect(end).toEqual(localDate("2025-03-01"));
  });

  // ─── Relative date tests (use today's actual date) ─────────────

  describe("with today's actual date", () => {
    const today = startOfDay(new Date());

    it("no campaign dates: start = today, end = last day of (today + N months)", () => {
      const game = makeGame({ scheduling_window_months: 3 });
      const { start, end } = getSchedulingWindow(game);

      expect(start).toEqual(today);
      expect(end).toEqual(lastDayOfMonth(addMonths(today, 3)));
    });

    it("future campaign start: window extends from that start", () => {
      const futureStart = addMonths(today, 4);
      const game = makeGame({
        scheduling_window_months: 2,
        campaign_start_date: toISO(futureStart),
      });
      const { start, end } = getSchedulingWindow(game);

      expect(start).toEqual(startOfDay(futureStart));
      expect(end).toEqual(lastDayOfMonth(addMonths(futureStart, 2)));
    });

    it("past campaign end: produces empty range (end < start)", () => {
      const pastEnd = subDays(today, 7);
      const game = makeGame({
        campaign_end_date: toISO(pastEnd),
      });
      const { start, end } = getSchedulingWindow(game);

      expect(start).toEqual(today);
      // End is before start
      expect(end.getTime()).toBeLessThan(start.getTime());
    });

    it("campaign end exactly today: single-day range", () => {
      const game = makeGame({
        campaign_end_date: toISO(today),
      });
      const { start, end } = getSchedulingWindow(game);

      expect(start).toEqual(today);
      expect(end).toEqual(today);
    });
  });
});
