'use client';

import { useState } from 'react';
import Link from 'next/link';
import { parseISO } from 'date-fns';
import { CalendarClock, MapPin, StickyNote } from 'lucide-react';
import { buildSessionTimeRange } from '@/lib/formatting';
import type { UpcomingSessionRow } from '@/lib/schedule';

const SOFT_CAP = 5;

function formatSessionDate(dateStr: string): string {
  return parseISO(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Flatten a session's time range into this panel's one-line label.
 *
 * Intentional divergence from ScheduledRow (the game-page view), which only shows the
 * "for you" conversion when both start and end times exist. Here we also show it for a
 * start-only session, since this aggregate view is the one place a player sees the start
 * time in their own zone.
 */
function formatTimeRange(
  date: string,
  start: string | null,
  end: string | null,
  gameTimezone: string | null,
  userTimezone: string | null,
  use24h: boolean
): string {
  const range = buildSessionTimeRange(date, start, end, gameTimezone, userTimezone, use24h);
  if (!range) return 'time TBD';
  // Same (or equivalent) timezone: the compact local time is already "for you".
  if (!range.viewerTime) return range.gameTime;
  return `${range.gameTime} ${range.gameTzAbbrev} (${range.viewerTime} ${range.viewerTzAbbrev} for you)`;
}

interface UpcomingSessionsPanelProps {
  rows: UpcomingSessionRow[];
  use24h: boolean;
  userTimezone?: string | null;
}

export function UpcomingSessionsPanel({
  rows,
  use24h,
  userTimezone = null,
}: UpcomingSessionsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, SOFT_CAP);

  return (
    <aside data-testid="upcoming-sessions-panel" className="lg:sticky lg:top-20">
      <div className="rounded-xl bg-muted p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Upcoming Sessions</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
        ) : (
          <>
            <ul className="divide-y divide-muted-foreground/20">
              {visible.map((row) => {
                const highlighted = row.dayHighlight !== null;
                return (
                  <li key={row.session.id}>
                    <Link
                      href={`/games/${row.gameId}`}
                      data-testid="upcoming-session"
                      className={`group block py-3.5 transition-colors ${
                        highlighted ? 'border-l-2 border-primary pl-3' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {row.gameName}
                        </span>
                        {row.dayHighlight && (
                          <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            {row.dayHighlight === 'today' ? 'Today' : 'Tomorrow'}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-3 shrink-0" />
                        <span>
                          {formatSessionDate(row.session.date)} ·{' '}
                          {formatTimeRange(
                            row.session.date,
                            row.session.start_time,
                            row.session.end_time,
                            row.gameTimezone,
                            userTimezone,
                            use24h
                          )}
                        </span>
                      </div>

                      {row.session.location && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{row.session.location}</span>
                        </div>
                      )}

                      {row.session.notes && (
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <StickyNote className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">{row.session.notes}</span>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {rows.length > SOFT_CAP && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                {showAll ? 'Show less' : `Show more (${rows.length - SOFT_CAP})`}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
