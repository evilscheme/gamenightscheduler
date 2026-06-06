import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarCheck,
  CalendarSearch,
  Calendar,
  Users,
  Layers,
  Shield,
} from 'lucide-react';
import { Button, EyebrowLabel } from '@/components/ui';
import { FloatingDice } from './FloatingDice';

// ─── Main component ─────────────────────────────────────────────────────────

export function SplashPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <HeroSection />
      <WhySection />
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
        <p className="text-lg sm:text-xl text-muted-foreground mb-4 max-w-lg mx-auto">
          Track availability. Find the best night. Play more games.
        </p>
        <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-xl mx-auto">
          A free tool for organizing recurring get-togethers, such as game nights, TTRPG
          campaigns (D&amp;D, Daggerheart, etc.), board game nights, or any group that
          needs to find a date that works for everyone.
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

// ─── Why ────────────────────────────────────────────────────────────────────

function WhySection() {
  return (
    <div className="py-16 sm:py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
          Scheduling, without the endless back-and-forth
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Finding a night when everyone&apos;s free is the hardest part of keeping a regular game
          going. Can We Play? replaces lengthy message threads with a simple interface:
          each person marks the dates they can make, and the app highlights the days that work
          for the most people. Whether you&apos;re running a long D&amp;D or Pathfinder campaign,
          hosting a board game night, or organizing any recurring meetup, you can confirm a date
          and export it straight to everyone&apos;s calendar. It&apos;s easy, ad-free, and costs nothing. Get playing!
        </p>
      </div>
    </div>
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
            title="Book sessions"
            desc="See which dates work best for the whole group and schedule in the shared calendar."
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
      <EyebrowLabel className="block mb-1">Step {num}</EyebrowLabel>
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
