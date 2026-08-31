import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { MediaPoster } from './MediaPoster';
import { ArrowRight, Crown, X, AlertCircle } from 'lucide-react';

interface LibraryItem {
  id: number;
  external_id?: string | null;
  title: string;
  item_type: string;
  image_url?: string | null;
}


interface ReplaceFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  newItem: LibraryItem | null;
  currentFavorites: LibraryItem[];
  isPro: boolean;
  onConfirmReplace: (itemToReplaceId: number, newItemId: number) => Promise<void>;
  onOpenProModal: () => void;
}

export const ReplaceFavoriteModal: React.FC<ReplaceFavoriteModalProps> = ({
  isOpen,
  onClose,
  newItem,
  currentFavorites,
  isPro,
  onConfirmReplace,
  onOpenProModal
}) => {
  const { language, t } = useTranslation();
  const isEs = language === 'es';

  if (!isOpen || !newItem) return null;

  const handleSelectToReplace = async (itemToReplaceId: number) => {
    await onConfirmReplace(itemToReplaceId, newItem.id);
    onClose();
  };

  const currentActive = currentFavorites[0];

  return (
    <div 
      className="content-modal-overlay" 
      style={{ position: 'fixed', inset: 0, zIndex: 3500 }} 
      onClick={onClose}
    >
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: isPro ? '640px' : '480px', 
          width: '100%', 
          maxHeight: '90vh', 
          overflowY: 'auto',
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
            {isPro 
              ? (isEs ? 'Límite de 10 destacados alcanzado' : '10 Favorites Limit Reached')
              : (isEs ? '¿Reemplazar obra destacada?' : 'Replace Featured Favorite?')
            }
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isPro
              ? (isEs 
                  ? `Ya tienes 10 ${t('media' + newItem.item_type.charAt(0).toUpperCase() + newItem.item_type.slice(1))} destacadas. Selecciona cuál deseas reemplazar por "${newItem.title}":`
                  : `You already have 10 featured items in this category. Choose which one to replace with "${newItem.title}":`)
              : (isEs 
                  ? `En el plan gratuito puedes tener 1 obra destacada por categoría. Si continúas, se actualizará tu destacado en tu perfil.`
                  : `Free plan allows 1 featured item per category. If you continue, your featured profile item will be updated.`)
            }
          </p>
        </div>

        {/* Body for Free Users: Side-by-Side visual comparison */}
        {!isPro && currentActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              {/* Current Active Favorite */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {isEs ? 'Actual' : 'Current'}
                </span>
                <div style={{ width: '90px', height: '130px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MediaPoster
                    src={currentActive.image_url}
                    title={currentActive.title}
                    itemType={currentActive.item_type}
                    height="100%"
                    width="100%"
                    borderRadius="8px"
                  />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentActive.title}>
                  {currentActive.title}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <ArrowRight size={24} />
              </div>

              {/* New Favorite To Feature */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                  {isEs ? 'Nuevo' : 'New'}
                </span>
                <div style={{ width: '90px', height: '130px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--accent-primary)' }}>
                  <MediaPoster
                    src={newItem.image_url}
                    title={newItem.title}
                    itemType={newItem.item_type}
                    height="100%"
                    width="100%"
                    borderRadius="8px"
                  />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={newItem.title}>
                  {newItem.title}
                </span>
              </div>
            </div>

            {/* Pro Upsell Callout */}
            <div 
              onClick={() => {
                onOpenProModal();
              }}

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
                <strong style={{ color: '#f59e0b' }}>{isEs ? '¿Quieres mantener ambas?' : 'Want to keep both?'}</strong>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>
                  {isEs ? 'Pásate a Pathd Premium para destacar hasta 10 obras por categoría.' : 'Upgrade to Pathd Premium to feature up to 10 items per category.'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </button>
              <button onClick={() => handleSelectToReplace(currentActive.id)} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                {isEs ? 'Confirmar y Reemplazar' : 'Confirm & Replace'}
              </button>
            </div>
          </div>
        )}

        {/* Body for Pro Users (10/10 slots full): List to choose which one to replace */}
        {isPro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', maxHeight: '420px', overflowY: 'auto', padding: '0.5rem 0' }}>
              {currentFavorites.map((fav) => (
                <div
                  key={fav.id}
                  className="glass-card"
                  style={{
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'center',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ width: '80px', height: '115px', borderRadius: '6px', overflow: 'hidden' }}>
                    <MediaPoster
                      src={fav.image_url}
                      title={fav.title}
                      itemType={fav.item_type}
                      height="100%"
                      width="100%"
                      borderRadius="6px"
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fav.title}>
                    {fav.title}
                  </span>
                  <button
                    onClick={() => handleSelectToReplace(fav.id)}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', width: '100%', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                  >
                    {isEs ? 'Reemplazar' : 'Replace'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={onClose} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                {isEs ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ReplaceFavoriteModal;
