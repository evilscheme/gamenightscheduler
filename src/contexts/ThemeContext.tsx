'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { DEFAULT_THEME_ID, themes, getThemeById, type Theme } from '@/lib/themes';

const THEME_STORAGE_KEY = 'color-theme';

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
  const [colorTheme, setColorThemeState] = useState(DEFAULT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  // Load saved theme on mount - this is a valid pattern for hydration from localStorage
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && getThemeById(saved)) {
      setColorThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', DEFAULT_THEME_ID);
    }
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setColorTheme = (themeId: string) => {
    if (!getThemeById(themeId)) return;
    setColorThemeState(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    document.documentElement.setAttribute('data-theme', themeId);
  };

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
