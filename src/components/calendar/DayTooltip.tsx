'use client';

import { createPortal } from 'react-dom';
import type { BandTone, TooltipModel } from '@/lib/calendarCellTooltip';
import { useHoverPopover } from '@/hooks/useHoverPopover';

/**
 * The 45° stripe from calendarCellState.ts:57-59, used by non-play in-range
 * cells. NOT used by `past` — a past date is out-of-range by construction
 * (getSchedulingWindow clamps windowStart to today), so calendarCellState
 * paints it with `cal-out-of-range`, not this stripe. See BAND_STYLES.past.
 */
const MUTED_STRIPE =
  'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]';

/**
 * The band restates the hovered cell's own fill, enlarged and labeled — so it
 * has to be painted from the same tokens calendarCellState() uses. Keep these
 * in step with it: a band that disagrees with its cell is worse than no band.
 *
 * Text colour is `text-muted-foreground`, not the cell's `text-cal-disabled-text`,
 * because band text sits on the white card background where `--cal-disabled-text`
 * (~1.6:1 contrast) is illegible. The fill is the contract; the text just needs
 * to stay readable.
 */
export const BAND_STYLES: Record<BandTone, string> = {
  available: 'bg-cal-available-bg text-cal-available-text',
  maybe:
    'bg-cal-available-ink/15 text-cal-available-ink border-y-2 border-dashed border-cal-available-ink',
  unavailable: 'bg-cal-unavailable-bg text-cal-unavailable-text',
  unset: 'bg-cal-empty-bg text-cal-empty-text',
  'non-play': `${MUTED_STRIPE} text-muted-foreground`,
  // past and out-of-range are intentionally identical strings, not a
  // duplicate to merge: calendarCellState paints a past date with
  // cal-out-of-range too (it's out-of-range by construction), so the two
  // fills must match even though `tone` keeps them distinct for the label.
  past: 'cal-out-of-range text-muted-foreground',
  'out-of-range': 'cal-out-of-range text-muted-foreground',
};

interface DayTooltipProps {
  hover: { date: string; model: TooltipModel } | null;
}

export function DayTooltip({ hover }: DayTooltipProps) {
  const { coords, hoverCapable } = useHoverPopover(hover?.date ?? null, {
    selector: (date) => `button[data-date="${date}"]`,
  });

  if (!hoverCapable || !hover || !coords) return null;
  const { model } = hover;

  return createPortal(
    <div
      role="tooltip"
      data-testid="day-tooltip"
      className={`pointer-events-none fixed z-50 w-56 rounded-lg border border-border bg-card p-3 shadow-lg ${
        coords.placeBelow ? '' : '-translate-y-full'
      } -translate-x-1/2`}
      style={{ left: coords.x, top: coords.y }}
    >
      {/*
        No star here: the cell's own star is coloured by the player's answer
        (calendarCellState.ts's starFill ladder), and duplicating that ladder
        just to match it would be a third copy of the same decision. A
        fill-primary (blue) star above a green cell star taught the wrong
        colour mapping. The SCHEDULED badge below already says this
        unambiguously.
      */}
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-card-foreground">
        {model.dateLabel}
        {model.badges.map((badge) => (
          <span
            key={badge}
            className="rounded-sm bg-primary/10 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-primary"
          >
            {badge}
          </span>
        ))}
      </p>

      {/* -mx-3 cancels the container padding so the band spans edge to edge. */}
      <div
        data-testid="day-tooltip-band"
        className={`-mx-3 mt-2 flex items-center justify-between gap-2 px-3 py-1 text-xs font-bold ${
          BAND_STYLES[model.band.tone]
        }`}
      >
        <span>{model.band.label}</span>
        {model.band.qualifier && (
          <span className="text-[10.5px] font-semibold opacity-85">{model.band.qualifier}</span>
        )}
      </div>

      {model.rows.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {model.rows.map((row, i) => (
            <li key={`${row.label}-${i}`} className="flex gap-1.5 text-[11px]">
              <span className="shrink-0 text-muted-foreground">{row.label}</span>
              <span className="text-card-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
      )}

      {model.hints.map((hint) => (
        <p key={hint} className="mt-2 text-[10.5px] italic text-muted-foreground">
          {hint}
        </p>
      ))}
    </div>,
    document.body,
  );
}
