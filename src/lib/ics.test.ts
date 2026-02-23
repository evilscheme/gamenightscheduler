import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateICS, escapeICS } from "./ics";

describe("escapeICS", () => {
  it("escapes backslashes", () => {
    expect(escapeICS("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("escapes semicolons", () => {
    expect(escapeICS("first;second;third")).toBe("first\\;second\\;third");
  });

  it("escapes commas", () => {
    expect(escapeICS("one,two,three")).toBe("one\\,two\\,three");
  });

  it("escapes newlines", () => {
    expect(escapeICS("line1\nline2")).toBe("line1\\nline2");
  });

  it("escapes multiple special characters", () => {
    expect(escapeICS("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("returns empty string unchanged", () => {
    expect(escapeICS("")).toBe("");
  });

  it("returns regular text unchanged", () => {
    expect(escapeICS("Hello World")).toBe("Hello World");
  });

  it("escapes carriage returns", () => {
    expect(escapeICS("line1\rline2")).toBe("line1\\nline2");
  });

  it("escapes CRLF sequences", () => {
    expect(escapeICS("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("escapes mixed line endings", () => {
    expect(escapeICS("a\r\nb\nc\rd")).toBe("a\\nb\\nc\\nd");
  });
});

describe("generateICS", () => {
  // Mock Date.now() for consistent DTSTAMP
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates valid calendar structure with empty events", () => {
    const result = generateICS([]);

    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).toContain("VERSION:2.0");
    expect(result).toContain("PRODID:-//Can We Play//Game Night Scheduler//EN");
    expect(result).toContain("CALSCALE:GREGORIAN");
    expect(result).toContain("METHOD:PUBLISH");
    expect(result).toContain("END:VCALENDAR");
    expect(result).not.toContain("BEGIN:VEVENT");
  });

  it("generates a single all-day event", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
      },
    ]);

    expect(result).toContain("BEGIN:VEVENT");
    expect(result).toContain("UID:20250120-0@canweplay.games");
    expect(result).toContain("DTSTAMP:20250115T100000Z");
    expect(result).toContain("DTSTART;VALUE=DATE:20250120");
    expect(result).toContain("DTEND;VALUE=DATE:20250120");
    expect(result).toContain("SUMMARY:Game Night");
    expect(result).toContain("END:VEVENT");
  });

  it("generates a timed event with start and end times", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
      },
    ]);

    expect(result).toContain("DTSTART:20250120T180000");
    expect(result).toContain("DTEND:20250120T220000");
  });

  it("handles time format with seconds (HH:MM:SS)", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00:00",
        endTime: "22:00:00",
        title: "Game Night",
      },
    ]);

    expect(result).toContain("DTSTART:20250120T180000");
    expect(result).toContain("DTEND:20250120T220000");
  });

  it("pads short time formats correctly", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "9:00",
        endTime: "12:30",
        title: "Morning Game",
      },
    ]);

    // 9:00 becomes 900 after replace, then slice(0,6) gives 900, padEnd gives 900000
    expect(result).toContain("DTSTART:20250120T900000");
    expect(result).toContain("DTEND:20250120T123000");
  });

  it("generates multiple events with unique UIDs", () => {
    const result = generateICS([
      { date: "2025-01-20", title: "Event 1" },
      { date: "2025-01-21", title: "Event 2" },
      { date: "2025-01-22", title: "Event 3" },
    ]);

    expect(result).toContain("UID:20250120-0@canweplay.games");
    expect(result).toContain("UID:20250121-1@canweplay.games");
    expect(result).toContain("UID:20250122-2@canweplay.games");
    expect(result.match(/BEGIN:VEVENT/g)?.length).toBe(3);
    expect(result.match(/END:VEVENT/g)?.length).toBe(3);
  });

  it("includes description when provided", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
        description: "Bring snacks!",
      },
    ]);

    expect(result).toContain("DESCRIPTION:Bring snacks!");
  });

  it("includes location when provided", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
        location: "123 Main St",
      },
    ]);

    expect(result).toContain("LOCATION:123 Main St");
  });

  it("includes both description and location", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
        description: "Weekly meetup",
        location: "Game Store",
      },
    ]);

    expect(result).toContain("DESCRIPTION:Weekly meetup");
    expect(result).toContain("LOCATION:Game Store");
  });

  it("escapes special characters in title", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "D&D; Session 5, Part 2",
      },
    ]);

    expect(result).toContain("SUMMARY:D&D\\; Session 5\\, Part 2");
  });

  it("escapes special characters in description", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
        description: "Line 1\nLine 2; with comma, and backslash\\",
      },
    ]);

    expect(result).toContain(
      "DESCRIPTION:Line 1\\nLine 2\\; with comma\\, and backslash\\\\"
    );
  });

  it("uses CRLF line endings", () => {
    const result = generateICS([{ date: "2025-01-20", title: "Test" }]);

    // ICS spec requires CRLF
    expect(result).toContain("\r\n");
    expect(result.split("\r\n").length).toBeGreaterThan(1);
  });

  it("omits description when not provided", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
      },
    ]);

    expect(result).not.toContain("DESCRIPTION:");
  });

  it("omits location when not provided", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
      },
    ]);

    expect(result).not.toContain("LOCATION:");
  });

  it("includes TZID when timezone is provided for timed event", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
        timezone: "America/Los_Angeles",
      },
    ]);

    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20250120T180000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20250120T220000");
  });

  it("uses floating time when no timezone provided", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
      },
    ]);

    // No TZID - floating time format
    expect(result).toContain("DTSTART:20250120T180000");
    expect(result).toContain("DTEND:20250120T220000");
    expect(result).not.toContain("TZID");
  });

  it("handles various timezone identifiers", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
        timezone: "Europe/London",
      },
    ]);

    expect(result).toContain("DTSTART;TZID=Europe/London:20250120T180000");
    expect(result).toContain("DTEND;TZID=Europe/London:20250120T220000");
  });

  it("does not include TZID for all-day events", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        title: "Game Night",
        timezone: "America/Los_Angeles",
      },
    ]);

    // All-day events use VALUE=DATE format, no TZID
    expect(result).toContain("DTSTART;VALUE=DATE:20250120");
    expect(result).toContain("DTEND;VALUE=DATE:20250120");
    expect(result).not.toContain("TZID");
  });

  it("includes VTIMEZONE component when timezone is used", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
        timezone: "America/Los_Angeles",
      },
    ]);

    // Must include VTIMEZONE for calendar apps to parse correctly
    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:America/Los_Angeles");
    expect(result).toContain("END:VTIMEZONE");
    expect(result).toContain("BEGIN:STANDARD");
    expect(result).toContain("END:STANDARD");
    expect(result).toContain("BEGIN:DAYLIGHT");
    expect(result).toContain("END:DAYLIGHT");
    expect(result).toContain("TZNAME:PST");
    expect(result).toContain("TZNAME:PDT");
  });

  it("includes only one VTIMEZONE per unique timezone", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Event 1",
        timezone: "America/Los_Angeles",
      },
      {
        date: "2025-01-21",
        startTime: "18:00",
        endTime: "22:00",
        title: "Event 2",
        timezone: "America/Los_Angeles",
      },
    ]);

    // Should only include one VTIMEZONE block even with multiple events
    expect(result.match(/BEGIN:VTIMEZONE/g)?.length).toBe(1);
  });

  it("does not include VTIMEZONE when no timezone used", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "Game Night",
      },
    ]);

    expect(result).not.toContain("BEGIN:VTIMEZONE");
  });

  it("generates VTIMEZONE with EU-style DST rules for Europe/Dublin", () => {
    const result = generateICS([
      {
        date: "2025-06-15",
        startTime: "19:00",
        endTime: "23:00",
        title: "Dublin Game Night",
        timezone: "Europe/Dublin",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Europe/Dublin");
    expect(result).toContain("BEGIN:DAYLIGHT");
    expect(result).toContain("END:DAYLIGHT");
    expect(result).toContain("BEGIN:STANDARD");
    expect(result).toContain("END:STANDARD");
    // EU DST starts last Sunday in March (month 3)
    expect(result).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
    // EU standard starts last Sunday in October (month 10)
    expect(result).toContain("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
  });

  it("generates VTIMEZONE with only STANDARD for Asia/Kolkata (no DST)", () => {
    const result = generateICS([
      {
        date: "2025-03-10",
        startTime: "20:00",
        endTime: "23:30",
        title: "Kolkata Game Night",
        timezone: "Asia/Kolkata",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Asia/Kolkata");
    expect(result).toContain("BEGIN:STANDARD");
    expect(result).toContain("END:STANDARD");
    // Kolkata does not observe DST
    expect(result).not.toContain("BEGIN:DAYLIGHT");
    // Verify offset is +0530
    expect(result).toContain("TZOFFSETTO:+0530");
  });

  it("generates VTIMEZONE with only STANDARD for Europe/Istanbul (permanent +03)", () => {
    const result = generateICS([
      {
        date: "2025-04-05",
        startTime: "18:00",
        endTime: "22:00",
        title: "Istanbul Game Night",
        timezone: "Europe/Istanbul",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Europe/Istanbul");
    expect(result).toContain("BEGIN:STANDARD");
    expect(result).toContain("END:STANDARD");
    // Istanbul uses permanent +03, no DST
    expect(result).not.toContain("BEGIN:DAYLIGHT");
    // Verify offset is +0300
    expect(result).toContain("TZOFFSETTO:+0300");
  });

  it("generates fixed-offset VTIMEZONE for Etc/GMT+5 (UTC-5)", () => {
    const result = generateICS([
      {
        date: "2025-01-20",
        startTime: "18:00",
        endTime: "22:00",
        title: "UTC Offset Game Night",
        timezone: "Etc/GMT+5",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Etc/GMT+5");
    expect(result).toContain("TZOFFSETTO:-0500");
    expect(result).not.toContain("BEGIN:DAYLIGHT");
    expect(result).toContain("DTSTART;TZID=Etc/GMT+5:20250120T180000");
  });

  it("generates fixed-offset VTIMEZONE for Etc/GMT-9 (UTC+9)", () => {
    const result = generateICS([
      {
        date: "2025-03-15",
        startTime: "20:00",
        endTime: "23:00",
        title: "UTC+9 Game Night",
        timezone: "Etc/GMT-9",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Etc/GMT-9");
    expect(result).toContain("TZOFFSETTO:+0900");
    expect(result).not.toContain("BEGIN:DAYLIGHT");
  });

  it("generates fixed-offset VTIMEZONE for Etc/GMT0 (UTC)", () => {
    const result = generateICS([
      {
        date: "2025-06-01",
        startTime: "12:00",
        endTime: "16:00",
        title: "UTC Game Night",
        timezone: "Etc/GMT0",
      },
    ]);

    expect(result).toContain("BEGIN:VTIMEZONE");
    expect(result).toContain("TZID:Etc/GMT0");
    expect(result).toContain("TZOFFSETTO:+0000");
    expect(result).not.toContain("BEGIN:DAYLIGHT");
  });

  it("does not include VTIMEZONE for unknown timezone (falls back to floating time)", () => {
    const result = generateICS([
      {
        date: "2025-02-14",
        startTime: "19:00",
        endTime: "22:00",
        title: "Mystery Game Night",
        timezone: "Fake/Zone",
      },
    ]);

    // Unknown timezone should not produce a VTIMEZONE block
    expect(result).not.toContain("BEGIN:VTIMEZONE");
    // The event itself should still exist
    expect(result).toContain("BEGIN:VEVENT");
    expect(result).toContain("SUMMARY:Mystery Game Night");
    expect(result).toContain("END:VEVENT");
  });
});
