'use client';

import { useEffect, useRef, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** When true, shows the crit face (20) facing forward without animation */
  staticCritFace?: boolean;
}

// Larger sizes for 3D readability
const sizes = {
  sm: 24,
  md: 48,
  lg: 96,
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

// Rotation matrix multiplication
function rotateX(point: [number, number, number], angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [point[0], point[1] * cos - point[2] * sin, point[1] * sin + point[2] * cos];
}

function rotateY(point: [number, number, number], angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [point[0] * cos + point[2] * sin, point[1], -point[0] * sin + point[2] * cos];
}

function rotateZ(point: [number, number, number], angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos, point[2]];
}

// Calculate face normal for lighting
function calculateNormal(
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number]
): [number, number, number] {
  const ax = v1[0] - v0[0];
  const ay = v1[1] - v0[1];
  const az = v1[2] - v0[2];
  const bx = v2[0] - v0[0];
  const by = v2[1] - v0[1];
  const bz = v2[2] - v0[2];
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

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

export function LoadingSpinner({
  size = 'md',
  className = '',
  staticCritFace = false,
}: LoadingSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const dimension = sizes[size];

  // Cache theme colors outside render loop to avoid expensive getComputedStyle calls every frame
  const [colors, setColors] = useState({ primary: '#7c3aed', foreground: '#3b0764' });

  // Listen for theme changes via MutationObserver on document root
  useEffect(() => {
    const updateColors = () => {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--primary').trim() || '#7c3aed';
      const foreground = style.getPropertyValue('--foreground').trim() || '#3b0764';
      setColors({ primary, foreground });
    };
    updateColors();

    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime: number | null = null;

    // Rotation speeds (radians per second).
    // These values have irrational ratios to each other (~0.636, ~2.75, ~0.364), ensuring
    // the die never returns to exactly the same orientation - creating perpetual, organic motion.
    const speedX = 0.7;
    const speedY = 1.1;
    const speedZ = 0.4;

    // Pre-calculated angles to orient face 0 (crit face) toward viewer
    // These rotate the die so the "20" face normal aligns with +Z axis
    const staticAngleX = -0.46;
    const staticAngleY = -0.32;
    const staticAngleZ = 0;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // Use static angles or animated rotation
      const angleX = staticCritFace ? staticAngleX : elapsed * speedX;
      const angleY = staticCritFace ? staticAngleY : elapsed * speedY;
      const angleZ = staticCritFace ? staticAngleZ : elapsed * speedZ;

      ctx.clearRect(0, 0, dimension, dimension);

      // Transform vertices
      const transformed = VERTICES.map((v) => {
        let point = rotateX(v, angleX);
        point = rotateY(point, angleY);
        point = rotateZ(point, angleZ);
        return point;
      });

      // Project to 2D
      // scale = 0.35 * dimension: Sizes the icosahedron to ~70% of canvas width,
      // leaving padding so edges don't clip during rotation.
      const scale = dimension * 0.35;
      const center = dimension / 2;
      const projected = transformed.map((v) => project(v, scale, center, center));

      // Use cached theme colors (updated via MutationObserver, not every frame)
      const { primary, foreground } = colors;
      const primaryHSL = parseColor(primary);
      const foregroundHSL = parseColor(foreground);

      // Prepare faces with depth and lighting info
      const facesWithDepth = FACES.map((face, faceIndex) => {
        const [i, j, k] = face;
        const v0 = transformed[i];
        const v1 = transformed[j];
        const v2 = transformed[k];

        const centerZ = (v0[2] + v1[2] + v2[2]) / 3;
        const normal = calculateNormal(v0, v1, v2);
        const normalLength = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        const lightIntensity = normalLength > 0 ? (normal[2] / normalLength + 1) / 2 : 0.5;
        const normalizedNormalZ = normalLength > 0 ? normal[2] / normalLength : 0;

        return {
          face,
          faceIndex,
          centerZ,
          lightIntensity,
          normalizedNormalZ,
        };
      });

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

          // Draw "20" on the crit face when it's facing the viewer
          if (isCritFace && faceIsVisible) {
            // Get the 3D transformed vertices for this face
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

            // localX = normal × localY (right direction when facing the face)
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
            // but we want the top of "20" to point toward the apex
            const ax = xOffsetProj[0] - centroidProj[0];
            const ay = xOffsetProj[1] - centroidProj[1];
            const bx = centroidProj[0] - yOffsetProj[0]; // negated
            const by = centroidProj[1] - yOffsetProj[1]; // negated

            // Apply affine transform: maps unit vectors to face-aligned vectors
            ctx.save();
            ctx.setTransform(ax, ay, bx, by, centroidProj[0], centroidProj[1]);

            // Draw text with offset toward base of triangle for better visual centering
            const fontSize = 1.1; // In transform units
            const textY = 0.45; // Y offset moves toward base (away from apex)
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            // Use 'alphabetic' baseline (more consistent across browsers) and manually center
            ctx.textBaseline = 'alphabetic';

            // Calculate true vertical center using actual font metrics
            const metrics = ctx.measureText('20');
            const ascent = metrics.actualBoundingBoxAscent;
            const descent = metrics.actualBoundingBoxDescent;
            const textHeight = ascent + descent;
            // Offset to center: move down by ascent, then back up by half height
            const verticalCenter = ascent - textHeight;

            // Gold text with dark outline for contrast on all backgrounds
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 0.1;
            ctx.lineJoin = 'round';
            ctx.strokeText('20', 0, textY + verticalCenter);
            ctx.fillStyle = 'hsl(45, 100%, 50%)';
            ctx.fillText('20', 0, textY + verticalCenter);

            ctx.restore();
          }
        }
      );

      // Only continue animation loop if not static
      if (!staticCritFace) {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [dimension, colors, staticCritFace]);

  return (
    <canvas
      ref={canvasRef}
      width={dimension}
      height={dimension}
      className={className}
      aria-label="Loading"
      style={{ width: dimension, height: dimension }}
    />
  );
}
