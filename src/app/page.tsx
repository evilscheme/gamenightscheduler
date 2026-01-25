'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button, LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default function Home() {
  const { profile, isLoading } = useAuth();

  // Show dashboard for authenticated users
  if (profile) {
    return <DashboardContent />;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show hero page for unauthenticated users
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 relative">
          <div className="text-center">
            <Image
              src="/logo.png"
              alt="Can We Play?"
              width={180}
              height={180}
              className="mx-auto mb-8"
              priority
            />
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
              Can We Play?
              <span className="block text-purple-200 text-2xl sm:text-3xl mt-2 font-normal">
                Never miss a game night again
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-purple-100 mb-8">
              Coordinate your game nights with ease. Track availability, suggest dates, and keep
              your group together.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-lg bg-white text-purple-700 hover:bg-purple-50 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Everything you need to organize game night
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="📅"
              title="Track Availability"
              description="Players mark when they're free, and the app shows you the best dates for everyone."
            />
            <FeatureCard
              icon="🎯"
              title="Smart Suggestions"
              description="Get ranked date suggestions based on player availability. See who can make each date at a glance."
            />
            <FeatureCard
              icon="📤"
              title="Calendar Export"
              description="Download .ics files or subscribe to a calendar feed that auto-syncs confirmed sessions."
            />
            <FeatureCard
              icon="👥"
              title="Multiple Games"
              description="Manage several games at once, each with its own players and schedule."
            />
            <FeatureCard
              icon="🔗"
              title="Easy Invites"
              description="Share a simple invite link to add players to your game."
            />
            <FeatureCard
              icon="🎲"
              title="Flexible Play Days"
              description="Set which days of the week your group can play - the calendar adapts automatically."
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-secondary py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">
            Sign up free and start coordinating your next game night.
          </p>
          <Link href="/login">
            <Button size="lg">Create Your First Game</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
