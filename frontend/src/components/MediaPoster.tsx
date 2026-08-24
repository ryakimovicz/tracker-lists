import React, { useState } from 'react';
import { Film, Tv, Book, BookOpen, Gamepad2, Disc, Sparkles } from 'lucide-react';

interface MediaPosterProps {
  src?: string | null;
  title: string;
  itemType?: string;
  height?: string | number;
  width?: string | number;
  aspectRatio?: string;
  borderRadius?: string | number;
  isNsfw?: boolean;
  showNsfw?: boolean;
  style?: React.CSSProperties;
}

export const MediaPoster: React.FC<MediaPosterProps> = ({
  src,
  title,
  itemType = 'movie',
  height = '100%',
  width = '100%',
  aspectRatio,
  borderRadius = '8px',
  isNsfw = false,
  showNsfw = true,
  style = {}
}) => {
  const [imgError, setImgError] = useState(false);

  // Normalize item type for icons & category colors
  const normType = (itemType || '').toLowerCase();

  const getPlaceholderConfig = () => {
    switch (normType) {
      case 'movie':
        return {
          icon: <Film size={36} color="var(--color-movie)" />,
          color: 'var(--color-movie)',
          bg: 'linear-gradient(145deg, rgba(74, 222, 128, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Película'
        };
      case 'series':
      case 'season':
      case 'episode':
        return {
          icon: <Tv size={36} color="var(--color-series)" />,
          color: 'var(--color-series)',
          bg: 'linear-gradient(145deg, rgba(250, 204, 21, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Serie'
        };
      case 'anime':
        return {
          icon: <Sparkles size={36} color="var(--color-anime)" />,
          color: 'var(--color-anime)',
          bg: 'linear-gradient(145deg, rgba(251, 146, 60, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Anime'
        };
      case 'book':
        return {
          icon: <Book size={36} color="var(--color-book)" />,
          color: 'var(--color-book)',
          bg: 'linear-gradient(145deg, rgba(180, 83, 9, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Libro'
        };
      case 'comic':
        return {
          icon: <BookOpen size={36} color="var(--color-comic)" />,
          color: 'var(--color-comic)',
          bg: 'linear-gradient(145deg, rgba(248, 113, 113, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Cómic'
        };
      case 'manga':
        return {
          icon: <BookOpen size={36} color="var(--color-manga)" />,
          color: 'var(--color-manga)',
          bg: 'linear-gradient(145deg, rgba(96, 165, 250, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Manga'
        };
      case 'game':
        return {
          icon: <Gamepad2 size={36} color="var(--color-game)" />,
          color: 'var(--color-game)',
          bg: 'linear-gradient(145deg, rgba(192, 132, 252, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Juego'
        };
      case 'music':
      case 'album':
      case 'track':
        return {
          icon: <Disc size={36} color="#ec4899" />,
          color: '#ec4899',
          bg: 'linear-gradient(145deg, rgba(236, 72, 153, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: 'Música'
        };
      default:
        return {
          icon: <Film size={36} color="var(--text-secondary)" />,
          color: 'var(--text-secondary)',
          bg: 'linear-gradient(145deg, rgba(148, 163, 184, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)',
          label: ''
        };
    }
  };

  const hasValidImage = Boolean(src && !imgError && !src.includes('photo-1543002588-bfa74002ed7e'));

  if (hasValidImage) {
    return (
      <img
        src={src!}
        alt={title}
        onError={() => setImgError(true)}
        style={{
          width,
          height,
          aspectRatio,
          objectFit: 'cover',
          borderRadius,
          filter: isNsfw && !showNsfw ? 'blur(15px)' : 'none',
          transition: 'filter 0.3s, transform 0.2s',
          display: 'block',
          ...style
        }}
      />
    );
  }

  const config = getPlaceholderConfig();

  return (
    <div
      style={{
        width,
        height,
        aspectRatio,
        borderRadius,
        background: config.bg,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 0.75rem',
        textAlign: 'center',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
        ...style
      }}
    >
      <div style={{
        padding: '0.85rem',
        borderRadius: '50%',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${config.color}40`,
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        {config.icon}
      </div>

      <span
        style={{
          color: '#f8fafc',
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: '1.25',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: '100%',
          wordBreak: 'break-word'
        }}
        title={title}
      >
        {title}
      </span>
    </div>
  );
};
