// Minimal quaternion / vector math, dependency-free.
// Used by the dice physics playback so the canvas-2D renderer needs no three.js.

export type Quat = [number, number, number, number]; // x, y, z, w
export type Vec3 = [number, number, number];

export const QUAT_IDENTITY: Quat = [0, 0, 0, 1];

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatApply(q: Quat, v: Vec3): Vec3 {
  // v' = v + 2w(q×v) + 2(q×(q×v))
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  const [ax, ay, az, aw] = a;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  // Take the shortest path
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    // Nearly identical: linear interpolation, then normalize
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    const w = aw + (bw - aw) * t;
    const len = Math.sqrt(x * x + y * y + z * z + w * w);
    return [x / len, y / len, z / len, w / len];
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const sa = Math.sin((1 - t) * theta) / sinTheta;
  const sb = Math.sin(t * theta) / sinTheta;
  return [
    ax * sa + bx * sb,
    ay * sa + by * sb,
    az * sa + bz * sb,
    aw * sa + bw * sb,
  ];
}

export function quatNormalize(q: Quat): Quat {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

// Rotation taking unit vector a onto unit vector b (minimal arc)
export function quatFromUnitVectors(a: Vec3, b: Vec3): Quat {
  const w = 1 + (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
  let x: number, y: number, z: number;
  if (w < 1e-8) {
    // Opposite vectors: rotate 180° around any axis orthogonal to a
    if (Math.abs(a[0]) > Math.abs(a[2])) {
      x = -a[1];
      y = a[0];
      z = 0;
    } else {
      x = 0;
      y = -a[2];
      z = a[1];
    }
    const len = Math.sqrt(x * x + y * y + z * z);
    return [x / len, y / len, z / len, 0];
  }
  x = a[1] * b[2] - a[2] * b[1];
  y = a[2] * b[0] - a[0] * b[2];
  z = a[0] * b[1] - a[1] * b[0];
  const len = Math.sqrt(x * x + y * y + z * z + w * w);
  return [x / len, y / len, z / len, w / len];
}

// Quaternion from a 3x3 rotation matrix given as rows (Shepperd's method)
export function quatFromMat3(m: number[][]): Quat {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = s / 4;
    x = (m[2][1] - m[1][2]) / s;
    y = (m[0][2] - m[2][0]) / s;
    z = (m[1][0] - m[0][1]) / s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    w = (m[2][1] - m[1][2]) / s;
    x = s / 4;
    y = (m[0][1] + m[1][0]) / s;
    z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    w = (m[0][2] - m[2][0]) / s;
    x = (m[0][1] + m[1][0]) / s;
    y = s / 4;
    z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    w = (m[1][0] - m[0][1]) / s;
    x = (m[0][2] + m[2][0]) / s;
    y = (m[1][2] + m[2][1]) / s;
    z = s / 4;
  }
  return [x, y, z, w];
}

// ── Small Vec3 helpers ──

export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecNormalize(a: Vec3): Vec3 {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return [a[0] / len, a[1] / len, a[2] / len];
}
