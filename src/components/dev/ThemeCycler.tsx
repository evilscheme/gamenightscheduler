'use client';

import { useEffect, useState } from 'react';
import { useAppTheme } from '@/contexts/ThemeContext';

/**
 * Dev helper: Press Ctrl+Alt+T to cycle through all theme combinations.
 * Shows a brief indicator of the current theme.
 */
export function ThemeCycler() {
  const { mode, setMode, colorTheme, setColorTheme, themes, mounted } = useAppTheme();
  const [showIndicator, setShowIndicator] = useState(false);
  const [currentCombo, setCurrentCombo] = useState('');

  useEffect(() => {
    if (!mounted) return;

    const modes = ['light', 'dark'] as const;

    // Build list of all combinations: [theme-mode, theme-mode, ...]
    const combinations: { theme: string; mode: 'light' | 'dark' }[] = [];
    for (const theme of themes) {
      for (const m of modes) {
        combinations.push({ theme: theme.id, mode: m });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+T (or Cmd+Alt+T on Mac)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();

        // Find current combination index
        const currentIndex = combinations.findIndex(
          (c) => c.theme === colorTheme && c.mode === mode
        );

        // Move to next combination
        const nextIndex = (currentIndex + 1) % combinations.length;
        const next = combinations[nextIndex];

        setColorTheme(next.theme);
        setMode(next.mode);

        // Show indicator
        const themeName = themes.find((t) => t.id === next.theme)?.name || next.theme;
        setCurrentCombo(`${themeName} (${next.mode})`);
        setShowIndicator(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, mode, setMode, colorTheme, setColorTheme, themes]);

  // Hide indicator after delay
  useEffect(() => {
    if (showIndicator) {
      const timer = setTimeout(() => setShowIndicator(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showIndicator, currentCombo]);

  if (!showIndicator) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-card border border-border rounded-lg shadow-lg text-sm font-medium text-card-foreground">
      {currentCombo}
    </div>
  );
}
