import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trophy, Disc, Mic, Headphones, Clock, Music, User as UserIcon, Calendar, ArrowRight, Star, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { PathdLoader } from './PathdLoader';

import { getCachedMusicDetails, setCachedMusicDetails, batchPrefetchMusicItems, prefetchMusicDetails } from '../utils/musicPrefetch';

interface MusicDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'artist' | 'album' | 'track';
  artist: string;
  name?: string;
  initialImage?: string;
}

const detectTextLanguage = (text: string): 'es' | 'en' | 'other' => {
  if (!text || text.trim().length < 8) return 'other';
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const tokens = clean.match(/\b[a-z]{2,}\b/g) || [];
  if (tokens.length === 0) return 'other';

  const spanishMarkers = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'es',
    'fue', 'era', 'son', 'con', 'por', 'para', 'como', 'su', 'sus', 'que', 'y', 'o',
    'al', 'se', 'ha', 'han', 'banda', 'cancion', 'canciones', 'album', 'artista',
    'nacido', 'nacida', 'musica', 'musical', 'guitarra', 'bateria', 'vocalista',
    'cantante', 'discografia', 'primer', 'primera', 'ano', 'anos', 'tambien', 'mas',
    'pero', 'grupo', 'formada', 'formado', 'integrantes', 'integrada', 'integrado',
    'origen', 'uruguay', 'uruguaya', 'uruguayo', 'argentina', 'argentino', 'espanola',
    'espanol', 'mexico', 'mexicano', 'letras', 'discos', 'genero', 'generos', 'disco'
  ]);

  const englishMarkers = new Set([
    'the', 'is', 'are', 'was', 'were', 'and', 'or', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'an', 'a', 'as', 'he', 'she', 'they', 'it', 'his',
    'her', 'their', 'its', 'has', 'have', 'had', 'been', 'band', 'song', 'songs',
    'album', 'artist', 'born', 'music', 'musical', 'guitar', 'drums', 'singer',
    'lead', 'vocalist', 'first', 'released', 'also', 'more', 'but', 'which', 'who',
    'about', 'after', 'known', 'years', 'formed', 'members', 'including', 'debut',
    'records', 'recorded', 'studio', 'tracks', 'genre', 'rock', 'pop', 'american',
    'british', 'canadian', 'australian', 'english', 'such', 'into', 'their'
  ]);

  let esScore = 0;
  let enScore = 0;

  for (const token of tokens) {
    if (spanishMarkers.has(token)) esScore++;
    if (englishMarkers.has(token)) enScore++;
  }

  if (esScore >= 2 && esScore > enScore) return 'es';
  if (enScore >= 2 && enScore > esScore) return 'en';
  if (esScore > 0 && enScore === 0) return 'es';
  if (enScore > 0 && enScore === 0) return 'en';
  return 'other';
};

export const MusicDetailsModal: React.FC<MusicDetailsModalProps> = (props) => {
  if (!props.isOpen) return null;
  const instanceKey = `${props.type}_${props.artist}_${props.name || ''}`;
  return <MusicDetailsModalInner key={instanceKey} {...props} />;
};

