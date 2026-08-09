'use client';

import { useMemo, useState } from 'react';
import { addMonths, startOfMonth, differenceInCalendarMonths, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateSuggestion, GameSession } from '@/types';
import { CalendarMonth } from './CalendarMonth';
import { EyebrowLabel, Panel } from '@/components/ui';
import { resolveDateState, showsPendingMark, describeDateState, type DateState } from '@/lib/schedule';
import { SCHEDULED_STAR_PATH } from '@/lib/constants';
import { LEGEND } from './calendarStyles';

/**
 * Months shown at once. The panel lives in a 340px sticky sidebar, so rendering
 * a full 13-month window made it taller than the viewport — and a sticky element
 * taller than the viewport hides its own overflow until the page bottom.
 */
const MONTHS_PER_PAGE = 3;

interface MiniCalendarProps {
  windowStart: Date;
  windowEnd: Date;
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  playDayWeekdays: Set<number>;
  specialPlayDates: Set<string>;
  weekStartDay: number;
  onCellActivate: (date: string) => void;
  subscribeLink?: React.ReactNode;
}

export function MiniCalendar({
  windowStart,
  windowEnd,
  suggestions,
  sessions,
  playDayWeekdays,
  specialPlayDates,
  weekStartDay,
  onCellActivate,
  subscribeLink,
}: MiniCalendarProps) {
  const months = useMemo(() => {
    const count = differenceInCalendarMonths(windowEnd, windowStart) + 1;
    return Array.from({ length: Math.max(1, count) }, (_, i) =>
      startOfMonth(addMonths(windowStart, i))
    );
  }, [windowStart, windowEnd]);

  const [pageStart, setPageStart] = useState(0);

  const maxStart = Math.max(0, months.length - MONTHS_PER_PAGE);
  // Derived, not stored. The window shrinks on its own as time passes
  // (windowStart is max(campaign_start, today)) and when a GM edits
  // campaign_end_date, so a stored cursor would need an effect to re-clamp it
  // and would render one wrong frame first.
  const safeStart = Math.min(pageStart, maxStart);
  const visibleMonths = months.slice(safeStart, safeStart + MONTHS_PER_PAGE);
  const showPager = months.length > MONTHS_PER_PAGE;

  const suggestionsByDate = useMemo(() => {
    const m = new Map<string, { state: DateState; showPending: boolean; title: string }>();
    suggestions.forEach((s) => {
      const state = resolveDateState(s, s.threshold);
      m.set(s.date, {
        state,
        showPending: showsPendingMark(s, state),
        title: describeDateState(s, s.threshold),
      });
    });
    return m;
  }, [suggestions]);

  const scheduledDates = useMemo(
    () => new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date)),
    [sessions]
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  const body = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <EyebrowLabel>Calendar</EyebrowLabel>
          {showPager && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="mini-calendar-prev"
                aria-label="Show earlier months"
                disabled={safeStart === 0}
                onClick={() => setPageStart(Math.max(0, safeStart - MONTHS_PER_PAGE))}
                className="inline-flex size-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="mini-calendar-next"
                aria-label="Show later months"
                disabled={safeStart >= maxStart}
                onClick={() => setPageStart(Math.min(maxStart, safeStart + MONTHS_PER_PAGE))}
                className="inline-flex size-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {subscribeLink}
      </div>
      <div className="@container">
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-2">
          {visibleMonths.map((m) => (
            <CalendarMonth
              key={m.toISOString()}
              monthStart={m}
              suggestionsByDate={suggestionsByDate}
              scheduledDates={scheduledDates}
              playDayWeekdays={playDayWeekdays}
              specialPlayDates={specialPlayDates}
              weekStartDay={weekStartDay}
              today={today}
              onCellActivate={onCellActivate}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {LEGEND.map((entry) => (
          <span key={entry.label} className="inline-flex items-center gap-1">
            {entry.swatches.map((swatch, i) => (
              <span key={i} className={`relative size-5 rounded-sm ${swatch.swatch}`}>
                {swatch.star && (
                  <svg viewBox="0 0 24 24" className={`size-full ${swatch.star}`}>
                    <path d={SCHEDULED_STAR_PATH} />
                  </svg>
                )}
                {swatch.pip === 'gold-solid' && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] size-1.75 rounded-full bg-cal-everyone" />
                )}
                {swatch.pip === 'gold-hollow' && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] size-1.75 rounded-full border-2 border-cal-everyone" />
                )}
                {swatch.pip === 'pending-on-fill' && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] size-1.75 rounded-full bg-cal-pending-on-fill" />
                )}
                {swatch.pip === 'pending-on-page' && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] size-1.75 rounded-full bg-cal-empty-text" />
                )}
              </span>
            ))}
            {entry.label}
          </span>
        ))}
      </div>
    </>
  );

  return <Panel>{body}</Panel>;
}
