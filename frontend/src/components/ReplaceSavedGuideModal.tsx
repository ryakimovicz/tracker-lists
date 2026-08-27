import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Crown, X, ArrowRight, BookOpen } from 'lucide-react';

interface ReplaceSavedGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGuideTitle: string;
  guideToReplaceTitle: string;
  onConfirmReplace: () => Promise<void>;
  onOpenProModal: () => void;
}

export const ReplaceSavedGuideModal: React.FC<ReplaceSavedGuideModalProps> = ({
  isOpen,
  onClose,
  targetGuideTitle,
  guideToReplaceTitle,
  onConfirmReplace,
  onOpenProModal
}) => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirmReplace();
    onClose();
  };

  return (
    <div className="content-modal-overlay" onClick={onClose}>
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '480px', 
          width: '100%', 
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.25rem'
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
            {isEs ? 'Límite de guías seguidas (3/3)' : 'Followed Guides Limit (3/3)'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isEs 
              ? `En el plan gratuito puedes seguir hasta 3 guías de otros usuarios. Si continúas, se intercambiará por la última guía que seguías.`
              : `Free plan allows following up to 3 community guides. If you continue, it will replace the last guide you followed.`
            }
          </p>
        </div>

        {/* Visual Swap Card */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '1rem',
          background: 'var(--bg-secondary)',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          {/* Guide to be replaced */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {isEs ? 'Se reemplazará' : 'Will be replaced'}
            </span>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              borderRadius: '10px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <BookOpen size={24} />
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={guideToReplaceTitle}>
              {guideToReplaceTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
            <ArrowRight size={24} />
          </div>

          {/* New Guide to follow */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              {isEs ? 'Nueva a seguir' : 'New to follow'}
            </span>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              borderRadius: '10px', 
              background: 'rgba(124, 58, 237, 0.15)', 
              color: 'var(--accent-primary)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--accent-primary)'
            }}>
              <BookOpen size={24} />
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={targetGuideTitle}>
              {targetGuideTitle}
            </span>
          </div>
        </div>

        {/* Pro Callout */}
        <div 
          onClick={onOpenProModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(124, 58, 237, 0.12))',
            borderRadius: '10px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            cursor: 'pointer'
          }}
        >
          <Crown size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', textAlign: 'left', lineHeight: 1.3 }}>
            <strong style={{ color: '#f59e0b' }}>{isEs ? '¿Quieres seguir ambas?' : 'Want to follow both?'}</strong>
            <span style={{ color: 'var(--text-secondary)', display: 'block' }}>
              {isEs ? 'Pásate a Pathd Premium para seguir guías ilimitadas.' : 'Upgrade to Pathd Premium to follow unlimited guides.'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
            {isEs ? 'Cancelar' : 'Cancel'}
          </button>
          <button onClick={handleConfirm} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
            {isEs ? 'Reemplazar y Seguir' : 'Replace & Follow'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ReplaceSavedGuideModal;
