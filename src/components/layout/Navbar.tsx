'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { profile, isLoading, signOut } = useAuth();

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Quest Calendar" width={32} height={32} />
              <span className="font-bold text-xl text-foreground">Quest Calendar</span>
            </Link>
            {profile?.is_gm && (
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                <Link
                  href="/games/new"
                  className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  New Game
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isLoading ? (
              <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
            ) : profile ? (
              <>
                <Link href="/settings" className="flex items-center gap-2">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name || ''}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                      {profile.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-foreground">
                    {profile.name}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
