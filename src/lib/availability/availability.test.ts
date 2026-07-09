import { describe, it, expect } from "vitest";
import {
  calculateGameFillRate,
  calculatePlayerCompletionPercentages,
  getPlayDatesInWindow,
} from "./availability";

describe("calculatePlayerCompletionPercentages", () => {
  // Use a fixed reference date for deterministic tests
  // January 15, 2025 is a Wednesday
  const referenceDate = new Date("2025-01-15");

  it("returns empty object when no play days are configured", () => {
    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [],
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      availabilityRecords: [],
      referenceDate,
    });

    expect(result).toEqual({});
  });

  it("returns 0% for players with no availability records", () => {
    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1", "player-2"],
      playDays: [5], // Fridays only
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords: [],
      referenceDate,
    });

    expect(result["player-1"]).toBe(0);
    expect(result["player-2"]).toBe(0);
  });

  it("returns 100% for players who filled in all dates", () => {
    // Get all the play dates first
    const playDates = getPlayDatesInWindow({
      playDays: [5], // Fridays
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    const availabilityRecords = playDates.map((date) => ({
      user_id: "player-1",
      date,
    }));

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(result["player-1"]).toBe(100);
  });

  it("calculates correct percentage for partial completion", () => {
    const playDates = getPlayDatesInWindow({
      playDays: [5], // Fridays
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    // Fill in half the dates
    const halfCount = Math.floor(playDates.length / 2);
    const availabilityRecords = playDates.slice(0, halfCount).map((date) => ({
      user_id: "player-1",
      date,
    }));

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    const expectedPercentage = Math.round((halfCount / playDates.length) * 100);
    expect(result["player-1"]).toBe(expectedPercentage);
  });

  it("handles multiple players with different completion rates", () => {
    const playDates = getPlayDatesInWindow({
      playDays: [5, 6], // Fridays and Saturdays
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    const availabilityRecords = [
      // Player 1 filled in all dates
      ...playDates.map((date) => ({ user_id: "player-1", date })),
      // Player 2 filled in only the first date
      { user_id: "player-2", date: playDates[0] },
      // Player 3 has no records
    ];

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1", "player-2", "player-3"],
      playDays: [5, 6],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(result["player-1"]).toBe(100);
    expect(result["player-2"]).toBe(Math.round((1 / playDates.length) * 100));
    expect(result["player-3"]).toBe(0);
  });

  it("includes extra play dates in the calculation", () => {
    // Add a extra date that's not a regular play day
    // January 20, 2025 is a Monday
    const extraDate = "2025-01-20";

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5], // Fridays only
      schedulingWindowMonths: 1,
      extraPlayDates: [extraDate],
      availabilityRecords: [{ user_id: "player-1", date: extraDate }],
      referenceDate,
    });

    // Player filled in 1 date out of total (Fridays + extra date)
    const totalDates = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [extraDate],
      referenceDate,
    }).length;

    expect(result["player-1"]).toBe(Math.round((1 / totalDates) * 100));
  });

  it("works for ad-hoc games with no play days and only extra dates", () => {
    const extraDates = ["2025-01-20", "2025-01-22", "2025-01-25"];

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1", "player-2"],
      playDays: [], // ad-hoc: no regular play days
      schedulingWindowMonths: 1,
      extraPlayDates: extraDates,
      availabilityRecords: [
        { user_id: "player-1", date: "2025-01-20" },
        { user_id: "player-1", date: "2025-01-22" },
        { user_id: "player-1", date: "2025-01-25" },
        { user_id: "player-2", date: "2025-01-20" },
      ],
      referenceDate,
    });

    expect(result["player-1"]).toBe(100);
    expect(result["player-2"]).toBe(Math.round((1 / 3) * 100));
  });

  it("ignores availability records for dates not in the play window", () => {
    const playDates = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    // Record for a date outside the window (past date)
    const pastDate = "2024-01-01";
    // Record for a date that's not a play day
    const nonPlayDay = "2025-01-16"; // Thursday

    const availabilityRecords = [
      { user_id: "player-1", date: pastDate },
      { user_id: "player-1", date: nonPlayDay },
      { user_id: "player-1", date: playDates[0] }, // One valid date
    ];

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    // Only 1 valid date out of total play dates
    expect(result["player-1"]).toBe(Math.round((1 / playDates.length) * 100));
  });

  it("uses pre-computed window bounds when provided", () => {
    const referenceDate = new Date("2025-01-15T00:00:00");
    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5], // Fridays
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      availabilityRecords: [],
      referenceDate,
      // Campaign starts Feb 1, ends Feb 28 — only February Fridays count
      windowStart: new Date("2025-02-01T00:00:00"),
      windowEnd: new Date("2025-02-28T00:00:00"),
    });

    // 4 Fridays in Feb 2025: 7th, 14th, 21st, 28th. 0 filled = 0%
    expect(result["player-1"]).toBe(0);
  });

  it("rounds percentages to nearest integer", () => {
    // Create a scenario where the percentage would have decimals
    const playDates = getPlayDatesInWindow({
      playDays: [1, 2, 3, 4, 5], // Weekdays
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    // Fill in 1 date
    const availabilityRecords = [{ user_id: "player-1", date: playDates[0] }];

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [1, 2, 3, 4, 5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(Number.isInteger(result["player-1"])).toBe(true);
  });

  it("returns empty object when window start is after window end", () => {
    const referenceDate = new Date("2025-01-15T00:00:00");
    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5],
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      availabilityRecords: [],
      referenceDate,
      windowStart: new Date("2025-04-01T00:00:00"),
      windowEnd: new Date("2025-02-28T00:00:00"),
    });

    expect(result).toEqual({});
  });
});

