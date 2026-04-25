'use client';

import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
} from 'date-fns';
import { CalendarCell } from './CalendarCell';
import { CellTintTier } from '@/lib/scheduleView';

interface CalendarMonthProps {
  monthStart: Date;
  suggestionsByDate: Map<string, { tier: CellTintTier }>;
  scheduledDates: Set<string>;
  playDayWeekdays: Set<number>;
  specialPlayDates: Set<string>;
  weekStartDay: number;
  onCellActivate: (date: string) => void;
}

export function CalendarMonth({
  monthStart,
  suggestionsByDate,
  scheduledDates,
  playDayWeekdays,
  specialPlayDates,
  weekStartDay,
  onCellActivate,
}: CalendarMonthProps) {
  const first = startOfMonth(monthStart);
  const last = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: first, end: last });
  const leadingBlanks = (getDay(first) - weekStartDay + 7) % 7;

  const dowLabels =
    weekStartDay === 1
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="rounded-md bg-background/40 p-2">
      <p className="mb-1 text-xs font-semibold text-card-foreground">{format(first, 'MMMM yyyy')}</p>
      <div className="grid grid-cols-7 gap-0.75 mb-1">
        {dowLabels.map((d, i) => (
          <div key={i} className="text-center font-mono text-[9px] text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.75">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <CalendarCell key={`lead-${i}`} date={null} day={null} isPlayDay={false} isScheduled={false} tier={null} />
        ))}
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const info = suggestionsByDate.get(key);
          const isPlayDay = playDayWeekdays.has(getDay(d)) || specialPlayDates.has(key);
          return (
            <CalendarCell
              key={key}
              date={key}
              day={d.getDate()}
              isPlayDay={isPlayDay}
              isScheduled={scheduledDates.has(key)}
              tier={info?.tier ?? null}
              onActivate={onCellActivate}
            />
          );
        })}
      </div>
    </div>
  );
}
