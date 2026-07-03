'use client';

import { useEffect, useRef } from 'react';
import { CritBurst } from '@/lib/critBurst';

/**
 * A one-shot gold glow that blooms behind its positioned parent, reusing the
 * Nat-20 CritBurst's light-ray + shockwave layer (drawBack) — no sparks — so a
 * newly scheduled session appears to light up for a moment as it lands on the
 * page.
 *
 * Render this as a child of a `relative isolate` element; the canvas sits at
 * `-z-10` so it paints over the parent's background but behind its content,
 * and spills a little past the parent's box to halo around it. The caller must
 * NOT render this when `prefers-reduced-motion` is set.
 */
export function SessionGlow({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (!ctx || w === 0 || h === 0) {
      // No drawable surface (e.g. jsdom / detached): finish immediately without
      // a synchronous setState from inside the effect body.
      queueMicrotask(() => onDoneRef.current?.());
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Glow centered in the canvas box, scaled to the row height.
    const burst = new CritBurst(w / 2, h / 2, h * 0.42);
    let raf = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      ctx.clearRect(0, 0, w, h);
      burst.step(dt);
      burst.drawBack(ctx); // glow only — the spark layer (drawFront) is skipped
      if (!burst.done) {
        raf = requestAnimationFrame(loop);
      } else {
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute -inset-10 -z-10"
    />
  );
}
