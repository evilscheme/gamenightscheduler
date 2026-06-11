// Headless d20 roll simulation with cannon-es.
// Produces renderer-agnostic frames (position + quaternion) that any view —
// WebGL or canvas-2D — can play back. Deliberately free of three.js.

import * as CANNON from 'cannon-es';
import {
  D20_VERTICES,
  D20_FACES,
  D20_FACE_NUMBERS,
  D20_FACE_NORMALS,
  D20_INRADIUS,
} from '@/lib/d20Geometry';
import {
  type Quat,
  type Vec3,
  QUAT_IDENTITY,
  quatApply,
  quatFromMat3,
  quatFromUnitVectors,
  quatMultiply,
  quatSlerp,
  vecCross,
  vecNormalize,
  vecSub,
} from '@/lib/quat';

import { DIE_RADIUS, ARENA_HALF_X, ARENA_HALF_Z } from '@/lib/diceConfig';

// ── Tuning constants ──

export const GRAVITY = -38; // stronger than earth gravity for a snappy, game-feel roll
export const PHYSICS_DT = 1 / 60;
export const MAX_SIM_SECONDS = 8;
export const MIN_ROLL_SECONDS = 1.4; // re-throw dud rolls that settle too quickly
export const SETTLE_SNAP_SECONDS = 0.25; // final ease that lays the die perfectly flat
export const DIE_REST_HEIGHT = D20_INRADIUS * DIE_RADIUS;

export interface RecordedFrame {
  p: Vec3;
  q: Quat;
}

// A landing counts as flat when the up-face normal is within ~8° of vertical;
// the settle snap then has almost nothing to correct and is imperceptible.
const FLAT_THRESHOLD = Math.cos((8 * Math.PI) / 180);

export interface RollSimulation {
  frames: RecordedFrame[];
  landedFace: number;
  naturalResult: number;
  steps: number;
  slept: boolean;
  /** Up-face normal's world y at rest (1 = perfectly flat) */
  flatness: number;
  /** How many throws were simulated before one was accepted */
  attempts: number;
}

// Which face index points up for a given orientation?
export function findUpFace(q: Quat): number {
  let best = 0;
  let bestY = -Infinity;
  for (let f = 0; f < D20_FACE_NORMALS.length; f++) {
    const worldY = quatApply(q, D20_FACE_NORMALS[f])[1];
    if (worldY > bestY) {
      bestY = worldY;
      best = f;
    }
  }
  return best;
}

// Orthonormal basis for a face as matrix columns (u toward apex vertex, w, n).
// Using the same apex-vertex convention for every face makes the resulting
// frame-to-frame rotation a symmetry of the icosahedron.
function faceBasis(faceIndex: number): [Vec3, Vec3, Vec3] {
  const [i, j, k] = D20_FACES[faceIndex];
  const v0 = D20_VERTICES[i];
  const v1 = D20_VERTICES[j];
  const v2 = D20_VERTICES[k];
  const centroid: Vec3 = [
    (v0[0] + v1[0] + v2[0]) / 3,
    (v0[1] + v1[1] + v2[1]) / 3,
    (v0[2] + v1[2] + v2[2]) / 3,
  ];
  const n = D20_FACE_NORMALS[faceIndex];
  const u = vecNormalize(vecSub(v0, centroid));
  const w = vecCross(n, u);
  return [u, w, n];
}

// Rotation (an icosahedral symmetry) that maps face `from` onto face `to`,
// apex vertex to apex vertex. Applied as a pre-rotation on the rendered die,
// it relabels the numbers without changing the physics.
export function faceMappingQuat(from: number, to: number): Quat {
  const bf = faceBasis(from);
  const bt = faceBasis(to);
  // R = M_to * M_fromᵀ, where M columns are the basis vectors
  const m = [0, 1, 2].map((row) =>
    [0, 1, 2].map((col) => {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += bt[k][row] * bf[k][col];
      return sum;
    })
  );
  return quatFromMat3(m);
}

