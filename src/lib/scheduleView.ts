import type { DateSuggestion, GameSession } from '@/types';
import { formatTimeShort } from '@/lib/formatting';

export type CellTintTier = 'high' | 'medium' | 'maybe' | 'warning' | 'conflict' | 'empty';

export function getCellTintTier(s: DateSuggestion): CellTintTier {
  if (s.totalPlayers === 0) return 'empty';
  const pct = s.availableCount / s.totalPlayers;
  if (pct >= 0.8) return 'high';
  if (pct >= 0.6) return 'medium';
  if (pct >= 0.4 || s.maybeCount > 0) return 'maybe';
  if (s.availableCount > 0) return 'warning';
  return 'conflict';
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

export function formatTimeWindow(
  earliestStartTime: string | null,
  latestEndTime: string | null,
  use24h: boolean
): string | null {
  if (!earliestStartTime && !latestEndTime) return null;
  if (earliestStartTime && latestEndTime) {
    return `${formatTimeShort(earliestStartTime, use24h)} – ${formatTimeShort(latestEndTime, use24h)}`;
  }
  if (earliestStartTime) return `from ${formatTimeShort(earliestStartTime, use24h)}`;
  return `until ${formatTimeShort(latestEndTime!, use24h)}`;
}

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
