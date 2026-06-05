'use client';

import { LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { SplashPage } from '@/components/splash/SplashPage';

/**
 * Client-side home gate. Rendered by the `/` server component whenever an auth
 * session exists or might exist (valid or expired token). Resolves the user's
 * profile and shows the dashboard; falls back to the splash only if the client
 * ultimately resolves to logged-out (e.g. a revoked refresh token).
 */
export function HomeApp() {
  const { profile, authStatus } = useAuth();

  if (profile) {
    return <DashboardContent />;
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <SplashPage />;
}
