'use client';

import type { DateState } from '@/lib/schedule';
import { useHoverSync } from './HoverSyncContext';
import { CELL_STYLES, PAST_STYLE, type PipKind } from './calendarStyles';

interface CalendarCellProps {
  date: string | null;
  day: number | null;
  isPlayDay: boolean;
  isScheduled: boolean;
  isPast: boolean;
  state: DateState | null;
  /** Someone in the group still hasn't answered for this date. */
  showPending: boolean;
  /** Plain-language explanation, shown on hover. From `describeDateState`. */
  title: string;
  onActivate?: (date: string) => void;
}

/**
 * Sized as a percentage of the cell so one rule holds from the 31.4px phone
 * floor to the 61.9px tablet maximum.
 */
function Pip({ kind, onFill }: { kind: PipKind | 'pending'; onFill: boolean }) {
  if (kind === 'none') return null;
  const shape = 'absolute left-1/2 -translate-x-1/2 bottom-[9%] w-[20%] aspect-square rounded-full z-20';
  if (kind === 'gold-solid') return <span aria-hidden className={`${shape} bg-cal-everyone`} />;
  if (kind === 'gold-hollow') {
    return <span aria-hidden className={`${shape} border-[1.5px] border-cal-everyone`} />;
  }
  // Adaptive grey: the blank cell's background on a filled cell, its ink on an outlined one.
  return (
    <span
      aria-hidden
      className={`${shape} ${onFill ? 'bg-cal-pending-on-fill' : 'bg-cal-empty-text'}`}
    />
  );
}

/** Fills the cell. */
function ScheduledStar() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="absolute inset-0 size-full fill-primary z-0"
    >
      <path d="M12 1.6l3.09 6.9 7.41.72-5.6 5.05 1.62 7.33L12 17.9l-6.52 3.7 1.62-7.33-5.6-5.05 7.41-.72z" />
    </svg>
  );
}

export function CalendarCell({
  date, day, isPlayDay, isScheduled, isPast, state, showPending, title, onActivate,
}: CalendarCellProps) {
  const { hoveredDate, setHoveredDate } = useHoverSync();
  const hovered = !!date && hoveredDate === date;

  if (day === null || !date) {
    return <div aria-hidden className="aspect-square" />;
  }

  const shell =
    'relative aspect-square rounded-sm flex items-center justify-center font-mono ' +
    'text-[10px] font-semibold overflow-hidden';
  const ring = hovered ? 'outline outline-2 outline-primary' : '';

  const handlers = {
    onClick: () => onActivate?.(date),
    onMouseEnter: () => setHoveredDate(date),
    onMouseLeave: () => setHoveredDate(null),
  };

  // A locked-in date stops being a question about availability, so it replaces
  // the ladder rendering entirely rather than layering on top of it.
  if (isScheduled) {
    const scheduledLabel = title ? `Scheduled on ${date} — ${title}` : `Scheduled on ${date}`;
    return (
      <button
        type="button"
        {...handlers}
        className={`${shell} ${ring} bg-transparent`}
        aria-label={scheduledLabel}
        data-testid="calendar-cell"
        data-date={date}
        data-state="scheduled"
      >
        <ScheduledStar />
        <span className="relative z-10 font-bold text-primary-foreground">{day}</span>
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

  const resolved: DateState = state ?? 'unknown';
  const style = CELL_STYLES[resolved];
  const fill = isPast ? PAST_STYLE : style.fill;
  const label = title ? `${date} — ${title}` : date;

  return (
    <button
      type="button"
      {...handlers}
      className={`${shell} ${fill} ${ring}`}
      aria-label={label}
      data-testid="calendar-cell"
      data-date={date}
      data-state={isPast ? 'past' : resolved}
    >
      {!isPast && <Pip kind={style.pip} onFill={style.filled} />}
      {!isPast && showPending && <Pip kind="pending" onFill={style.filled} />}
      <span className="relative z-10">{day}</span>
    </button>
  );
}
