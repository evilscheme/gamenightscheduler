import { describe, it, expect } from "vitest";
import { getSchedulingWindow } from "./scheduling";
import { parseISO } from "date-fns";

// Helper to create a local-midnight date from a YYYY-MM-DD string.
// Uses parseISO (which treats date-only strings as local time) instead of
// new Date() (which treats them as UTC).
function localDate(dateStr: string): Date {
  return parseISO(dateStr);
}

// Helper to make a minimal game object for testing
function makeGame(overrides: {
  scheduling_window_months?: number;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
}) {
  return {
    scheduling_window_months: 2,
    campaign_start_date: null as string | null,
    campaign_end_date: null as string | null,
    ...overrides,
  };
}

describe("getSchedulingWindow", () => {
  // Use a fixed reference date: 2025-01-15 (Wednesday), local midnight
  const referenceDate = localDate("2025-01-15");

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

  it("uses campaign_start_date when it is in the future", () => {
    const game = makeGame({ campaign_start_date: "2025-02-01" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Start date is in the future, so use it
    expect(start).toEqual(localDate("2025-02-01"));
    expect(end).toEqual(localDate("2025-03-31"));
  });

  it("uses today when campaign_start_date is in the past", () => {
    const game = makeGame({ campaign_start_date: "2025-01-01" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Start date is in the past, so use today
    expect(start).toEqual(localDate("2025-01-15"));
    expect(end).toEqual(localDate("2025-03-31"));
  });

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

  it("handles both campaign dates set", () => {
    const game = makeGame({
      campaign_start_date: "2025-02-01",
      campaign_end_date: "2025-02-28",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-02-01"));
    expect(end).toEqual(localDate("2025-02-28"));
  });

  it("returns empty range when campaign_end_date is before today", () => {
    const game = makeGame({ campaign_end_date: "2025-01-10" });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    expect(start).toEqual(localDate("2025-01-15"));
    // End is before start — consumers should handle this as empty
    expect(end).toEqual(localDate("2025-01-10"));
  });

  it("returns empty range when campaign_start_date is after window end", () => {
    const game = makeGame({
      scheduling_window_months: 1,
      campaign_start_date: "2025-04-01",
    });
    const { start, end } = getSchedulingWindow(game, referenceDate);

    // Start (Apr 1) is after window end (Feb 28) — empty range
    expect(start).toEqual(localDate("2025-04-01"));
    expect(end).toEqual(localDate("2025-02-28"));
  });
});
