import { describe, it, expect } from "vitest";
import { filterAvailabilityForCopy } from "./copyAvailability";
import { AvailabilityEntry } from "@/lib/availabilityStatus";

// Helper functions matching date-fns behavior
const formatDate = (date: Date) => date.toISOString().split("T")[0];
const getDayOfWeek = (date: Date) => date.getDay();
const isBefore = (date: Date, compare: Date) => date < compare;
const isAfter = (date: Date, compare: Date) => date > compare;
const parseDate = (dateStr: string) => new Date(`${dateStr}T12:00:00`);

// Create dates with fixed time to avoid timezone issues
const makeEntry = (
  status: "available" | "unavailable" | "maybe",
  comment: string | null = null,
  available_after: string | null = null,
  available_until: string | null = null
): AvailabilityEntry => ({
  status,
  comment,
  available_after,
  available_until,
});

describe("filterAvailabilityForCopy", () => {
  // Fixed "today" for deterministic tests: 2025-01-15 (Wednesday)
  const today = new Date("2025-01-15T12:00:00");
  // Window end: 2 months ahead, end of March
  const windowEndDate = new Date("2025-03-31T12:00:00");

  const defaultParams = {
    today,
    windowEndDate,
    formatDate,
    getDayOfWeek,
    isBefore,
    isAfter,
    parseDate,
  };

  it("copies only blank dates (skips already-set)", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("available"), // Fri
      "2025-01-24": makeEntry("unavailable"), // Fri
      "2025-01-31": makeEntry("maybe"), // Fri
    };

    const destinationAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("unavailable"), // Already set - should skip
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability,
      destinationPlayDays: [5], // Friday
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.date)).toEqual(["2025-01-24", "2025-01-31"]);
  });

  it("skips past dates", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-10": makeEntry("available"), // Past Fri
      "2025-01-17": makeEntry("available"), // Future Fri
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5], // Friday
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-01-17");
  });

  it("skips dates outside scheduling window", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("available"), // Within window
      "2025-04-04": makeEntry("available"), // Beyond window (April)
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5], // Friday
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-01-17");
  });

  it("respects destination play days (ignores source dates that aren't destination play days)", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("available"), // Fri
      "2025-01-18": makeEntry("available"), // Sat
      "2025-01-20": makeEntry("available"), // Mon
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5], // Only Fridays in destination
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-01-17");
  });

  it("includes destination extra play dates", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("available"), // Fri - regular play day
      "2025-01-20": makeEntry("available"), // Mon - extra play date
      "2025-01-21": makeEntry("available"), // Tue - not a play day
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5], // Only Fridays
      destinationExtraPlayDates: ["2025-01-20"], // Monday is extra
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.date)).toEqual(["2025-01-17", "2025-01-20"]);
  });

  it("preserves status, comment, and time constraints", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("maybe", "Depends on work", "18:00", "22:00"),
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toEqual({
      status: "maybe",
      comment: "Depends on work",
      available_after: "18:00",
      available_until: "22:00",
    });
  });

  it("handles empty source availability → returns empty", () => {
    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability: {},
      destinationAvailability: {},
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });

    expect(result).toEqual([]);
  });

  it("handles fully-set destination → returns empty", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("available"),
      "2025-01-24": makeEntry("available"),
    };

    const destinationAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-17": makeEntry("unavailable"),
      "2025-01-24": makeEntry("maybe"),
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability,
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });

    expect(result).toEqual([]);
  });

  it("returns results sorted by date", () => {
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-02-07": makeEntry("available"),
      "2025-01-17": makeEntry("available"),
      "2025-01-24": makeEntry("available"),
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });

    expect(result.map((r) => r.date)).toEqual([
      "2025-01-17",
      "2025-01-24",
      "2025-02-07",
    ]);
  });

  it("includes today's date (not past)", () => {
    // Today is 2025-01-15, which is a Wednesday
    const sourceAvailability: Record<string, AvailabilityEntry> = {
      "2025-01-15": makeEntry("available"),
    };

    const result = filterAvailabilityForCopy({
      ...defaultParams,
      sourceAvailability,
      destinationAvailability: {},
      destinationPlayDays: [3], // Wednesday
      destinationExtraPlayDates: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-01-15");
  });
});
