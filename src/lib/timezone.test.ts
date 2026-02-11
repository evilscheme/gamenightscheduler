import { describe, it, expect } from "vitest";
import {
  isValidTimezone,
  formatTimezoneDisplay,
  getTimezoneAbbreviation,
  convertTimeForDisplay,
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
    // GMT in winter, BST in summer
    expect(result).toMatch(/^London \((GMT|BST)\)$/);
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
