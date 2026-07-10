'use client';

import { CellTintTier } from '@/lib/schedule';
import { useHoverSync } from './HoverSyncContext';
import { CALENDAR_STYLES } from './calendarStyles';

interface CalendarCellProps {
  date: string | null;
  day: number | null;
  isPlayDay: boolean;
  isScheduled: boolean;
  isPast: boolean;
  tier: CellTintTier | null;
  onActivate?: (date: string) => void;
}

export function CalendarCell({ date, day, isPlayDay, isScheduled, isPast, tier, onActivate }: CalendarCellProps) {
  const { hoveredDate, setHoveredDate } = useHoverSync();
  const hovered = !!date && hoveredDate === date;

  if (day === null || !date) {
    return <div aria-hidden className="aspect-square" />;
  }

  if (isScheduled) {
    return (
      <button
        type="button"
        onClick={() => onActivate?.(date)}
        onMouseEnter={() => setHoveredDate(date)}
        onMouseLeave={() => setHoveredDate(null)}
        className={`aspect-square rounded-sm flex items-center justify-center ${CALENDAR_STYLES.scheduled.className} font-mono text-[10px] font-bold ${hovered ? 'outline outline-2 outline-primary' : ''}`}
        aria-label={`Scheduled on ${date}`}
        data-testid="calendar-cell"
        data-date={date}
      >
        ★
      </button>
    );
  }

  if (!isPlayDay) {
    return (
      <div
        className="aspect-square rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)] opacity-40 flex items-center justify-center text-[9px] text-muted-foreground"
        aria-hidden
      >
        {day}
      </div>
    );
  }

  const tintCls = isPast
    ? CALENDAR_STYLES.past.className
    : CALENDAR_STYLES[tier ?? 'empty'].className;

  return (
    <button
      type="button"
      onClick={() => onActivate?.(date)}
      onMouseEnter={() => setHoveredDate(date)}
      onMouseLeave={() => setHoveredDate(null)}
      className={`relative aspect-square rounded-sm flex items-center justify-center font-mono text-[10px] font-semibold ${tintCls} ${hovered ? 'outline outline-2 outline-primary' : ''}`}
      aria-label={date}
      data-testid="calendar-cell"
      data-date={date}
    >
      {day}
    </button>
  );
}
