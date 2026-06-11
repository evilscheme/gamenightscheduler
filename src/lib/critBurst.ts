// Nat-20 celebration: gold light rays erupting from behind the die, a
// shockwave ring, and a spray of sparks. Pure canvas-2D, sized relative to
// the die's on-screen radius so it scales from phone to desktop.

const DURATION = 2.2; // seconds
const RAY_COUNT = 12;
const SPARK_COUNT = 80;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  hue: number;
  white: boolean;
}

export class CritBurst {
  done = false;
  private t = 0;
  private sparks: Spark[] = [];

  /**
   * @param cx,cy  burst origin in CSS pixels (the die's screen center)
   * @param scale  the die's on-screen radius in CSS pixels
   */
  constructor(
    private cx: number,
    private cy: number,
    private scale: number
  ) {
    for (let i = 0; i < SPARK_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = scale * (2 + Math.random() * 5);
      this.sparks.push({
        x: cx,
        y: cy - scale * 0.2,
        vx: Math.cos(ang) * speed,
        // Upward bias so the spray fountains over the die
        vy: Math.sin(ang) * speed - scale * (1 + Math.random() * 1.5),
        age: 0,
        life: 0.7 + Math.random() * 0.9,
        size: scale * (0.04 + Math.random() * 0.05),
        hue: 40 + Math.random() * 15,
        white: Math.random() < 0.25,
      });
    }
  }

  step(dtRaw: number) {
    const dt = Math.min(Math.max(dtRaw, 0), 0.05);
    this.t += dt;
    const gravity = this.scale * 6;
    for (const s of this.sparks) {
      s.age += dt;
      s.vy += gravity * dt;
      s.vx *= 1 - 0.9 * dt; // air drag
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    if (this.t >= DURATION) this.done = true;
  }

  /** Light rays + shockwave ring — draw BEHIND the die */
  drawBack(ctx: CanvasRenderingContext2D) {
    const { t, cx, cy, scale } = this;
    // Envelope: quick rise, long fade
    const rise = Math.min(t / 0.2, 1);
    const fall = Math.max(0, 1 - Math.max(0, t - (DURATION - 0.7)) / 0.7);
    const env = rise * fall;
    if (env <= 0) return;

    ctx.save();
    ctx.translate(cx, cy - scale * 0.2);
    ctx.rotate(t * 0.35);
    ctx.fillStyle = 'hsl(45, 100%, 60%)';
    for (let i = 0; i < RAY_COUNT; i++) {
      const ang = (i / RAY_COUNT) * Math.PI * 2;
      const len = scale * (2.4 + 0.5 * Math.sin(t * 3 + i * 1.7));
      ctx.globalAlpha = env * (i % 2 === 0 ? 0.2 : 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * scale * 0.5, Math.sin(ang) * scale * 0.5);
      ctx.lineTo(Math.cos(ang - 0.07) * len, Math.sin(ang - 0.07) * len);
      ctx.lineTo(Math.cos(ang + 0.07) * len, Math.sin(ang + 0.07) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Shockwave ring in the first half second
    const ringT = t / 0.45;
    if (ringT < 1) {
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - ringT);
      ctx.strokeStyle = 'hsl(48, 100%, 70%)';
      ctx.lineWidth = scale * 0.12 * (1 - ringT) + 1;
      ctx.beginPath();
      ctx.arc(cx, cy - scale * 0.2, scale * (0.9 + ringT * 2.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Spark spray — draw IN FRONT of the die */
  drawFront(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const s of this.sparks) {
      const a = 1 - s.age / s.life;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.white
        ? 'hsl(50, 100%, 88%)'
        : `hsl(${s.hue}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
