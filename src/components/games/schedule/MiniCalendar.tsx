'use client';

import { useMemo } from 'react';
import { addMonths, startOfMonth, differenceInCalendarMonths } from 'date-fns';
import type { DateSuggestion, GameSession } from '@/types';
import { CalendarMonth } from './CalendarMonth';
import { EyebrowLabel } from '@/components/ui';
import { getCellTintTier, CellTintTier } from '@/lib/scheduleView';

interface MiniCalendarProps {
  windowStart: Date;
  windowEnd: Date;
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  playDayWeekdays: Set<number>;
  specialPlayDates: Set<string>;
  weekStartDay: number;
  topRanked: string[];
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
  topRanked,
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
    const m = new Map<string, { tier: CellTintTier; rank: number | null }>();
    suggestions.forEach((s) => {
      const rankIdx = topRanked.indexOf(s.date);
      m.set(s.date, {
        tier: getCellTintTier(s),
        rank: rankIdx >= 0 && rankIdx < 5 ? rankIdx + 1 : null,
      });
    });
    return m;
  }, [suggestions, topRanked]);

  const scheduledDates = useMemo(
    () => new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date)),
    [sessions]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <EyebrowLabel>Campaign window</EyebrowLabel>
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
            onCellActivate={onCellActivate}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-cal-available-bg" /> Most available</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-cal-maybe-bg" /> Mixed</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-cal-unavailable-bg/60" /> Conflict</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-cal-scheduled-bg" /> ★ Scheduled</span>
      </div>
    </div>
  );
}
