// Shared d20 (icosahedron) geometry data.
// This mirrors the constants in LoadingSpinner.tsx; once the physics-based
// renderer ships, LoadingSpinner should import from here too.

// Golden ratio
export const PHI = (1 + Math.sqrt(5)) / 2;

// 12 vertices of an icosahedron, normalized to the unit sphere (circumradius 1)
export const D20_VERTICES: [number, number, number][] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [-PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, -1],
].map(([x, y, z]) => {
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len] as [number, number, number];
});

// 20 triangular faces (vertex indices, counter-clockwise viewed from outside)
export const D20_FACES: [number, number, number][] = [
  // Top cap (around vertex 0)
  [0, 1, 8],
  [0, 8, 4],
  [0, 4, 5],
  [0, 5, 9],
  [0, 9, 1],
  // Upper middle band
  [1, 6, 8],
  [8, 6, 10],
  [8, 10, 4],
  [4, 10, 2],
  [4, 2, 5],
  [5, 2, 11],
  [5, 11, 9],
  [9, 11, 7],
  [9, 7, 1],
  [1, 7, 6],
  // Bottom cap (around vertex 3)
  [3, 6, 7],
  [3, 7, 11],
  [3, 11, 2],
  [3, 2, 10],
  [3, 10, 6],
];

// Number printed on each face (index = face index). Opposite faces sum to 21.
export const D20_FACE_NUMBERS = [
  20, 14, 8, 16, 2, 12, 10, 6, 18, 4, 9, 11, 15, 3, 17, 13, 7, 1, 19, 5,
];

// Outward-pointing unit normal per face
export const D20_FACE_NORMALS: [number, number, number][] = D20_FACES.map(
  ([i, j, k]) => {
    const v0 = D20_VERTICES[i],
      v1 = D20_VERTICES[j],
      v2 = D20_VERTICES[k];
    const e1x = v1[0] - v0[0],
      e1y = v1[1] - v0[1],
      e1z = v1[2] - v0[2];
    const e2x = v2[0] - v0[0],
      e2y = v2[1] - v0[1],
      e2z = v2[2] - v0[2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len] as [number, number, number];
  }
);

// Distance from the center to each face plane (inradius), for a circumradius-1 die
export const D20_INRADIUS = (() => {
  const [i] = D20_FACES[0];
  const v = D20_VERTICES[i];
  const n = D20_FACE_NORMALS[0];
  return Math.abs(v[0] * n[0] + v[1] * n[1] + v[2] * n[2]);
})();
