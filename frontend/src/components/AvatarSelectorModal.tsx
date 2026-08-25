import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Search, Sparkles, X, Check, Loader2, User as UserIcon } from 'lucide-react';

interface Character {
  name: string;
  image_url: string;
  category: string;
  origin: string;
}

interface AvatarSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoUrl?: string | null;
  isPro?: boolean;
  onAvatarUpdated: (newUrl: string | null) => void;
}

export const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({
  isOpen,
  onClose,
  currentPhotoUrl,
  isPro = false,
  onAvatarUpdated,
}) => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial popular character suggestions when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentPhotoUrl || null);
      setErrorMsg('');
      if (!query.trim()) {
        fetchCharacters('Goku');
      }
    }
  }, [isOpen]);

  const fetchCharacters = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/users/characters/search', {
        params: { query: searchTerm.trim() },
      });
      setResults(res.data || []);
    } catch (err) {
      console.error('Character search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        fetchCharacters(query);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSaveAvatar = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/avatar', { photo_url: selectedUrl });
      onAvatarUpdated(selectedUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          (isEs
            ? 'Error al actualizar avatar.'
            : 'Failed to update avatar.')
      );
    } finally {
      setIsSaving(false);
    }

  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/avatar', { photo_url: null });
      onAvatarUpdated(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error resetting avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          borderRadius: '20px',
          gap: '1.25rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '0.5rem',
                borderRadius: '10px',
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--accent-primary)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                {isEs ? 'Avatar de Personaje' : 'Character Avatar'}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isPro
                  ? isEs
                    ? '⭐ Exclusivo de Pathd Premium'
                    : '⭐ Exclusive to Pathd Premium'
                  : isEs
                  ? '🔒 Requiere suscripción Pathd Premium'
                  : '🔒 Requires Pathd Premium subscription'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input-field"
            placeholder={
              isEs
                ? 'Buscar personaje (Goku, Spider-Man, Kratos, Luffy, Geralt...)'
                : 'Search character (Goku, Spider-Man, Kratos, Luffy, Geralt...)'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            autoFocus
          />
          <Search
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          {isLoading && (
            <Loader2
              size={16}
              className="animate-spin"
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--accent-primary)',
              }}
            />
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Characters Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: '280px',
            maxHeight: '360px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '1rem',
            padding: '0.5rem 0.25rem',
          }}
        >
          {results.length === 0 && !isLoading && (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              {query.trim().length >= 2
                ? isEs
                  ? 'No se encontraron personajes con ese nombre.'
                  : 'No characters found with that name.'
                : isEs
                ? 'Escribe el nombre de un personaje para buscar en Anime, Cómics y Videojuegos.'
                : 'Type a character name to search across Anime, Comics, and Games.'}
            </div>
          )}

          {results.map((ch, idx) => {
            const isSelected = selectedUrl === ch.image_url;
            return (
              <div
                key={`${ch.name}-${idx}`}
                onClick={() => setSelectedUrl(ch.image_url)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-color)',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'var(--bg-secondary)',
                    boxShadow: isSelected ? '0 0 15px rgba(124, 58, 237, 0.6)' : 'none',
                  }}
                >
                  <img
                    src={ch.image_url}
                    alt={ch.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(124, 58, 237, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={20} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>

                <span
                  style={{
                    marginTop: '0.45rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                  title={ch.name}
                >
                  {ch.name}
                </span>

                {ch.origin && ch.origin.toLowerCase() !== ch.name.toLowerCase() && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                    title={ch.origin}
                  >
                    {ch.origin}
                  </span>
                )}

                <span
                  style={{
                    marginTop: '0.2rem',
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    background:
                      ch.category === 'anime'
                        ? 'rgba(139, 92, 246, 0.15)'
                        : ch.category === 'comic'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color:
                      ch.category === 'anime'
                        ? '#a78bfa'
                        : ch.category === 'comic'
                        ? '#60a5fa'
                        : '#34d399',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {ch.category === 'anime' ? 'Anime' : ch.category === 'comic' ? 'Cómic' : 'Juego'}
                </span>
              </div>
            );
          })}
        </div>


        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
          }}
        >
          {currentPhotoUrl ? (
            <button
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="btn-secondary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            >
              <UserIcon size={14} style={{ marginRight: '0.35rem' }} />
              {isEs ? 'Restablecer por defecto' : 'Reset to default'}
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.88rem' }}
            >
              {isEs ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveAvatar}
              disabled={isSaving || !selectedUrl || selectedUrl === currentPhotoUrl}
              className="btn-primary"
              style={{
                padding: '0.55rem 1.35rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Check size={16} />
              {isSaving
                ? isEs
                  ? 'Guardando...'
                  : 'Saving...'
                : isEs
                ? 'Aplicar Avatar'
                : 'Apply Avatar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AvatarSelectorModal;
