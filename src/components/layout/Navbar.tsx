'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { fetchUserGameCount } from '@/lib/data';

const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;

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
        className="size-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Help menu"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-card border border-border rounded-md shadow-lg z-50 py-1">
          <Link
            href="/help"
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            onClick={() => setIsOpen(false)}
          >
            <BookOpen className="size-4" />
            How to Use
          </Link>
          {FEEDBACK_EMAIL && (
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Can We Play? Feedback')}`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              onClick={() => setIsOpen(false)}
            >
              <Mail className="size-4" />
              Send Feedback
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ profile, signOut, hasGames }: { profile: { is_gm?: boolean; is_admin?: boolean; name?: string | null } | null; signOut: () => void; hasGames: boolean }) {
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
        className="size-8 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Mobile menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1">
          {hasGames && (
            <Link
              href="/"
              className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              My Games
            </Link>
          )}
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
  const { profile, authStatus, signOut } = useAuth();
  const [hasGames, setHasGames] = useState(false);

  useEffect(() => {
    if (!profile?.id) {
      return () => {};
    }

    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from('game_memberships').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
      fetchUserGameCount(supabase, profile.id),
    ]).then(([{ count: memberCount }, { count: gmCount }]) => {
      if (!cancelled) {
        setHasGames(((memberCount || 0) + (gmCount || 0)) > 0);
      }
    });

    return () => {
      cancelled = true;
      setHasGames(false);
    };
  }, [profile?.id]);

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Can We Play?" width={44} height={44} className="shrink-0" />
              <span className="hidden sm:block font-bold text-xl text-foreground">Can We Play?</span>
            </Link>
            {(hasGames || profile?.is_gm || profile?.is_admin) && (
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {hasGames && (
                  <Link
                    href="/"
                    className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    My Games
                  </Link>
                )}
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
            {authStatus === 'loading' ? (
              <div className="size-8 animate-pulse bg-muted rounded-full shrink-0" />
            ) : profile ? (
              <>
                <Link href="/settings" className="flex items-center gap-2 shrink-0">
                  <Avatar
                    userId={profile.id}
                    name={profile.name}
                    avatarUrl={profile.avatar_url}
                    size={30}
                    className="shrink-0"
                  />
                  <span className="hidden sm:block text-sm font-medium text-foreground">
                    {profile.name}
                  </span>
                </Link>
                <div className="hidden sm:block">
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    Sign out
                  </Button>
                </div>
                <MobileMenu profile={profile} signOut={signOut} hasGames={hasGames} />
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
