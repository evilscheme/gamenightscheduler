import { describe, it, expect } from "vitest";
import { getTimeOptions } from "./timeOptions";

describe("getTimeOptions", () => {
  it("returns 48 half-hour slots", () => {
    expect(getTimeOptions(false)).toHaveLength(48);
  });

  it("uses 24-hour labels when use24h is true", () => {
    const opts = getTimeOptions(true);
    expect(opts[0]).toEqual({ value: "00:00", label: "0:00" });
    expect(opts[39]).toEqual({ value: "19:30", label: "19:30" });
  });

  it("uses 12-hour AM/PM labels when use24h is false", () => {
    const opts = getTimeOptions(false);
    expect(opts[0]).toEqual({ value: "00:00", label: "12:00 AM" });
    expect(opts[39]).toEqual({ value: "19:30", label: "7:30 PM" });
  });
});