const MusicDetailsModalInner: React.FC<MusicDetailsModalProps> = ({
  isOpen,
  onClose,
  type: propType,
  artist: propArtist,
  name: propName,
  initialImage
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Internal item navigation state (allows jumping between track -> album -> artist without closing modal)
  const [activeItem, setActiveItem] = useState<{
    type: 'artist' | 'album' | 'track';
    artist: string;
    name?: string;
    image?: string;
  }>({
    type: propType,
    artist: propArtist,
    name: propName,
    image: initialImage
  });

  const initialCached = getCachedMusicDetails(propType, propArtist, propName);
  const [rankingPeriod, setRankingPeriod] = useState<'7day' | '1month' | 'overall'>('7day');
  const [discographyFilter, setDiscographyFilter] = useState<'all' | 'album' | 'single' | 'ep'>('all');
  const [isBioExpanded, setIsBioExpanded] = useState<boolean>(false);
  const [translatedBio, setTranslatedBio] = useState<string>('');
  const [translatedBioTarget, setTranslatedBioTarget] = useState<string>('');
  const [showOriginalBio, setShowOriginalBio] = useState<boolean>(true);
  const [isTranslatingBio, setIsTranslatingBio] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!initialCached);
  const [data, setData] = useState<any>(initialCached || null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!activeItem.artist) return;

    let isMounted = true;
    setError('');

    // Check if item is already in prefetch cache for instant 0ms rendering
    const cached = getCachedMusicDetails(activeItem.type, activeItem.artist, activeItem.name);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }

    const fetchDetails = async () => {
      try {
        const res = await apiClient.get('/users/music/details', {
          params: {
            type: activeItem.type,
            artist: activeItem.artist,
            name: activeItem.name || '',
            period: '7day'
          }
        });
        if (isMounted) {
          setData(res.data);
          setCachedMusicDetails(activeItem.type, activeItem.artist, activeItem.name, res.data);
          setLoading(false);

          // Deep prefetch reachable sub-items in background:
          if (activeItem.type === 'artist' && res.data.details?.discography?.length > 0) {
            // Batch prefetch top 8 releases of this artist
            const discItems = res.data.details.discography.slice(0, 8).map((albumItem: any) => ({
              type: 'album' as const,
              artist: activeItem.artist,
              name: albumItem.title
            }));
            batchPrefetchMusicItems(discItems, 8, 200);
          } else if (activeItem.type === 'album') {
            // Prefetch artist
            if (res.data.details?.artist) {
              prefetchMusicDetails('artist', res.data.details.artist);
            }
            // Batch prefetch first 8 tracks of this album
            if (res.data.details?.tracks?.length > 0) {
              const trkItems = res.data.details.tracks.slice(0, 8).map((trk: any) => ({
                type: 'track' as const,
                artist: res.data.details.artist || activeItem.artist,
                name: trk.name
              }));
              batchPrefetchMusicItems(trkItems, 8, 200);
            }
          } else if (activeItem.type === 'track') {
            if (res.data.details?.artist) {
              prefetchMusicDetails('artist', res.data.details.artist);
            }
            if (res.data.details?.album && res.data.details?.artist) {
              prefetchMusicDetails('album', res.data.details.artist, res.data.details.album);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          if (!cached) {
            setError(err.response?.data?.detail || (language === 'es' ? 'Error al cargar detalles.' : 'Failed to load details.'));
          }
          setLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeItem.type, activeItem.artist, activeItem.name]);

  if (!isOpen) return null;

  const currentType = activeItem.type;
  const details = data?.details;
  
  // Instant ranking period resolution from preloaded payload
  const currentPeriodData = data?.rankings?.[rankingPeriod] || {
    ranking: data?.ranking || [],
    current_user_rank: data?.current_user_rank
  };
  const ranking = currentPeriodData?.ranking || [];
  const currentUserRank = currentPeriodData?.current_user_rank;
  const isEs = language === 'es';

  const typeLabel = currentType === 'artist' 
    ? (isEs ? 'Artista' : 'Artist')
    : currentType === 'album' 
    ? (isEs ? 'Álbum' : 'Album')
    : (isEs ? 'Canción' : 'Track');

  const displayTitle = (currentType === 'artist' ? (details?.name || activeItem.artist) : (details?.name || activeItem.name || activeItem.artist));
  const displayArtist = (currentType === 'artist' ? null : (details?.artist || activeItem.artist));
  const displayImage = details?.image || activeItem.image;

  const formatDuration = (msOrSec: number | string | undefined) => {
    if (!msOrSec) return null;
    let seconds = typeof msOrSec === 'string' ? parseInt(msOrSec, 10) : msOrSec;
    if (isNaN(seconds) || seconds <= 0) return null;
    if (seconds > 1000) seconds = Math.floor(seconds / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleUserClick = (username: string) => {
    onClose();
    navigate(`/user/${encodeURIComponent(username)}`);
  };

  const handleTranslateBio = async (rawText: string) => {
    if (!rawText) return;
    const targetLang = isEs ? 'es' : 'en';
    if (translatedBio && translatedBioTarget === targetLang) {
      setShowOriginalBio(false);
      return;
    }
    try {
      setIsTranslatingBio(true);
      const res = await apiClient.post('/translate/', { text: rawText, target_language: targetLang });
      if (res.data && res.data.translated_text) {
        setTranslatedBio(res.data.translated_text);
        setTranslatedBioTarget(targetLang);
        setShowOriginalBio(false);
      }
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsTranslatingBio(false);
    }
  };

  const navigateToItem = (newType: 'artist' | 'album' | 'track', newArtist: string, newName?: string, newImage?: string) => {
    const cached = getCachedMusicDetails(newType, newArtist, newName);
    setData(cached || null);
    setLoading(!cached);
    setRankingPeriod('7day');
    setDiscographyFilter('all');
    setIsBioExpanded(false);
    setTranslatedBio('');
    setTranslatedBioTarget('');
    setShowOriginalBio(true);
    setIsTranslatingBio(false);
    setError('');
    setActiveItem({
      type: newType,
      artist: newArtist,
      name: newName,
      image: newImage
    });
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
        }}>
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #94a3b8, #64748b)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(148, 163, 184, 0.3)'
        }}>
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #b45309, #78350f)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(180, 83, 9, 0.3)'
        }}>
          3
        </span>
      );
    }
    return (
      <span style={{
        width: '26px',
        height: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: 'var(--text-secondary)'
      }}>
        #{rank}
      </span>
    );
  };

  const filteredDiscography = (details?.discography || []).filter((item: any) => {
    if (discographyFilter === 'all') return true;
    return item.record_type === discographyFilter;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(29, 185, 84, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-music, #1DB954)'
              }}
            >
              {currentType === 'artist' ? <Mic size={18} /> : currentType === 'album' ? <Disc size={18} /> : <Headphones size={18} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-music, #1DB954)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {typeLabel}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '480px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayTitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-close-modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s, background 0.2s'
            }}
            title={isEs ? 'Cerrar' : 'Close'}
            aria-label={isEs ? 'Cerrar' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Media Overview Banner (Always rendered immediately) */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: currentType === 'artist' ? '50%' : '12px',
                overflow: 'hidden',
                background: 'var(--bg-tertiary)',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={displayTitle}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ color: 'var(--color-music, #1DB954)', opacity: 0.6 }}>
                  {currentType === 'artist' ? <Mic size={48} /> : currentType === 'album' ? <Disc size={48} /> : <Headphones size={48} />}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {displayTitle}
              </h2>

              {/* Clickable Artist link (when in album or track view) */}
              {displayArtist && (
                <button
                  type="button"
                  onClick={() => navigateToItem('artist', displayArtist)}
                  onMouseEnter={() => prefetchMusicDetails('artist', displayArtist)}
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    width: 'fit-content'
                  }}
                  title={isEs ? `Ver artista ${displayArtist}` : `View artist ${displayArtist}`}
                >
                  <span>{displayArtist}</span>
                  <ArrowRight size={13} style={{ opacity: 0.7 }} />
                </button>
              )}

              {/* Clickable Album link (when in track view) */}
              {details?.album && currentType === 'track' && (
                <button
                  type="button"
                  onClick={() => navigateToItem('album', displayArtist || activeItem.artist, details.album)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    prefetchMusicDetails('album', displayArtist || activeItem.artist, details.album);
                  }}
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    width: 'fit-content',
                    transition: 'color 0.2s'
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  title={isEs ? `Ver álbum ${details.album}` : `View album ${details.album}`}
                >
                  <Disc size={13} />
                  <span style={{ textDecoration: 'underline' }}>{details.album}</span>
                </button>
              )}

              {details?.duration && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={13} />
                  <span>{formatDuration(details.duration)}</span>
                </div>
              )}

              {/* Release Year / Date for Album */}
              {currentType === 'album' && (details?.year || details?.release_date) && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} />
                  <span>
                    {isEs ? 'Año de lanzamiento: ' : 'Release year: '}
                    <strong style={{ color: 'var(--text-primary)' }}>{details.year || details.release_date}</strong>
                  </span>
                </div>
              )}

              {/* Tags / Genres */}
              {details?.tags && details.tags.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {details.tags.slice(0, 4).map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        textTransform: 'capitalize'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : loading && !details ? (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <div className="skeleton" style={{ height: '1.2rem', width: '60px', borderRadius: '9999px' }} />
                  <div className="skeleton" style={{ height: '1.2rem', width: '70px', borderRadius: '9999px' }} />
                </div>
              ) : null}
            </div>
          </div>

          {error && !details ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
              <p>{error}</p>
            </div>
          ) : loading && !details ? (
            /* Progressive Skeleton Loading State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Skeleton About / Bio */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="skeleton" style={{ height: '0.85rem', width: '90px' }} />
                <div className="skeleton" style={{ height: '0.8rem', width: '100%' }} />
                <div className="skeleton" style={{ height: '0.8rem', width: '92%' }} />
                <div className="skeleton" style={{ height: '0.8rem', width: '75%' }} />
              </div>

              {/* Skeleton Discography / Tracklist */}
              {currentType === 'artist' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="skeleton" style={{ height: '0.9rem', width: '110px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.85rem' }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="skeleton" style={{ height: '190px', borderRadius: '10px' }} />
                    ))}
                  </div>
                </div>
              )}
              {currentType === 'album' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="skeleton" style={{ height: '0.9rem', width: '120px' }} />
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="skeleton" style={{ height: '1.8rem', width: '100%', borderRadius: '6px' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Skeleton Rankings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton" style={{ height: '1.1rem', width: '150px' }} />
                  <div className="skeleton" style={{ height: '1.4rem', width: '160px', borderRadius: '8px' }} />
                </div>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ height: '2.5rem', width: '100%', borderRadius: '8px' }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Biography / Description */}
              {details?.bio && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {isEs ? 'Acerca de' : 'About'}
                  </h4>
                  {(() => {
                    const currentBioText = (translatedBio && !showOriginalBio) ? translatedBio : details.bio;
                    return (
                      <>
                        <div style={{
                          position: 'relative',
                          maxHeight: isBioExpanded ? '300px' : '90px',
                          overflowY: isBioExpanded ? 'auto' : 'hidden',
                          transition: 'max-height 0.25s ease'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                            {currentBioText}
                          </p>
                          {!isBioExpanded && currentBioText.length > 220 && (
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: '45px',
                              background: 'linear-gradient(to bottom, transparent, var(--bg-tertiary))',
                              pointerEvents: 'none'
                            }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.2rem' }}>
                          {currentBioText.length > 220 ? (
                            <button
                              type="button"
                              onClick={() => setIsBioExpanded(prev => !prev)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.2rem 0',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: 'var(--color-music, #1DB954)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                width: 'fit-content'
                              }}
                            >
                              <span>
                                {isBioExpanded 
                                  ? (isEs ? 'Mostrar menos' : 'Show less') 
                                  : (isEs ? 'Mostrar más' : 'Show more')}
                              </span>
                              {isBioExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : <div />}

                          {(() => {
                            const bioLang = detectTextLanguage(details.bio);
                            const canTranslateBio = bioLang !== language;
                            if (!canTranslateBio) return null;

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (showOriginalBio) {
                                    handleTranslateBio(details.bio);
                                  } else {
                                    setShowOriginalBio(true);
                                  }
                                }}
                                disabled={isTranslatingBio}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: isTranslatingBio ? 'wait' : 'pointer',
                                  fontWeight: 500,
                                  fontSize: '0.78rem',
                                  padding: '0.2rem 0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  opacity: isTranslatingBio ? 0.7 : 1,
                                  transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              >
                                <Globe size={13} />
                                <span>
                                  {isTranslatingBio 
                                    ? (isEs ? 'Traduciendo...' : 'Translating...') 
                                    : (showOriginalBio 
                                        ? (isEs ? 'Traducir al español' : 'Translate to English') 
                                        : (isEs ? 'Mostrar texto original' : 'Show original text'))}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Artist Discography Section (Albums, Singles, EPs, Compilations) */}
              {currentType === 'artist' && details?.discography && details.discography.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isEs ? 'Discografía' : 'Discography'} ({filteredDiscography.length})
                    </h4>

                    {/* Discography Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-tertiary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      {[
                        { id: 'all', label: isEs ? 'Todos' : 'All' },
                        { id: 'album', label: isEs ? 'Álbumes' : 'Albums' },
                        { id: 'single', label: isEs ? 'Sencillos' : 'Singles' },
                        { id: 'ep', label: 'EPs' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setDiscographyFilter(f.id as any)}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: discographyFilter === f.id ? 700 : 500,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: discographyFilter === f.id ? 'var(--color-music, #1DB954)' : 'transparent',
                            color: discographyFilter === f.id ? '#ffffff' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid of Albums/Singles/EPs */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '0.85rem',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    padding: '0.25rem'
                  }}>
                    {filteredDiscography.map((albumItem: any, idx: number) => (
                      <div
                        key={`${albumItem.title}-${idx}`}
                        onClick={() => navigateToItem('album', displayTitle, albumItem.title, albumItem.cover)}
                        style={{
                          padding: '0.6rem',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          boxSizing: 'border-box',
                          minHeight: '190px',
                          flexShrink: 0,
                          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.borderColor = 'rgba(29, 185, 84, 0.5)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(29, 185, 84, 0.15)';
                          prefetchMusicDetails('album', displayTitle, albumItem.title);
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        title={`${albumItem.title} (${albumItem.year || ''})`}
                      >
                        <div style={{ width: '100%', height: '120px', minHeight: '120px', maxHeight: '120px', borderRadius: '6px', overflow: 'hidden', background: '#222', flexShrink: 0 }}>
                          {albumItem.cover ? (
                            <img
                              src={albumItem.cover}
                              alt={albumItem.title}
                              referrerPolicy="no-referrer"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <Disc size={24} />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, marginTop: '0.45rem', minWidth: 0, gap: '0.25rem' }}>
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.25
                          }}>
                            {albumItem.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, marginTop: 'auto' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {albumItem.year || ''}
                            </span>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: 'var(--color-music, #1DB954)',
                              background: 'rgba(29, 185, 84, 0.12)',
                              padding: '0.05rem 0.3rem',
                              borderRadius: '3px',
                              lineHeight: 1.2
                            }}>
                              {albumItem.record_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Album Tracklist (Clickable tracks) */}
              {currentType === 'album' && details?.tracks && details.tracks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {isEs ? 'Lista de Canciones' : 'Tracklist'} ({details.tracks.length})
                  </h4>
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    {details.tracks.map((trk: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => navigateToItem('track', displayArtist || activeItem.artist, trk.name, displayImage)}
                        style={{
                          padding: '0.6rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: idx < details.tracks.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          prefetchMusicDetails('track', displayArtist || activeItem.artist, trk.name);
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title={isEs ? `Ver info de ${trk.name}` : `View info for ${trk.name}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', width: '20px', textAlign: 'right' }}>
                            {idx + 1}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {trk.name}
                          </span>
                        </div>
                        {trk.duration && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginLeft: '1rem' }}>
                            {formatDuration(trk.duration)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pathd Community Listeners Ranking with Period Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy size={18} color="#f59e0b" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isEs ? 'Top Oyentes en Pathd' : 'Top Listeners on Pathd'}
                    </h3>
                  </div>

                  {/* Period Filter Buttons: 7 días, 1 mes, Siempre */}
                  <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-tertiary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {[
                      { id: '7day', label: isEs ? '7 días' : '7 days' },
                      { id: '1month', label: isEs ? '1 mes' : '1 month' },
                      { id: 'overall', label: isEs ? 'Siempre' : 'All time' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setRankingPeriod(p.id as any)}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: rankingPeriod === p.id ? 700 : 500,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: rankingPeriod === p.id ? 'var(--color-music, #1DB954)' : 'transparent',
                          color: rankingPeriod === p.id ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {ranking.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Music size={28} color="var(--color-music, #1DB954)" style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isEs ? 'Aún no hay oyentes registrados en este período' : 'No registered listeners in this period'}
                    </span>
                    <span style={{ fontSize: '0.8rem', maxWidth: '380px' }}>
                      {isEs
                        ? '¡Escucha esta obra en tu reproductor con Last.fm conectado para aparecer en el ranking!'
                        : 'Play this item on your music player with Last.fm connected to appear in the ranking!'}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {ranking.map((listener: any) => {
                      const isMe = user?.id === listener.user_id;
                      return (
                        <div
                          key={listener.user_id}
                          onClick={() => handleUserClick(listener.username)}
                          style={{
                            padding: '0.65rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            background: isMe ? 'rgba(29, 185, 84, 0.08)' : 'var(--bg-tertiary)',
                            border: isMe ? '1.5px solid rgba(29, 185, 84, 0.4)' : '1px solid var(--border-color)',
                            transition: 'transform 0.15s ease, border-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)';
                            e.currentTarget.style.borderColor = 'var(--color-music, #1DB954)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.borderColor = isMe ? 'rgba(29, 185, 84, 0.4)' : 'var(--border-color)';
                          }}
                        >
                          {/* Left: Rank & User Avatar/Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            {getRankBadge(listener.rank)}

                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: 'var(--bg-secondary)',
                                border: listener.profile_color ? `2px solid ${listener.profile_color}` : '1.5px solid var(--border-color)',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {listener.photo_url ? (
                                <img
                                  src={listener.photo_url}
                                  alt={listener.username}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <UserIcon size={18} color="var(--text-muted)" />
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {listener.username}
                                </span>
                                {isMe && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--color-music, #1DB954)', color: '#ffffff' }}>
                                    {isEs ? 'Tú' : 'You'}
                                  </span>
                                )}
                                {listener.is_pro && (
                                  <span style={{ 
                                    fontSize: '0.65rem', 
                                    fontWeight: 700, 
                                    padding: '0.1rem 0.35rem', 
                                    borderRadius: '4px', 
                                    background: 'rgba(245, 158, 11, 0.12)', 
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}>
                                    <Star size={9} fill="#f59e0b" color="#f59e0b" />
                                    PREMIUM
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Scrobbles Count */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--color-music, #1DB954)',
                              background: 'rgba(29, 185, 84, 0.12)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(29, 185, 84, 0.25)'
                            }}>
                              {listener.playcount} {listener.playcount === 1 ? (isEs ? 'reproducción' : 'play') : (isEs ? 'reproducciones' : 'plays')}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Current user out of top 10 row */}
                    {currentUserRank && currentUserRank.rank && currentUserRank.rank > 10 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0.2rem 0' }}>
                          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            {isEs ? 'Tu Posición' : 'Your Rank'}
                          </span>
                          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                        </div>

                        <div
                          onClick={() => handleUserClick(currentUserRank.username)}
                          style={{
                            padding: '0.65rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            background: 'rgba(29, 185, 84, 0.08)',
                            border: '1.5px solid rgba(29, 185, 84, 0.4)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            <span style={{
                              width: '26px',
                              height: '26px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: 'var(--color-music, #1DB954)'
                            }}>
                              #{currentUserRank.rank}
                            </span>

                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: 'var(--bg-secondary)',
                                border: currentUserRank.profile_color ? `2px solid ${currentUserRank.profile_color}` : '1.5px solid var(--border-color)',
                                flexShrink: 0
                              }}
                            >
                              {currentUserRank.photo_url ? (
                                <img
                                  src={currentUserRank.photo_url}
                                  alt={currentUserRank.username}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <UserIcon size={18} color="var(--text-muted)" />
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {currentUserRank.username}
                              </span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--color-music, #1DB954)', color: '#ffffff' }}>
                                {isEs ? 'Tú' : 'You'}
                              </span>
                              {currentUserRank.is_pro && (
                                <span style={{ 
                                  fontSize: '0.65rem', 
                                  fontWeight: 700, 
                                  padding: '0.1rem 0.35rem', 
                                  borderRadius: '4px', 
                                  background: 'rgba(245, 158, 11, 0.12)', 
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}>
                                  <Star size={9} fill="#f59e0b" color="#f59e0b" />
                                  PREMIUM
                                </span>
                              )}
                            </div>
                          </div>

                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--color-music, #1DB954)',
                            background: 'rgba(29, 185, 84, 0.12)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(29, 185, 84, 0.25)'
                          }}>
                            {currentUserRank.playcount} {currentUserRank.playcount === 1 ? (isEs ? 'reproducción' : 'play') : (isEs ? 'reproducciones' : 'plays')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
