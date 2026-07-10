import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DevLoginClient } from './client';
import { PageLoading } from '@/components/ui';

export default function DevLoginPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <PageLoading />
      }
    >
      <DevLoginClient />
    </Suspense>
  );
}
