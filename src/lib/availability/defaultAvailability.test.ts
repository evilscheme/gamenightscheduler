import { describe, it, expect } from "vitest";
import { eachDayOfInterval, getDay, isBefore, format } from "date-fns";
import {
  computeDefaultEntries,
  planDefaultEntries,
  type WeekdayDefault,
} from "./defaultAvailability";

const formatDate = (d: Date) => format(d, "yyyy-MM-dd");

// Helpers to build the params with sane defaults for each test.
// Jan 2025: 1st=Wed. Window covers Jan 1–31, 2025.
// Use local-time constructors (not ISO strings) to avoid UTC-midnight timezone shift.
function run(overrides: Partial<Parameters<typeof computeDefaultEntries>[0]>) {
  return computeDefaultEntries(params(overrides));
}

function planRun(overrides: Partial<Parameters<typeof planDefaultEntries>[0]>) {
  return planDefaultEntries(params(overrides));
}

/** Shared param block: Jan 2025 window (1st = Wed), Wed+Fri play days. */
function params(overrides: Partial<Parameters<typeof computeDefaultEntries>[0]>) {
  const windowStart = new Date(2025, 0, 1);
  const windowEnd = new Date(2025, 0, 31);
  return {
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
  };
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

  it("does not fill dates that already have availability (non-destructive)", () => {
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

  it("is exactly the plan's toFill half", () => {
    const params = {
      defaults: { 5: FRI_AVAIL },
      existingAvailability: {
        "2025-01-10": {
          status: "maybe" as const,
          comment: null,
          available_after: null,
          available_until: null,
        },
      },
    };
    expect(run(params)).toEqual(planRun(params).toFill);
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

describe("planDefaultEntries", () => {
  const entry = (o: Partial<WeekdayDefault> = {}) => ({
    status: "available" as const,
    comment: null,
    available_after: null,
    available_until: null,
    ...o,
  });

  it("puts blank eligible dates in toFill and nothing in toReplace", () => {
    const { toFill, toReplace } = planRun({ defaults: { 5: FRI_AVAIL } });
    expect(toFill.map((e) => e.date)).toEqual([
      "2025-01-03",
      "2025-01-10",
      "2025-01-17",
      "2025-01-24",
      "2025-01-31",
    ]);
    expect(toReplace).toEqual([]);
  });

  it("routes an already-answered date that disagrees with the default into toReplace", () => {
    const { toFill, toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: { "2025-01-10": entry({ status: "maybe" }) },
    });
    expect(toFill.map((e) => e.date)).not.toContain("2025-01-10");
    expect(toReplace.map((e) => e.date)).toEqual(["2025-01-10"]);
    // The replacement carries the default's full payload, not just its status.
    expect(toReplace[0]).toEqual({
      date: "2025-01-10",
      status: "available",
      comment: null,
      available_after: "19:30:00",
      available_until: null,
    });
  });

  // The bug this whole feature exists for: edit a default, re-apply, and the
  // dates the OLD default wrote must be offered up as replaceable.
  it("offers every date written by a since-edited default", () => {
    const oldDefaultWrote = entry({ status: "available", available_after: "19:30:00" });
    const { toFill, toReplace } = planRun({
      // Friday's default changed from available@19:30 to unavailable.
      defaults: { 5: WED_UNAVAIL },
      existingAvailability: {
        "2025-01-03": oldDefaultWrote,
        "2025-01-10": oldDefaultWrote,
        "2025-01-17": oldDefaultWrote,
        "2025-01-24": oldDefaultWrote,
        "2025-01-31": oldDefaultWrote,
      },
    });
    expect(toFill).toEqual([]);
    expect(toReplace.map((e) => e.date)).toEqual([
      "2025-01-03",
      "2025-01-10",
      "2025-01-17",
      "2025-01-24",
      "2025-01-31",
    ]);
    expect(toReplace.every((e) => e.status === "unavailable")).toBe(true);
  });

  it("leaves a date that already matches its default out of BOTH lists", () => {
    const { toFill, toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: {
        "2025-01-10": entry({ status: "available", available_after: "19:30:00" }),
      },
    });
    expect(toFill.map((e) => e.date)).not.toContain("2025-01-10");
    expect(toReplace).toEqual([]);
  });

  it("does not call a date mismatched over HH:MM vs HH:MM:SS", () => {
    // An optimistic row from a single-date toggle carries "19:30"; the same
    // value round-tripped through Postgres carries "19:30:00".
    const { toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: {
        "2025-01-10": entry({ status: "available", available_after: "19:30" }),
      },
    });
    expect(toReplace).toEqual([]);
  });

  it("treats a blank-ish comment and no comment as the same comment", () => {
    const { toReplace } = planRun({
      defaults: { 5: { ...FRI_AVAIL, comment: null } },
      existingAvailability: {
        "2025-01-10": entry({
          status: "available",
          available_after: "19:30:00",
          comment: "   ",
        }),
      },
    });
    expect(toReplace).toEqual([]);
  });

  it("counts a differing comment as a mismatch", () => {
    const { toReplace } = planRun({
      defaults: { 5: { ...FRI_AVAIL, comment: "after dinner" } },
      existingAvailability: {
        "2025-01-10": entry({ status: "available", available_after: "19:30:00" }),
      },
    });
    expect(toReplace.map((e) => e.date)).toEqual(["2025-01-10"]);
  });

  it("never offers a past date for replacement", () => {
    const { toFill, toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      today: new Date(2025, 0, 15),
      existingAvailability: {
        "2025-01-03": entry({ status: "maybe" }), // past
        "2025-01-17": entry({ status: "maybe" }), // future
      },
    });
    expect(toReplace.map((e) => e.date)).toEqual(["2025-01-17"]);
    expect(toFill.map((e) => e.date)).toEqual(["2025-01-24", "2025-01-31"]);
  });

  it("never offers a date whose weekday has no default", () => {
    // Wednesday is a play day and is already answered, but has no default.
    const { toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: { "2025-01-01": entry({ status: "maybe" }) },
    });
    expect(toReplace).toEqual([]);
  });

  it("never offers a date that is neither a play day nor an extra date", () => {
    const { toReplace } = planRun({
      defaults: { 1: FRI_AVAIL }, // Monday default, Monday is not a play day
      existingAvailability: { "2025-01-06": entry({ status: "maybe" }) }, // a Monday
    });
    expect(toReplace).toEqual([]);
  });

  it("offers an answered extra play date on a non-play weekday", () => {
    const { toReplace } = planRun({
      defaults: { 6: { ...FRI_AVAIL, available_after: null } },
      extraPlayDates: ["2025-01-04"], // a Saturday
      existingAvailability: { "2025-01-04": entry({ status: "unavailable" }) },
    });
    expect(toReplace.map((e) => e.date)).toEqual(["2025-01-04"]);
  });

  it("returns both halves when some dates are blank and others disagree", () => {
    const { toFill, toReplace } = planRun({
      defaults: { 5: FRI_AVAIL },
      existingAvailability: {
        "2025-01-03": entry({ status: "unavailable" }),
        "2025-01-10": entry({ status: "available", available_after: "19:30:00" }), // matches
      },
    });
    expect(toReplace.map((e) => e.date)).toEqual(["2025-01-03"]);
    expect(toFill.map((e) => e.date)).toEqual(["2025-01-17", "2025-01-24", "2025-01-31"]);
  });

  it("returns two empty halves when the user has no defaults", () => {
    expect(planRun({ defaults: {} })).toEqual({ toFill: [], toReplace: [] });
  });
});
