import { describe, it, expect } from 'vitest';
import {
  D20_VERTICES,
  D20_FACES,
  D20_FACE_NUMBERS,
  D20_FACE_NORMALS,
  D20_INRADIUS,
} from './d20Geometry';

describe('d20Geometry', () => {
  it('has 12 unit vertices, 20 faces, 20 numbers', () => {
    expect(D20_VERTICES).toHaveLength(12);
    expect(D20_FACES).toHaveLength(20);
    expect(D20_FACE_NUMBERS).toHaveLength(20);
    for (const v of D20_VERTICES) {
      expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    }
  });

  it('numbers 1-20 each appear exactly once', () => {
    expect([...D20_FACE_NUMBERS].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
  });

  it('face normals are outward-pointing unit vectors', () => {
    D20_FACE_NORMALS.forEach((n, fi) => {
      expect(Math.hypot(...n)).toBeCloseTo(1, 10);
      // Outward: normal points away from the origin (toward the face centroid)
      const [i, j, k] = D20_FACES[fi];
      const cx =
        (D20_VERTICES[i][0] + D20_VERTICES[j][0] + D20_VERTICES[k][0]) / 3;
      const cy =
        (D20_VERTICES[i][1] + D20_VERTICES[j][1] + D20_VERTICES[k][1]) / 3;
      const cz =
        (D20_VERTICES[i][2] + D20_VERTICES[j][2] + D20_VERTICES[k][2]) / 3;
      expect(cx * n[0] + cy * n[1] + cz * n[2]).toBeGreaterThan(0);
    });
  });

  it('opposite faces sum to 21, following real d20 convention', () => {
    D20_FACE_NORMALS.forEach((n, fi) => {
      // The opposite face has the antiparallel normal
      const opposite = D20_FACE_NORMALS.findIndex(
        (m) =>
          Math.abs(m[0] + n[0]) < 1e-9 &&
          Math.abs(m[1] + n[1]) < 1e-9 &&
          Math.abs(m[2] + n[2]) < 1e-9
      );
      expect(opposite).toBeGreaterThanOrEqual(0);
      expect(D20_FACE_NUMBERS[fi] + D20_FACE_NUMBERS[opposite]).toBe(21);
    });
  });

  it('inradius matches the analytic icosahedron value', () => {
    // For circumradius 1: r_in = φ² / (√3 · √(φ + 2))
    const phi = (1 + Math.sqrt(5)) / 2;
    const expected = (phi * phi) / (Math.sqrt(3) * Math.sqrt(phi + 2));
    expect(D20_INRADIUS).toBeCloseTo(expected, 10);
  });
});
