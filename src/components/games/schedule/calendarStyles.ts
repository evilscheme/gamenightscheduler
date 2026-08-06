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

export interface LegendEntry {
  swatch: string;
  pip?: PipKind | 'gray';
  label: string;
}

/**
 * Teaches the three channels rather than the seven states, so a reader can
 * compose any cell they see instead of matching it against a list. The scheduled
 * star is deliberately omitted — it is self-evident, and including it would add
 * an eighth row.
 */
export const LEGEND: LegendEntry[] = [
  { swatch: 'bg-cal-available-bg',                                    label: 'Enough players' },
  { swatch: 'border-2 border-dashed border-cal-available-ink',        label: '…if the maybes work out' },
  { swatch: 'bg-cal-available-bg', pip: 'gold-solid',                 label: 'Everyone' },
  { swatch: 'bg-cal-available-bg', pip: 'gold-hollow',                label: 'Everyone, if the maybes work out' },
  { swatch: 'bg-cal-available-bg', pip: 'gray',                       label: "Someone hasn't answered" },
  { swatch: 'bg-cal-empty-bg',                                        label: 'Not enough responses yet' },
  { swatch: 'bg-cal-unavailable-bg',                                  label: "Can't happen" },
];
