import React from 'react';

interface GuideMediaTypeBarProps {
  mediaTypeCounts?: Record<string, number> | null;
  language: string;
  height?: number;
}

const MEDIA_TYPE_META: Record<string, { color: string; es: string; en: string }> = {
  movie: { color: 'var(--color-movie)', es: 'Películas', en: 'Movies' },
  series: { color: 'var(--color-series)', es: 'Series', en: 'Series' },
  anime: { color: 'var(--color-anime)', es: 'Anime', en: 'Anime' },
  book: { color: 'var(--color-book)', es: 'Libros', en: 'Books' },
  comic: { color: 'var(--color-comic)', es: 'Cómics', en: 'Comics' },
  manga: { color: 'var(--color-manga)', es: 'Manga', en: 'Manga' },
  game: { color: 'var(--color-game)', es: 'Juegos', en: 'Games' },
  custom: { color: 'var(--color-guide, #2DD4BF)', es: 'Personalizados', en: 'Custom' },
};

export const GuideMediaTypeBar: React.FC<GuideMediaTypeBarProps> = ({
  mediaTypeCounts,
  language,
  height = 4,
}) => {
  if (!mediaTypeCounts) return null;

  const entries = Object.entries(mediaTypeCounts)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total <= 0) return null;

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        display: 'flex',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'rgba(0, 0, 0, 0.25)',
      }}
    >
      {entries.map(([rawType, count]) => {
        const key = rawType.toLowerCase();
        const meta = MEDIA_TYPE_META[key] || {
          color: 'var(--color-guide, #2DD4BF)',
          es: key,
          en: key,
        };
        const pct = Math.round((count / total) * 100);
        const label = language === 'es' ? meta.es : meta.en;

        return (
          <div
            key={key}
            title={`${label}: ${pct}% (${count})`}
            style={{
              flex: count,
              height: '100%',
              background: meta.color,
              minWidth: '2px',
            }}
          />
        );
      })}
    </div>
  );
};
