'use client';

import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default function DashboardPage() {
  useAuthRedirect();

  return <DashboardContent />;
}
