import { describe, it, expect } from 'vitest';
import { effectiveThreshold } from './threshold';

describe('effectiveThreshold', () => {
  it('derives 60% rounded up, with a floor of 3, when the GM set no minimum', () => {
    expect(effectiveThreshold(0, 3)).toBe(3);
    expect(effectiveThreshold(0, 4)).toBe(3);
    expect(effectiveThreshold(0, 5)).toBe(3);
    expect(effectiveThreshold(0, 6)).toBe(4);
    expect(effectiveThreshold(0, 8)).toBe(5);
    expect(effectiveThreshold(0, 10)).toBe(6);
    expect(effectiveThreshold(0, 12)).toBe(8);
  });

  it('never derives a threshold larger than the group', () => {
    expect(effectiveThreshold(0, 1)).toBe(1);
    expect(effectiveThreshold(0, 2)).toBe(2);
  });

  it('uses the GM value verbatim when one is set', () => {
    expect(effectiveThreshold(2, 10)).toBe(2);
    expect(effectiveThreshold(7, 10)).toBe(7);
  });

  it('does not cap an explicit GM value at the group size', () => {
    // A game that cannot meet its own stated minimum stays honest about it.
    expect(effectiveThreshold(8, 5)).toBe(8);
  });

  it('returns 0 for an empty group', () => {
    expect(effectiveThreshold(0, 0)).toBe(0);
  });
});
