import { describe, it, expect } from 'vitest';
import { CritBurst } from './critBurst';

describe('CritBurst', () => {
  it('runs for its duration, then reports done', () => {
    const burst = new CritBurst(100, 100, 50);
    expect(burst.done).toBe(false);
    let steps = 0;
    while (!burst.done && steps < 1000) {
      burst.step(1 / 60);
      steps++;
    }
    expect(burst.done).toBe(true);
    // ~2.2s at 60fps
    expect(steps).toBeGreaterThan(100);
    expect(steps).toBeLessThan(200);
  });

  it('clamps huge dt so a background tab cannot fast-forward wildly', () => {
    const burst = new CritBurst(0, 0, 50);
    burst.step(30); // clamped to 50ms
    expect(burst.done).toBe(false);
  });

  it('drawing is side-effect-only and works on a plain 2d context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    // jsdom may not implement canvas 2d; skip the draw check there
    if (!ctx) return;
    const burst = new CritBurst(100, 100, 40);
    burst.step(0.1);
    expect(() => {
      burst.drawBack(ctx);
      burst.drawFront(ctx);
    }).not.toThrow();
  });
});
