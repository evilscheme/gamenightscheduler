'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarCheck,
  CalendarSearch,
  Calendar,
  Users,
  Layers,
  Shield,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
} from 'lucide-react';
import { Button } from '@/components/ui';

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

// ─── Main component ─────────────────────────────────────────────────────────

export function SplashPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <div className="relative overflow-hidden bg-linear-to-b from-primary/5 to-background">
      <FloatingDice />
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center relative z-10">
        <Image
          src="/logo.png"
          alt="Can We Play?"
          width={120}
          height={120}
          className="mx-auto mb-6"
          priority
        />
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Can We Play?</h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-lg mx-auto">
          Track availability. Find the best night. Play more games.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login">
            <Button size="lg">Get Started &mdash; It&apos;s Free</Button>
          </Link>
          <Link href="#how-it-works">
            <Button variant="ghost" size="lg">
              See How It Works
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

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

function FloatingDice() {
  return (
    <>
      <DiceField dice={DICE_DESKTOP} className="hidden sm:block" />
      <DiceField dice={DICE_MOBILE} className="sm:hidden" />
    </>
  );
}

// ─── How it works ───────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <div id="how-it-works" className="py-16 sm:py-24 bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
          <Step
            num={1}
            icon={<Users className="size-6" />}
            title="Invite your party"
            desc="Create a game and share an invite link. Players join with one click."
          />
          <Step
            num={2}
            icon={<CalendarCheck className="size-6" />}
            title="Mark availability"
            desc="Each player marks when they can play — available, maybe, or unavailable."
          />
          <Step
            num={3}
            icon={<CalendarSearch className="size-6" />}
            title="Book game nights"
            desc="See which dates work best for the whole group and confirm sessions."
          />
        </div>
      </div>
    </div>
  );
}

function Step({
  num,
  icon,
  title,
  desc,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <div className="text-xs font-bold text-primary uppercase tracking-wide mb-1">
        Step {num}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </div>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <div className="py-16 sm:py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4">
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <Feature
            icon={<Layers className="size-5" />}
            title="Multi-Game"
            desc="Manage several games at once, each with its own players and schedule."
          />
          <Feature
            icon={<Calendar className="size-5" />}
            title="Calendar Sync"
            desc="Auto-export confirmed sessions to Google Calendar, Apple, or any app."
          />
          <Feature
            icon={<Shield className="size-5" />}
            title="Co-GM Support"
            desc="Share game management with trusted players who can help run the show."
          />
        </div>
        <div className="text-center">
          <Link href="/login">
            <Button size="lg">Get Started &mdash; It&apos;s Free</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4 p-4 rounded-lg">
      <div className="shrink-0 size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
