/**
 * Dual-source special play dates utilities.
 *
 * TEMPORARY: This module supports reading from both the legacy
 * `games.special_play_dates` array column AND the new `game_play_dates` table.
 * Remove legacy support after data migration (step 3).
 */

export interface GamePlayDateEntry {
  date: string; // YYYY-MM-DD
  note: string | null;
}

/**
 * Merge special play dates from legacy array and new table, deduplicating by date.
 * When a date exists in both sources, the table entry wins (it may have a note).
 * Results are sorted by date ascending.
 */
export function mergeSpecialPlayDates(
  legacyDates: string[],
  tableRows: GamePlayDateEntry[]
): GamePlayDateEntry[] {
  const dateMap = new Map<string, GamePlayDateEntry>();

  // Legacy dates first (no notes)
  for (const date of legacyDates) {
    dateMap.set(date, { date, note: null });
  }

  // Table rows override legacy (may have notes)
  for (const row of tableRows) {
    dateMap.set(row.date, { date: row.date, note: row.note });
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
