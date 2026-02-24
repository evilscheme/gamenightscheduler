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
  const { authStatus, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(redirectTo);
    } else if (requireGM && authStatus === 'authenticated' && profile && !profile.is_gm) {
      router.push('/dashboard');
    } else if (requireAdmin && authStatus === 'authenticated' && profile && !profile.is_admin) {
      router.push('/dashboard');
    }
  }, [authStatus, profile, router, redirectTo, requireGM, requireAdmin]);
}
