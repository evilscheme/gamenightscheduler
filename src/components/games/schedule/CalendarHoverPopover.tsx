'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import type { DateSuggestion } from '@/types';
import { useHoverSync } from './HoverSyncContext';

interface CalendarHoverPopoverProps {
  suggestions: DateSuggestion[];
  scheduledDates: Set<string>;
}

function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCapable(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCapable(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  return capable;
}

const POPOVER_HEIGHT_HINT = 140;

export function CalendarHoverPopover({ suggestions, scheduledDates }: CalendarHoverPopoverProps) {
  const { hoveredDate, hoveredFrom } = useHoverSync();
  const hoverCapable = useHoverCapable();
  const [coords, setCoords] = useState<{ x: number; y: number; placeBelow: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeDate = hoveredFrom === 'cell' ? hoveredDate : null;

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!activeDate) {
      setCoords(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-testid="calendar-cell"][data-date="${activeDate}"]`
    );
    if (!el || el.offsetParent === null) {
      setCoords(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const placeBelow = rect.top < POPOVER_HEIGHT_HINT;
    setCoords({
      x: rect.left + rect.width / 2,
      y: placeBelow ? rect.bottom + 6 : rect.top - 6,
      placeBelow,
    });
  }, [activeDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || !hoverCapable || !activeDate || !coords) return null;

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
