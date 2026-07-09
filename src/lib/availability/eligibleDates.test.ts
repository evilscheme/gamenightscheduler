import { describe, it, expect } from "vitest";
import { isEligiblePlayDate } from "./eligibleDates";

// Fixed "today" for deterministic tests: 2025-01-15 (Wednesday)
const today = new Date(2025, 0, 15);

describe("isEligiblePlayDate", () => {
  it("is eligible on a regular play day", () => {
    // 2025-01-17 is a Friday
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 17),
        playDays: [5],
        extraPlayDates: [],
        today,
      })
    ).toBe(true);
  });

  it("is eligible on an extra play date even when not a regular play day", () => {
    // 2025-01-20 is a Monday; only Fridays are regular play days
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 20),
        playDays: [5],
        extraPlayDates: ["2025-01-20"],
        today,
      })
    ).toBe(true);
  });

  it("is ineligible when neither a play day nor an extra play date", () => {
    // 2025-01-21 is a Tuesday
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 21),
        playDays: [5],
        extraPlayDates: [],
        today,
      })
    ).toBe(false);
  });

  it("is ineligible for past dates", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 10), // Friday, before today
        playDays: [5],
        extraPlayDates: [],
        today,
      })
    ).toBe(false);
  });

  it("treats today itself as eligible", () => {
    // 2025-01-15 is a Wednesday
    expect(
      isEligiblePlayDate({
        date: today,
        playDays: [3],
        extraPlayDates: [],
        today,
      })
    ).toBe(true);
  });

  it("is ineligible beyond an optional window end", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 1, 1), // Feb 1 (Saturday)
        playDays: [6],
        extraPlayDates: [],
        today,
        windowEnd: new Date(2025, 0, 31),
      })
    ).toBe(false);
  });

  it("treats the window end itself as eligible (inclusive)", () => {
    // 2025-01-31 is a Friday
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 31),
        playDays: [5],
        extraPlayDates: [],
        today,
        windowEnd: new Date(2025, 0, 31),
      })
    ).toBe(true);
  });

  it("has no upper bound when windowEnd is omitted", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2026, 0, 1),
        playDays: [4], // Thursday
        extraPlayDates: [],
        today,
      })
    ).toBe(true);
  });

  it("is ineligible when already present in existingAvailability", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 17),
        playDays: [5],
        extraPlayDates: [],
        today,
        existingAvailability: { "2025-01-17": { status: "available" } },
      })
    ).toBe(false);
  });

  it("is eligible when existingAvailability is provided but blank for this date", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 17),
        playDays: [5],
        extraPlayDates: [],
        today,
        existingAvailability: { "2025-01-24": { status: "available" } },
      })
    ).toBe(true);
  });

  it("does not check existing entries when existingAvailability is omitted", () => {
    expect(
      isEligiblePlayDate({
        date: new Date(2025, 0, 17),
        playDays: [5],
        extraPlayDates: [],
        today,
      })
    ).toBe(true);
  });
});
