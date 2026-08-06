import type { DateState } from '@/lib/schedule';

export type PipKind = 'gold-solid' | 'gold-hollow' | 'none';

export interface CellStyle {
  /** Background/border/text classes for the cell. */
  fill: string;
  /** The gold "everyone" badge, if any. */
  pip: PipKind;
  /**
   * True when the cell has a solid background rather than a dashed outline.
   * Selects which half of the adaptive grey the pending pip uses — the two
   * backdrops sit at opposite ends of the luminance range, so no single value
   * clears contrast on both.
   */
  filled: boolean;
}

const GREEN_SOLID = 'bg-cal-available-bg text-cal-available-text';
const GREEN_OUTLINE = 'border-2 border-dashed border-cal-available-ink text-cal-available-ink';

/**
 * Three independent channels: fill hue = outcome, fill style = whether confirmed
 * yeses alone clear the threshold, pip = whether the ceiling reaches everyone.
 * Lightness encodes nothing, because it inverts between light and dark mode.
 */
export const CELL_STYLES: Record<DateState, CellStyle> = {
  'not-enough':            { fill: 'bg-cal-unavailable-bg text-cal-unavailable-text', pip: 'none',        filled: true },
  'unknown':               { fill: 'bg-cal-empty-bg text-cal-empty-text',             pip: 'none',        filled: true },
  'enough-if-maybes':      { fill: GREEN_OUTLINE,                                     pip: 'none',        filled: false },
  'everyone-if-maybes':    { fill: GREEN_OUTLINE,                                     pip: 'gold-hollow', filled: false },
  'enough':                { fill: GREEN_SOLID,                                       pip: 'none',        filled: true },
  'enough-maybe-everyone': { fill: GREEN_SOLID,                                       pip: 'gold-hollow', filled: true },
  'everyone':              { fill: GREEN_SOLID,                                       pip: 'gold-solid',  filled: true },
};

export const PAST_STYLE = 'bg-cal-empty-bg/30 text-cal-empty-text/60';

/**
 * The diagonal hatch used for non-play-day cells. Exported so the legend swatch
 * can copy it verbatim instead of duplicating the literal string, which would
 * let the two drift apart.
 */
export const NON_PLAY_DAY_FILL =
  'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)] opacity-40';

export interface LegendSwatch {
  /** Classes for the swatch box itself. */
  swatch: string;
  /** Optional pip drawn inside it. */
  pip?: PipKind | 'pending-on-fill' | 'pending-on-page';
}

export interface LegendEntry {
  /** One or more swatches shown side by side under a single label. */
  swatches: LegendSwatch[];
  label: string;
}

const FILLED_SWATCH = 'bg-cal-available-bg';
const OUTLINED_SWATCH = 'border-2 border-dashed border-cal-available-ink';

/**
 * Teaches the three channels rather than the seven states, so a reader can
 * compose any cell they see instead of matching it against a list. The scheduled
 * star is deliberately omitted — it is self-evident, and including it would add
 * an eighth row.
 */
export const LEGEND: LegendEntry[] = [
  { swatches: [{ swatch: FILLED_SWATCH }],                                          label: 'Enough players' },
  { swatches: [{ swatch: OUTLINED_SWATCH }],                                        label: 'Maybe enough players' },
  { swatches: [{ swatch: FILLED_SWATCH, pip: 'gold-solid' }],                       label: 'Everyone' },
  { swatches: [{ swatch: FILLED_SWATCH, pip: 'gold-hollow' }],                      label: 'Maybe everyone' },
  {
    swatches: [
      { swatch: FILLED_SWATCH, pip: 'pending-on-fill' },
      { swatch: OUTLINED_SWATCH, pip: 'pending-on-page' },
    ],
    label: "Someone hasn't answered",
  },
  { swatches: [{ swatch: 'bg-cal-empty-bg' }],                                      label: 'Waiting for responses' },
  { swatches: [{ swatch: 'bg-cal-unavailable-bg' }],                                label: "Can't happen" },
  { swatches: [{ swatch: NON_PLAY_DAY_FILL }],                                      label: 'Non-play day' },
];
