import { describe, it, expect } from "vitest";
import {
  isValidTimezone,
  formatTimezoneDisplay,
  getTimezoneAbbreviation,
  convertTimeForDisplay,
  getSessionInstantMs,
  getDateInTimezone,
  usableTimezone,
  TIMEZONE_SHAPE,
} from "./timezone";

describe("isValidTimezone", () => {
  it("accepts America/New_York as valid", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  it("accepts Europe/London as valid", () => {
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("accepts UTC as valid", () => {
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("rejects a fake timezone identifier", () => {
    expect(isValidTimezone("Fake/Timezone")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidTimezone("")).toBe(false);
  });

  it("rejects a real zone with an embedded or trailing CR/LF", () => {
    expect(isValidTimezone("America/New_York\n")).toBe(false);
    expect(isValidTimezone("America/New_York\r\nX-INJECT:1")).toBe(false);
    expect(isValidTimezone("UTC\r")).toBe(false);
  });

  it("returns a stable answer across repeated (cached) calls", () => {
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
  });

  it("rejects non-IANA strings like Eastern", () => {
    expect(isValidTimezone("Eastern")).toBe(false);
  });
});

describe("formatTimezoneDisplay", () => {
  it("returns empty string for null", () => {
    expect(formatTimezoneDisplay(null)).toBe("");
  });

  it("formats America/Los_Angeles with city name and abbreviation", () => {
    const result = formatTimezoneDisplay("America/Los_Angeles");
    // Abbreviation depends on current date (PST in winter, PDT in summer)
    expect(result).toMatch(/^Los Angeles \(P[DS]T\)$/);
  });

  it("formats Europe/London with city name and abbreviation", () => {
    const result = formatTimezoneDisplay("Europe/London");
    // GMT in winter, BST (or GMT+1) in summer depending on ICU/Node version
    expect(result).toMatch(/^London \((GMT|BST|GMT\+1)\)$/);
  });

  it("falls back to the raw string for an invalid timezone", () => {
    expect(formatTimezoneDisplay("InvalidTz")).toBe("InvalidTz");
  });

  it("formats Etc/GMT+5 as UTC-5 (sign inversion)", () => {
    expect(formatTimezoneDisplay("Etc/GMT+5")).toBe("UTC-5");
  });

  it("formats Etc/GMT-9 as UTC+9 (sign inversion)", () => {
    expect(formatTimezoneDisplay("Etc/GMT-9")).toBe("UTC+9");
  });

  it("formats Etc/GMT0 as UTC+0", () => {
    expect(formatTimezoneDisplay("Etc/GMT0")).toBe("UTC+0");
  });
});

describe("getTimezoneAbbreviation", () => {
  it("returns EST for winter New York", () => {
    const abbrev = getTimezoneAbbreviation(
      new Date("2025-01-15"),
      "America/New_York"
    );
    expect(abbrev).toBe("EST");
  });

  it("returns EDT for summer New York", () => {
    const abbrev = getTimezoneAbbreviation(
      new Date("2025-07-15"),
      "America/New_York"
    );
    expect(abbrev).toBe("EDT");
  });

  it("returns PST for winter Los Angeles", () => {
    expect(
      getTimezoneAbbreviation(new Date("2025-01-15"), "America/Los_Angeles")
    ).toBe("PST");
  });

  it("returns GMT for winter London", () => {
    expect(
      getTimezoneAbbreviation(new Date("2025-01-15"), "Europe/London")
    ).toBe("GMT");
  });

  it("returns UTC for the UTC timezone", () => {
    expect(getTimezoneAbbreviation(new Date("2025-01-15"), "UTC")).toBe("UTC");
  });
});

describe("isValidTimezone with Etc/GMT zones", () => {
  it("accepts Etc/GMT+5 as valid", () => {
    expect(isValidTimezone("Etc/GMT+5")).toBe(true);
  });

  it("accepts Etc/GMT-12 as valid", () => {
    expect(isValidTimezone("Etc/GMT-12")).toBe(true);
  });

  it("accepts Etc/GMT0 as valid", () => {
    expect(isValidTimezone("Etc/GMT0")).toBe(true);
  });
});

describe("convertTimeForDisplay", () => {
  it("reports same timezone when game and user timezone match", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "18:00",
      "America/New_York",
      "America/New_York",
      false
    );
    expect(result.isDifferentTz).toBe(false);
    expect(result.gameTime).toBe("6:00 PM");
    expect(result.gameTzAbbrev).toBe("EST");
    expect(result.userTime).toBeNull();
    expect(result.userTzAbbrev).toBeNull();
  });

  it("reports same timezone when user timezone is null", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "18:00",
      "America/New_York",
      null,
      false
    );
    expect(result.isDifferentTz).toBe(false);
    expect(result.gameTime).toBe("6:00 PM");
    expect(result.gameTzAbbrev).toBe("EST");
    expect(result.userTime).toBeNull();
    expect(result.userTzAbbrev).toBeNull();
  });

  // LA 6:00 PM PST (UTC-8) = UTC 02:00 Jan 16 = London 2:00 AM GMT (UTC+0)
  it("converts LA 6pm to London 2am in January (12h)", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "18:00",
      "America/Los_Angeles",
      "Europe/London",
      false
    );
    expect(result.isDifferentTz).toBe(true);
    expect(result.gameTime).toBe("6:00 PM");
    expect(result.gameTzAbbrev).toBe("PST");
    expect(result.userTime).toBe("2:00 AM");
    expect(result.userTzAbbrev).toBe("GMT");
  });

  // Same conversion in 24h format
  it("converts LA 18:00 to London 2:00 in January (24h)", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "18:00",
      "America/Los_Angeles",
      "Europe/London",
      true
    );
    expect(result.isDifferentTz).toBe(true);
    expect(result.gameTime).toBe("18:00");
    expect(result.gameTzAbbrev).toBe("PST");
    expect(result.userTime).toBe("02:00");
    expect(result.userTzAbbrev).toBe("GMT");
  });

  // NY 12:00 PM EST (UTC-5) = UTC 17:00 = LA 9:00 AM PST (UTC-8)
  it("converts NY noon to LA 9am in January", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "12:00",
      "America/New_York",
      "America/Los_Angeles",
      false
    );
    expect(result.isDifferentTz).toBe(true);
    expect(result.gameTime).toBe("12:00 PM");
    expect(result.gameTzAbbrev).toBe("EST");
    expect(result.userTime).toBe("9:00 AM");
    expect(result.userTzAbbrev).toBe("PST");
  });

  it("treats zones with the same offset as the same timezone", () => {
    // London and Dublin are both UTC+0 in January
    const result = convertTimeForDisplay(
      "2025-01-15",
      "12:00",
      "Europe/London",
      "Europe/Dublin",
      false
    );
    expect(result.isDifferentTz).toBe(false);
    expect(result.gameTime).toBe("12:00 PM");
    expect(result.gameTzAbbrev).toBe("GMT");
    expect(result.userTime).toBeNull();
  });

  // UTC 10:00 AM → Kolkata is UTC+5:30, so 3:30 PM IST
  it("handles half-hour offset timezones", () => {
    const result = convertTimeForDisplay(
      "2025-01-15",
      "10:00",
      "UTC",
      "Asia/Kolkata",
      false
    );
    expect(result.isDifferentTz).toBe(true);
    expect(result.gameTime).toBe("10:00 AM");
    expect(result.gameTzAbbrev).toBe("UTC");
    expect(result.userTime).toBe("3:30 PM");
  });
});

