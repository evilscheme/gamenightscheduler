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
    const start = performance.now();
    console.log('[Auth] fetchProfile started for user:', userId);
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
      console.log('[Auth] fetchProfile completed in', (performance.now() - start).toFixed(0), 'ms', { hasData: !!data, error });

      if (data && !error) {
        setProfile(data as User);
      }
    } catch (e) {
      // Timeout or error - continue without profile
      console.log('[Auth] fetchProfile FAILED in', (performance.now() - start).toFixed(0), 'ms', e);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const start = performance.now();
      console.log('[Auth] initializeAuth started');

      // Use getUser() which validates the session and refreshes the token if needed
      // This ensures we have a valid token before making any database queries
      // Unlike getSession(), this won't return an expired session
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('[Auth] getUser completed in', (performance.now() - start).toFixed(0), 'ms', { hasUser: !!user, error: error?.message });

      if (!isMounted) return;

      if (error || !user) {
        // No valid session
        console.log('[Auth] No valid session, finishing');
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // We have a validated user, now get the session object
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Auth] getSession completed in', (performance.now() - start).toFixed(0), 'ms');

      if (!isMounted) return;

      setSession(session);
      setUser(user);

      await fetchProfile(user.id);
      console.log('[Auth] initializeAuth finished in', (performance.now() - start).toFixed(0), 'ms');
    }

    // Start initialization immediately
    initializeAuth();

    // Listen for auth changes (handles sign in/out, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange event:', event, { hasSession: !!session });
      if (!isMounted) return;

      // Skip INITIAL_SESSION since initializeAuth() handles it
      if (event === 'INITIAL_SESSION') return;

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
