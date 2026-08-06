import { describe, it, expect } from 'vitest';
import { CELL_STYLES, LEGEND } from './calendarStyles';
import type { DateState } from '@/lib/schedule';

const ALL: DateState[] = [
  'not-enough', 'unknown', 'enough-if-maybes', 'everyone-if-maybes',
  'enough', 'enough-maybe-everyone', 'everyone',
];

describe('CELL_STYLES', () => {
  it('covers every state', () => {
    for (const s of ALL) expect(CELL_STYLES[s]).toBeDefined();
  });

  it('uses one green for both enough and everyone', () => {
    expect(CELL_STYLES['enough'].fill).toBe(CELL_STYLES['everyone'].fill);
    expect(CELL_STYLES['enough-maybe-everyone'].fill).toBe(CELL_STYLES['everyone'].fill);
  });

  it('marks only the everyone-flavoured states with a gold pip', () => {
    expect(CELL_STYLES['everyone'].pip).toBe('gold-solid');
    expect(CELL_STYLES['enough-maybe-everyone'].pip).toBe('gold-hollow');
    expect(CELL_STYLES['everyone-if-maybes'].pip).toBe('gold-hollow');
    expect(CELL_STYLES['enough'].pip).toBe('none');
    expect(CELL_STYLES['enough-if-maybes'].pip).toBe('none');
    expect(CELL_STYLES['unknown'].pip).toBe('none');
    expect(CELL_STYLES['not-enough'].pip).toBe('none');
  });

  it('outlines exactly the two states whose floor misses the threshold', () => {
    expect(CELL_STYLES['enough-if-maybes'].filled).toBe(false);
    expect(CELL_STYLES['everyone-if-maybes'].filled).toBe(false);
    expect(CELL_STYLES['enough'].filled).toBe(true);
    expect(CELL_STYLES['everyone'].filled).toBe(true);
    expect(CELL_STYLES['enough-maybe-everyone'].filled).toBe(true);
  });

  it('never hardcodes a palette colour', () => {
    const banned = /\b(bg|text|border)-(red|green|amber|yellow|blue|slate|gray|emerald)-\d{2,3}\b/;
    for (const s of ALL) expect(CELL_STYLES[s].fill).not.toMatch(banned);
  });
});

describe('LEGEND', () => {
  it('teaches the three channels plus non-play days in eight entries', () => {
    expect(LEGEND).toHaveLength(8);
    expect(LEGEND.map((e) => e.label)).toEqual([
      'Enough players',
      'Maybe enough players',
      'Everyone',
      'Maybe everyone',
      "Someone hasn't answered",
      'Waiting for responses',
      "Can't happen",
      'Non-play day',
    ]);
  });

  it('shows both pending swatches under the waiting-on-someone entry', () => {
    const entry = LEGEND.find((e) => e.label === "Someone hasn't answered");
    expect(entry?.swatches).toHaveLength(2);
  });
});
