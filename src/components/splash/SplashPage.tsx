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
      <ShowcaseSection />
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
          A free scheduler for TTRPG campaigns, board game groups, and any other recurring
          get-together. Set up your game once &mdash; no new poll to send before every session.
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
          Built for groups that play again and again
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          One-off polls work for one-off events. A TTRPG campaign or a monthly board game
          night needs something that sticks around.
          In Can We Play?, your game and your players stay set up between sessions: everyone
          keeps a running calendar of the dates they can make, the app highlights the nights
          that work for the most people, and confirmed sessions live in one shared place. When
          it&apos;s time to schedule the next session, the answers are already there. It&apos;s
          free and ad-free.
        </p>
      </div>
    </div>
  );
}

// ─── Showcase ───────────────────────────────────────────────────────────────

function ShowcaseSection() {
  return (
    <div className="py-16 sm:py-24 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 space-y-16 sm:space-y-24">
        <ShowcaseRow
          title="One calendar for the whole party"
          desc="Players mark upcoming dates as available, maybe, or unavailable — with notes
            and time constraints when life gets complicated. Plans changed? Update a date and
            everyone sees it."
          src="/screenshots/availability.png"
          alt="Availability calendar showing players' available, maybe, and unavailable dates"
        />
        <ShowcaseRow
          title="The best nights rise to the top"
          desc="Upcoming dates are ranked by who can make it, so you can see at a glance when
            the group is free. Confirm a date and it becomes a session on everyone's calendar."
          src="/screenshots/scheduling.png"
          alt="Scheduling suggestions ranking dates by availability, with a confirmed session"
          reverse
        />
      </div>
    </div>
  );
}

function ShowcaseRow({
  title,
  desc,
  src,
  alt,
  reverse,
}: {
  title: string;
  desc: string;
  src: string;
  alt: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex flex-col ${
        reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'
      } items-center gap-8 sm:gap-12`}
    >
      <div className="sm:w-2/5 text-center sm:text-left">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <div className="sm:w-3/5 w-full">
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          sizes="(min-width: 640px) 60vw, 100vw"
          className="w-full h-auto rounded-xl border border-border shadow-lg"
        />
      </div>
    </div>
  );
}

// ─── How it works ───────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <div id="how-it-works" className="py-16 sm:py-24 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
          <Step
            num={1}
            icon={<Users className="size-6" />}
            title="Invite your party"
            desc="Create a game and share the invite link. Players sign in with Google or Discord."
          />
          <Step
            num={2}
            icon={<CalendarCheck className="size-6" />}
            title="Mark availability"
            desc="Each player marks upcoming dates — available, maybe, or unavailable — and updates them as plans change."
          />
          <Step
            num={3}
            icon={<CalendarSearch className="size-6" />}
            title="Confirm sessions"
            desc="See which nights work for the whole group, confirm a date, and it shows up on everyone's calendar."
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
    <div className="py-16 sm:py-24 bg-secondary/30">
      <div className="max-w-3xl mx-auto px-4">
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <Feature
            icon={<Layers className="size-5" />}
            title="Multiple Games"
            desc="Run several games at once, each with its own players and schedule."
          />
          <Feature
            icon={<Calendar className="size-5" />}
            title="Calendar Sync"
            desc="Subscribe once and confirmed sessions appear in Apple, Google, or any other calendar app."
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
