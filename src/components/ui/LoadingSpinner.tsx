'use client';

import { useEffect, useRef } from 'react';
import {
  D20Renderer,
  SPINNER_CAMERA,
  TRAY_CAMERA,
  readDieTheme,
} from '@/lib/dieRenderer';
import { TumbleDriver } from '@/lib/diceTumble';
import { CritBurst } from '@/lib/critBurst';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** When set (1-20), throws the die with physics and lands on this number. */
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

export function LoadingSpinner({
  size = 'md',
  className = '',
  rollResult,
  onRollComplete,
}: LoadingSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimension = sizes[size];
  const isRollMode = rollResult != null && rollResult >= 1 && rollResult <= 20;

  // Store onRollComplete in a ref so the render effect doesn't restart
  // when the parent passes an unstable callback reference.
  const onRollCompleteRef = useRef(onRollComplete);
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new D20Renderer(
      canvas,
      isRollMode ? TRAY_CAMERA : SPINNER_CAMERA,
      readDieTheme(),
      isRollMode ? { shadow: true, numbers: 'all' } : { shadow: false, numbers: 'crit' }
    );

    // Track theme changes (the app supports live theme switching). The roll
    // loop stops once the die settles, so redraw the final pose explicitly.
    let redrawSettled: (() => void) | null = null;
    const themeObserver = new MutationObserver(() => {
      renderer.setTheme(readDieTheme());
      redrawSettled?.();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let resizeObserver: ResizeObserver | null = null;
    if (isRollMode) {
      // Roll mode fills its container (wide tray view)
      const resize = () =>
        renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      renderer.resize(dimension, dimension, dpr);
    }

    let raf = 0;
    let cancelled = false;

    if (isRollMode) {
      // cannon-es loads on demand: only roll mode pays for the physics engine
      import('@/lib/dicePhysics').then((physics) => {
        if (cancelled) return;
        const sim = physics.simulateRoll();
        const playback = physics.createPlayback(
          sim,
          rollResult,
          performance.now()
        );
        let burst: CritBurst | null = null;
        let settled = false;
        let last: number | null = null;
        const loop = (now: number) => {
          const dt = last == null ? 0 : (now - last) / 1000;
          last = now;
          const { p, q } = physics.evalPlayback(playback, now);

          if (playback.done && !settled) {
            settled = true;
            redrawSettled = () => renderer.render(p, q);
            onRollCompleteRef.current?.();
            if (rollResult === 20) {
              // Nat 20: the die erupts where it landed
              const { x, y, radius } = renderer.screenPosition(p);
              burst = new CritBurst(x, y, radius);
            }
          }

          burst?.step(dt);
          renderer.render(
            p,
            q,
            burst && !burst.done
              ? {
                  underlay: (ctx) => burst!.drawBack(ctx),
                  overlay: (ctx) => burst!.drawFront(ctx),
                }
              : undefined
          );

          if (!playback.done || (burst && !burst.done)) {
            raf = requestAnimationFrame(loop);
          }
        };
        raf = requestAnimationFrame(loop);
      });
    } else {
      // Perpetual physics-feel tumble (pure quaternion motion, no engine)
      const driver = new TumbleDriver();
      let last: number | null = null;
      const loop = (now: number) => {
        const dt = last == null ? 0 : (now - last) / 1000;
        last = now;
        renderer.render([0, 0, 0], driver.step(dt));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [dimension, isRollMode, rollResult]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={isRollMode ? `D20 showing ${rollResult}` : 'Loading'}
      style={
        isRollMode
          ? { width: '100%', aspectRatio: '16 / 10' }
          : { width: dimension, height: dimension }
      }
    />
  );
}
