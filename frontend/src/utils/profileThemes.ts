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
    id: 'rose',
    name: { es: 'Fucsia Sunset', en: 'Sunset Fuchsia' },
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
    id: 'sakura',
    name: { es: 'Rosa Sakura', en: 'Sakura Pink' },
    dark: {
      accent: '#f472b6',
      hover: '#ec4899',
      border: 'rgba(244, 114, 182, 0.28)',
      glow: 'rgba(244, 114, 182, 0.45)',
      glassBorder: 'rgba(244, 114, 182, 0.35)',
    },
    light: {
      accent: '#ec4899',
      hover: '#db2777',
      border: 'rgba(236, 72, 153, 0.25)',
      glow: 'rgba(236, 72, 153, 0.35)',
      glassBorder: 'rgba(236, 72, 153, 0.3)',
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
    id: 'lavender',
    name: { es: 'Lavanda Pastel', en: 'Pastel Lavender' },
    dark: {
      accent: '#c4b5fd',
      hover: '#a78bfa',
      border: 'rgba(196, 181, 253, 0.32)',
      glow: 'rgba(196, 181, 253, 0.5)',
      glassBorder: 'rgba(196, 181, 253, 0.38)',
    },
    light: {
      accent: '#8b5cf6',
      hover: '#7c3aed',
      border: 'rgba(139, 92, 246, 0.28)',
      glow: 'rgba(139, 92, 246, 0.35)',
      glassBorder: 'rgba(139, 92, 246, 0.3)',
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
    id: 'indigo',
    name: { es: 'Índigo Profundo', en: 'Deep Indigo' },
    dark: {
      accent: '#6366f1',
      hover: '#4f46e5',
      border: 'rgba(99, 102, 241, 0.28)',
      glow: 'rgba(99, 102, 241, 0.45)',
      glassBorder: 'rgba(99, 102, 241, 0.35)',
    },
    light: {
      accent: '#4f46e5',
      hover: '#4338ca',
      border: 'rgba(79, 70, 229, 0.25)',
      glow: 'rgba(79, 70, 229, 0.35)',
      glassBorder: 'rgba(79, 70, 229, 0.3)',
    },
  },
  {
    id: 'cyan',
    name: { es: 'Celeste Glaciar', en: 'Glacier Sky' },
    dark: {
      accent: '#38bdf8',
      hover: '#0ea5e9',
      border: 'rgba(56, 189, 248, 0.28)',
      glow: 'rgba(56, 189, 248, 0.45)',
      glassBorder: 'rgba(56, 189, 248, 0.35)',
    },
    light: {
      accent: '#0284c7',
      hover: '#0369a1',
      border: 'rgba(2, 132, 199, 0.25)',
      glow: 'rgba(2, 132, 199, 0.35)',
      glassBorder: 'rgba(2, 132, 199, 0.3)',
    },
  },
  {
    id: 'turquoise',
    name: { es: 'Turquesa Caribe', en: 'Caribbean Turquoise' },
    dark: {
      accent: '#14b8a6',
      hover: '#0d9488',
      border: 'rgba(20, 184, 166, 0.28)',
      glow: 'rgba(20, 184, 166, 0.45)',
      glassBorder: 'rgba(20, 184, 166, 0.35)',
    },
    light: {
      accent: '#0d9488',
      hover: '#0f766e',
      border: 'rgba(13, 148, 136, 0.25)',
      glow: 'rgba(13, 148, 136, 0.35)',
      glassBorder: 'rgba(13, 148, 136, 0.3)',
    },
  },
  {
    id: 'emerald',
    name: { es: 'Esmeralda Real', en: 'Royal Emerald' },
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
    id: 'clover',
    name: { es: 'Verde Trébol', en: 'Clover Green' },
    dark: {
      accent: '#22c55e',
      hover: '#16a34a',
      border: 'rgba(34, 197, 94, 0.28)',
      glow: 'rgba(34, 197, 94, 0.45)',
      glassBorder: 'rgba(34, 197, 94, 0.35)',
    },
    light: {
      accent: '#16a34a',
      hover: '#15803d',
      border: 'rgba(22, 163, 74, 0.25)',
      glow: 'rgba(22, 163, 74, 0.35)',
      glassBorder: 'rgba(22, 163, 74, 0.3)',
    },
  },
  {
    id: 'lime',
    name: { es: 'Lima Neón', en: 'Neon Lime' },
    dark: {
      accent: '#84cc16',
      hover: '#65a30d',
      border: 'rgba(132, 204, 22, 0.28)',
      glow: 'rgba(132, 204, 22, 0.45)',
      glassBorder: 'rgba(132, 204, 22, 0.35)',
    },
    light: {
      accent: '#65a30d',
      hover: '#4d7c0f',
      border: 'rgba(101, 163, 13, 0.25)',
      glow: 'rgba(101, 163, 13, 0.35)',
      glassBorder: 'rgba(101, 163, 13, 0.3)',
    },
  },
  {
    id: 'yellow',
    name: { es: 'Amarillo Rayo', en: 'Lightning Yellow' },
    dark: {
      accent: '#facc15',
      hover: '#eab308',
      border: 'rgba(250, 204, 21, 0.28)',
      glow: 'rgba(250, 204, 21, 0.45)',
      glassBorder: 'rgba(250, 204, 21, 0.35)',
    },
    light: {
      accent: '#ca8a04',
      hover: '#a16207',
      border: 'rgba(202, 138, 4, 0.25)',
      glow: 'rgba(202, 138, 4, 0.35)',
      glassBorder: 'rgba(202, 138, 4, 0.3)',
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
  {
    id: 'caramel',
    name: { es: 'Caramelo Tostado', en: 'Toasted Caramel' },
    dark: {
      accent: '#c27838',
      hover: '#a05c24',
      border: 'rgba(194, 120, 56, 0.28)',
      glow: 'rgba(194, 120, 56, 0.45)',
      glassBorder: 'rgba(194, 120, 56, 0.35)',
    },
    light: {
      accent: '#9a4c13',
      hover: '#78350f',
      border: 'rgba(154, 76, 19, 0.25)',
      glow: 'rgba(154, 76, 19, 0.35)',
      glassBorder: 'rgba(154, 76, 19, 0.3)',
    },
  },
  {
    id: 'cream',
    name: { es: 'Crema Vainilla', en: 'Vanilla Cream' },
    dark: {
      accent: '#fef3c7',
      hover: '#fde68a',
      border: 'rgba(254, 243, 199, 0.32)',
      glow: 'rgba(254, 243, 199, 0.42)',
      glassBorder: 'rgba(254, 243, 199, 0.28)',
    },
    light: {
      accent: '#d97706',
      hover: '#b45309',
      border: 'rgba(217, 119, 6, 0.25)',
      glow: 'rgba(217, 119, 6, 0.32)',
      glassBorder: 'rgba(217, 119, 6, 0.25)',
    },
  },
  {
    id: 'platinum',
    name: { es: 'Monocromo Platino', en: 'Platinum Silver' },
    dark: {
      accent: '#f1f5f9',
      hover: '#cbd5e1',
      border: 'rgba(241, 245, 249, 0.3)',
      glow: 'rgba(241, 245, 249, 0.35)',
      glassBorder: 'rgba(241, 245, 249, 0.25)',
    },
    light: {
      accent: '#334155',
      hover: '#1e293b',
      border: 'rgba(51, 65, 85, 0.25)',
      glow: 'rgba(51, 65, 85, 0.3)',
      glassBorder: 'rgba(51, 65, 85, 0.2)',
    },
  },
  {
    id: 'graphite',
    name: { es: 'Grafito Oscuro', en: 'Dark Graphite' },
    dark: {
      accent: '#64748b',
      hover: '#475569',
      border: 'rgba(100, 116, 139, 0.3)',
      glow: 'rgba(100, 116, 139, 0.4)',
      glassBorder: 'rgba(100, 116, 139, 0.25)',
    },
    light: {
      accent: '#475569',
      hover: '#334155',
      border: 'rgba(71, 85, 105, 0.25)',
      glow: 'rgba(71, 85, 105, 0.3)',
      glassBorder: 'rgba(71, 85, 105, 0.2)',
    },
  },
];

export function findProfileThemeColor(colorId?: string | null) {
  if (!colorId) return null;
  return PROFILE_THEME_COLORS.find(
    (c) => c.id === colorId || c.dark.accent.toLowerCase() === colorId.toLowerCase() || c.light.accent.toLowerCase() === colorId.toLowerCase()
  ) || null;
}

export function getProfileTheme(colorId?: string | null, isLight: boolean = false) {
  const matched = findProfileThemeColor(colorId);
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
      '--border-color': mode.border,
      '--border-glow': mode.glow,
      '--btn-glow': mode.glow,
      '--btn-glow-hover': mode.glow,
      '--accent-text': isLight 
        ? '#ffffff' 
        : (theme.id === 'amber' || theme.id === 'yellow' || theme.id === 'lime' || theme.id === 'platinum' || theme.id === 'lavender' || theme.id === 'cream' ? '#0f172a' : '#ffffff'),
      '--accent-text-hover': isLight 
        ? '#ffffff' 
        : (theme.id === 'platinum' || theme.id === 'yellow' || theme.id === 'cream' ? '#0f172a' : '#ffffff'),
    } as React.CSSProperties,
    modalStyles: {
      background: isLight 
        ? `linear-gradient(180deg, ${mode.border} 0%, rgba(255, 255, 255, 0.96) 60%)` 
        : `linear-gradient(180deg, ${mode.border} 0%, rgba(9, 13, 22, 0.98) 55%)`,
      border: `1px solid ${mode.border}`,
      boxShadow: `0 25px 50px rgba(0,0,0,0.6), 0 0 30px ${mode.glow}`,
    }
  };
}

