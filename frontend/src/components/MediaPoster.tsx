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

  const isCinemaPlaceholder = Boolean(
    src && (
      src.includes('photo-1489599849927-2ee91cede3ba') ||
      src.includes('photo-1489599849927')
    )
  );

  const isGenericImage = Boolean(
    src && (
      isCinemaPlaceholder ||
      src.includes('photo-1543002588-bfa74002ed7e') ||
      src.includes('images.unsplash.com/photo-')
    )
  );

  const hasValidImage = Boolean(src && !imgError && !isGenericImage);

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
          filter: 'none',
          transition: 'transform 0.2s',
          display: 'block',
          ...style
        }}
      />
    );
  }

  const config = getPlaceholderConfig();
  const backgroundStyle = isCinemaPlaceholder
    ? `linear-gradient(180deg, rgba(0, 0, 0, 0.88) 0%, rgba(15, 23, 42, 0.45) 45%, rgba(0, 0, 0, 0.92) 100%), url("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500") center/cover no-repeat`
    : config.bg;

  return (
    <div
      style={{
        width,
        height,
        aspectRatio,
        borderRadius,
        background: backgroundStyle,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '1.25rem 0.85rem',
        textAlign: 'center',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
        ...style
      }}
    >
      {/* Title in top-center area */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', marginTop: '0.25rem' }}>
        <span
          style={{
            color: '#f8fafc',
            fontSize: '0.92rem',
            fontWeight: 700,
            lineHeight: '1.3',
            textShadow: '0 2px 6px rgba(0,0,0,0.9)',
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

      {/* Central themed icon */}
      <div style={{
        padding: '0.9rem',
        borderRadius: '50%',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${config.color}50`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${config.color}25`
      }}>
        {config.icon}
      </div>
    </div>
  );
};


