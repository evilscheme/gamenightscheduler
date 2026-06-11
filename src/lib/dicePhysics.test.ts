import { describe, it, expect } from 'vitest';
import {
  DIE_REST_HEIGHT,
  createPlayback,
  evalPlayback,
  faceMappingQuat,
  findUpFace,
  simulateRoll,
} from './dicePhysics';
import { D20_FACE_NUMBERS, D20_FACE_NORMALS, D20_VERTICES } from './d20Geometry';
import { quatApply } from './quat';

describe('simulateRoll', () => {
  // One shared roll for the suite; each simulation is ~1-2ms but there's no
  // need to re-roll per assertion.
  const sim = simulateRoll();

  it('produces frames and a result consistent with the landed face', () => {
    expect(sim.frames.length).toBeGreaterThan(0);
    expect(sim.naturalResult).toBeGreaterThanOrEqual(1);
    expect(sim.naturalResult).toBeLessThanOrEqual(20);
    expect(D20_FACE_NUMBERS[sim.landedFace]).toBe(sim.naturalResult);
    const lastQ = sim.frames[sim.frames.length - 1].q;
    expect(findUpFace(lastQ)).toBe(sim.landedFace);
  });

  it('lands flat (within the cocked-roll rejection threshold)', () => {
    // simulateRoll retries cocked throws; only if all 10 attempts land
    // cocked (vanishingly rare) could flatness be lower.
    expect(sim.flatness).toBeGreaterThan(Math.cos((8 * Math.PI) / 180));
  });

  it('tumbles long enough to read as a real throw', () => {
    expect(sim.frames.length / 60).toBeGreaterThanOrEqual(1.4);
  });
});

describe('faceMappingQuat', () => {
  it('maps the source face normal onto the target face normal', () => {
    for (const [from, to] of [
      [0, 5],
      [3, 17],
      [19, 0],
      [7, 7],
    ] as const) {
      const r = faceMappingQuat(from, to);
      const mapped = quatApply(r, D20_FACE_NORMALS[from]);
      const target = D20_FACE_NORMALS[to];
      for (let i = 0; i < 3; i++) {
        expect(mapped[i]).toBeCloseTo(target[i], 9);
      }
    }
  });

  it('is an icosahedral symmetry: every vertex maps onto a vertex', () => {
    const r = faceMappingQuat(2, 14);
    for (const v of D20_VERTICES) {
      const m = quatApply(r, v);
      const matches = D20_VERTICES.some(
        (w) =>
          Math.abs(w[0] - m[0]) < 1e-9 &&
          Math.abs(w[1] - m[1]) < 1e-9 &&
          Math.abs(w[2] - m[2]) < 1e-9
      );
      expect(matches).toBe(true);
    }
  });
});

describe('playback', () => {
  it('starts at the first frame and clamps pre-start timestamps', () => {
    const sim = simulateRoll();
    const playback = createPlayback(sim, null, 1000);
    // rAF timestamps can precede the start time captured in a click handler
    const { p } = evalPlayback(playback, 990);
    expect(p[0]).toBeCloseTo(sim.frames[0].p[0], 6);
    expect(playback.done).toBe(false);
  });

  it('finishes flat, at rest height, showing the forced number', () => {
    const sim = simulateRoll();
    const forced = sim.naturalResult === 20 ? 1 : 20;
    const playback = createPlayback(sim, forced, 0);
    // First eval past the frames starts the settle snap; the second, a full
    // second later, is well past the 250ms snap duration
    const end = (sim.frames.length / 60 + 5) * 1000;
    evalPlayback(playback, end);
    const { p, q } = evalPlayback(playback, end + 1000);
    expect(playback.done).toBe(true);
    expect(p[1]).toBeCloseTo(DIE_REST_HEIGHT, 6);
    expect(D20_FACE_NUMBERS[findUpFace(q)]).toBe(forced);
    // Perfectly flat after the settle snap
    const worldN = quatApply(q, D20_FACE_NORMALS[findUpFace(q)]);
    expect(worldN[1]).toBeCloseTo(1, 6);
  });

  it('shows the natural result when no result is forced', () => {
    const sim = simulateRoll();
    const playback = createPlayback(sim, null, 0);
    const end = (sim.frames.length / 60 + 5) * 1000;
    evalPlayback(playback, end);
    const { q } = evalPlayback(playback, end + 1000);
    expect(D20_FACE_NUMBERS[findUpFace(q)]).toBe(sim.naturalResult);
  });
});
