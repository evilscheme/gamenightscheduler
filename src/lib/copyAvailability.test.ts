import { describe, it, expect } from "vitest";
import { filterAvailabilityForCopy, filterSessionConflictsForCopy, applyCopyConflicts } from "./copyAvailability";
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

describe("filterSessionConflictsForCopy", () => {
  const today = new Date("2025-01-15T12:00:00"); // Wed
  const windowEndDate = new Date("2025-03-31T12:00:00");
  const base = { today, windowEndDate, getDayOfWeek, isBefore, isAfter, parseDate };

  it("keeps only blank, in-window, future destination play-days/extra-dates", () => {
    const result = filterSessionConflictsForCopy({
      ...base,
      conflictCandidateDates: [
        "2025-01-17", // Fri, play day, blank → keep
        "2025-01-24", // Fri, but already set in dest → drop
        "2025-01-21", // Tue, not a play day/extra → drop
        "2025-01-10", // past → drop
        "2025-04-04", // beyond window → drop
        "2025-01-20", // Mon, extra play date → keep
      ],
      destinationAvailability: { "2025-01-24": makeEntry("available") },
      destinationPlayDays: [5],
      destinationExtraPlayDates: ["2025-01-20"],
    });
    expect(result).toEqual(["2025-01-17", "2025-01-20"]);
  });

  it("dedupes and sorts", () => {
    const result = filterSessionConflictsForCopy({
      ...base,
      conflictCandidateDates: ["2025-01-31", "2025-01-17", "2025-01-17"],
      destinationAvailability: {},
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });
    expect(result).toEqual(["2025-01-17", "2025-01-31"]);
  });

  it("returns empty for no candidates", () => {
    const result = filterSessionConflictsForCopy({
      ...base,
      conflictCandidateDates: [],
      destinationAvailability: {},
      destinationPlayDays: [5],
      destinationExtraPlayDates: [],
    });
    expect(result).toEqual([]);
  });
});

describe("applyCopyConflicts", () => {
  it("overrides copied entries on conflict dates and adds missing conflict dates", () => {
    const toCopy = [
      { date: "2025-01-17", entry: makeEntry("available", "from B", "18:00", "22:00") },
      { date: "2025-01-24", entry: makeEntry("maybe") },
    ];
    // 2025-01-17 is a conflict (override + strip note/time); 2025-01-31 is a
    // conflict with no copied entry (added fresh); 2025-01-24 is untouched.
    const result = applyCopyConflicts(toCopy, ["2025-01-17", "2025-01-31"], "unavailable");

    expect(result).toEqual([
      { date: "2025-01-17", entry: { status: "unavailable", comment: null, available_after: null, available_until: null } },
      { date: "2025-01-24", entry: makeEntry("maybe") },
      { date: "2025-01-31", entry: { status: "unavailable", comment: null, available_after: null, available_until: null } },
    ]);
  });

  it("with no conflict dates returns the copied entries sorted", () => {
    const toCopy = [
      { date: "2025-01-24", entry: makeEntry("available") },
      { date: "2025-01-17", entry: makeEntry("available") },
    ];
    const result = applyCopyConflicts(toCopy, [], "unavailable");
    expect(result.map((r) => r.date)).toEqual(["2025-01-17", "2025-01-24"]);
  });
});
