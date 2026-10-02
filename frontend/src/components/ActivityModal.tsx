import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ThumbsUp, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ActivityCommentThread } from './ActivityCommentThread';
import type { ActivityCardData } from './SocialActivityCard';

interface ActivityModalProps {
  activity: ActivityCardData;
  isOpen: boolean;
  onClose: () => void;
  likesCount: number;
  isLiked: boolean;
  onToggleLike: (e: React.MouseEvent) => void;
  commentsCount: number;
  onCommentsCountChange: (count: number) => void;
  renderCardBody: (closeButton?: React.ReactNode) => React.ReactNode;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  isOpen,
  onClose,
  likesCount,
  isLiked,
  onToggleLike,
  commentsCount,
  onCommentsCountChange,
  renderCardBody
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';

  const mouseDownOnBackdropRef = React.useRef(false);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const closeButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      title={isEs ? 'Cerrar' : 'Close'}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: '0.2rem',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      <X size={18} />
    </button>
  );

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          mouseDownOnBackdropRef.current = true;
        } else {
          mouseDownOnBackdropRef.current = false;
        }
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) {
          onClose();
        }
        mouseDownOnBackdropRef.current = false;
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary, #0f1523)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--card-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.85))',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Scrollable Container for Card Preview + Comments Thread */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Activity Event Card Preview */}
          <div
            style={{
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            {renderCardBody(closeButton)}

            {/* Like & Comments Stats in preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <button
                onClick={onToggleLike}
                disabled={!user}
                style={{
                  background: isLiked ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: isLiked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  color: isLiked ? '#3b82f6' : 'var(--text-secondary)',
                  borderRadius: '20px',
                  padding: '0.3rem 0.7rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: user ? 'pointer' : 'default',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
              >
                <ThumbsUp size={16} fill={isLiked ? '#3b82f6' : 'none'} color={isLiked ? '#3b82f6' : 'currentColor'} />
                <span>{likesCount}</span>
              </button>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: 'var(--accent-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <MessageSquare size={16} />
                <span>
                  {commentsCount} {isEs ? (commentsCount === 1 ? 'comentario' : 'comentarios') : (commentsCount === 1 ? 'comment' : 'comments')}
                </span>
              </div>
            </div>
          </div>

          {/* Comment Thread */}
          <div>
            <ActivityCommentThread
              activityId={activity.id}
              onCommentsCountChange={onCommentsCountChange}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
