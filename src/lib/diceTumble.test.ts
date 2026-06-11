import { describe, it, expect } from 'vitest';
import { DEFAULT_TUMBLE_PARAMS, TumbleDriver } from './diceTumble';

describe('TumbleDriver', () => {
  it('keeps the orientation a unit quaternion across many steps', () => {
    const driver = new TumbleDriver();
    for (let i = 0; i < 10_000; i++) {
      const q = driver.step(1 / 60);
      expect(Number.isFinite(q[0])).toBe(true);
      expect(Math.hypot(...q)).toBeCloseTo(1, 9);
    }
  });

  it('actually rotates over time', () => {
    const driver = new TumbleDriver();
    const q0 = [...driver.q];
    for (let i = 0; i < 60; i++) driver.step(1 / 60);
    const q1 = driver.q;
    // A second of tumbling at >= ~2 rad/s must move the orientation
    const dot = Math.abs(
      q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3]
    );
    expect(dot).toBeLessThan(0.99);
  });

  it('clamps huge dt (background tab wake-up) instead of jumping wildly', () => {
    const driver = new TumbleDriver();
    const before = [...driver.q];
    const q = driver.step(30); // 30s pause
    // Rotation this frame is bounded by maxSpeed * 50ms — far less than a
    // full revolution, so the angle between before/after stays small-ish
    const dot = Math.abs(
      before[0] * q[0] + before[1] * q[1] + before[2] * q[2] + before[3] * q[3]
    );
    expect(dot).toBeGreaterThan(0.8);
    expect(Math.hypot(...q)).toBeCloseTo(1, 9);
  });

  it('negative dt is treated as no time passing', () => {
    const driver = new TumbleDriver();
    const before = [...driver.q];
    const q = driver.step(-5);
    q.forEach((v, i) => expect(v).toBeCloseTo(before[i], 12));
  });

  it('default params are sane', () => {
    expect(DEFAULT_TUMBLE_PARAMS.baseSpeed).toBeGreaterThan(0);
    expect(DEFAULT_TUMBLE_PARAMS.flickIntervalSec).toBeGreaterThan(0);
    expect(DEFAULT_TUMBLE_PARAMS.flickStrength).toBeGreaterThan(0);
  });
});
