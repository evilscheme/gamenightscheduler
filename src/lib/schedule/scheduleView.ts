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

/**
 * The seven states a play date can be in, worst to best. See
 * docs/superpowers/specs/2026-08-05-calendar-availability-color-scheme-design.md
 */
export type DateState =
  | 'not-enough'
  | 'unknown'
  | 'enough-if-maybes'
  | 'everyone-if-maybes'
  | 'enough'
  | 'enough-maybe-everyone'
  | 'everyone';

type Tier = 'below' | 'enough' | 'everyone';

/**
 * Resolves a date to one of seven states.
 *
 * The asymmetry is the point: positive claims read off `respondedCeiling`, which
 * EXCLUDES pending players, so silence never counts as good news. The negative
 * claim reads off `optimisticCeiling`, which INCLUDES them, so a date is called
 * dead only when it cannot be saved even if every silent player says yes.
 *
 * "We don't know yet" therefore falls out of the arithmetic — there is no
 * response-rate cutoff anywhere.
 */
export function resolveDateState(s: DateSuggestion, threshold: number): DateState {
  const total = s.totalPlayers;
  if (total === 0) return 'unknown';

  const optimisticCeiling = total - s.unavailableCount;
  if (optimisticCeiling < threshold) return 'not-enough';

  const tier = (n: number): Tier =>
    n === total ? 'everyone' : n >= threshold ? 'enough' : 'below';

  const ceiling = tier(s.availableCount + s.maybeCount);
  if (ceiling === 'below') return 'unknown';

  const floor = tier(s.availableCount);
  if (floor === 'everyone') return 'everyone';
  if (floor === 'enough') {
    return ceiling === 'everyone' ? 'enough-maybe-everyone' : 'enough';
  }
  return ceiling === 'everyone' ? 'everyone-if-maybes' : 'enough-if-maybes';
}

/** Higher is better. Used for ranking and for ordering the legend. */
export const DATE_STATE_RANK: Record<DateState, number> = {
  'everyone': 7,
  'enough-maybe-everyone': 6,
  'enough': 5,
  'everyone-if-maybes': 4,
  'enough-if-maybes': 3,
  'unknown': 2,
  'not-enough': 1,
};

/**
 * Whether to draw the "someone still hasn't answered" pip.
 *
 * Suppressed on `unknown` (gray already implies pending) and on `not-enough`
 * (the date cannot be saved, so the fact is misleading). That leaves exactly the
 * two states where "this verdict may still improve" is actionable.
 */
export function showsPendingMark(s: DateSuggestion, state: DateState): boolean {
  return (state === 'enough' || state === 'enough-if-maybes') && s.pendingCount > 0;
}

/** For a single maybe, "the maybe" reads better than "1 maybe". */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * A plain-language sentence for the cell's tooltip.
 *
 * The roster-too-small case is called out by name: an explicit GM minimum is
 * honoured as entered (a new game may not have everyone joined yet), which turns
 * the whole calendar red, and that needs an explanation the GM can actually find.
 */
export function describeDateState(s: DateSuggestion, threshold: number): string {
  const total = s.totalPlayers;
  if (total === 0) return 'No players in this game yet';
  if (threshold > total) {
    return `This game needs ${threshold} players but only ${total} have joined`;
  }

  const state = resolveDateState(s, threshold);
  const maybes = `${s.maybeCount} ${plural(s.maybeCount, 'maybe', 'maybes')}`;
  const bothMaybes = s.maybeCount === 1 ? 'the maybe works' : `${s.maybeCount === 2 ? 'both' : 'all'} maybes work`;
  const silent = s.pendingCount === 1
    ? '1 still hasn’t answered'
    : `${s.pendingCount} still haven’t answered`;

  switch (state) {
    case 'everyone':
      return `All ${total} players are available`;
    case 'enough-maybe-everyone':
      return `${s.availableCount} of ${total} available — everyone, if ${bothMaybes} out`;
    case 'everyone-if-maybes':
      return `${s.availableCount} available and ${maybes} — everyone, if ${bothMaybes} out`;
    case 'enough': {
      const base = `${s.availableCount} available, ${threshold} needed`;
      return s.pendingCount > 0 ? `${base} — ${silent}` : base;
    }
    case 'enough-if-maybes':
      return `${s.availableCount} available, ${threshold} needed — enough only if ${bothMaybes} out`;
    case 'unknown':
      return `Not enough responses yet — ${s.pendingCount} of ${total} haven’t answered`;
    case 'not-enough':
      return `Can’t happen — ${s.unavailableCount} of ${total} can’t make it, and ${threshold} are needed`;
  }
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