function simulateOnce(): RollSimulation {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
  world.allowSleep = true;

  const dieMaterial = new CANNON.Material('die');
  const trayMaterial = new CANNON.Material('tray');
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMaterial, trayMaterial, {
      friction: 0.25,
      restitution: 0.42,
    })
  );

  // Invisible tray: floor, four walls, and a low ceiling to keep the die in frame
  const trayPlanes: Array<{ pos: Vec3; euler: Vec3 }> = [
    { pos: [0, 0, 0], euler: [-Math.PI / 2, 0, 0] }, // floor (normal +y)
    { pos: [-ARENA_HALF_X, 0, 0], euler: [0, Math.PI / 2, 0] }, // left → +x
    { pos: [ARENA_HALF_X, 0, 0], euler: [0, -Math.PI / 2, 0] }, // right → -x
    { pos: [0, 0, -ARENA_HALF_Z], euler: [0, 0, 0] }, // back → +z
    { pos: [0, 0, ARENA_HALF_Z], euler: [0, Math.PI, 0] }, // front → -z
    { pos: [0, 6.5, 0], euler: [Math.PI / 2, 0, 0] }, // ceiling → -y (above any spawn/bounce)
  ];
  for (const { pos, euler } of trayPlanes) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: trayMaterial,
    });
    body.position.set(...pos);
    body.quaternion.setFromEuler(...euler);
    world.addBody(body);
  }

  // The die: a convex hull of the same icosahedron the renderers draw
  const shape = new CANNON.ConvexPolyhedron({
    vertices: D20_VERTICES.map(
      ([x, y, z]) =>
        new CANNON.Vec3(x * DIE_RADIUS, y * DIE_RADIUS, z * DIE_RADIUS)
    ),
    faces: D20_FACES.map((f) => [...f]),
  });
  const die = new CANNON.Body({
    mass: 1,
    shape,
    material: dieMaterial,
    linearDamping: 0.08,
    angularDamping: 0.12,
  });
  die.allowSleep = true;
  die.sleepSpeedLimit = 0.4;
  die.sleepTimeLimit = 0.35;

  // Random throw: in from the left edge with strong tumble, already falling
  // so the die never hangs in the air at the start of the roll
  die.position.set(
    -ARENA_HALF_X + 0.9,
    2.6 + Math.random() * 1.0,
    -ARENA_HALF_Z + 1 + Math.random() * (2 * ARENA_HALF_Z - 2)
  );
  die.quaternion.setFromEuler(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  die.velocity.set(
    7 + Math.random() * 4,
    -2 - Math.random() * 3,
    (Math.random() - 0.5) * 6
  );
  die.angularVelocity.set(
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 50
  );
  world.addBody(die);

  const frames: RecordedFrame[] = [];
  const maxSteps = Math.ceil(MAX_SIM_SECONDS / PHYSICS_DT);
  let slept = false;
  let steps = 0;
  for (; steps < maxSteps; steps++) {
    world.step(PHYSICS_DT);
    frames.push({
      p: [die.position.x, die.position.y, die.position.z],
      q: [
        die.quaternion.x,
        die.quaternion.y,
        die.quaternion.z,
        die.quaternion.w,
      ],
    });
    if (die.sleepState === CANNON.Body.SLEEPING) {
      slept = true;
      break;
    }
  }

  const lastQ = frames[frames.length - 1].q;
  const landedFace = findUpFace(lastQ);
  const flatness = quatApply(lastQ, D20_FACE_NORMALS[landedFace])[1];
  return {
    frames,
    landedFace,
    naturalResult: D20_FACE_NUMBERS[landedFace],
    steps,
    slept,
    flatness,
    attempts: 1,
  };
}

