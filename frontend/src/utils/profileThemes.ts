import React from 'react';

export interface ProfileThemeColor {
  id: string;
  name: {
    es: string;
    en: string;
  };
  dark: {
    accent: string;
    hover: string;
    border: string;
    glow: string;
    glassBorder: string;
  };
  light: {
    accent: string;
    hover: string;
    border: string;
    glow: string;
    glassBorder: string;
  };
}

export const PROFILE_THEME_COLORS: ProfileThemeColor[] = [
  {
    id: 'amber',
    name: { es: 'Ámbar Solar', en: 'Solar Amber' },
    dark: {
      accent: '#f59e0b',
      hover: '#d97706',
      border: 'rgba(245, 158, 11, 0.28)',
      glow: 'rgba(245, 158, 11, 0.45)',
      glassBorder: 'rgba(245, 158, 11, 0.35)',
    },
    light: {
      accent: '#d97706',
      hover: '#b45309',
      border: 'rgba(217, 119, 6, 0.25)',
      glow: 'rgba(217, 119, 6, 0.35)',
      glassBorder: 'rgba(217, 119, 6, 0.3)',
    },
  },
  {
    id: 'violet',
    name: { es: 'Violeta Amatista', en: 'Amethyst Violet' },
    dark: {
      accent: '#a855f7',
      hover: '#9333ea',
      border: 'rgba(168, 85, 247, 0.28)',
      glow: 'rgba(168, 85, 247, 0.45)',
      glassBorder: 'rgba(168, 85, 247, 0.35)',
    },
    light: {
      accent: '#7c3aed',
      hover: '#6d28d9',
      border: 'rgba(124, 58, 237, 0.25)',
      glow: 'rgba(124, 58, 237, 0.35)',
      glassBorder: 'rgba(124, 58, 237, 0.3)',
    },
  },
  {
    id: 'cyan',
    name: { es: 'Cian Glaciar', en: 'Glacier Cyan' },
    dark: {
      accent: '#06b6d4',
      hover: '#0891b2',
      border: 'rgba(6, 182, 212, 0.28)',
      glow: 'rgba(6, 182, 212, 0.45)',
      glassBorder: 'rgba(6, 182, 212, 0.35)',
    },
    light: {
      accent: '#0891b2',
      hover: '#0e7490',
      border: 'rgba(8, 145, 178, 0.25)',
      glow: 'rgba(8, 145, 178, 0.35)',
      glassBorder: 'rgba(8, 145, 178, 0.3)',
    },
  },
  {
    id: 'emerald',
    name: { es: 'Verde Esmeralda', en: 'Emerald Jade' },
    dark: {
      accent: '#10b981',
      hover: '#059669',
      border: 'rgba(16, 185, 129, 0.28)',
      glow: 'rgba(16, 185, 129, 0.45)',
      glassBorder: 'rgba(16, 185, 129, 0.35)',
    },
    light: {
      accent: '#059669',
      hover: '#047857',
      border: 'rgba(5, 150, 105, 0.25)',
      glow: 'rgba(5, 150, 105, 0.35)',
      glassBorder: 'rgba(5, 150, 105, 0.3)',
    },
  },
  {
    id: 'rose',
    name: { es: 'Rosa Sunset', en: 'Sunset Rose' },
    dark: {
      accent: '#f43f5e',
      hover: '#e11d48',
      border: 'rgba(244, 63, 94, 0.28)',
      glow: 'rgba(244, 63, 94, 0.45)',
      glassBorder: 'rgba(244, 63, 94, 0.35)',
    },
    light: {
      accent: '#e11d48',
      hover: '#be123c',
      border: 'rgba(225, 29, 72, 0.25)',
      glow: 'rgba(225, 29, 72, 0.35)',
      glassBorder: 'rgba(225, 29, 72, 0.3)',
    },
  },
  {
    id: 'crimson',
    name: { es: 'Rojo Rubí', en: 'Ruby Crimson' },
    dark: {
      accent: '#ef4444',
      hover: '#dc2626',
      border: 'rgba(239, 68, 68, 0.28)',
      glow: 'rgba(239, 68, 68, 0.45)',
      glassBorder: 'rgba(239, 68, 68, 0.35)',
    },
    light: {
      accent: '#dc2626',
      hover: '#b91c1c',
      border: 'rgba(220, 38, 38, 0.25)',
      glow: 'rgba(220, 38, 38, 0.35)',
      glassBorder: 'rgba(220, 38, 38, 0.3)',
    },
  },
  {
    id: 'blue',
    name: { es: 'Azul Zafiro', en: 'Sapphire Blue' },
    dark: {
      accent: '#3b82f6',
      hover: '#2563eb',
      border: 'rgba(59, 130, 246, 0.28)',
      glow: 'rgba(59, 130, 246, 0.45)',
      glassBorder: 'rgba(59, 130, 246, 0.35)',
    },
    light: {
      accent: '#2563eb',
      hover: '#1d4ed8',
      border: 'rgba(37, 99, 235, 0.25)',
      glow: 'rgba(37, 99, 235, 0.35)',
      glassBorder: 'rgba(37, 99, 235, 0.3)',
    },
  },
  {
    id: 'orange',
    name: { es: 'Naranja Fuego', en: 'Solar Orange' },
    dark: {
      accent: '#f97316',
      hover: '#ea580c',
      border: 'rgba(249, 115, 22, 0.28)',
      glow: 'rgba(249, 115, 22, 0.45)',
      glassBorder: 'rgba(249, 115, 22, 0.35)',
    },
    light: {
      accent: '#ea580c',
      hover: '#c2410c',
      border: 'rgba(234, 88, 12, 0.25)',
      glow: 'rgba(234, 88, 12, 0.35)',
      glassBorder: 'rgba(234, 88, 12, 0.3)',
    },
  },
];

export function getProfileTheme(colorId?: string | null, isLight: boolean = false) {
  const matched = PROFILE_THEME_COLORS.find(
    (c) => c.id === colorId || c.dark.accent.toLowerCase() === colorId?.toLowerCase() || c.light.accent.toLowerCase() === colorId?.toLowerCase()
  );
  const theme = matched || PROFILE_THEME_COLORS[0];
  const mode = isLight ? theme.light : theme.dark;

  return {
    id: theme.id,
    name: theme.name,
    accent: mode.accent,
    hover: mode.hover,
    border: mode.border,
    glow: mode.glow,
    glassBorder: mode.glassBorder,
    cssVariables: {
      '--accent-primary': mode.accent,
      '--accent-secondary': mode.hover,
      '--accent-hover': mode.hover,
      '--border-glow': mode.glow,
    } as React.CSSProperties,
  };
}
