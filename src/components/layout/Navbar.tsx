'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';

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

function MobileMenu({ profile, signOut }: { profile: { is_gm?: boolean; is_admin?: boolean; name?: string | null } | null; signOut: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  return (
    <div className="relative sm:hidden" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Mobile menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1">
          {profile.is_gm && (
            <Link
              href="/games/new"
              className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              New Game
            </Link>
          )}
          {profile.is_admin && (
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Settings
          </Link>
          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Sign out
          </button>
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
            {(profile?.is_gm || profile?.is_admin) && (
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {profile?.is_gm && (
                  <Link
                    href="/games/new"
                    className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    New Game
                  </Link>
                )}
                {profile?.is_admin && (
                  <Link
                    href="/admin"
                    className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <HelpDropdown />
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
                <Button variant="ghost" size="sm" onClick={() => signOut()} className="hidden sm:inline-flex shrink-0">
                  Sign out
                </Button>
                <MobileMenu profile={profile} signOut={signOut} />
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
