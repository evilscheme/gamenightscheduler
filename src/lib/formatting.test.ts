import { describe, it, expect } from "vitest";
import { buildSessionTimeRange, formatTime, formatTimeShort } from "./formatting";

describe("formatTime", () => {
  it("returns empty string for null input", () => {
    expect(formatTime(null)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(formatTime("")).toBe("");
  });

  it("formats midnight (00:00) as 12:00 AM", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
  });

  it("formats noon (12:00) as 12:00 PM", () => {
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("formats PM times correctly", () => {
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTime("23:45")).toBe("11:45 PM");
  });

  it("formats AM times correctly", () => {
    expect(formatTime("09:15")).toBe("9:15 AM");
    expect(formatTime("01:00")).toBe("1:00 AM");
    expect(formatTime("11:59")).toBe("11:59 AM");
  });

  it("handles edge case 23:59", () => {
    expect(formatTime("23:59")).toBe("11:59 PM");
  });

  it("handles times with seconds (HH:MM:SS format)", () => {
    // Minutes part should still work correctly
    expect(formatTime("14:30:00")).toBe("2:30 PM");
    expect(formatTime("09:15:30")).toBe("9:15 AM");
  });

  it("formats 1 PM correctly", () => {
    expect(formatTime("13:00")).toBe("1:00 PM");
  });

  it("formats 11 AM correctly", () => {
    expect(formatTime("11:00")).toBe("11:00 AM");
  });
});

describe("formatTimeShort", () => {
  it("returns empty string for null input", () => {
    expect(formatTimeShort(null)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(formatTimeShort("")).toBe("");
  });

  it("omits minutes when they are :00", () => {
    expect(formatTimeShort("19:00")).toBe("7pm");
    expect(formatTimeShort("09:00")).toBe("9am");
    expect(formatTimeShort("12:00")).toBe("12pm");
    expect(formatTimeShort("00:00")).toBe("12am");
  });

  it("includes minutes when they are not :00", () => {
    expect(formatTimeShort("19:30")).toBe("7:30pm");
    expect(formatTimeShort("09:15")).toBe("9:15am");
    expect(formatTimeShort("14:45")).toBe("2:45pm");
  });

  it("handles HH:MM:SS format", () => {
    expect(formatTimeShort("19:00:00")).toBe("7pm");
    expect(formatTimeShort("19:30:00")).toBe("7:30pm");
  });

  it("uses lowercase am/pm", () => {
    expect(formatTimeShort("08:00")).toBe("8am");
    expect(formatTimeShort("20:00")).toBe("8pm");
  });
});

describe("formatTime (24h mode)", () => {
  it("formats PM times in 24-hour format", () => {
    expect(formatTime("14:30", true)).toBe("14:30");
  });

  it("formats midnight as 0:00", () => {
    expect(formatTime("00:00", true)).toBe("0:00");
  });

  it("strips leading zero from single-digit hours", () => {
    expect(formatTime("09:05", true)).toBe("9:05");
  });

  it("keeps noon as 12:00", () => {
    expect(formatTime("12:00", true)).toBe("12:00");
  });

  it("formats end-of-day 23:59", () => {
    expect(formatTime("23:59", true)).toBe("23:59");
  });

  it("returns empty string for null input", () => {
    expect(formatTime(null, true)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(formatTime("", true)).toBe("");
  });
});

describe("formatTimeShort (24h mode)", () => {
  it("formats on-the-hour times with :00", () => {
    expect(formatTimeShort("18:00", true)).toBe("18:00");
  });

  it("includes minutes when not on the hour", () => {
    expect(formatTimeShort("18:30", true)).toBe("18:30");
  });

  it("formats midnight as 0:00", () => {
    expect(formatTimeShort("00:00", true)).toBe("0:00");
  });

  it("strips leading zero from single-digit hours on the hour", () => {
    expect(formatTimeShort("09:00", true)).toBe("9:00");
  });

  it("strips leading zero from single-digit hours with minutes", () => {
    expect(formatTimeShort("09:30", true)).toBe("9:30");
  });

  it("returns empty string for null input", () => {
    expect(formatTimeShort(null, true)).toBe("");
  });
});

describe("backwards compatibility (explicit use24h=false)", () => {
  it("formatTime still returns 12h format with explicit false", () => {
    expect(formatTime("14:30", false)).toBe("2:30 PM");
  });

  it("formatTimeShort still returns compact 12h format with explicit false", () => {
    expect(formatTimeShort("19:00", false)).toBe("7pm");
  });
});

describe("buildSessionTimeRange", () => {
  it("returns null when the session has no start time", () => {
    expect(
      buildSessionTimeRange("2026-08-15", null, "11:30:00", "Asia/Tokyo", "America/Los_Angeles", false)
    ).toBeNull();
  });

  it("returns a bare compact range when the game has no timezone", () => {
    const range = buildSessionTimeRange(
      "2026-08-15",
      "08:30:00",
      "11:30:00",
      null,
      "America/Los_Angeles",
      false
    );
    expect(range).toEqual({
      gameTime: "8:30am–11:30am",
      gameTzAbbrev: null,
      viewerTime: null,
      viewerTzAbbrev: null,
    });
  });

  it("omits the timezone label when the viewer shares the game's offset", () => {
    // Amsterdam and Berlin are distinct IANA zones with an identical offset —
    // the wall clocks agree, so labelling them would be noise.
    const range = buildSessionTimeRange(
      "2026-08-16",
      "19:00:00",
      "23:00:00",
      "Europe/Amsterdam",
      "Europe/Berlin",
      false
    );
    expect(range).toEqual({
      gameTime: "7pm–11pm",
      gameTzAbbrev: null,
      viewerTime: null,
      viewerTzAbbrev: null,
    });
  });

  it("labels the game timezone and converts for a viewer in a different zone", () => {
    // 08:30 JST on Aug 15 is 16:30 UTC on Aug 14 — i.e. 9:30 AM the previous
    // day in Los Angeles. This is the row that makes the admin table look
    // mis-sorted without a label.
    const range = buildSessionTimeRange(
      "2026-08-15",
      "08:30:00",
      "11:30:00",
      "Asia/Tokyo",
      "America/Los_Angeles",
      false
    );
    expect(range?.gameTime).toBe("8:30am–11:30am");
    expect(range?.gameTzAbbrev).toBe("GMT+9");
    expect(range?.viewerTime).toBe("4:30 PM – 7:30 PM");
    expect(range?.viewerTzAbbrev).toBe("PDT");
  });

  it("converts a start-only session without inventing an end time", () => {
    const range = buildSessionTimeRange(
      "2026-08-14",
      "19:00:00",
      null,
      "America/New_York",
      "America/Los_Angeles",
      false
    );
    expect(range?.gameTime).toBe("7pm");
    expect(range?.gameTzAbbrev).toBe("EDT");
    expect(range?.viewerTime).toBe("4:00 PM");
    expect(range?.viewerTzAbbrev).toBe("PDT");
  });

  it("honours the 24-hour preference in the game-local range", () => {
    const range = buildSessionTimeRange(
      "2026-08-15",
      "08:30:00",
      "11:30:00",
      "Asia/Tokyo",
      "America/Los_Angeles",
      true
    );
    expect(range?.gameTime).toBe("8:30–11:30");
    expect(range?.viewerTime).toBe("16:30 – 19:30");
  });
});
