'use client';

import { useEffect, useRef } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** When true, shows the crit face (20) facing forward without animation */
  staticCritFace?: boolean;
  /** When set (1-20), rolls the die and stops on this number. Numbers appear on all faces. */
  rollResult?: number;
  /** Called when the roll animation finishes (only used with rollResult) */
  onRollComplete?: () => void;
}

// Larger sizes for 3D readability
const sizes = {
  sm: 24,
  md: 48,
  lg: 96,
  xl: 192,
};

// Icosahedron geometry using golden ratio
const PHI = (1 + Math.sqrt(5)) / 2;

// 12 vertices of an icosahedron (normalized)
const VERTICES: [number, number, number][] = [
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

// 20 triangular faces of the icosahedron (vertex indices, counter-clockwise)
const FACES: [number, number, number][] = [
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

// The "crit" face - face index 0 will have "20" on it
const CRIT_FACE_INDEX = 0;

// Number assignment for each face (index = face index, value = number on that face)
// Opposite faces sum to 21, following standard d20 convention
const FACE_NUMBERS = [
  20, 14, 8, 16, 2, 12, 10, 6, 18, 4, 9, 11, 15, 3, 17, 13, 7, 1, 19, 5,
];

// Pre-compute face normals via cross product (outward-pointing for CCW winding)
const FACE_NORMALS: [number, number, number][] = FACES.map(([i, j, k]) => {
  const v0 = VERTICES[i], v1 = VERTICES[j], v2 = VERTICES[k];
  const e1x = v1[0] - v0[0], e1y = v1[1] - v0[1], e1z = v1[2] - v0[2];
  const e2x = v2[0] - v0[0], e2y = v2[1] - v0[1], e2z = v2[2] - v0[2];
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return [nx / len, ny / len, nz / len] as [number, number, number];
});

// Pre-compute the Euler angles (rotateX, rotateY) that orient each face toward +Z
// Given rotation order Rz(az)*Ry(ay)*Rx(ax), we solve for angles that map
// the face normal to (0, 0, 1):
//   ax = atan2(ny, nz) → zeroes out the y-component after Rx
//   ay = atan2(-nx, sqrt(ny²+nz²)) → zeroes out the x-component after Ry
const FACE_ORIENTATIONS: [number, number, number][] = FACE_NORMALS.map(([nx, ny, nz]) => {
  const ax = Math.atan2(ny, nz);
  const ay = Math.atan2(-nx, Math.sqrt(ny * ny + nz * nz));
  return [ax, ay, 0] as [number, number, number];
});

// Project 3D to 2D with perspective
// perspective = 4: Camera distance from origin. Higher values = less distortion, flatter look.
//                  4 gives a subtle 3D effect without extreme foreshortening.
function project(
  point: [number, number, number],
  scale: number,
  offsetX: number,
  offsetY: number
): [number, number, number] {
  const perspective = 4;
  const z = point[2] + perspective;
  const factor = perspective / z;
  return [point[0] * factor * scale + offsetX, point[1] * factor * scale + offsetY, point[2]];
}

// Parse color string (hex or HSL) to HSL components
function parseColor(color: string): { h: number; s: number; l: number } | null {
  // Handle hex colors like #7c3aed or #fff
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: l * 100 };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  // Handle "221.2 83.2% 53.3%" format (Tailwind CSS variables)
  const match = color.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
  if (match) {
    return {
      h: parseFloat(match[1]),
      s: parseFloat(match[2]),
      l: parseFloat(match[3]),
    };
  }

  return null;
}

// Draw a number on a triangular face using perspective-correct affine transform
function drawFaceNumber(
  ctx: CanvasRenderingContext2D,
  faceIndex: number,
  face: [number, number, number],
  transformed: [number, number, number][],
  scale: number,
  center: number,
  showAllNumbers: boolean,
  dpr: number,
  verticalCenterCache: Map<string, number>,
) {
  const [i, j, k] = face;
  const v0 = transformed[i];
  const v1 = transformed[j];
  const v2 = transformed[k];

  // Calculate face centroid in 3D
  const centroid3D: [number, number, number] = [
    (v0[0] + v1[0] + v2[0]) / 3,
    (v0[1] + v1[1] + v2[1]) / 3,
    (v0[2] + v1[2] + v2[2]) / 3,
  ];

  // Use v0 as fixed "up" reference for consistent text orientation
  // This keeps the text stable as the die rotates (no flipping)
  const upDir: [number, number, number] = [
    v0[0] - centroid3D[0],
    v0[1] - centroid3D[1],
    v0[2] - centroid3D[2],
  ];
  const upLen = Math.sqrt(upDir[0] ** 2 + upDir[1] ** 2 + upDir[2] ** 2);
  const localY: [number, number, number] = [
    upDir[0] / upLen,
    upDir[1] / upLen,
    upDir[2] / upLen,
  ];

  // Calculate face normal (edge1 x edge2)
  const edge1: [number, number, number] = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
  const edge2: [number, number, number] = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
  const faceNormal: [number, number, number] = [
    edge1[1] * edge2[2] - edge1[2] * edge2[1],
    edge1[2] * edge2[0] - edge1[0] * edge2[2],
    edge1[0] * edge2[1] - edge1[1] * edge2[0],
  ];
  const normalLen = Math.sqrt(
    faceNormal[0] ** 2 + faceNormal[1] ** 2 + faceNormal[2] ** 2
  );
  const normalizedNormal: [number, number, number] = [
    faceNormal[0] / normalLen,
    faceNormal[1] / normalLen,
    faceNormal[2] / normalLen,
  ];

  // localX = normal x localY (right direction when facing the face)
  // Combined with negated Y transform, this gives correct non-mirrored text
  const localX: [number, number, number] = [
    normalizedNormal[1] * localY[2] - normalizedNormal[2] * localY[1],
    normalizedNormal[2] * localY[0] - normalizedNormal[0] * localY[2],
    normalizedNormal[0] * localY[1] - normalizedNormal[1] * localY[0],
  ];

  // Project centroid and offset points to get 2D transform
  const textScale = 0.4; // Scale factor for text size relative to face
  const centroidProj = project(centroid3D, scale, center, center);

  // Project points offset along local X and Y axes
  const xOffset3D: [number, number, number] = [
    centroid3D[0] + localX[0] * textScale,
    centroid3D[1] + localX[1] * textScale,
    centroid3D[2] + localX[2] * textScale,
  ];
  const yOffset3D: [number, number, number] = [
    centroid3D[0] + localY[0] * textScale,
    centroid3D[1] + localY[1] * textScale,
    centroid3D[2] + localY[2] * textScale,
  ];

  const xOffsetProj = project(xOffset3D, scale, center, center);
  const yOffsetProj = project(yOffset3D, scale, center, center);

  // Calculate the 2D transform vectors
  // Note: Y axis is negated because canvas text has top in -Y direction,
  // but we want the top of the number to point toward the apex
  const ax = xOffsetProj[0] - centroidProj[0];
  const ay = xOffsetProj[1] - centroidProj[1];
  const bx = centroidProj[0] - yOffsetProj[0]; // negated
  const by = centroidProj[1] - yOffsetProj[1]; // negated

  // Apply affine transform with DPR scaling (setTransform replaces the context's
  // DPR scale, so we must factor it into the transform matrix directly)
  ctx.save();
  ctx.setTransform(ax * dpr, ay * dpr, bx * dpr, by * dpr, centroidProj[0] * dpr, centroidProj[1] * dpr);

  const number = showAllNumbers ? FACE_NUMBERS[faceIndex] : 20;
  const text = String(number);
  const isCrit = number === 20;

  // Draw text with offset toward base of triangle for better visual centering
  const fontSize = 1.1; // In transform units
  const textY = 0.45; // Y offset moves toward base (away from apex)
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Use pre-cached vertical center offset instead of calling measureText per-face per-frame
  const verticalCenter = verticalCenterCache.get(text) ?? 0;

  if (isCrit) {
    // Gold text with dark outline for the 20 face
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 0.1;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, textY + verticalCenter);
    ctx.fillStyle = 'hsl(45, 100%, 50%)';
    ctx.fillText(text, 0, textY + verticalCenter);
  } else {
    // White text with dark outline for all other faces
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 0.08;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, textY + verticalCenter);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(text, 0, textY + verticalCenter);
  }

  ctx.restore();
}

