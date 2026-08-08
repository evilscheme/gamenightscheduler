'use client';

import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import type { DateSuggestion } from '@/types';
import { describeDateState } from '@/lib/schedule';
import { useHoverPopover } from '@/hooks/useHoverPopover';
import { useHoverSync } from './HoverSyncContext';

interface CalendarHoverPopoverProps {
  suggestions: DateSuggestion[];
  scheduledDates: Set<string>;
}

export function CalendarHoverPopover({ suggestions, scheduledDates }: CalendarHoverPopoverProps) {
  const { hoveredDate, hoveredFrom } = useHoverSync();
  const activeDate = hoveredFrom === 'cell' ? hoveredDate : null;
  const { coords, hoverCapable } = useHoverPopover(activeDate, {
    selector: (date) => `[data-testid="calendar-cell"][data-date="${date}"]`,
  });

  if (!hoverCapable || !activeDate || !coords) return null;

  const suggestion = suggestions.find((s) => s.date === activeDate);
  const isScheduled = scheduledDates.has(activeDate);
  const dateLabel = format(parseISO(activeDate), 'EEE, MMM d');

  if (!suggestion && !isScheduled) return null;

  return createPortal(
    <div
      role="tooltip"
      data-testid="calendar-hover-popover"
      className={`pointer-events-none fixed z-50 w-56 rounded-lg border border-border bg-card p-3 shadow-lg ${
        coords.placeBelow ? '' : '-translate-y-full'
      } -translate-x-1/2`}
      style={{ left: coords.x, top: coords.y }}
    >
      <p className="text-xs font-semibold text-card-foreground">{dateLabel}</p>
      {suggestion && (
        <p className="mt-1 text-muted-foreground text-xs">
          {describeDateState(suggestion, suggestion.threshold)}
        </p>
      )}
      {isScheduled ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Session scheduled</p>
      ) : suggestion ? (
        <ul className="mt-2 space-y-1 text-[11px]">
          <PopoverLine label="Available" count={suggestion.availableCount} colorClass="text-success" names={suggestion.availablePlayers.map((p) => p.user.name)} />
          {suggestion.maybeCount > 0 && (
            <PopoverLine label="Maybe" count={suggestion.maybeCount} colorClass="text-warning" names={suggestion.maybePlayers.map((p) => p.user.name)} />
          )}
          {suggestion.unavailableCount > 0 && (
            <PopoverLine label="Can't make it" count={suggestion.unavailableCount} colorClass="text-danger" names={suggestion.unavailablePlayers.map((p) => p.user.name)} />
          )}
          {suggestion.pendingCount > 0 && (
            <PopoverLine label="No response" count={suggestion.pendingCount} colorClass="text-muted-foreground" names={suggestion.pendingPlayers.map((u) => u.name)} />
          )}
        </ul>
      ) : null}
    </div>,
    document.body
  );
}

function PopoverLine({ label, count, colorClass, names }: { label: string; count: number; colorClass: string; names: string[] }) {
  return (
    <li className="flex flex-col gap-0.5">
      <span className={`font-mono ${colorClass}`}>
        {label} · {count}
      </span>
      {names.length > 0 && (
        <span className="text-muted-foreground truncate">{names.join(', ')}</span>
      )}
    </li>
  );
}
