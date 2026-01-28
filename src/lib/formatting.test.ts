import { describe, it, expect } from "vitest";
import { formatTime, formatTimeShort } from "./formatting";

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
