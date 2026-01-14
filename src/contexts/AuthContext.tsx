'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    // Listen for auth changes - this is the source of truth
    // onAuthStateChange fires immediately with initial state, so we rely on it
    // rather than getSession() to avoid race conditions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    // Fallback: if onAuthStateChange doesn't fire within 1 second, assume no session
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      // Add timeout to prevent hanging
      const fetchPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;

      if (data && !error) {
        setProfile(data as User);
      }
    } catch {
      // Timeout or error - continue without profile
    }
    setIsLoading(false);
  }

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
