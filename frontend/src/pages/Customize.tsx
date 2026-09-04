import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';

import {
  ArrowLeft,
  Calendar,
  Star,
  Crown,
  User,
  Image as ImageIcon,
  Monitor,
  Palette,
  Sliders,
  Music,
  CheckCircle,
  AlertCircle,
  Pencil,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Film,
  Tv,
  Sparkles,
  Book,
  Gamepad2,
  GripVertical,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

import { PROFILE_THEME_COLORS, getProfileTheme } from '../utils/profileThemes';
import { DEFAULT_CATEGORY_ORDER, getOrderedCategories } from '../utils/categoryOrder';

import { AvatarSelectorModal } from '../components/AvatarSelectorModal';
import { BannerSelectorModal } from '../components/BannerSelectorModal';
import { BackgroundSelectorModal } from '../components/BackgroundSelectorModal';
import { ProModal } from '../components/ProModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { MusicServiceGuideModal } from '../components/MusicServiceGuideModal';

export const CustomizePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { language, t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isEs = language === 'es';
  const isLight = theme === 'light';

  // Modal states
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showDisconnectLastFmModal, setShowDisconnectLastFmModal] = useState(false);
  const [showMusicGuideModal, setShowMusicGuideModal] = useState(false);

  // Profile data & counts for the header preview
  const [profile, setProfile] = useState<any>(user);
  const [shelfCount, setShelfCount] = useState<number>(0);
  const [nowPlaying, setNowPlaying] = useState<any>(null);

  // Profile Theme & Color
  const [selectedProfileColor, setSelectedProfileColor] = useState(user?.profile_color || 'amber');
  const [colorMsg, setColorMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingColor, setIsUpdatingColor] = useState(false);

  // Category Order State
  const [localCategoryOrder, setLocalCategoryOrder] = useState<string[]>(() =>
    getOrderedCategories(user?.category_order)
  );
  const [isSavingCategoryOrder, setIsSavingCategoryOrder] = useState(false);
  const [categoryOrderMsg, setCategoryOrderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pointer-based Drag & Drop state
  const [pointerDrag, setPointerDrag] = useState<{
    cat: string;
    sourceIndex: number;
    currentY: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const pointerDragRef = useRef<typeof pointerDrag>(null);
  const dragOverIndexRef = useRef<typeof dragOverIndex>(null);

  useEffect(() => {
    pointerDragRef.current = pointerDrag;
  }, [pointerDrag]);

  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  // Last.fm state
  const [lastfmMsg, setLastfmMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDisconnectingLastFm, setIsDisconnectingLastFm] = useState(false);

  // Load user profile & shelf count on mount
  const loadProfileData = async () => {
    try {
      const [userRes, libRes] = await Promise.allSettled([
        apiClient.get('/users/me'),
        apiClient.get('/library/')
      ]);
      if (userRes.status === 'fulfilled' && userRes.value.data) {
        setProfile(userRes.value.data);
        setSelectedProfileColor(userRes.value.data.profile_color || 'amber');
        setLocalCategoryOrder(getOrderedCategories(userRes.value.data.category_order));

        if (userRes.value.data.lastfm_username) {
          try {
            const npRes = await apiClient.get(`/users/${userRes.value.data.id}/music/now-playing`);
            setNowPlaying(npRes.data || null);
          } catch (e) {
            setNowPlaying(null);
          }
        } else {
          setNowPlaying(null);
        }
      }
      if (libRes.status === 'fulfilled' && Array.isArray(libRes.value.data)) {
        setShelfCount(libRes.value.data.length);
      }
    } catch (e) {
      console.error('Failed to load profile for customize page', e);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    if (user) {
      setProfile((prev: any) => ({ ...prev, ...user }));
      if (user.profile_color) setSelectedProfileColor(user.profile_color);
      setLocalCategoryOrder(getOrderedCategories(user.category_order));
    }
  }, [user]);

  // Pointer drag event listener
  useEffect(() => {
    if (!pointerDrag) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handlePointerMove = (e: PointerEvent) => {
      const currentDrag = pointerDragRef.current;
      if (!currentDrag) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const rowEl = elements.map(el => el.closest('[data-category-row-index]')).find(Boolean) as HTMLElement | undefined;

      if (rowEl) {
        const cIdx = parseInt(rowEl.getAttribute('data-category-row-index') || '0', 10);
        const rect = rowEl.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        const targetIdx = isAfter ? cIdx + 1 : cIdx;

        setDragOverIndex(prev => (prev === targetIdx ? prev : targetIdx));
      }
    };

    const handlePointerUp = () => {
      const currentDrag = pointerDragRef.current;
      const targetIdx = dragOverIndexRef.current;

      if (currentDrag && targetIdx !== null && targetIdx !== undefined) {
        setLocalCategoryOrder(prev => {
          const newOrder = [...prev];
          const [moved] = newOrder.splice(currentDrag.sourceIndex, 1);
          let insertionIdx = targetIdx;
          if (currentDrag.sourceIndex < targetIdx) {
            insertionIdx = targetIdx - 1;
          }
          newOrder.splice(Math.min(Math.max(0, insertionIdx), newOrder.length), 0, moved);
          return newOrder;
        });
      }

      setPointerDrag(null);
      setDragOverIndex(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [pointerDrag]);

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    if (!user?.is_pro) {
      setShowProModal(true);
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localCategoryOrder.length) return;

    const newOrder = [...localCategoryOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    setLocalCategoryOrder(newOrder);
  };

  const handleResetCategoryOrder = () => {
    if (!user?.is_pro) {
      setShowProModal(true);
      return;
    }
    setLocalCategoryOrder([...DEFAULT_CATEGORY_ORDER]);
  };

  const handleSaveCategoryOrder = async (orderToSave?: string[]) => {
    if (!user?.is_pro) {
      setShowProModal(true);
      return;
    }
    const order = orderToSave || localCategoryOrder;
    setIsSavingCategoryOrder(true);
    setCategoryOrderMsg(null);
    try {
      await apiClient.put('/users/me/category-order', {
        category_order: JSON.stringify(order)
      });
      await refreshProfile();
      setCategoryOrderMsg({
        type: 'success',
        text: isEs ? 'Orden de categorías guardado con éxito.' : 'Category order saved successfully.'
      });
      setTimeout(() => setCategoryOrderMsg(null), 3000);
    } catch (err: any) {
      setCategoryOrderMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Error al guardar el orden.' : 'Error saving order.')
      });
    } finally {
      setIsSavingCategoryOrder(false);
    }
  };

  const handleSelectProfileColor = async (colorId: string) => {
    if (!user?.is_pro) {
      setShowProModal(true);
      return;
    }
    setSelectedProfileColor(colorId);
    setIsUpdatingColor(true);
    setColorMsg(null);
    try {
      await apiClient.put('/users/me/color', { profile_color: colorId });
      await refreshProfile();
      setProfile((prev: any) => ({ ...prev, profile_color: colorId }));
      setColorMsg({
        type: 'success',
        text: isEs ? 'Color de perfil actualizado con éxito.' : 'Profile color updated successfully.',
      });
      setTimeout(() => setColorMsg(null), 3000);
    } catch (err: any) {
      setColorMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Error al actualizar color.' : 'Error updating color.'),
      });
    } finally {
      setIsUpdatingColor(false);
    }
  };

  const handleLastFmLogin = () => {
    const currentOrigin = window.location.origin;
    window.location.href = `http://www.last.fm/api/auth/?api_key=de5acce61bdd8b3e4bd181ebce8a69e8&cb=${encodeURIComponent(`${currentOrigin}/customize`)}`;
  };

  const executeDisconnectLastFm = async () => {
    setIsDisconnectingLastFm(true);
    setLastfmMsg(null);
    try {
      await apiClient.delete('/users/me/lastfm/disconnect');
      await refreshProfile();
      setProfile((prev: any) => ({ ...prev, lastfm_username: null }));
      setNowPlaying(null);
      setLastfmMsg({
        type: 'success',
        text: isEs ? 'Cuenta de Last.fm desconectada.' : 'Last.fm account disconnected.',
      });
      setShowDisconnectLastFmModal(false);
      setTimeout(() => setLastfmMsg(null), 3000);
    } catch (err: any) {
      setLastfmMsg({
        type: 'error',
        text: isEs ? 'Error al desconectar la cuenta.' : 'Error disconnecting account.',
      });
      setShowDisconnectLastFmModal(false);
    } finally {
      setIsDisconnectingLastFm(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const activeProfileTheme = getProfileTheme(selectedProfileColor || profile?.profile_color, isLight);

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5rem',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '2rem 1rem',
        ...(profile?.is_pro && profile?.profile_color ? activeProfileTheme.cssVariables : {})
      }}
    >
      {/* Immersive Ambient Background Wallpaper (Fixed Background Layer - Matching Profile) */}
      {profile?.is_pro && profile?.background_url && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${profile.background_url})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          {/* Subtle blur and dark atmospheric vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(9, 13, 22, 0.65) 0%, rgba(9, 13, 22, 0.88) 75%, rgba(9, 13, 22, 0.97) 100%)',
              backdropFilter: 'blur(3px)',
            }}
          />
        </div>
      )}

      {/* Header Preview Card (Identical to Profile Header) */}
      {profile && (
        <div
          className="glass-card"
          style={{
            position: 'relative',
            display: 'flex',
            gap: '2rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '2.5rem',
            borderRadius: '20px',
            overflow: 'hidden',
            border: profile.is_pro && profile.banner_url ? '1px solid rgba(255, 255, 255, 0.12)' : undefined,
            boxShadow: profile.is_pro && profile.banner_url ? '0 12px 30px rgba(0, 0, 0, 0.4)' : undefined,
          }}
        >
          {profile.is_pro && profile.banner_url && (
            <>
              {/* Banner Image Layer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${profile.banner_url})`,
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
                  background: 'linear-gradient(180deg, rgba(15, 15, 20, 0.45) 0%, rgba(15, 15, 20, 0.85) 55%, rgba(15, 15, 20, 0.98) 100%)',
                  zIndex: 1,
                }}
              />
            </>
          )}

          {/* Button to go back to Profile */}
          <button
            onClick={() => navigate('/profile')}
            className="btn-secondary"
            style={{
              position: 'absolute',
              top: '1.25rem',
              right: '1.25rem',
              padding: '0.55rem 0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '24px',
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              cursor: 'pointer',
              zIndex: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
            title={isEs ? 'Volver al perfil' : 'Back to profile'}
          >
            <ArrowLeft size={16} />
            <span>{isEs ? 'Ver Perfil' : 'View Profile'}</span>
          </button>

          {/* Avatar */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.username}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent-primary)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: '3px solid var(--accent-primary)',
                  boxShadow: 'var(--shadow-md)',
                  background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                }}
              >
                {profile.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 250, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{profile.username}</h1>
              {profile.is_pro && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'default',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                    userSelect: 'none'
                  }}
                >
                  <Star size={12} fill="white" />
                  PREMIUM
                </span>
              )}

              {profile.is_vip && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  <Crown size={12} fill="white" />
                  VIP
                </span>
              )}

              {profile.is_admin && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ADMIN
                </span>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} /> {isEs ? 'Miembro desde' : 'Joined'} {formatDate(new Date(profile.created_at || Date.now()))}
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{profile.followers_count ?? 0}</strong> {isEs ? 'Seguidores' : 'Followers'}</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{profile.following_count ?? 0}</strong> {isEs ? 'Seguidos' : 'Following'}</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{shelfCount}</strong> {isEs ? 'En Estantería' : 'On Shelf'}</span>
            </div>

            {/* Now Playing Widget */}
            {nowPlaying && (
              <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#333' }}>
                  {nowPlaying.image && <img src={nowPlaying.image} alt="Album Art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {nowPlaying.is_playing ? (
                      <><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} /> {isEs ? 'Escuchando ahora' : 'Now Playing'}</>
                    ) : (
                      isEs ? 'Última canción escuchada' : 'Last Played'
                    )}
                  </span>
                  <a href={nowPlaying.url} target="_blank" rel="noopener noreferrer" style={{ margin: '0.2rem 0 0.1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {nowPlaying.name}
                  </a>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{nowPlaying.artist}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECCIONES DE PERSONALIZACIÓN ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* 1. Personalizar Imágenes */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <User size={20} color="var(--accent-primary)" />
              {isEs ? 'Personalizar Perfil' : 'Customize Profile'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
              {isEs
                ? 'Modifica las imágenes y fondos decorativos de tu perfil.'
                : 'Customize your profile picture, banner, and background image.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Imagen de Perfil */}
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--border-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}
                >
                  <User size={18} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {isEs ? 'Imagen de perfil' : 'Profile Picture'}
                </span>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>

            {/* Imagen de Portada (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (user?.is_pro) {
                  setShowBannerModal(true);
                } else {
                  setShowProModal(true);
                }
              }}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(139, 92, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8b5cf6',
                    flexShrink: 0,
                  }}
                >
                  <ImageIcon size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {isEs ? 'Imagen de portada' : 'Banner Image'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Star size={10} fill="#f59e0b" />
                    PREMIUM
                  </span>
                </div>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>

            {/* Imagen de Fondo (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (user?.is_pro) {
                  setShowBackgroundModal(true);
                } else {
                  setShowProModal(true);
                }
              }}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                >
                  <Monitor size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {isEs ? 'Imagen de fondo' : 'Background Image'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Star size={10} fill="#f59e0b" />
                    PREMIUM
                  </span>
                </div>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        {/* 2. Color de Perfil */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <Palette size={19} color="var(--accent-primary)" />
              {isEs ? 'Color de perfil' : 'Profile Color'}
              <span
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Star size={10} fill="#f59e0b" />
                PREMIUM
              </span>
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {isEs
                ? 'Elige el color de acento y resplandor para tu perfil.'
                : 'Choose the accent and glow color for your profile.'}
            </p>
          </div>

          {colorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                background: colorMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: colorMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${colorMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {colorMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{colorMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.85rem' }}>
            {PROFILE_THEME_COLORS.map((col) => {
              const activeColor = theme === 'light' ? col.light.accent : col.dark.accent;
              const isSelected = selectedProfileColor === col.id || selectedProfileColor === col.dark.accent || selectedProfileColor === col.light.accent;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleSelectProfileColor(col.id)}
                  disabled={isUpdatingColor}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.9rem 0.75rem',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${activeColor}` : '1px solid var(--border-color)',
                    background: isSelected ? (theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)') : 'var(--bg-secondary)',
                    cursor: user?.is_pro ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 14px ${activeColor}40` : 'none',
                    transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: activeColor,
                      boxShadow: `0 2px 8px ${activeColor}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <CheckCircle size={16} color="#ffffff" />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? activeColor : 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  >
                    {isEs ? col.name.es : col.name.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Orden de Categorías */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
              <Sliders size={20} color="var(--accent-primary)" />
              {isEs ? 'Orden de categorías' : 'Category Order'}
            </h2>
            <span
              style={{
                fontSize: '0.65rem',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Star size={10} fill="#f59e0b" />
              PREMIUM
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
            {isEs
              ? 'Arrastra las categorías con el mouse o usa las flechas para personalizar su orden en el Inicio, Estantería, Explorar, Guías y modales.'
              : 'Drag categories with your mouse or use the arrows to customize their order across Home, Shelf, Explore, Guides, and modals.'}
          </p>

          {categoryOrderMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                background: categoryOrderMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: categoryOrderMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${categoryOrderMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {categoryOrderMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{categoryOrderMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '480px' }}>
            {localCategoryOrder.map((cat, idx) => {
              const catColor = `var(--color-${cat})`;
              const catTextColor = `var(--color-text-${cat})`;
              const isFirst = idx === 0;
              const isLast = idx === localCategoryOrder.length - 1;

              const getCategoryIcon = () => {
                switch (cat) {
                  case 'movie': return <Film size={17} color={catTextColor} />;
                  case 'series': return <Tv size={17} color={catTextColor} />;
                  case 'anime': return <Sparkles size={17} color={catTextColor} />;
                  case 'book': return <Book size={17} color={catTextColor} />;
                  case 'comic': return <Book size={17} color={catTextColor} />;
                  case 'manga': return <Book size={17} color={catTextColor} />;
                  case 'game': return <Gamepad2 size={17} color={catTextColor} />;
                  default: return <Film size={17} color={catTextColor} />;
                }
              };

              const getCategoryLabel = () => {
                switch (cat) {
                  case 'movie': return isEs ? 'Películas' : 'Movies';
                  case 'series': return 'Series';
                  case 'anime': return 'Anime';
                  case 'book': return isEs ? 'Libros' : 'Books';
                  case 'comic': return isEs ? 'Cómics' : 'Comics';
                  case 'manga': return 'Mangas';
                  case 'game': return isEs ? 'Videojuegos' : 'Games';
                  default: return cat;
                }
              };

              const isRowBeingDragged = pointerDrag?.cat === cat;
              const isDropTargetTop = dragOverIndex === idx && !isRowBeingDragged;

              return (
                <React.Fragment key={cat}>
                  {/* Animated Drop Slot before this category */}
                  {isDropTargetTop && (
                    <div
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        border: '2px dashed var(--accent-primary)',
                        background: 'rgba(129, 140, 248, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        margin: '0.15rem 0',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{isEs ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
                    </div>
                  )}

                  <div
                    data-category-row-index={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: isRowBeingDragged ? 'rgba(30, 41, 59, 0.4)' : 'var(--bg-secondary)',
                      borderTop: isRowBeingDragged ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRight: isRowBeingDragged ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                      borderBottom: isRowBeingDragged ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                      borderLeft: `4px solid ${catColor}`,
                      transition: 'all 0.15s ease',
                      opacity: isRowBeingDragged ? 0.45 : 1,
                      transform: isRowBeingDragged ? 'scale(0.98)' : 'none',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          if (!user?.is_pro) {
                            setShowProModal(true);
                            return;
                          }
                          e.preventDefault();
                          e.stopPropagation();
                          setPointerDrag({
                            cat,
                            sourceIndex: idx,
                            currentY: e.clientY
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: user?.is_pro ? 'var(--text-muted)' : 'rgba(255, 255, 255, 0.2)',
                          cursor: user?.is_pro ? 'grab' : 'not-allowed',
                          padding: '0.2rem 0.15rem',
                          borderRadius: '4px'
                        }}
                        title={isEs ? 'Arrastrar para reordenar' : 'Drag to reorder'}
                      >
                        <GripVertical size={16} />
                      </div>

                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        minWidth: '18px'
                      }}>
                        #{idx + 1}
                      </span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: catColor,
                        boxShadow: `0 2px 6px ${catColor}40`
                      }}>
                        {getCategoryIcon()}
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getCategoryLabel()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(idx, 'up')}
                        disabled={isFirst}
                        title={isEs ? 'Mover arriba' : 'Move up'}
                        style={{
                          padding: '0.35rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: isFirst ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                          color: isFirst ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: isFirst ? 'not-allowed' : 'pointer',
                          opacity: isFirst ? 0.35 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveCategory(idx, 'down')}
                        disabled={isLast}
                        title={isEs ? 'Mover abajo' : 'Move down'}
                        style={{
                          padding: '0.35rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: isLast ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                          color: isLast ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: isLast ? 'not-allowed' : 'pointer',
                          opacity: isLast ? 0.35 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Animated Drop Slot at bottom of category list */}
            {pointerDrag && dragOverIndex === localCategoryOrder.length && (
              <div
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '2px dashed var(--accent-primary)',
                  background: 'rgba(129, 140, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  margin: '0.15rem 0',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{isEs ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
              </div>
            )}
          </div>

          {/* Botones de acción abajo */}
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem', maxWidth: '480px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleResetCategoryOrder}
              className="btn-secondary"
              style={{
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: '8px'
              }}
            >
              <RotateCcw size={15} />
              {isEs ? 'Restablecer por defecto' : 'Reset to Default'}
            </button>

            <button
              type="button"
              onClick={() => handleSaveCategoryOrder()}
              disabled={isSavingCategoryOrder}
              className="btn-primary"
              style={{
                padding: '0.5rem 1.15rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: '8px'
              }}
            >
              <CheckCircle size={15} />
              {isSavingCategoryOrder ? (isEs ? 'Guardando...' : 'Saving...') : (isEs ? 'Guardar orden' : 'Save Order')}
            </button>
          </div>
        </div>

        {/* 4. Last.fm (Mostrar música escuchada) */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                <Music size={20} color="#ef4444" />
                {isEs ? 'Mostrar música escuchada (Last.fm)' : 'Show Currently Playing Music (Last.fm)'}
              </h2>
              {profile?.lastfm_username ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <CheckCircle size={12} />
                  {isEs ? 'Conectado' : 'Connected'}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600
                  }}
                >
                  {isEs ? 'No conectado' : 'Not connected'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMusicGuideModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.4rem',
                borderRadius: '6px'
              }}
            >
              <HelpCircle size={15} />
              {isEs ? '¿Cómo conectar tu servicio de música?' : 'How to connect your music service?'}
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
            {isEs
              ? 'Conecta tu cuenta de Last.fm para mostrar en tiempo real la música que estás escuchando en Spotify, YouTube Music, Apple Music, Tidal o archivos locales en tu perfil.'
              : 'Connect your Last.fm account to display in real-time what music you are listening to on Spotify, YouTube Music, Apple Music, Tidal, or local players on your profile.'}
          </p>

          {lastfmMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                background: lastfmMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: lastfmMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${lastfmMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {lastfmMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{lastfmMsg.text}</span>
            </div>
          )}

          {profile?.lastfm_username ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {profile.lastfm_username}
                </div>
                <a
                  href={`https://www.last.fm/user/${profile.lastfm_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                >
                  {isEs ? 'Ver perfil en Last.fm' : 'View Last.fm profile'} <ExternalLink size={12} />
                </a>
              </div>

              <button
                type="button"
                onClick={() => setShowDisconnectLastFmModal(true)}
                disabled={isDisconnectingLastFm}
                className="btn-secondary"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                {isDisconnectingLastFm ? (isEs ? 'Desconectando...' : 'Disconnecting...') : (isEs ? 'Desconectar' : 'Disconnect')}
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={handleLastFmLogin}
                className="btn-primary"
                style={{
                  background: '#d51007',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(213, 16, 7, 0.3)'
                }}
              >
                <Music size={16} />
                {isEs ? 'Conectar con Last.fm' : 'Connect with Last.fm'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {showAvatarModal && (
        <AvatarSelectorModal
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          currentPhotoUrl={profile.photo_url}
          onAvatarUpdated={(newUrl) => {
            setProfile((prev: any) => ({ ...prev, photo_url: newUrl }));
            refreshProfile();
          }}
        />
      )}

      {showBannerModal && (
        <BannerSelectorModal
          isOpen={showBannerModal}
          onClose={() => setShowBannerModal(false)}
          currentBannerUrl={profile.banner_url}
          onBannerUpdated={(newUrl) => {
            setProfile((prev: any) => ({ ...prev, banner_url: newUrl }));
            refreshProfile();
          }}
        />
      )}

      {showBackgroundModal && (
        <BackgroundSelectorModal
          isOpen={showBackgroundModal}
          onClose={() => setShowBackgroundModal(false)}
          currentBackgroundUrl={profile.background_url}
          onBackgroundUpdated={(newUrl) => {
            setProfile((prev: any) => ({ ...prev, background_url: newUrl }));
            refreshProfile();
          }}
        />
      )}

      {showProModal && <ProModal onClose={() => setShowProModal(false)} />}

      <MusicServiceGuideModal
        isOpen={showMusicGuideModal}
        onClose={() => setShowMusicGuideModal(false)}
      />

      <ConfirmModal
        isOpen={showDisconnectLastFmModal}
        title={isEs ? '¿Desconectar Last.fm?' : 'Disconnect Last.fm?'}
        message={
          isEs
            ? 'Ya no se mostrará tu música escuchada en tu perfil. Puedes volver a conectarlo cuando quieras.'
            : 'Your currently playing music will no longer appear on your profile. You can reconnect anytime.'
        }
        confirmText={isEs ? 'Desconectar' : 'Disconnect'}
        cancelText={isEs ? 'Cancelar' : 'Cancel'}
        type="danger"
        onConfirm={executeDisconnectLastFm}
        onClose={() => setShowDisconnectLastFmModal(false)}
      />
    </div>
  );
};

export default CustomizePage;
