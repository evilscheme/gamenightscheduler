'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { TIMEOUTS } from '@/lib/constants';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: User | null;
  session: Session | null;
  isLoading: boolean;
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
  const supabase = getSupabaseClient();

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
      }
    } catch {
      // Timeout or error - continue without profile
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    let initialLoadComplete = false;

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

      setSession(session);
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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
  }

  async function signInWithDiscord(redirectTo?: string) {
    const redirectUrl = `${window.location.origin}/auth/callback${
      redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
    }`;
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
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
