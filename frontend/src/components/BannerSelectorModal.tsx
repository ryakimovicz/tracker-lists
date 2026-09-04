import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Search, X, Check, Loader2, Image as ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import { getOrderedCategories } from '../utils/categoryOrder';

interface BannerItem {
  title: string;
  image_url: string;
  category: string;
  origin: string;
}

interface BannerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBannerUrl?: string | null;
  onBannerUpdated: (newUrl: string | null) => void;
}

export const BannerSelectorModal: React.FC<BannerSelectorModalProps> = ({
  isOpen,
  onClose,
  currentBannerUrl,
  onBannerUpdated,
}) => {
  const { language } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const isEs = language === 'es';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');

  const [results, setResults] = useState<BannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentBannerUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  // Race condition prevention
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBanners = async (searchTerm: string) => {
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
        console.error('Banner search error:', err);
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

      setSelectedUrl(currentBannerUrl || null);
      setErrorMsg('');
      setQuery('');
      fetchBanners('');
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen, currentBannerUrl]);

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      fetchBanners(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Reset category filter if it has no results in new search
  useEffect(() => {
    if (selectedCategory !== 'all' && !results.some(r => r.category === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [results, selectedCategory]);

  const handleSaveBanner = async () => {

    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/banner', { banner_url: selectedUrl });
      await refreshProfile();
      onBannerUpdated(selectedUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          (isEs ? 'Error al guardar el banner de portada' : 'Failed to save profile banner')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      await apiClient.put('/users/me/banner', { banner_url: null });
      setSelectedUrl(null);
      await refreshProfile();
      onBannerUpdated(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          (isEs ? 'Error al restablecer el banner' : 'Failed to reset banner')
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          height: 'min(760px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          padding: '1.75rem',
          gap: '1.25rem',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
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
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
              }}
            >
              <ImageIcon size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEs ? 'Portada de Perfil' : 'Profile Banner'}
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  PREMIUM
                </span>
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isEs
                  ? 'Elige una imagen panorámica de alta definición para el encabezado de tu perfil'
                  : 'Choose a high-definition panoramic wallpaper for your profile header'}
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
              padding: '0.4rem',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Preview of Selected Banner (Matches Profile Header 1:1) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '175px',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'var(--surface-color)',
            border: selectedUrl ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            padding: '1.5rem 1.75rem',
            gap: '1.25rem',
          }}
        >
          {selectedUrl && (
            <>
              {/* Banner Image Layer */}
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
              {/* Darkening & Gradient overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(15, 15, 20, 0.4) 0%, rgba(15, 15, 20, 0.85) 55%, rgba(15, 15, 20, 0.98) 100%)',
                  zIndex: 1,
                }}
              />
            </>
          )}

          {/* Avatar simulation */}
          <div style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>

            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.username}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2.5px solid var(--accent-primary)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  border: '2.5px solid var(--accent-primary)',
                  background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>

          {/* User info simulation */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {user?.username || 'Username'}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '3px',
                  fontWeight: 700,
                }}
              >
                PREMIUM
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: selectedUrl ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
              {selectedUrl
                ? (isEs ? 'Vista previa de cómo se verá en tu perfil' : 'Live preview of your profile header')
                : (isEs ? 'Sin portada' : 'No banner')}
            </span>
          </div>
        </div>




        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input-field"
            placeholder={
              isEs
                ? 'Buscar portada (Cyberpunk 2077, Attack on Titan, The Witcher, Interstellar, Breaking Bad...)'
                : 'Search banner (Cyberpunk 2077, Attack on Titan, The Witcher, Interstellar, Breaking Bad...)'
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
                transform: 'translateY(-50)',
                color: 'var(--accent-primary)',
              }}
            />
          )}
        </div>

        {/* Category Filters (Only show categories with results) */}
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
                const catColor = cat === 'all' ? '#f59e0b' : `var(--color-${cat})`;
                const catTextColor = cat === 'all' ? '#ffffff' : `var(--color-text-${cat})`;

                const getLabel = () => {
                  switch (cat) {
                    case 'all': return isEs ? 'Todo' : 'All';
                    case 'movie': return isEs ? 'Películas' : 'Movies';
                    case 'series': return isEs ? 'Series' : 'Shows';
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

        {/* Banners Grid */}
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
                      ? 'No hay portadas en esta categoría.'
                      : 'No banners found in this category.'
                    : query.trim().length >= 2
                    ? isEs
                      ? 'No se encontraron portadas con ese nombre.'
                      : 'No banners found with that name.'
                    : isEs
                    ? 'Escribe para buscar fondos y portadas de Juegos, Anime, Películas y Series.'
                    : 'Type to search panoramic banners from Games, Anime, Movies, and Shows.'}
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
                      ? '2px solid #f59e0b'
                      : '1px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isSelected ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none',
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
                        background: 'rgba(245, 158, 11, 0.35)',
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
                      {b.category === 'game' ? (isEs ? 'Juego' : 'Game') : b.category === 'anime' ? 'Anime' : b.category === 'movie' ? (isEs ? 'Película' : 'Movie') : (isEs ? 'Serie' : 'Show')}
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
            gap: '1rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
          }}
        >
          {currentBannerUrl ? (
            <button
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <Trash2 size={15} />
              {isEs ? 'Quitar Portada' : 'Remove Banner'}
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} className="btn-secondary" disabled={isSaving}>
              {isEs ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveBanner}
              disabled={isSaving || !selectedUrl || selectedUrl === currentBannerUrl}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#fff',
              }}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isEs ? 'Guardar Portada' : 'Save Banner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
