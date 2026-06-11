// Perpetual "die turning in the air" motion for loading states.
// No physics engine: a freely tumbling icosahedron is just quaternion
// integration. The physical feel comes from the angular velocity profile —
// periodic flicks (a hand jostling the die) that decay back to a cruising
// speed under drag, plus a slowly wandering spin axis so the motion never
// becomes a constant-rate rotation.

import {
  type Quat,
  type Vec3,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
} from '@/lib/quat';

export interface TumbleParams {
  /** rad/s the spin relaxes toward between flicks */
  baseSpeed: number;
  /** average seconds between flicks */
  flickIntervalSec: number;
  /** rad/s added by a flick */
  flickStrength: number;
}

export const DEFAULT_TUMBLE_PARAMS: TumbleParams = {
  baseSpeed: 2.2,
  flickIntervalSec: 2.4,
  flickStrength: 6,
};

// Uniformly distributed direction on the unit sphere
function randomDir(): Vec3 {
  const z = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), r * Math.sin(t), z];
}

export class TumbleDriver {
  q: Quat;
  private omega: Vec3;
  private untilFlick: number;

  constructor(params: TumbleParams = DEFAULT_TUMBLE_PARAMS) {
    this.q = quatFromAxisAngle(randomDir(), Math.random() * Math.PI * 2);
    const d = randomDir();
    this.omega = [
      d[0] * params.baseSpeed,
      d[1] * params.baseSpeed,
      d[2] * params.baseSpeed,
    ];
    // Stagger the first flick so multiple dice don't pulse in sync
    this.untilFlick = Math.random() * params.flickIntervalSec;
  }

  /** Advance the tumble by dt seconds and return the new orientation */
  step(dtRaw: number, params: TumbleParams = DEFAULT_TUMBLE_PARAMS): Quat {
    // Clamp so a background-tab pause doesn't produce a giant rotation jump
    const dt = Math.min(Math.max(dtRaw, 0), 0.05);

    this.untilFlick -= dt;
    if (this.untilFlick <= 0) {
      const d = randomDir();
      const k = params.flickStrength * (0.7 + Math.random() * 0.6);
      this.omega = [
        this.omega[0] + d[0] * k,
        this.omega[1] + d[1] * k,
        this.omega[2] + d[2] * k,
      ];
      this.untilFlick = params.flickIntervalSec * (0.6 + Math.random() * 0.8);
    }

    let speed = Math.hypot(this.omega[0], this.omega[1], this.omega[2]);
    if (speed < 1e-6) {
      const d = randomDir();
      this.omega = [
        d[0] * params.baseSpeed,
        d[1] * params.baseSpeed,
        d[2] * params.baseSpeed,
      ];
      speed = params.baseSpeed;
    }

    // Drag: speed eases back toward the base between flicks
    const newSpeed =
      params.baseSpeed + (speed - params.baseSpeed) * Math.exp(-1.3 * dt);

    // Slow axis wander so the spin axis precesses organically
    const w = randomDir();
    const wander = 0.4 * dt;
    let ax = this.omega[0] / speed + w[0] * wander;
    let ay = this.omega[1] / speed + w[1] * wander;
    let az = this.omega[2] / speed + w[2] * wander;
    const axisLen = Math.hypot(ax, ay, az);
    ax /= axisLen;
    ay /= axisLen;
    az /= axisLen;
    this.omega = [ax * newSpeed, ay * newSpeed, az * newSpeed];

    // Integrate: world-frame angular velocity pre-multiplies the orientation
    this.q = quatNormalize(
      quatMultiply(quatFromAxisAngle([ax, ay, az], newSpeed * dt), this.q)
    );
    return this.q;
  }
}
