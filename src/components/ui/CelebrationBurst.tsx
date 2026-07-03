'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

// Total lifetime of the celebration. Matches the animation timeline below:
// the border trace + shine sweep run ~900ms, then the glow pulse is delayed
// ~820ms and lasts ~1050ms.
const CELEBRATION_MS = 1950;
const GOLD = '#fbbf24';

/**
 * One-shot "session confirmed" celebration: a gold border traces around the
 * card while a shine sweeps across, then a gold glow pulses.
 *
 * Deliberately self-contained — all structure is inline-styled, the trace rect
 * carries `fill="none"` as an attribute, and the motion runs through the Web
 * Animations API. It does NOT depend on any global stylesheet, so a missing or
 * stale CSS rule can never leave the SVG rect showing its default black fill.
 *
 * Render it inside a `relative isolate overflow-hidden` row; do NOT render it
 * when prefers-reduced-motion is set (the parent already gates on that).
 */
export function SessionCelebration({ onDone }: { onDone?: () => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rectRef = useRef<SVGRectElement | null>(null);
  const sheenRef = useRef<HTMLSpanElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useLayoutEffect(() => {
    const finish = () => onDoneRef.current?.();
    const svg = svgRef.current;
    const rect = rectRef.current;
    const sheen = sheenRef.current;
    const row = svg?.parentElement as HTMLElement | null;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const canAnimate = typeof rect?.animate === 'function';

    if (reduce || !svg || !rect || !canAnimate) {
      const t = setTimeout(finish, 300);
      return () => clearTimeout(t);
    }

    // Size the trace rect to the card's real pixels (an SVG `%` length would
    // otherwise resolve against the default 300x150 viewport).
    const { width, height } = svg.getBoundingClientRect();
    const w = Math.round(width);
    const h = Math.round(height);
    if (w && h) {
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      rect.setAttribute('x', '1.5');
      rect.setAttribute('y', '1.5');
      rect.setAttribute('width', String(w - 3));
      rect.setAttribute('height', String(h - 3));
    }

    const anims: Animation[] = [];
    // Phase 1 — border draws + shine sweeps (together, ~900ms).
    anims.push(
      rect.animate(
        [
          { strokeDashoffset: '100', opacity: 1 },
          { strokeDashoffset: '0', opacity: 1, offset: 0.7 },
          { strokeDashoffset: '0', opacity: 0 },
        ],
        { duration: 900, easing: 'ease-in-out', fill: 'forwards' }
      )
    );
    if (sheen) {
      anims.push(
        sheen.animate(
          [
            { transform: 'translateX(-130%)', opacity: 0 },
            { opacity: 1, offset: 0.12 },
            { opacity: 1, offset: 0.88 },
            { transform: 'translateX(130%)', opacity: 0 },
          ],
          { duration: 900, easing: 'ease-in-out', fill: 'forwards' }
        )
      );
    }
    // Phase 2 — gold glow pulse on the row itself. It's the row's own
    // box-shadow, which the row's overflow-hidden does NOT clip, so the halo
    // can bloom outward while the trace/shine stay contained.
    if (typeof row?.animate === 'function') {
      anims.push(
        row.animate(
          [
            { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
            {
              boxShadow:
                '0 0 0 1px rgba(251,191,36,0.5), 0 0 22px 5px rgba(251,191,36,0.55)',
              offset: 0.3,
            },
            { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
          ],
          { duration: 1050, delay: 820, easing: 'ease-out', fill: 'forwards' }
        )
      );
    }

    const timer = setTimeout(finish, CELEBRATION_MS);
    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <>
      <svg
        ref={svgRef}
        aria-hidden="true"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <rect
          ref={rectRef}
          fill="none"
          stroke={GOLD}
          strokeWidth={2}
          rx={11}
          ry={11}
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
        />
      </svg>
      <span
        ref={sheenRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0,
          transform: 'translateX(-130%)',
          background:
            'linear-gradient(105deg, transparent 40%, rgba(255,240,200,0.5) 50%, transparent 60%)',
        }}
      />
    </>
  );
}
