import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DevLoginClient } from './client';
import { LoadingSpinner } from '@/components/ui';

export default function DevLoginPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <DevLoginClient />
    </Suspense>
  );
}
