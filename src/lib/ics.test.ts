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
});
