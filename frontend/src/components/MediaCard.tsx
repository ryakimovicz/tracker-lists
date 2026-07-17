import React from 'react';
import { Star, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MediaCardProps {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  typeLabel?: string;
  subtitle?: string;
  progressText?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  isLoading?: boolean;
  isNsfw?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  title,
  imageUrl,
  typeLabel,
  subtitle,
  progressText,
  onClick,
  style,
  actionLabel,
  onAction,
  isLoading,
  isNsfw
}) => {
  const { user } = useAuth();
  const [isPeek, setIsPeek] = React.useState(false);
  
  const shouldBlur = isNsfw && !user?.show_nsfw;
  const currentlyBlurred = shouldBlur && !isPeek;

  const handleCardClick = (e: React.MouseEvent) => {
    if (currentlyBlurred) {
      e.stopPropagation();
      setIsPeek(true);
      return;
    }
    if (onClick) onClick();
  };

  return (
    <div
      className="glass-card"
      onClick={handleCardClick}
      style={{
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        cursor: (onClick || currentlyBlurred) ? 'pointer' : 'default',
        minWidth: '160px',
        width: '160px',
        transition: 'transform 0.2s',
        ...style
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={imageUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150'}
          alt={title}
          style={{ 
            width: '100%', 
            height: '220px', 
            objectFit: 'cover', 
            borderRadius: '8px',
            filter: currentlyBlurred ? 'blur(15px)' : 'none',
            transition: 'filter 0.3s'
          }}
        />
        {currentlyBlurred && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
            color: 'white', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem'
          }}>
            Haz clic para ver portada
          </div>
        )}
        {typeLabel && (
          <span style={{
            position: 'absolute',
            bottom: '0.5rem',
            left: '0.5rem',
            background: 'rgba(9, 9, 12, 0.85)',
            color: typeLabel.toLowerCase() === 'anime' ? '#a78bfa' : 'var(--text-secondary)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backdropFilter: 'blur(4px)'
          }}>
            {typeLabel}
          </span>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: '0.95rem', 
          fontWeight: 600, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }} title={title}>
          {title}
        </h4>
        
        {progressText && (
          <div style={{ 
            marginTop: '0.25rem',
            fontSize: '0.7rem', 
            color: 'var(--accent-primary)',
            fontWeight: 700,
            background: 'rgba(124, 58, 237, 0.12)',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            display: 'inline-block',
            alignSelf: 'flex-start',
            letterSpacing: '0.04em'
          }}>
            {progressText}
          </div>
        )}

        {subtitle && (
          <span style={{ 
            fontSize: '0.8rem', 
            color: 'var(--text-secondary)',
            overflow: 'visible',
            textOverflow: 'clip',
            whiteSpace: 'normal'
          }}>
            {subtitle}
          </span>
        )}
        
        {onAction && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAction(e);
            }}
            className="btn-secondary"
            style={{ 
              marginTop: '0.25rem',
              padding: '0.25rem 0.5rem', 
              fontSize: '0.75rem',
              alignSelf: 'stretch',
              textAlign: 'center',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {isLoading ? (
              <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : actionLabel ? (
              actionLabel
            ) : (
              <Check size={16} />
            )}
          </button>
        )}
      </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

