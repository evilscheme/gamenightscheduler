'use client';

import { useSyncExternalStore } from 'react';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

// ─── Dice configuration ─────────────────────────────────────────────────────

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

const DICE_COUNT_DESKTOP = 100;
const DICE_COUNT_MOBILE = 42;

// Seeded PRNG for deterministic layout across renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GeneratedDie {
  face: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  rotate: number;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

function generateDice(count: number, seed: number): GeneratedDie[] {
  const rand = mulberry32(seed);
  const dice: GeneratedDie[] = [];

  for (let i = 0; i < count; i++) {
    dice.push({
      face: Math.floor(rand() * 6),
      size: Math.round(16 + rand() * 24), // 16-40px
      opacity: 0.04 + rand() * 0.1, // 0.04-0.14
      duration: 5 + rand() * 5, // 5-10s
      delay: rand() * 8, // 0-8s
      rotate: Math.round(-45 + rand() * 90), // -45 to 45 degrees
      x: rand() * 100, // 0-100%
      y: rand() * 100, // 0-100%
    });
  }

  return dice;
}

const DICE_DESKTOP = generateDice(DICE_COUNT_DESKTOP, 42);
const DICE_MOBILE = generateDice(DICE_COUNT_MOBILE, 9);

function DiceField({ dice, className }: { dice: GeneratedDie[]; className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
      {dice.map((die, i) => {
        const Icon = DICE_ICONS[die.face];
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${die.x}%`,
              top: `${die.y}%`,
              transform: `rotate(${die.rotate}deg)`,
            }}
          >
            <Icon
              className="dice-filled animate-[float_6s_ease-in-out_infinite]"
              style={{
                color: `color-mix(in srgb, var(--primary) ${Math.round(die.opacity * 100)}%, transparent)`,
                animationDuration: `${die.duration}s`,
                animationDelay: `${die.delay}s`,
              }}
              size={die.size}
            />
          </div>
        );
      })}
    </div>
  );
}

// Stable no-op subscription: the hydration snapshot never changes after mount.
const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the first hydration render, true afterward.
 * Implemented with useSyncExternalStore (server snapshot = false, client snapshot
 * = true) rather than a useState/useEffect mount flag, so it is hydration-safe AND
 * avoids setting state in an effect (react-hooks/set-state-in-effect).
 */
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Decorative floating-dice background for the hero. Rendered client-only: returns
 * null until hydrated, so the (purely decorative) dice never appear in the
 * server-rendered HTML — keeping the raw `/` response small. Server and first
 * client render both produce null (no hydration mismatch); the dice fade in after
 * mount.
 */
export function FloatingDice() {
  const hydrated = useHydrated();

  if (!hydrated) return null;

  return (
    <>
      <DiceField dice={DICE_DESKTOP} className="hidden sm:block" />
      <DiceField dice={DICE_MOBILE} className="sm:hidden" />
    </>
  );
}
