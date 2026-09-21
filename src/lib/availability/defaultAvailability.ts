import type { AvailabilityStatus } from "@/types";
import type { AvailabilityEntry } from "./availabilityStatus";
import { isEligiblePlayDate } from "./eligibleDates";

/** A user's standing default for one weekday. Mirrors a per-date entry minus the date. */
export interface WeekdayDefault {
  status: AvailabilityStatus;
  comment: string | null;
  available_after: string | null; // HH:MM:SS
  available_until: string | null; // HH:MM:SS
}

/** A single per-date availability row the apply action will write. */
export interface DefaultEntryToWrite {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  comment: string | null;
  available_after: string | null;
  available_until: string | null;
}

/**
 * The two halves of an "apply my defaults" run, kept apart because they carry
 * different consent: `toFill` is free (nothing is lost), `toReplace` destroys
 * an answer the player already gave and is only written when they say so.
 */
export interface DefaultEntriesPlan {
  /** Eligible dates that are blank — safe to write without asking. */
  toFill: DefaultEntryToWrite[];
  /**
   * Eligible dates already answered, where the answer differs from the
   * weekday default. Dates that already match the default are in neither
   * list: rewriting them is a no-op, and counting them would inflate the
   * "N dates don't match" prompt with dates that do.
   */
  toReplace: DefaultEntryToWrite[];
}

interface ComputeDefaultEntriesParams {
  /** User's weekday defaults keyed by day_of_week (0=Sun…6=Sat). Missing key = no default. */
  defaults: Record<number, WeekdayDefault>;
  /** Every calendar date in the scheduling window (e.g. eachDayOfInterval(start, end)). */
  dates: Date[];
  playDays: number[];
  extraPlayDates: string[];
  existingAvailability: Record<string, AvailabilityEntry>;
  today: Date;
  formatDate: (date: Date) => string;
  getDayOfWeek: (date: Date) => number;
  /**
   * @deprecated no longer used — the past/eligibility check now lives in
   * `eligibleDates.ts`. Kept optional so existing callers/tests can still
   * pass it.
   */
  isBefore?: (date: Date, dateToCompare: Date) => boolean;
}

/**
 * Times reach us in two shapes: "HH:MM:SS" from Postgres (and from the
 * defaults editor, which appends ":00") but "HH:MM" from an optimistic row
 * written by a single-date toggle before the refetch lands. Compare at
 * minute precision so a date that already matches its default isn't reported
 * as a mismatch purely because its cached row hasn't round-tripped yet.
 */
function sameTime(a: string | null, b: string | null): boolean {
  return (a?.slice(0, 5) ?? null) === (b?.slice(0, 5) ?? null);
}

/** An all-whitespace note and no note are the same note. */
function normalizeComment(comment: string | null): string | null {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : null;
}

/** Whether a date's existing entry already says exactly what the default says. */
function matchesDefault(entry: AvailabilityEntry, def: WeekdayDefault): boolean {
  return (
    entry.status === def.status &&
    normalizeComment(entry.comment) === normalizeComment(def.comment) &&
    sameTime(entry.available_after, def.available_after) &&
    sameTime(entry.available_until, def.available_until)
  );
}

/**
 * Split every eligible date into what applying the user's defaults would fill
 * versus what it would overwrite. A date is eligible when it's a regular play
 * day or extra date, isn't past, and its weekday has a configured default.
 */
export function planDefaultEntries({
  defaults,
  dates,
  playDays,
  extraPlayDates,
  existingAvailability,
  today,
  formatDate,
  getDayOfWeek,
}: ComputeDefaultEntriesParams): DefaultEntriesPlan {
  const plan: DefaultEntriesPlan = { toFill: [], toReplace: [] };

  for (const date of dates) {
    // Play-day-or-extra and not past. Deliberately NOT passing
    // `existingAvailability` — already-answered dates are sorted below rather
    // than dropped, which is the whole point of the plan.
    if (!isEligiblePlayDate({ date, playDays, extraPlayDates, today })) {
      continue;
    }

    // The weekday must have a configured default.
    const dayOfWeek = getDayOfWeek(date);
    const def = defaults[dayOfWeek];
    if (!def) continue;

    const dateStr = formatDate(date);
    const existing = existingAvailability[dateStr];

    if (existing && matchesDefault(existing, def)) continue;

    const entry: DefaultEntryToWrite = {
      date: dateStr,
      status: def.status,
      comment: def.comment,
      available_after: def.available_after,
      available_until: def.available_until,
    };

    if (existing) {
      plan.toReplace.push(entry);
    } else {
      plan.toFill.push(entry);
    }
  }

  return plan;
}

/**
 * Compute the per-date entries to write when applying a user's default availability
 * to a game. Non-destructive: only blank, future, play/extra dates whose weekday has a
 * configured default are returned.
 */
export function computeDefaultEntries(params: ComputeDefaultEntriesParams): DefaultEntryToWrite[] {
  return planDefaultEntries(params).toFill;
}
