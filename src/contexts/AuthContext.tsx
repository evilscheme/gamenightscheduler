'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { createClient, onSupabaseStatus } from '@/lib/supabase/client';
import { User } from '@/types';
import { TIMEOUTS } from '@/lib/constants';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: User | null;
  session: Session | null;
  isLoading: boolean;
  backendError: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithDiscord: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a singleton supabase client to avoid recreating on each render
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const supabase = getSupabaseClient();
  const errorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced error reporter — delays showing the banner by 2s so that
  // transient failures (e.g. Safari resuming a suspended tab) are ignored
  // if a successful request arrives within the window. Recovery is immediate.
  const reportBackendError = useCallback((isError: boolean) => {
    if (isError) {
      if (!errorDebounceRef.current) {
        errorDebounceRef.current = setTimeout(() => {
          errorDebounceRef.current = null;
          setBackendError(true);
        }, TIMEOUTS.BACKEND_ERROR_DEBOUNCE);
      }
    } else {
      if (errorDebounceRef.current) {
        clearTimeout(errorDebounceRef.current);
        errorDebounceRef.current = null;
      }
      setBackendError(false);
    }
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (errorDebounceRef.current) {
        clearTimeout(errorDebounceRef.current);
      }
    };
  }, []);

  // Health check on mount - detect if Supabase auth service is reachable
  // Catches outages for ALL users (including unauthenticated) where the
  // auth endpoint returns 5xx/522 errors (exactly the Feb 2025 outage pattern)
  useEffect(() => {
    async function checkBackendHealth() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
          {
            headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
            signal: AbortSignal.timeout(TIMEOUTS.PROFILE_FETCH),
          }
        );
        if (!response.ok) {
          reportBackendError(true);
        }
      } catch {
        reportBackendError(true);
      }
    }
    checkBackendHealth();
  }, [reportBackendError]);

  // Subscribe to Supabase fetch-level error/recovery signals
  useEffect(() => {
    return onSupabaseStatus(reportBackendError);
  }, [reportBackendError]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Add timeout to prevent hanging
      const fetchPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), TIMEOUTS.PROFILE_FETCH)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;

      if (data && !error) {
        setProfile(data as User);
        reportBackendError(false);
      }
    } catch {
      // Timeout or error - continue without profile
      reportBackendError(true);
    }
    setIsLoading(false);
  }, [supabase, reportBackendError]);

  useEffect(() => {
    let isMounted = true;
    let initialLoadComplete = false;
    let currentUserId: string | null = null;

    // Listen for auth state changes - this is the ONLY source of truth
    // DO NOT call getUser() separately - it's slow (5+ seconds for token refresh)
    // Instead, let onAuthStateChange handle everything:
    // - SIGNED_IN fires BEFORE token refresh (has expired token) - skip during initial load
    // - INITIAL_SESSION fires AFTER token refresh (has valid token) - use this for initial load
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // During initial load, skip SIGNED_IN - it fires before token refresh completes
      // The session it provides has an expired access token, causing profile fetch to fail
      // INITIAL_SESSION will fire shortly after with a valid, refreshed token
      if (event === 'SIGNED_IN' && !initialLoadComplete) {
        return;
      }

      // INITIAL_SESSION marks the completion of initial auth check (including token refresh)
      if (event === 'INITIAL_SESSION') {
        initialLoadComplete = true;
      }

      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== currentUserId;
      currentUserId = newUserId;

      setSession(session);

      // Only fetch profile when the user actually changes (sign-in, sign-out).
      // Skip on token refreshes and tab resume events — profile data hasn't
      // changed and this avoids unnecessary DB traffic (especially in Safari
      // which fires auth events on every tab focus).
      // Always process INITIAL_SESSION so isLoading gets set to false.
      if (!userChanged && event !== 'INITIAL_SESSION') return;

      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  async function signInWithGoogle(redirectTo?: string) {
    const redirectUrl = `${window.location.origin}/auth/callback${
      redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) reportBackendError(true);
  }

  async function signInWithDiscord(redirectTo?: string) {
    const redirectUrl = `${window.location.origin}/auth/callback${
      redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) reportBackendError(true);
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      reportBackendError(true);
    }
  }

  async function refreshProfile() {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        backendError,
        signInWithGoogle,
        signInWithDiscord,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
