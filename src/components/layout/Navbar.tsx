'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';

const GITHUB_ISSUES_URL = 'https://github.com/evilscheme/gamenightscheduler/issues';

function HelpDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Help menu"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-card border border-border rounded-md shadow-lg z-50">
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-md whitespace-nowrap"
            onClick={() => setIsOpen(false)}
          >
            🐛 Report Bug / Feedback
          </a>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { profile, isLoading, signOut } = useAuth();

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Can We Play?" width={44} height={44} className="shrink-0" />
              <span className="hidden sm:block font-bold text-xl text-foreground">Can We Play?</span>
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

          <div className="flex items-center gap-2 sm:gap-3">
            <HelpDropdown />
            <ThemeToggle />
            {isLoading ? (
              <div className="h-8 w-8 animate-pulse bg-muted rounded-full shrink-0" />
            ) : profile ? (
              <>
                <Link href="/settings" className="flex items-center gap-2 shrink-0">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external avatar URL
                    <img
                      src={profile.avatar_url}
                      alt={profile.name || ''}
                      className="h-8 w-8 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0">
                      {profile.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-foreground">
                    {profile.name}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => signOut()} className="shrink-0">
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
