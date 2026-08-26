import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Search, X, Check, Loader2, User as UserIcon } from 'lucide-react';

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
  onAvatarUpdated,
}) => {
  const { language } = useTranslation();
  const { refreshProfile } = useAuth();
  const isEs = language === 'es';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'movie' | 'series' | 'anime' | 'comic' | 'manga' | 'book' | 'game'>('all');
  const [results, setResults] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  // Race condition prevention
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCharacters = async (searchTerm: string) => {
    const currentRequestId = ++activeRequestIdRef.current;

    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/users/characters/search', {
        params: { query: searchTerm.trim() },
        signal: controller.signal,
      });

      // Only update state if this is still the latest active request
      if (currentRequestId === activeRequestIdRef.current) {
        setResults(res.data || []);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (currentRequestId === activeRequestIdRef.current) {
        console.error('Character search error:', err);
        setIsLoading(false);
      }
    }
  };

  // Initial popular character suggestions when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentPhotoUrl || null);
      setErrorMsg('');
      setQuery('');
      fetchCharacters('');
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    // Skip if query is empty because isOpen effect handles initial empty fetch
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      fetchCharacters(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Reset category filter if it has no results in new search
  useEffect(() => {
    if (selectedCategory !== 'all' && !results.some(r => r.category === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [results, selectedCategory]);


  const handleSaveAvatar = async () => {

    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/avatar', { photo_url: selectedUrl });
      await refreshProfile();
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
      await refreshProfile();
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
          height: 'min(640px, 90vh)',
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
              <UserIcon size={20} />
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                {isEs ? 'Avatar de Personaje' : 'Character Avatar'}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isEs
                  ? 'Elige tu personaje favorito para tu imagen de perfil'
                  : 'Choose your favorite character for your profile picture'}
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
                ? 'Buscar personaje o portada (Batman, Inception, Breaking Bad, Goku, Hollow Knight, Harry Potter...)'
                : 'Search character or cover (Batman, Inception, Breaking Bad, Goku, Hollow Knight, Harry Potter...)'
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

        {/* Category Filters (Only show categories with results) */}
        {(() => {
          const allCategories = ['all', 'movie', 'series', 'anime', 'comic', 'manga', 'book', 'game'] as const;
          const availableCategories = allCategories.filter(cat => cat === 'all' || results.some(r => r.category === cat));

          if (results.length === 0 || availableCategories.length <= 1) {
            return null;
          }

          return (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {availableCategories.map(cat => {
                const isSelected = selectedCategory === cat;
                const catColor = cat === 'all' ? 'var(--accent-primary)' : `var(--color-${cat})`;
                const catTextColor = cat === 'all' ? '#ffffff' : `var(--color-text-${cat})`;

                const getLabel = () => {
                  switch (cat) {
                    case 'all': return isEs ? 'Todo' : 'All';
                    case 'movie': return isEs ? 'Películas' : 'Movies';
                    case 'series': return isEs ? 'Series' : 'Series';
                    case 'anime': return 'Anime';
                    case 'comic': return isEs ? 'Cómics' : 'Comics';
                    case 'manga': return 'Manga';
                    case 'book': return isEs ? 'Libros' : 'Books';
                    case 'game': return isEs ? 'Juegos' : 'Games';
                    default: return cat;
                  }
                };

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      border: `1.5px solid ${catColor}`,
                      background: isSelected ? catColor : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? (cat === 'all' ? '#ffffff' : catTextColor) : 'var(--text-primary)',
                      boxShadow: isSelected ? `0 0 10px ${catColor}40` : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {getLabel()}
                  </button>
                );
              })}
            </div>
          );
        })()}


        {errorMsg && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
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
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gridAutoRows: 'max-content',
            alignContent: 'start',
            gap: '1rem',
            padding: '0.5rem 0.25rem',
          }}
        >

          {(() => {
            const filteredResults = results.filter(ch => selectedCategory === 'all' || ch.category === selectedCategory);

            if (filteredResults.length === 0 && !isLoading) {
              return (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                  }}
                >
                  {results.length > 0
                    ? isEs
                      ? 'No hay resultados en esta categoría.'
                      : 'No results found in this category.'
                    : query.trim().length >= 2
                    ? isEs
                      ? 'No se encontraron resultados con ese nombre.'
                      : 'No results found with that name.'
                    : isEs
                    ? 'Escribe para buscar personajes y portadas de Películas, Series, Videojuegos, Anime, Libros y Cómics.'
                    : 'Type to search characters and covers across Movies, Shows, Games, Anime, Books, and Comics.'}
                </div>
              );
            }

            return filteredResults.map((ch, idx) => {
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

                {selectedCategory === 'all' && (() => {
                  const getCategoryLabel = () => {
                    switch (ch.category) {
                      case 'series': return isEs ? 'Serie' : 'Series';
                      case 'movie': return isEs ? 'Película' : 'Movie';
                      case 'anime': return 'Anime';
                      case 'comic': return isEs ? 'Cómic' : 'Comic';
                      case 'manga': return 'Manga';
                      case 'book': return isEs ? 'Libro' : 'Book';
                      case 'game': return isEs ? 'Juego' : 'Game';
                      default: return isEs ? 'Serie' : 'Series';
                    }
                  };
                  return (
                    <span
                      className={`tag-badge tag-${ch.category || 'series'}`}
                      style={{
                        marginTop: '0.25rem',
                        fontSize: '0.62rem',
                        padding: '0.1rem 0.45rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {getCategoryLabel()}
                    </span>
                  );
                })()}
              </div>
            );
          });
        })()}
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
