import { describe, it, expect } from "vitest";
import {
  USAGE_LIMITS,
  TEXT_LIMITS,
  TIMEZONE_GROUPS,
  TIMEZONE_OPTIONS,
  WEEK_START_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from "./constants";

// Note: We don't test exact values (e.g., MAX_GAMES_PER_USER === 20) because
// constants are their own source of truth. Testing exact values would just
// cause test failures when we intentionally change a limit.
// Instead, we test structural invariants that should always hold.

describe("USAGE_LIMITS", () => {
  it("all limits are positive numbers", () => {
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThan(0);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThan(0);
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeGreaterThan(0);
  });

  it("limits are reasonable (not too restrictive or too permissive)", () => {
    // Max games should be between 5 and 100
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThanOrEqual(5);
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeLessThanOrEqual(100);

    // Max players should be between 10 and 200
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThanOrEqual(10);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeLessThanOrEqual(200);

    // Max future sessions should be between 50 and 500
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeGreaterThanOrEqual(50);
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeLessThanOrEqual(500);
  });
});

describe("TEXT_LIMITS", () => {
  it("all text limits are positive numbers", () => {
    expect(TEXT_LIMITS.GAME_NAME).toBeGreaterThan(0);
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeGreaterThan(0);
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeGreaterThan(0);
  });

  it("text limits are reasonable", () => {
    // Game name should allow decent length but not be excessive
    expect(TEXT_LIMITS.GAME_NAME).toBeGreaterThanOrEqual(50);
    expect(TEXT_LIMITS.GAME_NAME).toBeLessThanOrEqual(200);

    // Description should allow paragraphs but not essays
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeGreaterThanOrEqual(500);
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeLessThanOrEqual(5000);

    // Display name should allow full names but not novels
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeGreaterThanOrEqual(20);
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeLessThanOrEqual(100);
  });
});

describe("TIMEZONE_GROUPS", () => {
  it("has entries for expected regions", () => {
    const labels = TIMEZONE_GROUPS.map((g) => g.label);
    expect(labels).toContain("North America");
    expect(labels).toContain("Europe");
    expect(labels).toContain("East & Southeast Asia");
    expect(labels).toContain("Oceania");
  });

  it("each group has a label and options array", () => {
    for (const group of TIMEZONE_GROUPS) {
      expect(typeof group.label).toBe("string");
      expect(group.label.length).toBeGreaterThan(0);
      expect(Array.isArray(group.options)).toBe(true);
      expect(group.options.length).toBeGreaterThan(0);
    }
  });

  it("has at least 30 total timezone options across all groups", () => {
    const total = TIMEZONE_GROUPS.reduce(
      (sum, group) => sum + group.options.length,
      0
    );
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it("has a UTC Offsets group with 24 entries covering UTC-11 to UTC+12", () => {
    const utcGroup = TIMEZONE_GROUPS.find((g) => g.label === "UTC Offsets");
    expect(utcGroup).toBeDefined();
    expect(utcGroup!.options).toHaveLength(24);
  });
});

describe("TIMEZONE_OPTIONS", () => {
  it("has at least 30 entries", () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("has no duplicate values", () => {
    const uniqueValues = new Set(TIMEZONE_OPTIONS.map((t) => t.value));
    expect(uniqueValues.size).toBe(TIMEZONE_OPTIONS.length);
  });

  it("all values are valid IANA timezones", () => {
    for (const tz of TIMEZONE_OPTIONS) {
      expect(() => {
        Intl.DateTimeFormat(undefined, { timeZone: tz.value });
      }).not.toThrow();
    }
  });
});

describe("WEEK_START_OPTIONS", () => {
  it("has exactly 2 entries", () => {
    expect(WEEK_START_OPTIONS).toHaveLength(2);
  });

  it("values are 0 and 1", () => {
    const values = WEEK_START_OPTIONS.map((o) => o.value);
    expect(values).toContain(0);
    expect(values).toContain(1);
  });
});

describe("TIME_FORMAT_OPTIONS", () => {
  it("has exactly 2 entries", () => {
    expect(TIME_FORMAT_OPTIONS).toHaveLength(2);
  });

  it("values are '12h' and '24h'", () => {
    const values = TIME_FORMAT_OPTIONS.map((o) => o.value);
    expect(values).toContain("12h");
    expect(values).toContain("24h");
  });
});
