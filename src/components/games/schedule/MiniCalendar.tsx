'use client';

import { useMemo } from 'react';
import { addMonths, startOfMonth, differenceInCalendarMonths, startOfDay } from 'date-fns';
import type { DateSuggestion, GameSession } from '@/types';
import { CalendarMonth } from './CalendarMonth';
import { EyebrowLabel, Panel } from '@/components/ui';
import { getCellTintTier, CellTintTier } from '@/lib/scheduleView';
import { CALENDAR_STYLES, LEGEND_ORDER } from './calendarStyles';

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
    const m = new Map<string, { tier: CellTintTier }>();
    suggestions.forEach((s) => {
      m.set(s.date, { tier: getCellTintTier(s) });
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {LEGEND_ORDER.map((state) => (
          <span key={state} className="inline-flex items-center gap-1">
            <span className={`size-2 rounded-sm ${CALENDAR_STYLES[state].className}`} />
            {CALENDAR_STYLES[state].label}
          </span>
        ))}
      </div>
    </>
  );

  return <Panel>{body}</Panel>;
}