// A good throw tumbles long enough to satisfy AND lands flat — a cocked die
// would need a visible artificial rotation to display its result.
function isGoodThrow(sim: RollSimulation): boolean {
  return (
    sim.frames.length * PHYSICS_DT >= MIN_ROLL_SECONDS &&
    sim.flatness >= FLAT_THRESHOLD
  );
}

// Simulate throws (each ~1-2ms) until one is good; keep the best fallback
export function simulateRoll(): RollSimulation {
  let best = simulateOnce();
  let attempts = 1;
  while (!isGoodThrow(best) && attempts < 10) {
    const next = simulateOnce();
    attempts++;
    // Prefer flat over long, then the flattest landing
    const bestScore =
      (best.flatness >= FLAT_THRESHOLD ? 2 : 0) +
      (best.frames.length * PHYSICS_DT >= MIN_ROLL_SECONDS ? 1 : 0) +
      best.flatness;
    const nextScore =
      (next.flatness >= FLAT_THRESHOLD ? 2 : 0) +
      (next.frames.length * PHYSICS_DT >= MIN_ROLL_SECONDS ? 1 : 0) +
      next.flatness;
    if (nextScore > bestScore) best = next;
  }
  return { ...best, attempts };
}

// ── Playback ──
// Evaluates a recorded roll at wall-clock time, including the final settle
// snap. Both renderers consume this, so their motion is identical.

export interface RollPlayback {
  sim: RollSimulation;
  qRelabel: Quat; // identity unless the result is forced
  startTime: number;
  snapStart: number | null;
  done: boolean;
}

export function createPlayback(
  sim: RollSimulation,
  forcedResult: number | null,
  startTime: number
): RollPlayback {
  let qRelabel = QUAT_IDENTITY;
  if (forcedResult != null) {
    const desiredFace = D20_FACE_NUMBERS.indexOf(forcedResult);
    if (desiredFace !== -1 && desiredFace !== sim.landedFace) {
      qRelabel = faceMappingQuat(desiredFace, sim.landedFace);
    }
  }
  return { sim, qRelabel, startTime, snapStart: null, done: false };
}

export function evalPlayback(
  playback: RollPlayback,
  now: number
): { p: Vec3; q: Quat } {
  const { frames } = playback.sim;
  // Clamp: the first animation-frame timestamp can precede the
  // performance.now() captured in the click handler
  const t = Math.max(0, (now - playback.startTime) / 1000);
  const idx = t / PHYSICS_DT;
  const i0 = Math.min(Math.floor(idx), frames.length - 1);

  if (i0 < frames.length - 1) {
    const f0 = frames[i0];
    const f1 = frames[i0 + 1];
    const alpha = idx - i0;
    const p: Vec3 = [
      f0.p[0] + (f1.p[0] - f0.p[0]) * alpha,
      f0.p[1] + (f1.p[1] - f0.p[1]) * alpha,
      f0.p[2] + (f1.p[2] - f0.p[2]) * alpha,
    ];
    return { p, q: quatMultiply(quatSlerp(f0.q, f1.q, alpha), playback.qRelabel) };
  }

  // Settle snap: ease the die perfectly flat onto its landed face
  const last = frames[frames.length - 1];
  if (playback.snapStart == null) playback.snapStart = now;
  const s = Math.min(
    (now - playback.snapStart) / (SETTLE_SNAP_SECONDS * 1000),
    1
  );
  const ease = 1 - Math.pow(1 - s, 3);

  const worldN = quatApply(last.q, D20_FACE_NORMALS[playback.sim.landedFace]);
  const qAlign = quatFromUnitVectors(worldN, [0, 1, 0]);
  const qFlat = quatMultiply(qAlign, last.q);
  const q = quatMultiply(quatSlerp(last.q, qFlat, ease), playback.qRelabel);
  const p: Vec3 = [
    last.p[0],
    last.p[1] + (DIE_REST_HEIGHT - last.p[1]) * ease,
    last.p[2],
  ];
  if (s >= 1) playback.done = true;
  return { p, q };
}
