export interface ImportanceBadgeStyle {
  label: string;
  color: string;
  bg: string;
  overlayBg: string;
  border: string;
  glow?: string;
}

export function getGuideImportanceStyle(
  rank: number | null | undefined,
  language: string,
  isLight: boolean
): ImportanceBadgeStyle | null {
  if (!rank) return null;

  switch (rank) {
    case 1: // Extra — Turquesa
      return {
        label: 'Extra',
        color: isLight ? '#0d9488' : '#2dd4bf',
        bg: isLight ? 'rgba(13, 148, 136, 0.12)' : 'rgba(45, 212, 191, 0.14)',
        overlayBg: isLight ? 'rgba(240, 253, 250, 0.94)' : 'rgba(15, 23, 42, 0.86)',
        border: isLight ? 'rgba(13, 148, 136, 0.45)' : 'rgba(45, 212, 191, 0.55)',
      };
    case 2: // Opcional — Celeste
      return {
        label: language === 'es' ? 'Opcional' : 'Optional',
        color: isLight ? '#0284c7' : '#38bdf8',
        bg: isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.15)',
        overlayBg: isLight ? 'rgba(240, 249, 255, 0.94)' : 'rgba(15, 23, 42, 0.86)',
        border: isLight ? 'rgba(2, 132, 199, 0.45)' : 'rgba(56, 189, 248, 0.55)',
      };
    case 3: // Recomendado — Rojo (Rocket League: Import)
      return {
        label: language === 'es' ? 'Recomendado' : 'Recommended',
        color: isLight ? '#dc2626' : '#f87171',
        bg: isLight ? 'rgba(220, 38, 38, 0.11)' : 'rgba(248, 113, 113, 0.16)',
        overlayBg: isLight ? 'rgba(254, 242, 242, 0.94)' : 'rgba(15, 23, 42, 0.86)',
        border: isLight ? 'rgba(220, 38, 38, 0.45)' : 'rgba(248, 113, 113, 0.55)',
      };
    case 4: // Importante — Amarillo / Dorado (Rocket League: Exotic)
      return {
        label: language === 'es' ? 'Importante' : 'Important',
        color: isLight ? '#b45309' : '#facc15',
        bg: isLight ? 'rgba(217, 119, 6, 0.13)' : 'rgba(250, 204, 21, 0.15)',
        overlayBg: isLight ? 'rgba(255, 251, 235, 0.95)' : 'rgba(15, 23, 42, 0.86)',
        border: isLight ? 'rgba(217, 119, 6, 0.5)' : 'rgba(250, 204, 21, 0.55)',
      };
    case 5: // Esencial — Violeta oscuro / Neón (Rocket League: Black Market)
      return {
        label: language === 'es' ? 'Esencial' : 'Essential',
        color: isLight ? '#86198f' : '#e879f9',
        bg: isLight ? 'rgba(192, 38, 211, 0.14)' : 'rgba(134, 25, 143, 0.34)',
        overlayBg: isLight ? 'rgba(250, 232, 255, 0.95)' : 'rgba(46, 16, 101, 0.92)',
        border: isLight ? 'rgba(162, 28, 175, 0.55)' : 'rgba(232, 121, 249, 0.72)',
        glow: isLight ? '0 0 6px rgba(192, 38, 211, 0.25)' : '0 0 8px rgba(217, 70, 239, 0.45)',
      };
    default:
      return null;
  }
}
