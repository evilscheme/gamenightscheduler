import { describe, it, expect } from "vitest";
import {
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
      specialPlayDates: [],
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
      specialPlayDates: [],
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
      specialPlayDates: [],
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
      specialPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(result["player-1"]).toBe(100);
  });

  it("calculates correct percentage for partial completion", () => {
    const playDates = getPlayDatesInWindow({
      playDays: [5], // Fridays
      schedulingWindowMonths: 1,
      specialPlayDates: [],
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
      specialPlayDates: [],
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
      specialPlayDates: [],
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
      specialPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(result["player-1"]).toBe(100);
    expect(result["player-2"]).toBe(Math.round((1 / playDates.length) * 100));
    expect(result["player-3"]).toBe(0);
  });

  it("includes special play dates in the calculation", () => {
    // Add a special date that's not a regular play day
    // January 20, 2025 is a Monday
    const specialDate = "2025-01-20";

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [5], // Fridays only
      schedulingWindowMonths: 1,
      specialPlayDates: [specialDate],
      availabilityRecords: [{ user_id: "player-1", date: specialDate }],
      referenceDate,
    });

    // Player filled in 1 date out of total (Fridays + special date)
    const totalDates = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      specialPlayDates: [specialDate],
      referenceDate,
    }).length;

    expect(result["player-1"]).toBe(Math.round((1 / totalDates) * 100));
  });

  it("ignores availability records for dates not in the play window", () => {
    const playDates = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      specialPlayDates: [],
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
      specialPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    // Only 1 valid date out of total play dates
    expect(result["player-1"]).toBe(Math.round((1 / playDates.length) * 100));
  });

  it("rounds percentages to nearest integer", () => {
    // Create a scenario where the percentage would have decimals
    const playDates = getPlayDatesInWindow({
      playDays: [1, 2, 3, 4, 5], // Weekdays
      schedulingWindowMonths: 1,
      specialPlayDates: [],
      referenceDate,
    });

    // Fill in 1 date
    const availabilityRecords = [{ user_id: "player-1", date: playDates[0] }];

    const result = calculatePlayerCompletionPercentages({
      playerIds: ["player-1"],
      playDays: [1, 2, 3, 4, 5],
      schedulingWindowMonths: 1,
      specialPlayDates: [],
      availabilityRecords,
      referenceDate,
    });

    expect(Number.isInteger(result["player-1"])).toBe(true);
  });
});

describe("getPlayDatesInWindow", () => {
  const referenceDate = new Date("2025-01-15"); // Wednesday

  it("returns empty array when no play days configured", () => {
    const result = getPlayDatesInWindow({
      playDays: [],
      schedulingWindowMonths: 2,
      specialPlayDates: [],
      referenceDate,
    });

    expect(result).toEqual([]);
  });

  it("returns only dates matching play days", () => {
    const result = getPlayDatesInWindow({
      playDays: [5], // Fridays only (day 5)
      schedulingWindowMonths: 1,
      specialPlayDates: [],
      referenceDate,
    });

    // All results should be Fridays
    result.forEach((dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      expect(date.getDay()).toBe(5);
    });
  });

  it("includes special play dates even if not regular play days", () => {
    const specialDate = "2025-01-20"; // Monday
    const result = getPlayDatesInWindow({
      playDays: [5], // Fridays only
      schedulingWindowMonths: 1,
      specialPlayDates: [specialDate],
      referenceDate,
    });

    expect(result).toContain(specialDate);
  });

  it("does not include special dates outside the window", () => {
    const pastSpecialDate = "2024-01-01";
    const futureSpecialDate = "2026-01-01";

    const result = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      specialPlayDates: [pastSpecialDate, futureSpecialDate],
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
      specialPlayDates: [],
      referenceDate,
    });

    expect(result).toContain("2025-01-15");
  });

  it("respects scheduling window months", () => {
    const result1Month = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      specialPlayDates: [],
      referenceDate,
    });

    const result3Months = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 3,
      specialPlayDates: [],
      referenceDate,
    });

    expect(result3Months.length).toBeGreaterThan(result1Month.length);
  });

  it("returns dates in yyyy-MM-dd format", () => {
    const result = getPlayDatesInWindow({
      playDays: [5],
      schedulingWindowMonths: 1,
      specialPlayDates: [],
      referenceDate,
    });

    result.forEach((dateStr) => {
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
