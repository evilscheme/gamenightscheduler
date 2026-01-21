'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface UseAuthRedirectOptions {
  /** Require user to be a GM, redirect to dashboard if not */
  requireGM?: boolean;
  /** Require user to be an admin, redirect to dashboard if not */
  requireAdmin?: boolean;
  /** Custom redirect URL for unauthenticated users (default: /login) */
  redirectTo?: string;
}

/**
 * Hook to handle auth-based redirects for protected pages.
 * Redirects to login if not authenticated.
 * Optionally redirects non-GMs or non-admins to dashboard.
 */
export function useAuthRedirect(options: UseAuthRedirectOptions = {}) {
  const { requireGM = false, requireAdmin = false, redirectTo = '/login' } = options;
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if auth is done loading AND there's no session
    if (!isLoading && !session) {
      router.push(redirectTo);
    } else if (requireGM && !isLoading && profile && !profile.is_gm) {
      // If profile loaded but not a GM, redirect to dashboard
      router.push('/dashboard');
    } else if (requireAdmin && !isLoading && profile && !profile.is_admin) {
      // If profile loaded but not an admin, redirect to dashboard
      router.push('/dashboard');
    }
  }, [isLoading, session, profile, router, redirectTo, requireGM, requireAdmin]);
}
