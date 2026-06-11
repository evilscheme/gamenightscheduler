import { describe, it, expect } from 'vitest';
import {
  type Quat,
  type Vec3,
  QUAT_IDENTITY,
  quatApply,
  quatFromAxisAngle,
  quatFromMat3,
  quatFromUnitVectors,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  vecNormalize,
} from './quat';

const closeTo = (a: number[], b: number[], eps = 1e-10) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps));
};

describe('quat', () => {
  it('identity leaves vectors unchanged', () => {
    closeTo(quatApply(QUAT_IDENTITY, [1, 2, 3]), [1, 2, 3]);
  });

  it('multiply composes rotations (apply b then a)', () => {
    const rotX90 = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    const rotY90 = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const composed = quatMultiply(rotY90, rotX90);
    const direct = quatApply(rotY90, quatApply(rotX90, [0, 0, 1]));
    closeTo(quatApply(composed, [0, 0, 1]), direct);
  });

  it('axis-angle rotates by the given angle', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    closeTo(quatApply(q, [1, 0, 0]), [0, 1, 0]);
  });

  it('fromUnitVectors maps a onto b', () => {
    const a = vecNormalize([1, 2, -0.5]);
    const b = vecNormalize([-0.3, 1, 2]);
    closeTo(quatApply(quatFromUnitVectors(a, b), a), b);
  });

  it('fromUnitVectors handles opposite vectors', () => {
    const a: Vec3 = [0, 1, 0];
    closeTo(quatApply(quatFromUnitVectors(a, [0, -1, 0]), a), [0, -1, 0]);
  });

  it('slerp hits both endpoints and stays normalized midway', () => {
    const a = quatFromAxisAngle([1, 0, 0], 0.3);
    const b = quatFromAxisAngle([0, 1, 0], 1.9);
    closeTo(quatSlerp(a, b, 0), a);
    closeTo(quatSlerp(a, b, 1), b, 1e-9);
    const mid = quatSlerp(a, b, 0.5);
    expect(Math.hypot(...mid)).toBeCloseTo(1, 10);
  });

  it('fromMat3 agrees with axis-angle', () => {
    const angle = 1.1;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Rotation about z by `angle` as a row-major matrix
    const m = [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1],
    ];
    const expected = quatFromAxisAngle([0, 0, 1], angle);
    const got = quatFromMat3(m);
    // q and -q are the same rotation
    const sign = Math.sign(got[3] * expected[3]) || 1;
    closeTo(
      got.map((v) => v * sign),
      [...expected]
    );
  });

  it('normalize returns a unit quaternion', () => {
    const q = quatNormalize([1, 2, 3, 4] as Quat);
    expect(Math.hypot(...q)).toBeCloseTo(1, 12);
  });
});
