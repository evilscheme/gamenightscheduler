import { describe, it, expect } from "vitest";
import { eachDayOfInterval, getDay, isBefore, format } from "date-fns";
import { computeDefaultEntries, type WeekdayDefault } from "./defaultAvailability";

const formatDate = (d: Date) => format(d, "yyyy-MM-dd");

// Helpers to build the params with sane defaults for each test.
function run(overrides: Partial<Parameters<typeof computeDefaultEntries>[0]>) {
  // Jan 2025: 1st=Wed. Window covers Jan 1–31, 2025.
  // Use local-time constructors (not ISO strings) to avoid UTC-midnight timezone shift.
  const windowStart = new Date(2025, 0, 1);
  const windowEnd = new Date(2025, 0, 31);
  return computeDefaultEntries({
    defaults: {},
    dates: eachDayOfInterval({ start: windowStart, end: windowEnd }),
    playDays: [3, 5], // Wed, Fri
    extraPlayDates: [],
    existingAvailability: {},
    today: new Date(2025, 0, 1),
    formatDate,
    getDayOfWeek: getDay,
    isBefore,
    ...overrides,
  });
}

const FRI_AVAIL: WeekdayDefault = {
  status: "available",
  comment: null,
  available_after: "19:30:00",
  available_until: null,
};
const WED_UNAVAIL: WeekdayDefault = {
  status: "unavailable",
  comment: null,
  available_after: null,
  available_until: null,
};

describe("computeDefaultEntries", () => {
  it("returns nothing when the user has no defaults", () => {
    expect(run({ defaults: {} })).toEqual([]);
  });

  it("fills blank play-day dates whose weekday has a default", () => {
    const result = run({ defaults: { 5: FRI_AVAIL } });
    // Fridays in Jan 2025: 3, 10, 17, 24, 31
    expect(result.map((e) => e.date)).toEqual([
      "2025-01-03",
      "2025-01-10",
      "2025-01-17",
      "2025-01-24",
      "2025-01-31",
    ]);
    expect(result[0]).toEqual({
      date: "2025-01-03",
      status: "available",
      comment: null,
      available_after: "19:30:00",
      available_until: null,
    });
  });

  it("skips play-day weekdays that have no default", () => {
    // Only Wednesday has a default; Fridays (also a play day) must produce no entries.
    const result = run({ defaults: { 3: WED_UNAVAIL } });
    const fridaysInJan = ["2025-01-03", "2025-01-10", "2025-01-17", "2025-01-24", "2025-01-31"];
    expect(result.map((e) => e.date).filter((d) => fridaysInJan.includes(d))).toEqual([]);
  });

  it("does not touch dates that already have availability (non-destructive)", () => {
    const result = run({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: {
        "2025-01-10": {
          status: "maybe",
          comment: null,
          available_after: null,
          available_until: null,
        },
      },
    });
    expect(result.map((e) => e.date)).not.toContain("2025-01-10");
  });

  it("skips past dates", () => {
    const result = run({ defaults: { 5: FRI_AVAIL }, today: new Date(2025, 0, 15) });
    // Only Fridays on/after Jan 15 remain: 17, 24, 31
    expect(result.map((e) => e.date)).toEqual(["2025-01-17", "2025-01-24", "2025-01-31"]);
  });

  it("skips non-play, non-extra weekdays", () => {
    // Monday has a default but is not a play day and not an extra date -> ignored.
    const MON_AVAIL = { ...FRI_AVAIL, available_after: null };
    const result = run({ defaults: { 1: MON_AVAIL } });
    expect(result).toEqual([]);
  });

  it("includes extra play dates matched by their weekday default", () => {
    // 2025-01-04 is a Saturday (not a play day) but is an extra play date.
    const SAT_AVAIL = { ...FRI_AVAIL, available_after: null };
    const result = run({
      defaults: { 6: SAT_AVAIL },
      extraPlayDates: ["2025-01-04"],
    });
    expect(result.map((e) => e.date)).toEqual(["2025-01-04"]);
  });

  it("copies comment and times through for available/maybe; carries unavailable as-is", () => {
    const result = run({ defaults: { 3: WED_UNAVAIL, 5: FRI_AVAIL } });
    const wed = result.find((e) => e.date === "2025-01-01"); // Wed
    const fri = result.find((e) => e.date === "2025-01-03"); // Fri
    expect(wed?.status).toBe("unavailable");
    expect(wed?.available_after).toBeNull();
    expect(fri?.status).toBe("available");
    expect(fri?.available_after).toBe("19:30:00");
  });

  it("works for ad-hoc games (no play days, only extra dates)", () => {
    const result = run({
      defaults: { 5: FRI_AVAIL },
      playDays: [],
      extraPlayDates: ["2025-01-10"], // a Friday
    });
    expect(result.map((e) => e.date)).toEqual(["2025-01-10"]);
  });
});
