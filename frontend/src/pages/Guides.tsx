import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useEffectiveSearchParams } from '../hooks/useEffectiveSearchParams';
import { apiClient } from '../api/client';
import { getProfileTheme } from '../utils/profileThemes';
import { SwipeViewPager } from '../components/SwipeViewPager';
import { GuideMediaTypeBar } from '../components/GuideMediaTypeBar';
import { GuideIcon, CreateGuideIcon } from '../components/CreateGuideIcon';
import { ProModal } from '../components/ProModal';
import {
  Bookmark,
  BookOpen,
  Clock,
  Lock,
  Pencil,
  Plus,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';

const validGuideTabs = ['followed', 'created', 'popular', 'new'] as const;
type GuideHubTab = typeof validGuideTabs[number];

const normalizeGuideTab = (raw: string | null): GuideHubTab | null => {
  if (!raw) return null;
  if (raw === 'seguidas' || raw === 'saved' || raw === 'followed') return 'followed';
  if (raw === 'creadas' || raw === 'mine' || raw === 'created') return 'created';
  if (raw === 'populares' || raw === 'popular' || raw === 'explorar' || raw === 'explore' || raw === 'guides') return 'popular';
  if (raw === 'nuevas' || raw === 'new') return 'new';
  return null;
};

interface GuideCardProps {
  guide: any;
  language: string;
  isLight: boolean;
  t: (key: string) => string;
  onOpen: (id: number) => void;
  showCreator?: boolean;
  showVisibility?: boolean;
  showOwnerActions?: boolean;
  onEdit?: (guide: any) => void;
  onDelete?: (guide: any) => void;
}

const GuideHubCard: React.FC<GuideCardProps> = React.memo(({
  guide,
  language,
  isLight,
  t,
  onOpen,
  showCreator = true,
  showVisibility = false,
  showOwnerActions = false,
  onEdit,
  onDelete,
}) => {
  const gTheme = guide.accent_color ? getProfileTheme(guide.accent_color, isLight) : null;
  const guideAccent = gTheme ? gTheme.accent : 'var(--color-guide, #2DD4BF)';
  const guideAccentText = gTheme ? ((gTheme.cssVariables as any)['--accent-text'] || '#ffffff') : '#ffffff';
  const guideColorVars: React.CSSProperties = (gTheme
    ? {
        '--guide-accent': gTheme.accent,
        '--title-hover-color': gTheme.accent,
        '--card-hover-glow': gTheme.glow,
        '--accent-primary': gTheme.accent,
      }
    : {
        '--guide-accent': 'var(--color-guide, #2DD4BF)',
        '--title-hover-color': 'var(--color-guide, #2DD4BF)',
      }) as unknown as React.CSSProperties;

  const isDraft = guide.visibility === 'DRAFT';
  const isPrivate = guide.visibility === 'PRIVATE';
  const visibilityLabel = isDraft
    ? (language === 'es' ? 'Borrador' : 'Draft')
    : isPrivate
      ? (language === 'es' ? 'Privada' : 'Private')
      : (language === 'es' ? 'Pública' : 'Public');
  const visibilityBg = isDraft
    ? 'rgba(245, 158, 11, 0.9)'
    : isPrivate
      ? 'rgba(100, 116, 139, 0.9)'
      : 'rgba(16, 185, 129, 0.9)';

  const itemsCount = guide.items_count ?? (Array.isArray(guide.items) ? guide.items.length : 0);
  const creatorName = guide.creator_username || guide.creator || '';

  return (
    <div
      className="activity-card activity-card-portrait guide-explore-card"
      style={{
        minWidth: 0,
        width: '100%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...guideColorVars,
      }}
      onClick={() => onOpen(guide.id)}
    >
      {/* Title + Rating / Followers */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div
          className="card-item-title"
          style={{
            fontSize: '0.88rem',
            fontWeight: 600,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
            transition: 'color 0.2s ease',
          }}
          title={guide.title}
        >
          {guide.title}
        </div>
        {(guide.average_rating != null || (guide.saves_count || 0) > 0) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px',
              flexShrink: 0,
              paddingTop: '1px',
            }}
          >
            {(guide.saves_count || 0) > 0 && (
              <span
                title={language === 'es' ? 'Seguidores de la guía' : 'Guide followers'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  color: '#ec4899',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                {guide.saves_count >= 1000
                  ? `${(guide.saves_count / 1000).toFixed(guide.saves_count >= 10000 ? 0 : 1)}k`
                  : guide.saves_count}
              </span>
            )}
            {guide.average_rating != null && (
              <span
                title={language === 'es' ? 'Valoración promedio' : 'Average rating'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#eab308',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                <Star size={12} fill="#eab308" color="#eab308" />
                {guide.average_rating}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cover Collage or Banner */}
      <div
        className="card-media-cover"
        style={{
          position: 'relative',
          width: '100%',
          height: '140px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {guide.banner_url ? (
          <img
            src={guide.banner_url}
            alt={guide.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : guide.covers && guide.covers.length > 0 ? (
          <div
            className="guide-cover-collage"
            style={{
              display: 'grid',
              gridTemplateColumns: guide.covers.length >= 2 ? '1fr 1fr' : '1fr',
              gridTemplateRows: guide.covers.length >= 3 ? '1fr 1fr' : '1fr',
              width: '100%',
              height: '100%',
              gap: '2px',
              background: '#000',
            }}
          >
            {guide.covers.slice(0, 4).map((img: string, cIdx: number) => (
              <img
                key={cIdx}
                src={img}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        ) : (
          <div className="guide-cover-fallback" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <BookOpen size={28} color={guideAccent} />
          </div>
        )}

        {showVisibility && (
          <span
            className="guide-visibility-badge"
            style={{
              position: 'absolute',
              top: '6px',
              left: '6px',
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              background: visibilityBg,
              color: '#ffffff',
              fontWeight: 700,
              backdropFilter: 'blur(4px)',
              zIndex: 2,
            }}
          >
            {visibilityLabel}
          </span>
        )}

        {guide.user_progress_percentage != null && (
          <span
            title={
              language === 'es'
                ? `Tu progreso: ${Math.round(guide.user_progress_percentage)}%`
                : `Your progress: ${Math.round(guide.user_progress_percentage)}%`
            }
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background:
                Math.round(guide.user_progress_percentage) >= 100
                  ? guideAccent
                  : 'rgba(15, 23, 42, 0.84)',
              color:
                Math.round(guide.user_progress_percentage) >= 100
                  ? guideAccentText
                  : '#ffffff',
              border: `1px solid ${guideAccent}`,
              backdropFilter: 'blur(4px)',
              zIndex: 2,
            }}
          >
            {Math.round(guide.user_progress_percentage)}%
          </span>
        )}
      </div>

      <GuideMediaTypeBar mediaTypeCounts={guide.media_type_counts} language={language} />

      {/* Body Content */}
      <div
        className="card-body-content"
        style={{
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          flex: 1,
          minHeight: '2.5rem',
          justifyContent: 'center',
        }}
      >
        {showCreator && creatorName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: guideAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: guideAccentText,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {guide.creator_photo_url ? (
                <img src={guide.creator_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                creatorName.charAt(0).toUpperCase() || 'P'
              )}
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {creatorName}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {itemsCount} {t('guidesWorksCount')}
          </span>

          {showOwnerActions && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => onEdit?.(guide)}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  padding: 0,
                  borderRadius: '8px',
                  color: guide.can_edit === false ? '#f59e0b' : 'var(--text-secondary)',
                  borderColor: guide.can_edit === false ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)',
                }}
                title={language === 'es' ? 'Editar' : 'Edit'}
              >
                {guide.can_edit === false ? <Lock size={14} /> : <Pencil size={14} />}
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(guide)}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  padding: 0,
                  borderRadius: '8px',
                  color: '#ef4444',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                }}
                title={language === 'es' ? 'Eliminar' : 'Delete'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const Guides: React.FC = () => {
  const { t, language } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const navigate = useNavigate();
  const { effectiveSearchParams, searchParams, setSearchParams } = useEffectiveSearchParams('/guides');

  const urlTab = normalizeGuideTab(effectiveSearchParams?.get('tab') || null);
  const [activeTab, setActiveTab] = useState<GuideHubTab>(urlTab || 'followed');
  const userManuallyPickedTabRef = useRef<boolean>(Boolean(urlTab));
  const autoFallbackAppliedRef = useRef<boolean>(false);

  const [savedGuides, setSavedGuides] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('pathd_me_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.saved_lists)) return parsed.saved_lists;
      }
    } catch (_) {}
    return [];
  });

  const [createdGuides, setCreatedGuides] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('pathd_me_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.created_lists)) return parsed.created_lists;
      }
    } catch (_) {}
    return [];
  });

  const [loadingUserGuides, setLoadingUserGuides] = useState<boolean>(() => {
    return !sessionStorage.getItem('pathd_me_cache');
  });

  const [exploreGuidesData, setExploreGuidesData] = useState<any>(() => {
    try {
      const cached = sessionStorage.getItem('pathd_guides_explore_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  });
  const [loadingExploreGuides, setLoadingExploreGuides] = useState<boolean>(!exploreGuidesData);

  // Modals
  const [showProModal, setShowProModal] = useState(false);
  const [guideToDelete, setGuideToDelete] = useState<any | null>(null);
  const [deletingGuide, setDeletingGuide] = useState(false);

  // Sync URL ?tab=...
  useEffect(() => {
    if (!effectiveSearchParams) return;
    const nextUrlTab = normalizeGuideTab(effectiveSearchParams.get('tab'));
    if (nextUrlTab) {
      userManuallyPickedTabRef.current = true;
      setActiveTab(nextUrlTab);
    }
  }, [effectiveSearchParams]);

  const fetchUserGuides = useCallback(async () => {
    try {
      const res = await apiClient.get('/users/me');
      const nextSaved = Array.isArray(res.data?.saved_lists) ? res.data.saved_lists : [];
      const nextCreated = Array.isArray(res.data?.created_lists) ? res.data.created_lists : [];
      setSavedGuides(nextSaved);
      setCreatedGuides(nextCreated);
      try {
        sessionStorage.setItem('pathd_me_cache', JSON.stringify(res.data));
      } catch (_) {}

      // Default to 'followed', falling back to 'popular' if the user follows no guides yet
      if (!userManuallyPickedTabRef.current && !autoFallbackAppliedRef.current) {
        autoFallbackAppliedRef.current = true;
        if (nextSaved.length === 0) {
          setActiveTab('popular');
        }
      }
    } catch (err) {
      console.error('Failed to load user guides', err);
    } finally {
      setLoadingUserGuides(false);
    }
  }, []);

  const fetchExploreGuides = useCallback(async () => {
    try {
      const res = await apiClient.get('/lists/explore');
      setExploreGuidesData(res.data);
      try {
        sessionStorage.setItem('pathd_guides_explore_cache', JSON.stringify(res.data));
      } catch (_) {}
    } catch (err) {
      console.error('Failed to load explore guides', err);
    } finally {
      setLoadingExploreGuides(false);
    }
  }, []);

  const lastFetchRef = useRef<number>(Date.now());

  useEffect(() => {
    fetchUserGuides();
    fetchExploreGuides();
    lastFetchRef.current = Date.now();

    const handleRefresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > 15000) {
        fetchUserGuides();
        lastFetchRef.current = Date.now();
      }
    };

    const handleGuidesUpdated = () => {
      fetchUserGuides();
      fetchExploreGuides();
      lastFetchRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('guides-updated', handleGuidesUpdated);
    return () => {
      document.removeEventListener('visibilitychange', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('guides-updated', handleGuidesUpdated);
    };
  }, [fetchUserGuides, fetchExploreGuides]);

  // Tab indicator & SwipeViewPager (0: followed, 1: created, 2: popular, 3: new)
  const currentStep =
    activeTab === 'created' ? 1 :
    activeTab === 'popular' ? 2 :
    activeTab === 'new' ? 3 : 0;

  const subtabsContainerRef = useRef<HTMLDivElement>(null);
  const subtabItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const desktopIndicatorRef = useRef<HTMLDivElement | null>(null);

  const getTabColor = () => 'var(--accent-primary)';

  const moveDesktopIndicator = useCallback((targetIdx: number, instant = false) => {
    const indicator = desktopIndicatorRef.current;
    const el = subtabItemRefs.current[targetIdx];
    if (!indicator || !el) return;
    if (instant) {
      indicator.style.transition = 'none';
    }
    indicator.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
    indicator.style.width = `${el.offsetWidth}px`;
    indicator.style.background = getTabColor();
    indicator.style.opacity = '1';
    if (instant) {
      void indicator.offsetWidth;
      indicator.style.transition = 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), width 0.16s cubic-bezier(0.2, 0, 0, 1), background-color 0.16s ease, opacity 0.12s ease';
    }
  }, []);

  useEffect(() => {
    moveDesktopIndicator(currentStep, false);
    const handleResize = () => moveDesktopIndicator(currentStep, true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep, language, savedGuides.length, createdGuides.length, moveDesktopIndicator]);

  const handleScrollProgress = useCallback((progress: number) => {
    const clamped = Math.min(3, Math.max(0, progress));
    if (subtabsContainerRef.current) {
      subtabsContainerRef.current.style.setProperty('--tab-progress', clamped.toFixed(4));
      subtabsContainerRef.current.style.setProperty('--explore-indicator-color', 'var(--accent-primary)');
    }
    subtabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(clamped - i);
      const act = Math.max(0, Math.min(1, 1 - dist));
      el.style.setProperty('--tab-act', act.toFixed(4));
    });
  }, []);

  useEffect(() => {
    handleScrollProgress(currentStep);
  }, [currentStep, handleScrollProgress]);

  const goToStep = (step: number) => {
    const targetTab: GuideHubTab =
      step === 1 ? 'created' :
      step === 2 ? 'popular' :
      step === 3 ? 'new' : 'followed';
    userManuallyPickedTabRef.current = true;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    setActiveTab(targetTab);
    if (subtabsContainerRef.current) {
      subtabsContainerRef.current.style.setProperty('--tab-progress', String(step));
      subtabsContainerRef.current.style.setProperty('--explore-indicator-color', getTabColor());
    }
    subtabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--tab-act', i === step ? '1' : '0');
    });

    const newParams = new URLSearchParams(effectiveSearchParams || searchParams);
    if (targetTab === 'followed') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', targetTab);
    }
    setSearchParams(newParams);
  };

  const handleOpenGuide = useCallback((id: number) => {
    navigate(`/guide/${id}`);
  }, [navigate]);

  const handleEditGuide = useCallback((guide: any) => {
    if (guide.can_edit !== false) {
      navigate(`/create?edit=${guide.id}`);
    } else {
      setShowProModal(true);
    }
  }, [navigate]);

  const confirmDeleteGuide = async () => {
    if (!guideToDelete) return;
    setDeletingGuide(true);
    try {
      await apiClient.delete(`/lists/${guideToDelete.id}`);
      setCreatedGuides(prev => prev.filter(g => g.id !== guideToDelete.id));
      setSavedGuides(prev => prev.filter(g => g.id !== guideToDelete.id));
      setGuideToDelete(null);
      window.dispatchEvent(new Event('guides-updated'));
    } catch (err) {
      console.error('Failed to delete guide', err);
    } finally {
      setDeletingGuide(false);
    }
  };

  const popularGuides: any[] = exploreGuidesData?.populares || [];
  const newGuides: any[] = exploreGuidesData?.nuevas || [];

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
    gap: '1rem',
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', paddingBottom: '5.5rem' }}>
      {/* Subtabs Bar */}
      <div
        ref={subtabsContainerRef}
        className="explore-subtabs-container"
        onMouseLeave={() => moveDesktopIndicator(currentStep)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.75rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          paddingTop: '0.25rem',
          position: 'relative',
          '--tab-progress': String(currentStep),
          '--explore-tab-count': '4',
          '--explore-indicator-color': 'var(--accent-primary)',
        } as React.CSSProperties}
      >
        <button
          type="button"
          ref={(el) => { subtabItemRefs.current[0] = el; }}
          className={`explore-subtab-item ${activeTab === 'followed' ? 'active' : ''}`}
          onClick={() => goToStep(0)}
          onMouseEnter={() => moveDesktopIndicator(0)}
          style={{
            fontSize: '1.02rem',
            fontWeight: activeTab === 'followed' ? 600 : 500,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem 0',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            '--tab-color': 'var(--accent-primary)',
            '--tab-act': activeTab === 'followed' ? '1' : '0',
          } as React.CSSProperties}
        >
          <span className="explore-subtab-icon">
            <Bookmark size={17} />
          </span>
          <span className="explore-subtab-label">
            {language === 'es' ? 'Seguidas' : 'Followed'}
            {savedGuides.length > 0 ? ` (${savedGuides.length})` : ''}
          </span>
        </button>

        <button
          type="button"
          ref={(el) => { subtabItemRefs.current[1] = el; }}
          className={`explore-subtab-item ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => goToStep(1)}
          onMouseEnter={() => moveDesktopIndicator(1)}
          style={{
            fontSize: '1.02rem',
            fontWeight: activeTab === 'created' ? 600 : 500,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem 0',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            '--tab-color': 'var(--accent-primary)',
            '--tab-act': activeTab === 'created' ? '1' : '0',
          } as React.CSSProperties}
        >
          <span className="explore-subtab-icon">
            <GuideIcon size={17} />
          </span>
          <span className="explore-subtab-label">
            {language === 'es' ? 'Mis guías' : 'My Guides'}
            {createdGuides.length > 0 ? ` (${createdGuides.length})` : ''}
          </span>
        </button>

        <button
          type="button"
          ref={(el) => { subtabItemRefs.current[2] = el; }}
          className={`explore-subtab-item ${activeTab === 'popular' ? 'active' : ''}`}
          onClick={() => goToStep(2)}
          onMouseEnter={() => moveDesktopIndicator(2)}
          style={{
            fontSize: '1.02rem',
            fontWeight: activeTab === 'popular' ? 600 : 500,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem 0',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            '--tab-color': 'var(--accent-primary)',
            '--tab-act': activeTab === 'popular' ? '1' : '0',
          } as React.CSSProperties}
        >
          <span className="explore-subtab-icon">
            <Trophy size={17} />
          </span>
          <span className="explore-subtab-label">
            {language === 'es' ? 'Populares' : 'Popular'}
          </span>
        </button>

        <button
          type="button"
          ref={(el) => { subtabItemRefs.current[3] = el; }}
          className={`explore-subtab-item ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => goToStep(3)}
          onMouseEnter={() => moveDesktopIndicator(3)}
          style={{
            fontSize: '1.02rem',
            fontWeight: activeTab === 'new' ? 600 : 500,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem 0',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            '--tab-color': 'var(--accent-primary)',
            '--tab-act': activeTab === 'new' ? '1' : '0',
          } as React.CSSProperties}
        >
          <span className="explore-subtab-icon">
            <Clock size={17} />
          </span>
          <span className="explore-subtab-label">
            {language === 'es' ? 'Nuevas' : 'New'}
          </span>
        </button>

        {/* Desktop sliding indicator */}
        <div
          ref={desktopIndicatorRef}
          className="explore-subtab-indicator home-desktop-only"
          style={{
            position: 'absolute',
            bottom: '-1px',
            left: 0,
            width: 0,
            height: '2px',
            background: 'var(--accent-primary)',
            opacity: 0,
            transition: 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), width 0.16s cubic-bezier(0.2, 0, 0, 1), background-color 0.16s ease, opacity 0.12s ease',
            pointerEvents: 'none',
            willChange: 'transform, width',
          }}
        />

        {/* Mobile sliding indicator */}
        <div className="explore-subtabs-sliding-indicator home-mobile-only" />
      </div>

      {/* Swipeable Tab Content */}
      <SwipeViewPager
        currentIndex={currentStep}
        totalSlides={4}
        onSlideChange={goToStep}
        onScrollProgress={handleScrollProgress}
      >
        {/* Slide 0: Seguidas */}
        <div style={{ width: '100%', flex: 1, marginTop: '1.25rem' }}>
          {loadingUserGuides ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
              {language === 'es' ? 'Cargando guías...' : 'Loading guides...'}
            </div>
          ) : savedGuides.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                padding: '3rem 1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <Bookmark size={38} style={{ opacity: 0.45, color: 'var(--color-guide, #2DD4BF)' }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'es' ? 'Todavía no seguís ninguna guía' : "You aren't following any guides yet"}
              </div>
              <p style={{ margin: 0, maxWidth: '420px', fontSize: '0.9rem' }}>
                {language === 'es'
                  ? 'Seguí guías de la comunidad para llevar el seguimiento de tus sagas, universos y listas paso a paso.'
                  : 'Follow community guides to track your sagas, universes, and reading or watch orders step by step.'}
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => goToStep(2)}
                style={{
                  marginTop: '0.25rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Trophy size={16} />
                <span>{language === 'es' ? 'Ver populares' : 'View popular'}</span>
              </button>
            </div>
          ) : (
            <div style={gridStyle}>
              {savedGuides.map((guide) => (
                <GuideHubCard
                  key={guide.id}
                  guide={guide}
                  language={language}
                  isLight={isLight}
                  t={t}
                  onOpen={handleOpenGuide}
                  showCreator
                />
              ))}
            </div>
          )}
        </div>

        {/* Slide 1: Mis guías */}
        <div style={{ width: '100%', flex: 1, marginTop: '1.25rem' }}>
          {loadingUserGuides ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
              {language === 'es' ? 'Cargando guías...' : 'Loading guides...'}
            </div>
          ) : createdGuides.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                padding: '3rem 1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <GuideIcon size={38} style={{ opacity: 0.45, color: 'var(--accent-primary)' }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'es' ? 'Todavía no creaste ninguna guía' : "You haven't created any guides yet"}
              </div>
              <p style={{ margin: 0, maxWidth: '420px', fontSize: '0.9rem' }}>
                {language === 'es'
                  ? 'Armá órdenes cronológicos, sagas o listas temáticas combinando películas, series, libros, cómics, anime y juegos.'
                  : 'Build chronological orders, sagas, or themed lists combining movies, TV shows, books, comics, anime, and games.'}
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/create')}
                style={{
                  marginTop: '0.25rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <CreateGuideIcon size={17} idSuffix="guides-empty-cta" />
                <span>{language === 'es' ? 'Crear mi primera guía' : 'Create my first guide'}</span>
              </button>
            </div>
          ) : (
            <div style={gridStyle}>
              {createdGuides.map((guide) => (
                <GuideHubCard
                  key={guide.id}
                  guide={guide}
                  language={language}
                  isLight={isLight}
                  t={t}
                  onOpen={handleOpenGuide}
                  showCreator={false}
                  showVisibility
                  showOwnerActions
                  onEdit={handleEditGuide}
                  onDelete={setGuideToDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Slide 2: Populares */}
        <div style={{ width: '100%', flex: 1, marginTop: '1.25rem' }}>
          {loadingExploreGuides ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
              {language === 'es' ? 'Cargando guías...' : 'Loading guides...'}
            </div>
          ) : popularGuides.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem' }}>
              <BookOpen size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0 }}>
                {language === 'es' ? 'Aún no hay guías públicas disponibles.' : 'No public guides available yet.'}
              </p>
            </div>
          ) : (
            <div style={gridStyle}>
              {popularGuides.map((guide: any) => (
                <GuideHubCard
                  key={guide.id}
                  guide={guide}
                  language={language}
                  isLight={isLight}
                  t={t}
                  onOpen={handleOpenGuide}
                  showCreator
                />
              ))}
            </div>
          )}
        </div>

        {/* Slide 3: Nuevas */}
        <div style={{ width: '100%', flex: 1, marginTop: '1.25rem' }}>
          {loadingExploreGuides ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
              {language === 'es' ? 'Cargando guías...' : 'Loading guides...'}
            </div>
          ) : newGuides.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem' }}>
              <BookOpen size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0 }}>
                {language === 'es' ? 'Aún no hay guías públicas disponibles.' : 'No public guides available yet.'}
              </p>
            </div>
          ) : (
            <div style={gridStyle}>
              {newGuides.map((guide: any) => (
                <GuideHubCard
                  key={guide.id}
                  guide={guide}
                  language={language}
                  isLight={isLight}
                  t={t}
                  onOpen={handleOpenGuide}
                  showCreator
                />
              ))}
            </div>
          )}
        </div>
      </SwipeViewPager>

      {/* Delete confirmation modal */}
      {guideToDelete && (
        <div
          onClick={() => !deletingGuide && setGuideToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card-solid, var(--bg-secondary))',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '1.25rem',
              maxWidth: '400px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {language === 'es' ? 'Eliminar guía' : 'Delete guide'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {language === 'es'
                ? `¿Seguro que querés eliminar "${guideToDelete.title}"? Esta acción no se puede deshacer.`
                : `Are you sure you want to delete "${guideToDelete.title}"? This action cannot be undone.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={deletingGuide}
                onClick={() => setGuideToDelete(null)}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px' }}
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deletingGuide}
                onClick={confirmDeleteGuide}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: deletingGuide ? 'not-allowed' : 'pointer',
                  opacity: deletingGuide ? 0.7 : 1,
                }}
              >
                {deletingGuide
                  ? (language === 'es' ? 'Eliminando...' : 'Deleting...')
                  : (language === 'es' ? 'Eliminar' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button: Create Guide */}
      <button
        type="button"
        className="guides-create-fab"
        onClick={() => navigate('/create')}
        aria-label={language === 'es' ? 'Crear guía' : 'Create Guide'}
        title={language === 'es' ? 'Crear guía' : 'Create Guide'}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {showProModal && <ProModal onClose={() => setShowProModal(false)} />}
    </div>
  );
};

export default Guides;