// Quartic ease-out for smooth deceleration
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function LoadingSpinner({
  size = 'md',
  className = '',
  staticCritFace = false,
  rollResult,
  onRollComplete,
}: LoadingSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const rollCompleteCalledRef = useRef(false);
  const dimension = sizes[size];

  // For roll mode: random start angles, computed once per rollResult change
  const rollStartRef = useRef<[number, number, number] | null>(null);

  // Store parsed theme colors in a ref to avoid animation restarts on theme change.
  // The MutationObserver updates this ref directly; the render loop reads it each frame.
  const colorsRef = useRef<{
    primaryHSL: ReturnType<typeof parseColor>;
    foregroundHSL: ReturnType<typeof parseColor>;
  }>({
    primaryHSL: parseColor('#7c3aed'),
    foregroundHSL: parseColor('#3b0764'),
  });

  // Store onRollComplete in a ref so the render effect doesn't restart
  // when the parent passes an unstable callback reference.
  const onRollCompleteRef = useRef(onRollComplete);
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  });

  // Listen for theme changes via MutationObserver on document root.
  // Parses HSL once per theme change instead of every animation frame.
  useEffect(() => {
    const updateColors = () => {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--primary').trim() || '#7c3aed';
      const foreground = style.getPropertyValue('--foreground').trim() || '#3b0764';
      colorsRef.current = {
        primaryHSL: parseColor(primary),
        foregroundHSL: parseColor(foreground),
      };
    };
    updateColors();

    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  // Generate new random start angles when rollResult changes
  useEffect(() => {
    if (rollResult != null) {
      rollStartRef.current = [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ];
      rollCompleteCalledRef.current = false;
    }
  }, [rollResult]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas buffer for crisp rendering on HiDPI/Retina displays.
    // CSS size stays at `dimension`; physical buffer is `dimension * dpr`.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimension * dpr;
    canvas.height = dimension * dpr;
    ctx.scale(dpr, dpr);

    let startTime: number | null = null;
    const isRollMode = rollResult != null && rollResult >= 1 && rollResult <= 20;
    const showAllNumbers = isRollMode;

    // Roll animation config
    const ROLL_DURATION = 2.0; // seconds
    const EXTRA_SPINS = 3; // full rotations added for visual effect

    // Find target face index for rollResult
    let targetFaceIndex = 0;
    if (isRollMode) {
      targetFaceIndex = FACE_NUMBERS.indexOf(rollResult);
      if (targetFaceIndex === -1) targetFaceIndex = 0;
    }

    // Rotation speeds (radians per second) for spinning mode
    // These values have irrational ratios to each other (~0.636, ~2.75, ~0.364), ensuring
    // the die never returns to exactly the same orientation - creating perpetual, organic motion.
    const speedX = 0.7;
    const speedY = 1.1;
    const speedZ = 0.4;

    // Pre-calculated angles to orient face 0 (crit face) toward viewer
    // These rotate the die so the "20" face normal aligns with +Z axis
    const staticAngleX = -0.46;
    const staticAngleY = -0.32;

    const scale = dimension * 0.35;
    const center = dimension / 2;
    const perspective = 4;

    // Pre-allocate buffers to avoid per-frame GC pressure.
    // These arrays are mutated in-place during each render frame instead of
    // creating new arrays via .map() on every requestAnimationFrame callback.
    const transformed: [number, number, number][] = VERTICES.map(
      () => [0, 0, 0] as [number, number, number]
    );
    const projected: [number, number, number][] = VERTICES.map(
      () => [0, 0, 0] as [number, number, number]
    );
    const facesWithDepth = FACES.map((face, faceIndex) => ({
      face,
      faceIndex,
      centerZ: 0,
      lightIntensity: 0,
      normalizedNormalZ: 0,
    }));

    // Pre-cache text vertical-center offsets for all d20 numbers.
    // Canvas measureText is transform-independent for a given font size,
    // so we measure once at effect setup rather than per-face per-frame.
    const verticalCenterCache = new Map<string, number>();
    ctx.save();
    ctx.font = 'bold 1.1px sans-serif';
    for (let n = 1; n <= 20; n++) {
      const text = String(n);
      const metrics = ctx.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      verticalCenterCache.set(text, ascent - (ascent + descent));
    }
    ctx.restore();

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      let angleX: number, angleY: number, angleZ: number;

      if (isRollMode) {
        const startAngles = rollStartRef.current || [0, 0, 0];
        const targetAngles = FACE_ORIENTATIONS[targetFaceIndex];

        const t = Math.min(elapsed / ROLL_DURATION, 1);
        const eased = easeOutQuart(t);

        // Interpolate from random start to target, adding extra full spins
        angleX = startAngles[0] + (targetAngles[0] + EXTRA_SPINS * Math.PI * 2 - startAngles[0]) * eased;
        angleY = startAngles[1] + (targetAngles[1] + EXTRA_SPINS * Math.PI * 2 - startAngles[1]) * eased;
        angleZ = startAngles[2] + (targetAngles[2] - startAngles[2]) * eased;
      } else if (staticCritFace) {
        angleX = staticAngleX;
        angleY = staticAngleY;
        angleZ = 0;
      } else {
        angleX = elapsed * speedX;
        angleY = elapsed * speedY;
        angleZ = elapsed * speedZ;
      }

      ctx.clearRect(0, 0, dimension, dimension);

      // Transform vertices in-place via inlined rotateX → rotateY → rotateZ chain.
      // Trig is computed once outside the loop to avoid redundant Math.cos/sin per vertex.
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
      const cosZ = Math.cos(angleZ), sinZ = Math.sin(angleZ);

      for (let i = 0; i < VERTICES.length; i++) {
        const [vx, vy, vz] = VERTICES[i];
        // rotateX: [x, y*cos-z*sin, y*sin+z*cos]
        const ry = vy * cosX - vz * sinX;
        const rz = vy * sinX + vz * cosX;
        // rotateY: [x*cos+z*sin, y, -x*sin+z*cos]
        const mx = vx * cosY + rz * sinY;
        const mz = -vx * sinY + rz * cosY;
        // rotateZ: [x*cos-y*sin, x*sin+y*cos, z]
        transformed[i][0] = mx * cosZ - ry * sinZ;
        transformed[i][1] = mx * sinZ + ry * cosZ;
        transformed[i][2] = mz;
      }

      // Project to 2D in-place
      for (let i = 0; i < VERTICES.length; i++) {
        const tz = transformed[i][2] + perspective;
        const factor = perspective / tz;
        projected[i][0] = transformed[i][0] * factor * scale + center;
        projected[i][1] = transformed[i][1] * factor * scale + center;
        projected[i][2] = transformed[i][2];
      }

      // Read theme colors from ref (updated by MutationObserver, not per-frame)
      const { primaryHSL, foregroundHSL } = colorsRef.current;

      // Update face depth and lighting data in-place (inlined cross product).
      // Must read vertex indices from the stored .face, not FACES[fi], because
      // the sort from the previous frame reorders facesWithDepth.
      for (let fi = 0; fi < facesWithDepth.length; fi++) {
        const [i, j, k] = facesWithDepth[fi].face;
        const v0 = transformed[i], v1 = transformed[j], v2 = transformed[k];
        facesWithDepth[fi].centerZ = (v0[2] + v1[2] + v2[2]) / 3;

        const e1x = v1[0] - v0[0], e1y = v1[1] - v0[1], e1z = v1[2] - v0[2];
        const e2x = v2[0] - v0[0], e2y = v2[1] - v0[1], e2z = v2[2] - v0[2];
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);

        facesWithDepth[fi].lightIntensity = normalLength > 0 ? (nz / normalLength + 1) / 2 : 0.5;
        facesWithDepth[fi].normalizedNormalZ = normalLength > 0 ? nz / normalLength : 0;
      }

      // Sort faces back to front
      facesWithDepth.sort((a, b) => a.centerZ - b.centerZ);

      // Detect theme: dark themes have light foreground (high L)
      const isDarkTheme = foregroundHSL ? foregroundHSL.l > 50 : false;

      // Draw filled faces
      facesWithDepth.forEach(
        ({ face, faceIndex, lightIntensity, normalizedNormalZ }) => {
          const [i, j, k] = face;
          const [x0, y0] = projected[i];
          const [x1, y1] = projected[j];
          const [x2, y2] = projected[k];

          const isCritFace = faceIndex === CRIT_FACE_INDEX;
          const faceIsVisible = normalizedNormalZ > 0;

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.closePath();

          // Face fill with lighting - all faces use primary color
          const hue = primaryHSL?.h ?? 220;
          const sat = primaryHSL?.s ?? 80;

          let minL: number, maxL: number;
          if (isDarkTheme) {
            minL = 40;
            maxL = 70;
          } else {
            minL = 35;
            maxL = 60;
          }
          const adjustedLightness = minL + lightIntensity * (maxL - minL);

          ctx.fillStyle = `hsl(${hue}, ${sat}%, ${adjustedLightness}%)`;
          ctx.fill();

          // Edge stroke
          if (isDarkTheme) {
            ctx.strokeStyle = `hsl(${hue}, 60%, 25%)`;
          } else {
            ctx.strokeStyle = `hsl(${hue}, 50%, 25%)`;
          }
          ctx.lineWidth = Math.max(0.5, dimension / 48);
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Draw numbers on visible faces
          if (faceIsVisible) {
            if (showAllNumbers) {
              drawFaceNumber(ctx, faceIndex, face, transformed, scale, center, true, dpr, verticalCenterCache);
            } else if (isCritFace) {
              drawFaceNumber(ctx, faceIndex, face, transformed, scale, center, false, dpr, verticalCenterCache);
            }
          }
        }
      );

      // Continue animation or signal completion
      if (isRollMode) {
        if (elapsed < ROLL_DURATION) {
          animationRef.current = requestAnimationFrame(render);
        } else {
          // Animation complete — fire callback via ref
          if (!rollCompleteCalledRef.current && onRollCompleteRef.current) {
            rollCompleteCalledRef.current = true;
            onRollCompleteRef.current();
          }
        }
      } else if (!staticCritFace) {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [dimension, staticCritFace, rollResult]);

  return (
    <canvas
      ref={canvasRef}
      width={dimension}
      height={dimension}
      className={className}
      aria-label={rollResult != null ? `D20 showing ${rollResult}` : 'Loading'}
      style={{ width: dimension, height: dimension }}
    />
  );
}