describe("getSessionInstantMs", () => {
  it("resolves a Los Angeles evening to the correct UTC instant (PDT = UTC-7)", () => {
    // 2026-06-01 19:00 PDT == 2026-06-02 02:00 UTC
    const ms = getSessionInstantMs("2026-06-01", "19:00", "America/Los_Angeles");
    expect(new Date(ms).toISOString()).toBe("2026-06-02T02:00:00.000Z");
  });

  it("orders cross-timezone sessions by true instant, not by local clock time", () => {
    // New York 20:00 EDT (00:00 UTC) is earlier than LA 19:00 PDT (02:00 UTC),
    // even though 19:00 < 20:00 as raw strings.
    const ny = getSessionInstantMs("2026-06-01", "20:00", "America/New_York");
    const la = getSessionInstantMs("2026-06-01", "19:00", "America/Los_Angeles");
    expect(ny).toBeLessThan(la);
  });

  it("defaults a missing time to start-of-day", () => {
    const ms = getSessionInstantMs("2026-06-01", null, "America/Los_Angeles");
    // 2026-06-01 00:00 PDT == 2026-06-01 07:00 UTC
    expect(new Date(ms).toISOString()).toBe("2026-06-01T07:00:00.000Z");
  });

  it("treats the local time as UTC when no timezone is given", () => {
    const ms = getSessionInstantMs("2026-06-01", "12:00", null);
    expect(new Date(ms).toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });
});

describe("getDateInTimezone", () => {
  it("returns the previous calendar date in a western timezone before its midnight", () => {
    // 2026-06-02 03:00 UTC is still 2026-06-01 20:00 in Los Angeles
    const ms = Date.UTC(2026, 5, 2, 3, 0, 0);
    expect(getDateInTimezone(ms, "America/Los_Angeles")).toBe("2026-06-01");
    expect(getDateInTimezone(ms, "Asia/Tokyo")).toBe("2026-06-02");
  });
});

// Stored zones are GM-writable through PostgREST; anything that isn't a real
// zone must behave exactly like "no timezone" instead of throwing RangeError.
const GARBAGE_ZONES = [
  "Not/A_Zone",
  "garbage",
  "America/New_York\r\nX-INJECT:1",
  "UTC\n",
  "<b>bold</b>",
  "",
];

describe("TIMEZONE_SHAPE (mirrors the SQL CHECK constraint)", () => {
  it.each([
    "America/Argentina/Buenos_Aires",
    "America/Port-au-Prince",
    "Etc/GMT+5",
    "Etc/GMT-14",
    "UTC",
    "America/Los_Angeles",
  ])("accepts %s", (tz) => {
    expect(TIMEZONE_SHAPE.test(tz)).toBe(true);
  });

  it.each([
    "UTC\n",
    "UTC\r",
    "America/New_York\r\nX-INJECT:1",
    "Europe/London;X=1",
    "A:B",
    "has space",
    "",
    "a".repeat(65),
  ])("rejects %j", (tz) => {
    expect(TIMEZONE_SHAPE.test(tz)).toBe(false);
  });
});

describe("usableTimezone", () => {
  it("returns a valid zone unchanged", () => {
    expect(usableTimezone("Europe/London")).toBe("Europe/London");
  });

  it.each([...GARBAGE_ZONES, null, undefined])("returns null for %j", (tz) => {
    expect(usableTimezone(tz)).toBeNull();
  });
});

describe("helpers with an invalid stored timezone", () => {
  const ms = Date.UTC(2026, 5, 2, 3, 0, 0);

  it.each(GARBAGE_ZONES)("getDateInTimezone(%j) behaves as with null", (tz) => {
    expect(() => getDateInTimezone(ms, tz)).not.toThrow();
    expect(getDateInTimezone(ms, tz)).toBe(getDateInTimezone(ms, null));
  });

  it.each(GARBAGE_ZONES)("getSessionInstantMs(%j) behaves as with null", (tz) => {
    expect(getSessionInstantMs("2026-06-01", "19:00", tz)).toBe(
      getSessionInstantMs("2026-06-01", "19:00", null)
    );
  });

  it.each(GARBAGE_ZONES)("convertTimeForDisplay with game zone %j shows the raw time", (tz) => {
    const result = convertTimeForDisplay("2026-01-15", "18:00", tz, "Europe/London", false);
    expect(result).toEqual({
      gameTime: "6:00 PM",
      gameTzAbbrev: "",
      userTime: null,
      userTzAbbrev: null,
      isDifferentTz: false,
    });
  });

  it.each(GARBAGE_ZONES)("convertTimeForDisplay with user zone %j skips conversion", (tz) => {
    const result = convertTimeForDisplay("2026-01-15", "18:00", "America/Los_Angeles", tz, true);
    expect(result.gameTime).toBe("18:00");
    expect(result.gameTzAbbrev).toBe("PST");
    expect(result.isDifferentTz).toBe(false);
    expect(result.userTime).toBeNull();
  });

  it.each(GARBAGE_ZONES)("formatTimezoneDisplay(%j) does not throw", (tz) => {
    expect(() => formatTimezoneDisplay(tz)).not.toThrow();
  });

  it.each(GARBAGE_ZONES)("getTimezoneAbbreviation(%j) does not throw", (tz) => {
    expect(() => getTimezoneAbbreviation(new Date(ms), tz)).not.toThrow();
  });
});
