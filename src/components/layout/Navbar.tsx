'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎲</span>
              <span className="font-bold text-xl text-foreground">Quest Calendar</span>
            </Link>
            {session && (
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                {session.user.isGm && (
                  <Link
                    href="/games/new"
                    className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    New Game
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {status === 'loading' ? (
              <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
            ) : session ? (
              <>
                <Link href="/settings" className="flex items-center gap-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || ''}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                      {session.user.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-foreground">
                    {session.user.name}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
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
