'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CritBurst } from '@/lib/critBurst';

/**
 * One-shot celebratory burst reusing the Nat-20 CritBurst effect. Renders a
 * fixed, click-through canvas overlay only while a burst is playing, then
 * unmounts itself. Respects prefers-reduced-motion.
 */
export function useCelebration(): { celebrate: () => void; overlay: React.ReactNode } {
  const [active, setActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const celebrate = useCallback(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return; // honor reduced-motion: no animation
    }
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Practically unreachable (2D context is always available), but bail
      // out safely without calling setState synchronously inside the effect.
      queueMicrotask(() => setActive(false));
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Burst from screen center, scaled to viewport.
    const burst = new CritBurst(w / 2, h / 2, Math.min(w, h) * 0.12);
    let raf = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      ctx.clearRect(0, 0, w, h);
      burst.step(dt);
      burst.drawBack(ctx);
      burst.drawFront(ctx);
      if (!burst.done) {
        raf = requestAnimationFrame(loop);
      } else {
        setActive(false);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const overlay = active ? (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-100 size-full"
    />
  ) : null;

  return { celebrate, overlay };
}
