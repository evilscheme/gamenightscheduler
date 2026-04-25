'use client';

import { CellTintTier } from '@/lib/scheduleView';
import { useHoverSync } from './HoverSyncContext';

interface CalendarCellProps {
  date: string | null;
  day: number | null;
  isPlayDay: boolean;
  isScheduled: boolean;
  tier: CellTintTier | null;
  onActivate?: (date: string) => void;
}

const TIER_BG: Record<CellTintTier, string> = {
  high: 'bg-cal-available-bg text-cal-available-text',
  medium: 'bg-cal-available-bg/60 text-cal-available-text',
  maybe: 'bg-cal-maybe-bg text-cal-maybe-text',
  warning: 'bg-cal-unavailable-bg/60 text-cal-unavailable-text',
  empty: 'bg-muted/40 text-muted-foreground',
};

export function CalendarCell({ date, day, isPlayDay, isScheduled, tier, onActivate }: CalendarCellProps) {
  const { hoveredDate, setHoveredDate } = useHoverSync();
  const hovered = !!date && hoveredDate === date;

  if (day === null || !date) {
    return <div aria-hidden className="aspect-square" />;
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

  if (isScheduled) {
    return (
      <button
        type="button"
        onClick={() => onActivate?.(date)}
        onMouseEnter={() => setHoveredDate(date)}
        onMouseLeave={() => setHoveredDate(null)}
        className={`aspect-square rounded-sm flex items-center justify-center bg-cal-scheduled-bg text-cal-scheduled-text font-mono text-[10px] font-bold ${hovered ? 'outline outline-2 outline-primary' : ''}`}
        aria-label={`Scheduled on ${date}`}
      >
        ★
      </button>
    );
  }

  const tintCls = tier ? TIER_BG[tier] : TIER_BG.empty;

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
