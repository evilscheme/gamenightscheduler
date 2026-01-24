'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeContextProvider } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeContextProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeContextProvider>
    </ThemeProvider>
  );
}
