'use client';

import { LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { SplashPage } from '@/components/splash/SplashPage';

export default function Home() {
  const { profile, isLoading } = useAuth();

  // Show dashboard for authenticated users
  if (profile) {
    return <DashboardContent />;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show splash page for unauthenticated users
  return <SplashPage />;
}
