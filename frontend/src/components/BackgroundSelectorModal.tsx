import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Search, X, Check, Loader2, Monitor, Trash2, Sparkles } from 'lucide-react';
import { getOrderedCategories } from '../utils/categoryOrder';

interface BackgroundItem {
  title: string;
  image_url: string;
  category: string;
  origin: string;
}

interface BackgroundSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackgroundUrl?: string | null;
  onBackgroundUpdated: (newUrl: string | null) => void;
}

export const BackgroundSelectorModal: React.FC<BackgroundSelectorModalProps> = ({
  isOpen,
  onClose,
  currentBackgroundUrl,
  onBackgroundUpdated,
}) => {
  const { language } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const isEs = language === 'es';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');

  const [results, setResults] = useState<BackgroundItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentBackgroundUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Race condition prevention
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBackgrounds = async (searchTerm: string) => {
    const currentRequestId = ++activeRequestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/users/banners/search', {
        params: { query: searchTerm.trim() },
        signal: controller.signal,
      });

      if (currentRequestId === activeRequestIdRef.current) {
        setResults(res.data || []);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (currentRequestId === activeRequestIdRef.current) {
        console.error('Background search error:', err);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {

      setSelectedUrl(currentBackgroundUrl || null);
      setErrorMsg('');
      setQuery('');
      fetchBackgrounds('');
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen, currentBackgroundUrl]);

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      fetchBackgrounds(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Reset category filter if it has no results in new search
  useEffect(() => {
    if (selectedCategory !== 'all' && !results.some(r => r.category === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [results, selectedCategory]);

  const handleSaveBackground = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/background', { background_url: selectedUrl });
      await refreshProfile();
      onBackgroundUpdated(selectedUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          (isEs
            ? 'Error al actualizar fondo de perfil.'
            : 'Failed to update profile background.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveBackground = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/background', { background_url: null });
      await refreshProfile();
      setSelectedUrl(null);
      onBackgroundUpdated(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || (isEs ? 'Error al quitar fondo.' : 'Error removing background.'));
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
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
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
          maxWidth: '740px',
          height: 'min(780px, 94vh)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          padding: '1.75rem',
          gap: '1.25rem',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '0.5rem',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
              }}
            >
              <Monitor size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEs ? 'Fondo de Pantalla del Perfil' : 'Profile Background Wallpaper'}
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  PREMIUM
                </span>
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isEs
                  ? 'Fondo inmersivo en 1080p y 4K para toda tu página de perfil.'
                  : 'Immersive 1080p and 4K wallpaper covering your entire profile page.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Preview of Selected Profile Background */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '160px',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'var(--bg-primary)',
            border: selectedUrl ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          {selectedUrl ? (
            <>
              {/* Wallpaper Layer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${selectedUrl})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  zIndex: 0,
                }}
              />
              {/* Dark atmospheric vignette */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at center, rgba(9, 13, 22, 0.65) 0%, rgba(9, 13, 22, 0.88) 80%, rgba(9, 13, 22, 0.96) 100%)',
                  backdropFilter: 'blur(2px)',
                  zIndex: 1,
                }}
              />
            </>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--bg-primary)',
                zIndex: 0,
              }}
            />
          )}

          {/* Profile Card Simulation on Top of Background */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              background: 'rgba(18, 24, 38, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              backdropFilter: 'blur(8px)',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.username}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--accent-primary)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {user?.username || 'Usuario'}
                </span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                  ★ PREMIUM
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedUrl
                  ? (isEs ? 'Vista previa del fondo ambiental' : 'Ambient wallpaper preview')
                  : (isEs ? 'Sin fondo de pantalla' : 'No background wallpaper')}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isEs
                ? 'Buscar fondo (ej. The Witcher, Cyberpunk, Batman, Attack on Titan)...'
                : 'Search background (e.g., The Witcher, Cyberpunk, Batman, Attack on Titan)...'
            }
            style={{
              width: '100%',
              padding: '0.75rem 2.8rem 0.75rem 2.8rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
            }}
            autoFocus
          />
          {isLoading && (
            <Loader2
              size={18}
              className="animate-spin"
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#10b981',
              }}
            />
          )}
        </div>

        {/* Category Filters (Canonical Order, only showing available categories) */}
        {(() => {
          const ordered = getOrderedCategories(user?.category_order);
          const allCategories = ['all', ...ordered] as const;
          const availableCategories = allCategories.filter(cat => cat === 'all' || results.some(r => r.category === cat));

          if (results.length === 0 || availableCategories.length <= 1) {
            return null;
          }

          return (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {availableCategories.map(cat => {
                const isSelected = selectedCategory === cat;
                const catColor = cat === 'all' ? '#10b981' : `var(--color-${cat})`;
                const catTextColor = cat === 'all' ? '#ffffff' : `var(--color-text-${cat})`;

                const getLabel = () => {
                  switch (cat) {
                    case 'all': return isEs ? 'Todo' : 'All';
                    case 'movie': return isEs ? 'Películas' : 'Movies';
                    case 'series': return isEs ? 'Series' : 'Series';
                    case 'anime': return 'Anime';
                    case 'book': return isEs ? 'Libros' : 'Books';
                    case 'comic': return isEs ? 'Cómics' : 'Comics';
                    case 'manga': return 'Manga';
                    case 'game': return isEs ? 'Juegos' : 'Games';
                    default: return cat;
                  }
                };

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat as any)}
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

        {/* Backgrounds Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gridAutoRows: 'max-content',
            alignContent: 'start',
            gap: '1rem',
            padding: '0.5rem 0.25rem',
          }}
        >
          {(() => {
            const filteredResults = results.filter(b => selectedCategory === 'all' || b.category === selectedCategory);

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
                      ? 'No hay fondos en esta categoría.'
                      : 'No backgrounds found in this category.'
                    : query.trim().length >= 2
                    ? isEs
                      ? 'No se encontraron fondos con ese nombre.'
                      : 'No backgrounds found with that name.'
                    : isEs
                    ? 'Escribe para buscar fondos 1080p de Videojuegos, Anime, Películas y Series.'
                    : 'Type to search 1080p backgrounds from Games, Anime, Movies, and Shows.'}
                </div>
              );
            }

            return filteredResults.map((b, idx) => {
              const isSelected = selectedUrl === b.image_url;
              return (
                <div
                  key={`${b.title}-${idx}`}
                  onClick={() => setSelectedUrl(b.image_url)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isSelected
                      ? '2px solid #10b981'
                      : '1px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isSelected ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '110px',
                      position: 'relative',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <img
                      src={b.image_url}
                      alt={b.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(16, 185, 129, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={26} color="white" strokeWidth={3} />
                      </div>
                    )}
                    {selectedCategory === 'all' && (
                      <span
                        className={`tag-badge tag-${b.category || 'game'}`}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          fontSize: '0.6rem',
                          padding: '0.1rem 0.4rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {b.category === 'game' ? (isEs ? 'Juego' : 'Game') : b.category === 'anime' ? 'Anime' : b.category === 'movie' ? (isEs ? 'Película' : 'Movie') : (isEs ? 'Serie' : 'Series')}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={b.title}
                    >
                      {b.title}
                    </span>
                    {b.origin && b.origin !== b.title && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={b.origin}
                      >
                        {b.origin}
                      </span>
                    )}
                  </div>
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
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
          }}
        >
          {currentBackgroundUrl ? (
            <button
              onClick={handleRemoveBackground}
              disabled={isSaving}
              className="btn-secondary"
              style={{
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderColor: '#ef4444',
                color: '#ef4444',
              }}
            >
              <Trash2 size={16} />
              {isEs ? 'Quitar Fondo' : 'Remove Background'}
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary"
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.88rem' }}
            >
              {isEs ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveBackground}
              disabled={isSaving || !selectedUrl || selectedUrl === currentBackgroundUrl}
              className="btn-primary"
              style={{
                padding: '0.55rem 1.35rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#10b981',
                borderColor: '#10b981',
              }}
            >
              <Check size={16} />
              {isSaving
                ? isEs
                  ? 'Guardando...'
                  : 'Saving...'
                : isEs
                ? 'Guardar Fondo'
                : 'Save Background'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackgroundSelectorModal;
