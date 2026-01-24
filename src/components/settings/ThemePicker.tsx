'use client';

import { useAppTheme } from '@/contexts/ThemeContext';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ThemePicker() {
  const { mode, setMode, colorTheme, setColorTheme, themes, mounted } = useAppTheme();

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Light/Dark Mode Selector */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-3">Mode</label>
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setMode('light')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'light'
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SunIcon className="w-4 h-4" />
            Light
          </button>
          <button
            onClick={() => setMode('dark')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'dark'
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MoonIcon className="w-4 h-4" />
            Dark
          </button>
          <button
            onClick={() => setMode('system')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'system'
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SystemIcon className="w-4 h-4" />
            System
          </button>
        </div>
      </div>

      {/* Color Theme Selector */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-3">Color Theme</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setColorTheme(theme.id)}
              className={`relative flex flex-col items-start p-3 rounded-lg border-2 transition-all ${
                colorTheme === theme.id
                  ? 'border-primary bg-secondary/50'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              {/* Selection indicator */}
              {colorTheme === theme.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <CheckIcon className="w-3 h-3 text-primary-foreground" />
                </div>
              )}

              {/* Color swatches */}
              <div className="flex gap-1 mb-2">
                <div
                  className="w-6 h-6 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.previewColors.primary }}
                />
                <div
                  className="w-6 h-6 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.previewColors.secondary }}
                />
                <div
                  className="w-6 h-6 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.previewColors.accent }}
                />
              </div>

              {/* Theme name and description */}
              <span className="text-sm font-medium text-card-foreground">{theme.name}</span>
              <span className="text-xs text-muted-foreground">{theme.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
