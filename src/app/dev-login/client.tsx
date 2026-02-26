'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { loginAsDevUser, signOutDevUser } from './actions';
import { LoadingSpinner } from '@/components/ui';
import { safeCallbackUrl } from '@/lib/url';

const PERSONAS = [
  { key: 'gm', label: 'Dev GM', description: 'Host games', badge: 'GM' },
  { key: 'player1', label: 'Dev Player 1', description: 'Join games', badge: 'P1' },
  { key: 'player2', label: 'Dev Player 2', description: 'Join games', badge: 'P2' },
  { key: 'admin', label: 'Dev Admin', description: 'Admin access', badge: 'A' },
] as const;

export function DevLoginClient() {
  const { session, profile, authStatus } = useAuth();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  const [isPending, startTransition] = useTransition();
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleLogin(persona: string) {
    setError(null);
    setActivePersona(persona);
    startTransition(async () => {
      const result = await loginAsDevUser(persona);
      if (result.success) {
        // Hard navigation so the Supabase client reinitializes with the new session cookies
        window.location.href = callbackUrl;
      } else {
        setError(result.error || 'Login failed');
        setActivePersona(null);
      }
    });
  }

  function handleSignOut() {
    setError(null);
    setActivePersona('signout');
    startTransition(async () => {
      await signOutDevUser();
      window.location.reload();
    });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-warning/10 border border-warning/30 rounded-full text-warning text-xs font-medium mb-4">
              Development Only
            </div>
            <h1 className="text-2xl font-bold text-card-foreground">Dev Login</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Quick switch between test users. Users persist across sessions.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {authStatus === 'loading' ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {session && profile && (
                <div className="mb-6 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        Signed in as <span className="text-primary">{profile.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{session.user.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      disabled={isPending}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {PERSONAS.map((persona) => (
                  <button
                    key={persona.key}
                    onClick={() => handleLogin(persona.key)}
                    disabled={isPending}
                    className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending && activePersona === persona.key ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <span className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {persona.badge}
                      </span>
                    )}
                    <span className="text-sm font-medium text-card-foreground">{persona.label}</span>
                    <span className="text-xs text-muted-foreground">{persona.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
