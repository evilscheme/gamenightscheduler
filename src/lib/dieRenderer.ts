// Canvas-2D d20 renderer driven by an orientation quaternion (+ optional
// world position for rolls). Faces are drawn as projected, depth-sorted,
// Lambert-shaded polygons — no WebGL, no dependencies beyond the geometry
// and quaternion helpers.

import {
  D20_VERTICES,
  D20_FACES,
  D20_FACE_NUMBERS,
  D20_FACE_NORMALS,
} from '@/lib/d20Geometry';
import { DIE_RADIUS } from '@/lib/diceConfig';
import {
  type Quat,
  type Vec3,
  quatApply,
  vecCross,
  vecDot,
  vecNormalize,
  vecSub,
} from '@/lib/quat';

export interface DieCamera {
  pos: Vec3;
  look: Vec3;
  fovDeg: number;
}

/** Angled overhead view framing the roll tray (404 page) */
export const TRAY_CAMERA: DieCamera = {
  pos: [0, 9.6, 4.6],
  look: [0, 0.3, 0],
  fovDeg: 42,
};

/** Straight-on close view where the die fills the frame (loading spinner) */
export const SPINNER_CAMERA: DieCamera = {
  pos: [0, 0, 4.2],
  look: [0, 0, 0],
  fovDeg: 42,
};

export interface DieTheme {
  h: number;
  s: number;
  l: number;
  isDark: boolean;
}

export interface D20RendererOptions {
  /** Draw the floor contact shadow (default true; off for spinner mode) */
  shadow?: boolean;
  /** Which face numbers to draw: every face, or only the gold 20 (default 'all') */
  numbers?: 'all' | 'crit';
}

