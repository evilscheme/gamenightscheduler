import { describe, it, expect } from "vitest";
import { mergeSpecialPlayDates, type GamePlayDateEntry } from "./specialPlayDates";

describe("mergeSpecialPlayDates", () => {
  // TEMPORARY: Remove these tests when legacy support is dropped (step 3 of migration)

  it("returns dates from legacy array only", () => {
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-05"],
      []
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: null },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("returns dates from new table only", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-01", note: "Only after 2pm" },
      { date: "2026-03-05", note: null },
    ];
    const result = mergeSpecialPlayDates([], tableRows);
    expect(result).toEqual([
      { date: "2026-03-01", note: "Only after 2pm" },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("deduplicates dates present in both sources, preferring table (has notes)", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-01", note: "Moved to 5pm" },
    ];
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-05"],
      tableRows
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: "Moved to 5pm" },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("returns empty array when both sources are empty", () => {
    const result = mergeSpecialPlayDates([], []);
    expect(result).toEqual([]);
  });

  it("sorts results by date", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-10", note: null },
    ];
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-15"],
      tableRows
    );
    expect(result.map((d) => d.date)).toEqual([
      "2026-03-01",
      "2026-03-10",
      "2026-03-15",
    ]);
  });

  it("handles duplicate dates in legacy array", () => {
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-01", "2026-03-05"],
      []
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: null },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("table entry with null note still overrides legacy entry", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-01", note: null },
    ];
    const result = mergeSpecialPlayDates(
      ["2026-03-01"],
      tableRows
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: null },
    ]);
    expect(result.length).toBe(1); // No duplicate
  });

  it("handles many dates from both sources", () => {
    const legacy = Array.from({ length: 50 }, (_, i) =>
      `2026-03-${String(i + 1).padStart(2, "0")}`
    ).filter((d) => d <= "2026-03-31");
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-04-01", note: "April fools" },
      { date: "2026-03-15", note: "Override" },
    ];
    const result = mergeSpecialPlayDates(legacy, tableRows);

    // Should have 31 March dates + 1 April date = 32 unique
    expect(result.length).toBe(32);
    // March 15 should have the note from table
    const march15 = result.find((d) => d.date === "2026-03-15");
    expect(march15?.note).toBe("Override");
    // April 1 should be at the end
    expect(result[result.length - 1].date).toBe("2026-04-01");
  });
});
