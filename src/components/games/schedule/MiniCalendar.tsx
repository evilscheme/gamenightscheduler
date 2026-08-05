'use client';

import { useMemo } from 'react';
import { addMonths, startOfMonth, differenceInCalendarMonths, startOfDay } from 'date-fns';
import type { DateSuggestion, GameSession } from '@/types';
import { CalendarMonth } from './CalendarMonth';
import { EyebrowLabel, Panel } from '@/components/ui';
import { resolveDateState, showsPendingMark, describeDateState, type DateState } from '@/lib/schedule';
import { LEGEND } from './calendarStyles';

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
        <EyebrowLabel>Calendar</EyebrowLabel>
        {subscribeLink}
      </div>
      <div className="@container">
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-2">
          {months.map((m) => (
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
            <span className={`relative size-4 rounded-sm ${entry.swatch}`}>
              {entry.pip === 'gold-solid' && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] w-[20%] aspect-square rounded-full bg-cal-everyone" />
              )}
              {entry.pip === 'gold-hollow' && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] w-[20%] aspect-square rounded-full border-[1.5px] border-cal-everyone" />
              )}
              {entry.pip === 'gray' && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-[9%] w-[20%] aspect-square rounded-full bg-cal-pending-on-fill" />
              )}
            </span>
            {entry.label}
          </span>
        ))}
      </div>
    </>
  );

  return <Panel>{body}</Panel>;
}