// Parse a CSS color custom property: Tailwind HSL triple ("262.1 83.3% 57.8%")
// or hex ("#7c3aed" / "#fff")
function parseColorToHSL(
  raw: string
): { h: number; s: number; l: number } | null {
  const triple = raw.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
  if (triple) {
    return {
      h: parseFloat(triple[1]),
      s: parseFloat(triple[2]),
      l: parseFloat(triple[3]),
    };
  }
  if (raw.startsWith('#')) {
    let hex = raw.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  return null;
}

/** Read the die's theme from the document's CSS variables */
export function readDieTheme(): DieTheme {
  const style = getComputedStyle(document.documentElement);
  const primary =
    parseColorToHSL(style.getPropertyValue('--primary').trim()) ?? {
      h: 262,
      s: 83,
      l: 58,
    };
  const foreground = parseColorToHSL(
    style.getPropertyValue('--foreground').trim()
  );
  // Dark themes have a light foreground
  return { ...primary, isDark: (foreground?.l ?? 10) > 50 };
}

const LIGHT_DIR = vecNormalize([4, 12, 4]);
const TEXT_SCALE = 0.4 * DIE_RADIUS; // world-space size of the number quad

export class D20Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  // Camera basis
  private camPos: Vec3;
  private fwd: Vec3;
  private right: Vec3;
  private up: Vec3;
  private focal: number;
  private theme: DieTheme;
  private shadow: boolean;
  private numbers: 'all' | 'crit';
  private verticalCenterCache = new Map<string, number>();

  constructor(
    private canvas: HTMLCanvasElement,
    camera: DieCamera,
    theme: DieTheme,
    opts: D20RendererOptions = {}
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.theme = theme;
    this.shadow = opts.shadow ?? true;
    this.numbers = opts.numbers ?? 'all';
    this.camPos = camera.pos;
    this.fwd = vecNormalize(vecSub(camera.look, camera.pos));
    this.right = vecNormalize(vecCross(this.fwd, [0, 1, 0]));
    this.up = vecCross(this.right, this.fwd);
    this.focal = 1 / Math.tan(((camera.fovDeg / 2) * Math.PI) / 180);

    // Pre-cache text vertical-center offsets (transform-independent)
    this.ctx.save();
    this.ctx.font = 'bold 1.1px sans-serif';
    for (let n = 1; n <= 20; n++) {
      const text = String(n);
      const m = this.ctx.measureText(text);
      this.verticalCenterCache.set(
        text,
        m.actualBoundingBoxAscent -
          (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)
      );
    }
    this.ctx.restore();
  }

  setTheme(theme: DieTheme) {
    this.theme = theme;
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
  }

  // Perspective-project a world point to canvas pixels (+ camera depth)
  private project(pt: Vec3): [number, number, number] {
    const d = vecSub(pt, this.camPos);
    const zv = vecDot(d, this.fwd);
    const xv = vecDot(d, this.right);
    const yv = vecDot(d, this.up);
    const k = (this.focal * this.h) / 2 / zv;
    return [this.w / 2 + xv * k, this.h / 2 - yv * k, zv];
  }

  /**
   * Draw a frame. Optional hooks draw extra effects in CSS-pixel space:
   * `underlay` after the clear but behind the die, `overlay` on top of it.
   */
  render(
    p: Vec3 | null,
    q: Quat | null,
    hooks?: {
      underlay?: (ctx: CanvasRenderingContext2D) => void;
      overlay?: (ctx: CanvasRenderingContext2D) => void;
    }
  ) {
    const { ctx, dpr, w, h } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!p || !q) return;

    hooks?.underlay?.(ctx);
    if (this.shadow) this.drawShadow(p);
    this.drawDie(p, q);
    hooks?.overlay?.(ctx);
  }

  /** A world point's canvas position in CSS pixels, plus the die's
   *  approximate on-screen radius there — for positioning effects. */
  screenPosition(p: Vec3): { x: number; y: number; radius: number } {
    const c = this.project(p);
    const edge = this.project([p[0] + DIE_RADIUS, p[1], p[2]]);
    return { x: c[0], y: c[1], radius: Math.abs(edge[0] - c[0]) };
  }

  // Contact shadow: a projected ellipse on the floor that fades with height
  private drawShadow(p: Vec3) {
    const { ctx, dpr } = this;
    const height = Math.max(0, p[1]);
    const alpha = 0.32 * Math.max(0.12, 1 - height * 0.12);
    const r = DIE_RADIUS * 0.92 * (1 - Math.min(height * 0.04, 0.3));

    const center: Vec3 = [p[0], 0.01, p[2]];
    const c = this.project(center);
    const px = this.project([center[0] + r, center[1], center[2]]);
    const pz = this.project([center[0], center[1], center[2] + r]);

    ctx.save();
    ctx.setTransform(
      (px[0] - c[0]) * dpr,
      (px[1] - c[1]) * dpr,
      (pz[0] - c[0]) * dpr,
      (pz[1] - c[1]) * dpr,
      c[0] * dpr,
      c[1] * dpr
    );
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  private drawDie(p: Vec3, q: Quat) {
    const { ctx, theme } = this;

    // Transform vertices to world space, project to screen
    const world: Vec3[] = D20_VERTICES.map((v) => {
      const r = quatApply(q, [
        v[0] * DIE_RADIUS,
        v[1] * DIE_RADIUS,
        v[2] * DIE_RADIUS,
      ]);
      return [r[0] + p[0], r[1] + p[1], r[2] + p[2]];
    });
    const screen = world.map((v) => this.project(v));

    // Approximate on-screen die radius for stroke width scaling
    const c0 = this.project(p);
    const cEdge = this.project([p[0] + DIE_RADIUS, p[1], p[2]]);
    const screenRadius = Math.abs(cEdge[0] - c0[0]);

    // Depth-sort faces back to front (larger camera depth first)
    const order = D20_FACES.map((face, faceIndex) => {
      const depth =
        (screen[face[0]][2] + screen[face[1]][2] + screen[face[2]][2]) / 3;
      return { face, faceIndex, depth };
    }).sort((a, b) => b.depth - a.depth);

    const { h, s, isDark } = theme;
    const minL = isDark ? 28 : 30;
    const maxL = isDark ? 68 : 62;

    for (const { face, faceIndex } of order) {
      const [i, j, k] = face;
      const nWorld = quatApply(q, D20_FACE_NORMALS[faceIndex]);
      const faceCenter: Vec3 = [
        (world[i][0] + world[j][0] + world[k][0]) / 3,
        (world[i][1] + world[j][1] + world[k][1]) / 3,
        (world[i][2] + world[j][2] + world[k][2]) / 3,
      ];
      const toCam = vecNormalize(vecSub(this.camPos, faceCenter));
      const visible = vecDot(nWorld, toCam) > 0;

      // Lambert shading against a fixed top-right key light. The low ambient
      // floor keeps real contrast between lit and shaded faces.
      const lambert = Math.max(0, vecDot(nWorld, LIGHT_DIR));
      const intensity = 0.12 + 0.88 * lambert;
      // Plastic sheen: a Blinn-Phong-style highlight on faces angled between
      // the light and the camera, so the brightest face visibly pops
      const halfVec = vecNormalize([
        LIGHT_DIR[0] + toCam[0],
        LIGHT_DIR[1] + toCam[1],
        LIGHT_DIR[2] + toCam[2],
      ]);
      const spec = Math.pow(Math.max(0, vecDot(nWorld, halfVec)), 14);
      const lightness = Math.min(
        minL + intensity * (maxL - minL) + spec * 12,
        maxL + 14
      );

      ctx.beginPath();
      ctx.moveTo(screen[i][0], screen[i][1]);
      ctx.lineTo(screen[j][0], screen[j][1]);
      ctx.lineTo(screen[k][0], screen[k][1]);
      ctx.closePath();
      ctx.fillStyle = `hsl(${h}, ${s}%, ${lightness}%)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${h}, ${isDark ? 60 : 50}%, 25%)`;
      ctx.lineWidth = Math.max(1, screenRadius / 24);
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (visible && (this.numbers === 'all' || faceIndex === 0)) {
        this.drawFaceNumber(faceIndex, world[i], world[j], world[k], nWorld);
      }
    }
  }

  // Draw the face number via an affine transform built from three projected
  // anchor points, so the glyph tracks the face in perspective.
  private drawFaceNumber(
    faceIndex: number,
    v0: Vec3,
    v1: Vec3,
    v2: Vec3,
    nWorld: Vec3
  ) {
    const { ctx, dpr } = this;
    const centroid: Vec3 = [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3,
    ];
    // Text-up points toward the apex vertex (v0)
    const localY = vecNormalize(vecSub(v0, centroid));
    // localY × n (not n × localY): the projection flips screen-y, which flips
    // chirality, so the right-direction must flip too or numbers mirror
    const localX = vecCross(localY, nWorld);

    const cProj = this.project(centroid);
    const xProj = this.project([
      centroid[0] + localX[0] * TEXT_SCALE,
      centroid[1] + localX[1] * TEXT_SCALE,
      centroid[2] + localX[2] * TEXT_SCALE,
    ]);
    const yProj = this.project([
      centroid[0] + localY[0] * TEXT_SCALE,
      centroid[1] + localY[1] * TEXT_SCALE,
      centroid[2] + localY[2] * TEXT_SCALE,
    ]);

    const ax = xProj[0] - cProj[0];
    const ay = xProj[1] - cProj[1];
    // Negated: canvas text +y is downward, we want it pointing away from apex
    const bx = cProj[0] - yProj[0];
    const by = cProj[1] - yProj[1];

    ctx.save();
    ctx.setTransform(
      ax * dpr,
      ay * dpr,
      bx * dpr,
      by * dpr,
      cProj[0] * dpr,
      cProj[1] * dpr
    );

    const num = D20_FACE_NUMBERS[faceIndex];
    const text = String(num);
    const isCrit = num === 20;
    const textY = 0.45 + (this.verticalCenterCache.get(text) ?? 0);

    ctx.font = 'bold 1.1px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = isCrit ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = isCrit ? 0.1 : 0.08;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, textY);
    ctx.fillStyle = isCrit ? 'hsl(45, 100%, 50%)' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(text, 0, textY);

    // Underline 6 and 9 so orientation is unambiguous
    if (num === 6 || num === 9) {
      ctx.beginPath();
      ctx.moveTo(-0.28, 0.62);
      ctx.lineTo(0.28, 0.62);
      ctx.lineWidth = 0.09;
      ctx.stroke();
    }

    ctx.restore();
  }
}
