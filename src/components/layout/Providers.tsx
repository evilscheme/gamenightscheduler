'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeContextProvider } from '@/contexts/ThemeContext';
import { ThemeCycler } from '@/components/dev/ThemeCycler';
import { ToastProvider } from '@/components/ui/Toast';
import { ReactNode, useState } from 'react';
import { QUERY_STALE_TIME } from '@/lib/constants';

export function Providers({ children }: { children: ReactNode }) {
  // useState keeps a single QueryClient for the life of the app while still
  // creating a fresh one per render tree (avoids sharing cache across SSR requests).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_STALE_TIME,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeContextProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
        <ThemeCycler />
      </ThemeContextProvider>
    </ThemeProvider>
  );
}
