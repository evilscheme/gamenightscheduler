'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { DEFAULT_THEME_ID, themes, getThemeById, type Theme } from '@/lib/themes';
import { useLocalStoragePref } from '@/hooks/useLocalStoragePref';

const THEME_STORAGE_KEY = 'color-theme';

const isValidThemeId = (v: unknown): v is string =>
  typeof v === 'string' && !!getThemeById(v);

interface ThemeContextValue {
  // Light/dark mode from next-themes
  mode: string | undefined;
  setMode: (mode: string) => void;
  resolvedMode: string | undefined;
  // Color theme
  colorTheme: string;
  setColorTheme: (themeId: string) => void;
  currentTheme: Theme | undefined;
  themes: Theme[];
  // Hydration state
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const { theme: mode, setTheme: setMode, resolvedTheme: resolvedMode } = useNextTheme();
  const [colorTheme, setColorThemeRaw] = useLocalStoragePref<string>(
    THEME_STORAGE_KEY,
    DEFAULT_THEME_ID,
    isValidThemeId
  );
  const [mounted, setMounted] = useState(false);

  // Mirror the current colorTheme onto the root `data-theme` attribute so CSS
  // theme variables apply. The inline script in app/layout.tsx handles the
  // first paint before React mounts; this effect handles every render after.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setColorTheme = useCallback(
    (themeId: string) => {
      if (!getThemeById(themeId)) return;
      setColorThemeRaw(themeId);
    },
    [setColorThemeRaw]
  );

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        resolvedMode,
        colorTheme,
        setColorTheme,
        currentTheme: getThemeById(colorTheme),
        themes,
        mounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeContextProvider');
  }
  return context;
}
