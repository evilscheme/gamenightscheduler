'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface UseAuthRedirectOptions {
  /** Require user to be a GM, redirect to dashboard if not */
  requireGM?: boolean;
  /** Custom redirect URL for unauthenticated users (default: /login) */
  redirectTo?: string;
}

/**
 * Hook to handle auth-based redirects for protected pages.
 * Redirects to login if not authenticated.
 * Optionally redirects non-GMs to dashboard.
 */
export function useAuthRedirect(options: UseAuthRedirectOptions = {}) {
  const { requireGM = false, redirectTo = '/login' } = options;
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if auth is done loading AND there's no session
    if (!isLoading && !session) {
      router.push(redirectTo);
    } else if (requireGM && !isLoading && profile && !profile.is_gm) {
      // If profile loaded but not a GM, redirect to dashboard
      router.push('/dashboard');
    }
  }, [isLoading, session, profile, router, redirectTo, requireGM]);
}
