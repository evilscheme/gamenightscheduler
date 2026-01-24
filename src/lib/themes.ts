export interface Theme {
  id: string;
  name: string;
  description: string;
  previewColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'purple',
    name: 'Vibrant Purple',
    description: 'Bold purple tones',
    previewColors: {
      primary: '#7c3aed',
      secondary: '#a78bfa',
      accent: '#f3e8ff',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Calming blue tones',
    previewColors: {
      primary: '#0ea5e9',
      secondary: '#38bdf8',
      accent: '#e0f2fe',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep natural greens',
    previewColors: {
      primary: '#16a34a',
      secondary: '#4ade80',
      accent: '#dcfce7',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Clean minimal gray-blue',
    previewColors: {
      primary: '#475569',
      secondary: '#64748b',
      accent: '#f1f5f9',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Elegant pink tones',
    previewColors: {
      primary: '#e11d48',
      secondary: '#fb7185',
      accent: '#ffe4e6',
    },
  },
];

export const DEFAULT_THEME_ID = 'purple';

export function getThemeById(id: string): Theme | undefined {
  return themes.find((t) => t.id === id);
}
