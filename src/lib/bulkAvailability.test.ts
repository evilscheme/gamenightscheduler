import { describe, it, expect } from "vitest";
import { filterDatesForBulkSet } from "./bulkAvailability";
import { AvailabilityEntry } from "@/lib/availabilityStatus";

// Helper functions matching date-fns behavior
const formatDate = (date: Date) => date.toISOString().split("T")[0];
const getDayOfWeek = (date: Date) => date.getDay();
const isBefore = (date: Date, compare: Date) => date < compare;

// Create dates with fixed time to avoid timezone issues
const makeDate = (dateStr: string) => new Date(`${dateStr}T12:00:00`);

describe("filterDatesForBulkSet", () => {
  // Fixed "today" for deterministic tests: 2025-01-15 (Wednesday)
  const today = makeDate("2025-01-15");

  // Sample dates in the window (Jan 15-31, 2025)
  const dates = [
    makeDate("2025-01-15"), // Wed (today)
    makeDate("2025-01-16"), // Thu
    makeDate("2025-01-17"), // Fri
    makeDate("2025-01-18"), // Sat
    makeDate("2025-01-19"), // Sun
    makeDate("2025-01-20"), // Mon
    makeDate("2025-01-21"), // Tue
    makeDate("2025-01-22"), // Wed
    makeDate("2025-01-23"), // Thu
    makeDate("2025-01-24"), // Fri
    makeDate("2025-01-25"), // Sat
  ];

  it('filters "remaining" - only unset dates', () => {
    const playDays = [5, 6]; // Fri, Sat
    const existingAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": { status: "available", comment: null, available_after: null, available_until: null },
    };

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability,
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    // Should include Fri 24, Sat 18, Sat 25 (not Fri 17 - already set)
    expect(result).toContain("2025-01-18");
    expect(result).toContain("2025-01-24");
    expect(result).toContain("2025-01-25");
    expect(result).not.toContain("2025-01-17"); // already has availability
  });

  it("filters specific day of week (e.g., Fridays)", () => {
    const playDays = [5, 6]; // Fri, Sat

    const result = filterDatesForBulkSet({
      filter: "5", // Fridays
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    // Should only include Fridays
    expect(result).toEqual(["2025-01-17", "2025-01-24"]);
  });

  it("excludes past dates", () => {
    const playDays = [3]; // Wednesdays
    const pastDates = [
      makeDate("2025-01-08"), // Past Wed
      makeDate("2025-01-15"), // Today (Wed)
      makeDate("2025-01-22"), // Future Wed
    ];

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates: pastDates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).not.toContain("2025-01-08"); // past
    expect(result).toContain("2025-01-15"); // today (not before today)
    expect(result).toContain("2025-01-22"); // future
  });

  it("includes special play dates", () => {
    const playDays = [5]; // Only Fridays normally
    const specialPlayDates = ["2025-01-20"]; // Monday as special

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays,
      specialPlayDates,
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toContain("2025-01-17"); // Friday
    expect(result).toContain("2025-01-20"); // Special play date (Monday)
    expect(result).toContain("2025-01-24"); // Friday
    expect(result).not.toContain("2025-01-21"); // Tuesday, not special
  });

  it("excludes non-play days", () => {
    const playDays = [5]; // Only Fridays

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    // Should only include Fridays
    expect(result).toEqual(["2025-01-17", "2025-01-24"]);
  });

  it('returns all play dates for "remaining" with empty availability', () => {
    const playDays = [5, 6]; // Fri, Sat

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toEqual([
      "2025-01-17",
      "2025-01-18",
      "2025-01-24",
      "2025-01-25",
    ]);
  });

  it('returns empty array for "remaining" when all dates are set', () => {
    const playDays = [5]; // Only Fridays
    const existingAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": { status: "available", comment: null, available_after: null, available_until: null },
      "2025-01-24": { status: "unavailable", comment: null, available_after: null, available_until: null },
    };

    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability,
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toEqual([]);
  });

  it("handles empty dates array", () => {
    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates: [],
      playDays: [5],
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toEqual([]);
  });

  it("handles empty play days", () => {
    const result = filterDatesForBulkSet({
      filter: "remaining",
      dates,
      playDays: [],
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toEqual([]);
  });

  it("specific day filter still respects play days configuration", () => {
    const playDays = [5]; // Only Fridays
    // Trying to filter by Saturdays (6) but Saturdays aren't play days
    const result = filterDatesForBulkSet({
      filter: "6", // Saturdays
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    // No Saturdays because they're not in playDays
    expect(result).toEqual([]);
  });

  it("specific day filter works when day is a play day", () => {
    const playDays = [5, 6]; // Fridays and Saturdays

    const result = filterDatesForBulkSet({
      filter: "6", // Saturdays
      dates,
      playDays,
      specialPlayDates: [],
      existingAvailability: {},
      today,
      formatDate,
      getDayOfWeek,
      isBefore,
    });

    expect(result).toEqual(["2025-01-18", "2025-01-25"]);
  });
});
