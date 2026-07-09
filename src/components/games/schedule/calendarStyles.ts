import type { CellTintTier } from '@/lib/schedule';

export type CalendarVisualState = CellTintTier | 'scheduled' | 'past';

/**
 * Single source of truth for mini-calendar cell appearance.
 * - `className` is applied to both the cell and the legend swatch — text-* classes
 *   are inert on an empty swatch, so combining bg + text keeps one entry per state.
 * - Adding a new visual state means updating this map AND `LEGEND_ORDER` below.
 */
export const CALENDAR_STYLES: Record<CalendarVisualState, { className: string; label: string }> = {
  high:      { className: 'bg-cal-available-bg text-cal-available-text', label: 'Most available' },
  medium:    { className: 'bg-cal-available-medium-bg text-cal-available-medium-text', label: 'Some available' },
  maybe:     { className: 'bg-cal-maybe-bg text-cal-maybe-text', label: 'Mixed' },
  warning:   { className: 'bg-cal-unavailable-bg/60 text-cal-unavailable-text', label: 'Mostly unavailable' },
  empty:     { className: 'bg-cal-empty-bg text-cal-empty-text', label: 'Awaiting responses' },
  past:      { className: 'bg-cal-empty-bg/30 text-cal-empty-text/60', label: 'Past' },
  scheduled: { className: 'bg-cal-scheduled-bg text-cal-scheduled-text', label: '★ Scheduled' },
};

export const LEGEND_ORDER: CalendarVisualState[] = [
  'high', 'medium', 'maybe', 'warning', 'empty', 'past', 'scheduled',
];