describe("calculateGameFillRate", () => {
  // Regression for the admin "fill rate" bug: a game whose campaign ends soon
  // was scored against the full N-month window instead of the campaign-bounded
  // window, inflating the denominator and tanking the rate.
  //
  // Real scenario ("Mah Jong!"): play_days Mon–Sat, 3-month window, but the
  // campaign ends 2026-06-06. The only play dates that matter are the 7 between
  // today (2026-05-30) and the campaign end. All players filled those 7.
  const referenceDate = new Date("2026-05-30T12:00:00"); // Saturday
  const monSat = [1, 2, 3, 4, 5, 6];
  const inWindowDates = [
    "2026-05-30", // Sat
    "2026-06-01", // Mon
    "2026-06-02",
    "2026-06-03",
    "2026-06-04",
    "2026-06-05",
    "2026-06-06", // Sat (campaign end)
  ];

  it("bounds the window by campaign_end_date (100%, not 23%)", () => {
    const players = ["gm", "p1", "p2"];
    const availabilityRecords = players.flatMap((user_id) =>
      inWindowDates.map((date) => ({ user_id, date }))
    );

    const fillRate = calculateGameFillRate({
      playerIds: players,
      playDays: monSat,
      schedulingWindowMonths: 3,
      campaignStartDate: null,
      campaignEndDate: "2026-06-06",
      extraPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(fillRate).toBe(100);
  });

  it("does not credit availability filled past the campaign end", () => {
    // A player who additionally filled dates after the campaign end gains
    // nothing: those dates are outside the bounded window entirely.
    const fillRate = calculateGameFillRate({
      playerIds: ["p1"],
      playDays: monSat,
      schedulingWindowMonths: 3,
      campaignStartDate: null,
      campaignEndDate: "2026-06-06",
      extraPlayDates: [],
      availabilityRecords: [
        ...inWindowDates.map((date) => ({ user_id: "p1", date })),
        { user_id: "p1", date: "2026-07-15" },
        { user_id: "p1", date: "2026-08-20" },
      ],
      referenceDate,
    });

    expect(fillRate).toBe(100);
  });

  it("averages per-player completion across all players", () => {
    const fillRate = calculateGameFillRate({
      playerIds: ["full", "empty"],
      playDays: monSat,
      schedulingWindowMonths: 3,
      campaignStartDate: null,
      campaignEndDate: "2026-06-06",
      extraPlayDates: [],
      availabilityRecords: inWindowDates.map((date) => ({ user_id: "full", date })),
      referenceDate,
    });

    // full = 100%, empty = 0% -> average 50%
    expect(fillRate).toBe(50);
  });

  it("returns 0 when there are no play dates in the window", () => {
    const fillRate = calculateGameFillRate({
      playerIds: ["p1"],
      playDays: [], // ad-hoc with no extra dates
      schedulingWindowMonths: 3,
      campaignStartDate: null,
      campaignEndDate: null,
      extraPlayDates: [],
      availabilityRecords: [],
      referenceDate,
    });

    expect(fillRate).toBe(0);
  });
});

describe("getPlayDatesInWindow", () => {
  const referenceDate = new Date("2025-01-15"); // Wednesday

  it("returns empty array when no play days configured", () => {
    const result = getPlayDatesInWindow({
      playDays: [],
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      referenceDate,
    });

    expect(result).toEqual([]);
  });

  it("returns only dates matching play days", () => {
    const result = getPlayDatesInWindow({
      playDays: [5], // Fridays only (day 5)
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    // All results should be Fridays
    result.forEach((dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      expect(date.getDay()).toBe(5);
    });
  });

  it("includes extra play dates even if not regular play days", () => {
    const extraDate = "2025-01-20"; // Monday
    const result = getPlayDatesInWindow({
      playDays: [5], // Fridays only
      schedulingWindowMonths: 1,
      extraPlayDates: [extraDate],
      referenceDate,
    });

    expect(result).toContain(extraDate);
  });

  it("does not include extra dates outside the window", () => {
    const pastSpecialDate = "2024-01-01";
    const futureSpecialDate = "2026-01-01";

    const result = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [pastSpecialDate, futureSpecialDate],
      referenceDate,
    });

    expect(result).not.toContain(pastSpecialDate);
    expect(result).not.toContain(futureSpecialDate);
  });

  it("includes today if it is a play day", () => {
    // January 15, 2025 is Wednesday (day 3)
    const result = getPlayDatesInWindow({
      playDays: [3], // Wednesdays
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    expect(result).toContain("2025-01-15");
  });

  it("respects scheduling window months", () => {
    const result1Month = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    const result3Months = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 3,
      extraPlayDates: [],
      referenceDate,
    });

    expect(result3Months.length).toBeGreaterThan(result1Month.length);
  });

  it("uses pre-computed window bounds when provided", () => {
    const referenceDate = new Date("2025-01-15T00:00:00");
    const result = getPlayDatesInWindow({
      playDays: [5], // Fridays
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      referenceDate,
      windowStart: new Date("2025-02-01T00:00:00"),
      windowEnd: new Date("2025-02-28T00:00:00"),
    });

    // Only February Fridays: 7th, 14th, 21st, 28th
    expect(result).toEqual([
      "2025-02-07",
      "2025-02-14",
      "2025-02-21",
      "2025-02-28",
    ]);
  });

  it("returns dates in yyyy-MM-dd format", () => {
    const result = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      extraPlayDates: [],
      referenceDate,
    });

    result.forEach((dateStr) => {
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("returns empty array when window start is after window end", () => {
    const referenceDate = new Date("2025-01-15T00:00:00");
    const result = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 2,
      extraPlayDates: [],
      referenceDate,
      windowStart: new Date("2025-04-01T00:00:00"),
      windowEnd: new Date("2025-02-28T00:00:00"),
    });

    expect(result).toEqual([]);
  });
});
