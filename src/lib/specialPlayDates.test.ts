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
});
