import type { DateSuggestion, GameSession } from '@/types';
import { formatTimeShort } from '@/lib/formatting';

export type CellTintTier = 'high' | 'medium' | 'maybe' | 'warning' | 'empty';

/**
 * Returns the colour tier for a mini-calendar cell.
 * - Score weights "maybe" responses as half a yes: `(available + 0.5 * maybe) / total`.
 * - Red ("warning") is reserved for majority-unavailable dates. Cells dominated
 *   by pending responses fall through to "empty" (gray) rather than red, since
 *   "unknown" is not the same signal as "definitely not".
 */
export function getCellTintTier(s: DateSuggestion): CellTintTier {
  if (s.totalPlayers === 0) return 'empty';
  const score = (s.availableCount + 0.5 * s.maybeCount) / s.totalPlayers;
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'maybe';
  if (s.unavailableCount / s.totalPlayers >= 0.5) return 'warning';
  return 'empty';
}

export function partitionByThreshold(items: DateSuggestion[]): {
  viable: DateSuggestion[];
  belowThreshold: DateSuggestion[];
} {
  const viable: DateSuggestion[] = [];
  const belowThreshold: DateSuggestion[] = [];
  for (const s of items) {
    if (s.meetsThreshold) viable.push(s);
    else belowThreshold.push(s);
  }
  return { viable, belowThreshold };
}

/**
 * Shared core for building a "start–end" time-window phrase out of two
 * already-`formatTimeShort`-formatted strings: `"<start><separator><end>"`,
 * `"from <start>"`, `"until <end>"`, or `""` when neither is set.
 *
 * `formatTimeWindow` (below) and `otherGameSessions.formatSessionTimeWindow`
 * both implement this same start/end → phrase logic; they differ only in
 * separator spacing and in what they return for "neither set" (`null` vs
 * `""`), and each difference is pinned by that call site's own tests — so
 * this stays the one shared implementation behind two thin wrappers rather
 * than a single formatter with two different pinned outputs.
 */
export function joinTimeWindow(start: string, end: string, separator: string): string {
  if (start && end) return `${start}${separator}${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return '';
}

export function formatTimeWindow(
  earliestStartTime: string | null,
  latestEndTime: string | null,
  use24h: boolean
): string | null {
  const start = formatTimeShort(earliestStartTime, use24h);
  const end = formatTimeShort(latestEndTime, use24h);
  if (!start && !end) return null;
  return joinTimeWindow(start, end, ' – ');
}

/**
 * A session on the same day as `referenceDate` is treated as upcoming (not past).
 */
export function splitUpcomingPast(
  sessions: GameSession[],
  referenceDate: Date
): { upcoming: GameSession[]; past: GameSession[] } {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const upcoming: GameSession[] = [];
  const past: GameSession[] = [];
  for (const s of sessions) {
    const d = new Date(`${s.date}T00:00:00`);
    if (d.getTime() < ref.getTime()) past.push(s);
    else upcoming.push(s);
  }
  return { upcoming, past };
}

interface ComputeDefaultsParams {
  earliestStartTime: string | null;
  latestEndTime: string | null;
  gameDefaultStart: string; // HH:MM
  gameDefaultEnd: string; // HH:MM
}

/**
 * Start = max(gameDefault, playerConstraint); end = min(gameDefault, playerConstraint). Slices input times to HH:MM.
 * Caller is responsible for guarding against constraints that would produce start > end.
 */
export function computeDefaultSessionTimes({
  earliestStartTime,
  latestEndTime,
  gameDefaultStart,
  gameDefaultEnd,
}: ComputeDefaultsParams): { start: string; end: string } {
  let start = gameDefaultStart;
  let end = gameDefaultEnd;
  if (earliestStartTime) {
    const candidate = earliestStartTime.slice(0, 5);
    if (candidate > start) start = candidate;
  }
  if (latestEndTime) {
    const candidate = latestEndTime.slice(0, 5);
    if (candidate < end) end = candidate;
  }
  return { start, end };
}

export function getTopNDates(viable: DateSuggestion[], n: number): string[] {
  return viable.slice(0, n).map((s) => s.date);
}
