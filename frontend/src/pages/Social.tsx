import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Compass, Star, User, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { SocialActivityCard } from '../components/SocialActivityCard';
import type { ActivityCardData } from '../components/SocialActivityCard';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { PathdLoader } from '../components/PathdLoader';
import { SwipeViewPager } from '../components/SwipeViewPager';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

type SocialTab = 'following' | 'discover' | 'reviews' | 'me';

const getCachedFeed = (tab: SocialTab): ActivityCardData[] => {
  try {
    const raw = sessionStorage.getItem(`pathd_social_feed_${tab}`) || localStorage.getItem(`pathd_social_feed_${tab}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
};

export const Social: React.FC = () => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs: SocialTab[] = ['following', 'discover', 'reviews', 'me'];
  const tabParam = searchParams.get('tab');
  const activeTab: SocialTab = (tabParam && validTabs.includes(tabParam as SocialTab))
    ? (tabParam as SocialTab)
    : 'following';

  const [activeSocialTab, setActiveSocialTab] = useState<SocialTab>(activeTab);

  useEffect(() => {
    setActiveSocialTab(activeTab);
  }, [activeTab]);

  // Fast in-memory cache to allow 0ms instantaneous tab switching
  const feedCacheRef = useRef<Partial<Record<SocialTab, ActivityCardData[]>>>({
    following: getCachedFeed('following'),
    discover: getCachedFeed('discover'),
    reviews: getCachedFeed('reviews'),
    me: getCachedFeed('me'),
  });

  const activeTabRef = useRef<SocialTab>(activeSocialTab);
  activeTabRef.current = activeSocialTab;

  const abortControllerRef = useRef<AbortController | null>(null);

  const [tabFeeds, setTabFeeds] = useState<Record<SocialTab, ActivityCardData[]>>(() => ({
    following: feedCacheRef.current.following || [],
    discover: feedCacheRef.current.discover || [],
    reviews: feedCacheRef.current.reviews || [],
    me: feedCacheRef.current.me || [],
  }));
  const [tabLoading, setTabLoading] = useState<Record<SocialTab, boolean>>(() => ({
    following: (feedCacheRef.current.following || []).length === 0,
    discover: (feedCacheRef.current.discover || []).length === 0,
    reviews: (feedCacheRef.current.reviews || []).length === 0,
    me: (feedCacheRef.current.me || []).length === 0,
  }));
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;

  const handleOpenItem = (item: any) => {
    if (!item) return;
    const targetType = item.item_type || 'movie';
    const targetId = item.external_id || item.id;
    if (targetType && targetId) {
      navigate(`/item/${targetType}/${targetId}`, {
        state: { backgroundLocation: location, item }
      });
    } else {
      setSelectedItem(item);
    }
  };

  const fetchTabFeed = async (tab: SocialTab, isRefresh = false, signal?: AbortSignal) => {
    if (signal?.aborted || activeTabRef.current !== tab) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
      refreshingRef.current = true;
    }

    try {
      let endpoint = '/social/feed/following';
      if (tab === 'discover') endpoint = '/social/feed/discover';
      else if (tab === 'reviews') endpoint = '/social/feed/reviews';
      else if (tab === 'me') endpoint = '/social/feed/me';

      const res = await apiClient.get(endpoint, { signal });

      // Discard stale response if user switched tabs during network request
      if (signal?.aborted || activeTabRef.current !== tab) {
        return;
      }

      if (Array.isArray(res.data)) {
        // Consolidate legacy dual activities:
        // 1. One item_rated + one item_reviewed for same entity/item
        // 2. An episode/issue watch/read event + a work completed event for the same user & series/comic
        const consolidated: ActivityCardData[] = [];
        const seenReviewRating = new Map<string, number>();

        // Helper to extract series / work title & id for grouping
        const getWorkIdent = (item: ActivityCardData) => {
          const meta = item.metadata_json ? (typeof item.metadata_json === 'string' ? JSON.parse(item.metadata_json) : item.metadata_json) : {};
          const workTitle = (meta.series_title || meta.volume_title || meta.show_name || meta.work_title || '').trim().toLowerCase();
          const seriesExtId = (meta.series_external_id || meta.parent_external_id || meta.volume_id || '').trim().toLowerCase();
          const cleanItemTitle = (item.item_title || '').trim().toLowerCase();
          return { workTitle, seriesExtId, cleanItemTitle, meta };
        };

        for (const item of res.data) {
          const itemMeta = item.metadata_json ? (typeof item.metadata_json === 'string' ? JSON.parse(item.metadata_json) : item.metadata_json) : {};
          if ((item.details || '').toLowerCase() === 'dropped' || (itemMeta.status || '').toLowerCase() === 'dropped') {
            continue;
          }

          const isReview = item.activity_type === 'item_reviewed';
          const isRating = item.activity_type === 'item_rated';
          const reviewKey = (isReview || isRating) && (item.external_id || item.item_title)
            ? `${item.user_id}_${item.external_id || item.item_title}`
            : null;

          if (reviewKey && seenReviewRating.has(reviewKey)) {
            const idx = seenReviewRating.get(reviewKey)!;
            const existing = consolidated[idx];
            if (existing.activity_type === 'item_reviewed' && isRating) {
              try {
                const meta = existing.metadata_json ? (typeof existing.metadata_json === 'string' ? JSON.parse(existing.metadata_json) : existing.metadata_json) : {};
                if (!meta.rating && item.details) {
                  meta.rating = Number(item.details);
                  existing.metadata_json = JSON.stringify(meta);
                }
              } catch (_) {}
              continue;
            } else if (existing.activity_type === 'item_rated' && isReview) {
              try {
                const meta = item.metadata_json ? (typeof item.metadata_json === 'string' ? JSON.parse(item.metadata_json) : item.metadata_json) : {};
                if (!meta.rating && existing.details) {
                  meta.rating = Number(existing.details);
                  item.metadata_json = JSON.stringify(meta);
                }
              } catch (_) {}
              consolidated[idx] = item;
              continue;
            }
          }

          if (reviewKey) {
            seenReviewRating.set(reviewKey, consolidated.length);
          }

          // Deduplicate identical/consecutive item_favorited or shelf_favorite activities for the same work & user
          const isFavorite = item.activity_type === 'item_favorited' || item.activity_type === 'shelf_favorite';
          if (isFavorite) {
            const itemWorkExt = (item.external_id || '').trim().toLowerCase();
            const itemWorkTitle = (item.item_title || '').trim().toLowerCase();
            const isDuplicate = consolidated.some(c => 
              c.user_id === item.user_id &&
              (c.activity_type === 'item_favorited' || c.activity_type === 'shelf_favorite') &&
              ((itemWorkExt && c.external_id && (c.external_id || '').trim().toLowerCase() === itemWorkExt) ||
               (itemWorkTitle && c.item_title && (c.item_title || '').trim().toLowerCase() === itemWorkTitle))
            );
            if (isDuplicate) {
              continue;
            }
          }

          // Check for work completion unification:
          // An episode/issue event and a work completed event (item_completed or status=completed/read)
          const isWorkCompletion = (item.activity_type === 'item_completed' || item.activity_type === 'item_status_changed') &&
            (itemMeta.status === 'completed' || itemMeta.status === 'read' || (item.details || '').toLowerCase() === 'completed' || (item.details || '').toLowerCase() === 'read');

          const isUnitConsumption = (item.activity_type === 'episode_watched' || item.activity_type === 'issue_read' || item.activity_type === 'item_progress_updated' || item.activity_type === 'item_status_changed') &&
            ((item.external_id && (String(item.external_id).startsWith('tvm-ep-') || String(item.external_id).startsWith('cv_issue_'))) || item.item_type === 'episode');

          const isShelfAdd = item.activity_type === 'shelf_add' || item.activity_type === 'item_added_to_library';
          const isStatusChanged = item.activity_type === 'item_status_changed' || item.activity_type === 'item_completed';

          let mergedWithExisting = false;

          // Unify Shelf Add + Status Changed for unadded works marked directly (e.g. Added and watched / finished)
          if (isShelfAdd) {
            const itemWorkExt = (item.external_id || '').trim().toLowerCase();
            const itemWorkTitle = (item.item_title || '').trim().toLowerCase();
            for (let i = consolidated.length - 1; i >= Math.max(0, consolidated.length - 15); i--) {
              const target = consolidated[i];
              if (target.user_id !== item.user_id) continue;
              const targetIsStatus = target.activity_type === 'item_status_changed' || target.activity_type === 'item_completed';
              if (!targetIsStatus) continue;

              const targetExt = (target.external_id || '').trim().toLowerCase();
              const targetTitle = (target.item_title || '').trim().toLowerCase();
              const matchesWork = (itemWorkExt && targetExt && itemWorkExt === targetExt) ||
                (itemWorkTitle && targetTitle && itemWorkTitle === targetTitle);

              if (matchesWork) {
                const targetMeta = target.metadata_json ? (typeof target.metadata_json === 'string' ? JSON.parse(target.metadata_json) : target.metadata_json) : {};
                targetMeta.also_added = true;
                target.metadata_json = JSON.stringify(targetMeta);
                mergedWithExisting = true;
                break;
              }
            }
          } else if (isStatusChanged) {
            const itemWorkExt = (item.external_id || '').trim().toLowerCase();
            const itemWorkTitle = (item.item_title || '').trim().toLowerCase();
            for (let i = consolidated.length - 1; i >= Math.max(0, consolidated.length - 15); i--) {
              const target = consolidated[i];
              if (target.user_id !== item.user_id) continue;
              const targetIsAdd = target.activity_type === 'shelf_add' || target.activity_type === 'item_added_to_library';
              if (!targetIsAdd) continue;

              const targetExt = (target.external_id || '').trim().toLowerCase();
              const targetTitle = (target.item_title || '').trim().toLowerCase();
              const matchesWork = (itemWorkExt && targetExt && itemWorkExt === targetExt) ||
                (itemWorkTitle && targetTitle && itemWorkTitle === targetTitle);

              if (matchesWork) {
                itemMeta.also_added = true;
                item.metadata_json = JSON.stringify(itemMeta);
                consolidated[i] = item;
                mergedWithExisting = true;
                break;
              }
            }
          }

          if (!mergedWithExisting && isWorkCompletion) {
            const itemWorkTitle = (item.item_title || '').trim().toLowerCase();
            const itemWorkExt = (item.external_id || '').trim().toLowerCase();
            for (let i = consolidated.length - 1; i >= Math.max(0, consolidated.length - 15); i--) {
              const target = consolidated[i];
              if (target.user_id !== item.user_id) continue;
              const targetIdent = getWorkIdent(target);
              const matchesWork = (itemWorkExt && targetIdent.seriesExtId && itemWorkExt === targetIdent.seriesExtId) ||
                (itemWorkTitle && targetIdent.workTitle && itemWorkTitle === targetIdent.workTitle) ||
                (itemWorkTitle && target.item_title && target.item_title.toLowerCase().startsWith(itemWorkTitle));
              
              if (matchesWork) {
                const targetMeta = target.metadata_json ? (typeof target.metadata_json === 'string' ? JSON.parse(target.metadata_json) : target.metadata_json) : {};
                targetMeta.finished_work = true;
                target.metadata_json = JSON.stringify(targetMeta);
                mergedWithExisting = true;
                break;
              }
            }
          } else if (!mergedWithExisting && isUnitConsumption) {
            const unitIdent = getWorkIdent(item);
            for (let i = consolidated.length - 1; i >= Math.max(0, consolidated.length - 15); i--) {
              const target = consolidated[i];
              if (target.user_id !== item.user_id) continue;
              const targetMeta = target.metadata_json ? (typeof target.metadata_json === 'string' ? JSON.parse(target.metadata_json) : target.metadata_json) : {};
              const targetIsCompletion = (target.activity_type === 'item_completed' || target.activity_type === 'item_status_changed') &&
                (targetMeta.status === 'completed' || targetMeta.status === 'read' || (target.details || '').toLowerCase() === 'completed' || (target.details || '').toLowerCase() === 'read');
              
              if (targetIsCompletion) {
                const targetTitle = (target.item_title || '').trim().toLowerCase();
                const targetExt = (target.external_id || '').trim().toLowerCase();
                const matchesWork = (targetExt && unitIdent.seriesExtId && targetExt === unitIdent.seriesExtId) ||
                  (targetTitle && unitIdent.workTitle && targetTitle === unitIdent.workTitle) ||
                  (targetTitle && item.item_title && item.item_title.toLowerCase().startsWith(targetTitle));

                if (matchesWork) {
                  itemMeta.finished_work = true;
                  item.metadata_json = JSON.stringify(itemMeta);
                  consolidated[i] = item;
                  mergedWithExisting = true;
                  break;
                }
              }
            }
          }

          if (!mergedWithExisting) {
            consolidated.push(item);
          }
        }

        // Cache both in memory ref and storage
        feedCacheRef.current[tab] = consolidated;
        const serialized = JSON.stringify(consolidated);
        try {
          sessionStorage.setItem(`pathd_social_feed_${tab}`, serialized);
          localStorage.setItem(`pathd_social_feed_${tab}`, serialized);
        } catch (_) {}

        setTabFeeds(prev => ({ ...prev, [tab]: consolidated }));
        setTabLoading(prev => ({ ...prev, [tab]: false }));
      }
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || signal?.aborted) {
        return; // Request was aborted due to tab switch; ignore silently
      }
      console.error(`Error loading social feed for tab ${tab}:`, err);
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
      setRefreshing(false);
      refreshingRef.current = false;
    }
  };

  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const lastFeedFetchRef = useRef<number>(Date.now());

  useEffect(() => {
    activeTabRef.current = activeSocialTab;

    // Abort any pending fetch for another tab
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Immediately show cached items if available; otherwise show loader
    const cached = feedCacheRef.current[activeSocialTab] || getCachedFeed(activeSocialTab);
    if (cached && cached.length > 0) {
      feedCacheRef.current[activeSocialTab] = cached;
      setTabFeeds(prev => ({ ...prev, [activeSocialTab]: cached }));
      setTabLoading(prev => ({ ...prev, [activeSocialTab]: false }));
    } else {
      setTabLoading(prev => ({ ...prev, [activeSocialTab]: true }));
    }

    setHasNewUpdates(false);
    lastFeedFetchRef.current = Date.now();

    fetchTabFeed(activeSocialTab, false, controller.signal);

    return () => {
      controller.abort();
    };
  }, [activeSocialTab]);

  // Listen to system library and progress events to immediately refresh Social in the background
  useEffect(() => {
    const handleImmediateRefresh = () => {
      const currentTab = activeTabRef.current;
      try {
        sessionStorage.removeItem(`pathd_social_feed_${currentTab}`);
        localStorage.removeItem(`pathd_social_feed_${currentTab}`);
      } catch (_) {}
      delete feedCacheRef.current[currentTab];
      fetchTabFeed(currentTab, true);
    };

    window.addEventListener('library-updated', handleImmediateRefresh);
    window.addEventListener('progress-updated', handleImmediateRefresh);
    window.addEventListener('activity-created', handleImmediateRefresh);

    return () => {
      window.removeEventListener('library-updated', handleImmediateRefresh);
      window.removeEventListener('progress-updated', handleImmediateRefresh);
      window.removeEventListener('activity-created', handleImmediateRefresh);
    };
  }, []);

  // Check for updates when user returns to the tab or refocuses (debounced with ref check)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const timePassed = Date.now() - lastFeedFetchRef.current;
        // If more than 30 seconds passed and not busy, refresh feed
        if (timePassed > 30000 && !tabLoading[activeTabRef.current] && !refreshingRef.current) {
          const currentTab = activeTabRef.current;
          fetchTabFeed(currentTab, true);
          lastFeedFetchRef.current = Date.now();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  const handleTabChange = (tab: SocialTab) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (tab === activeSocialTab) return;
    setActiveSocialTab(tab);
    setHasNewUpdates(false);
    activeTabRef.current = tab;

    const tabIdx = validTabs.indexOf(tab);
    if (tabIdx !== -1) {
      if (socialTabsContainerRef.current) {
        socialTabsContainerRef.current.style.setProperty('--tab-progress', String(tabIdx));
      }
      tabItemRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.setProperty('--tab-act', i === tabIdx ? '1' : '0');
      });
    }

    const newParams = new URLSearchParams(searchParams);
    if (tab === 'following') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  };

  const currentSocialStep = validTabs.indexOf(activeSocialTab);

  const goToSocialStep = (step: number) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const targetTab = validTabs[step] || 'following';
    setActiveSocialTab(targetTab);
    activeTabRef.current = targetTab;

    if (socialTabsContainerRef.current) {
      socialTabsContainerRef.current.style.setProperty('--tab-progress', String(step));
    }
    tabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--tab-act', i === step ? '1' : '0');
    });

    const newParams = new URLSearchParams(searchParams);
    if (targetTab === 'following') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', targetTab);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Real-time gesture tracking refs & handler for smooth mobile tab morphing
  const socialTabsContainerRef = useRef<HTMLDivElement>(null);
  const tabItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleScrollProgress = useCallback((progress: number) => {
    const clamped = Math.min(3, Math.max(0, progress));
    if (socialTabsContainerRef.current) {
      socialTabsContainerRef.current.style.setProperty('--tab-progress', clamped.toFixed(4));
    }
    tabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(clamped - i);
      const act = Math.max(0, Math.min(1, 1 - dist));
      el.style.setProperty('--tab-act', act.toFixed(4));
    });
  }, []);

  useEffect(() => {
    handleScrollProgress(currentSocialStep);
  }, [currentSocialStep, handleScrollProgress]);

  const handleApplyUpdates = () => {
    setHasNewUpdates(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchTabFeed(activeSocialTab, true, controller.signal);
  };

  const handleDeleteActivity = (id: number) => {
    setTabFeeds(prev => {
      const current = prev[activeSocialTab] || [];
      const updated = current.filter(a => a.id !== id);
      feedCacheRef.current[activeSocialTab] = updated;
      try {
        const serialized = JSON.stringify(updated);
        sessionStorage.setItem(`pathd_social_feed_${activeSocialTab}`, serialized);
        localStorage.setItem(`pathd_social_feed_${activeSocialTab}`, serialized);
      } catch (_) {}
      return { ...prev, [activeSocialTab]: updated };
    });
  };

  const tabsConfig = [
    {
      id: 'following' as SocialTab,
      label: isEs ? 'Siguiendo' : 'Following',
      icon: Users,
      description: isEs ? 'Actividad de personas a las que sigues' : 'Activity from users you follow'
    },
    {
      id: 'discover' as SocialTab,
      label: isEs ? 'Descubrir' : 'Discover',
      icon: Compass,
      description: isEs ? 'Hitos y actividad comunitaria global' : 'Global community milestones and highlights'
    },
    {
      id: 'reviews' as SocialTab,
      label: isEs ? 'Reseñas' : 'Reviews',
      icon: Star,
      description: isEs ? 'Calificaciones y reseñas recientes' : 'Recent ratings and community reviews'
    },
    {
      id: 'me' as SocialTab,
      label: isEs ? 'Mi Actividad' : 'My Activity',
      icon: User,
      description: isEs ? 'Tu muro público y gestión de visibilidad' : 'Your public feed and visibility settings'
    }
  ];

  const renderSocialFeed = (tab: SocialTab) => {
    const items = tabFeeds[tab] || [];
    const isLoading = tabLoading[tab] && items.length === 0;

    if (isLoading) {
      return (
        <div style={{ minHeight: '45vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
          <PathdLoader size="medium" message={isEs ? 'Cargando comunidad...' : 'Loading community...'} />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {tab === 'following'
              ? (isEs ? 'Tu muro está en silencio' : 'Your feed is quiet')
              : (isEs ? 'No hay actividad disponible' : 'No activity available')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
            {tab === 'following'
              ? (isEs ? 'Los usuarios que sigues no han registrado actividad recientemente. ¡Explora la pestaña Descubrir para conectar con más personas!' : 'Users you follow have not recorded activity recently. Explore Discover to find new people!')
              : tab === 'me'
              ? (isEs ? 'Todavía no has registrado actividad pública. Completa obras o califícalas para ver tu progreso aquí.' : 'You have not logged public activity yet. Complete items or rate them to see your progress.')
              : (isEs ? 'No se encontraron publicaciones con los criterios actuales.' : 'No entries found with the current criteria.')}
          </p>
          {tab === 'following' && (
            <button
              onClick={() => goToSocialStep(1)}
              className="btn-primary"
              style={{ padding: '0.7rem 1.75rem', borderRadius: '25px', fontWeight: 600 }}
            >
              {isEs ? 'Ir a Descubrir' : 'Go to Discover'}
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className="social-feed-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
          alignItems: 'stretch'
        }}
      >
        {items.map(act => (
          <SocialActivityCard
            key={act.id}
            activity={act}
            isOwnActivity={Boolean(user && user.id === act.user_id)}
            onDelete={handleDeleteActivity}
            onOpenItem={(item) => handleOpenItem(item)}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Unified Underline Tabs Bar */}
      <div
        ref={socialTabsContainerRef}
        className="social-tabs-container"
        style={{
          display: 'flex',
          gap: '1.75rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          marginBottom: '0.75rem',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--bg-primary)',
          marginTop: '-2rem',
          paddingTop: '1.35rem',
          overflowX: 'auto',
          '--tab-progress': String(currentSocialStep)
        } as React.CSSProperties}
      >
        {tabsConfig.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeSocialTab === tab.id;
          return (
            <div
              key={tab.id}
              ref={el => { tabItemRefs.current[idx] = el; }}
              onClick={() => goToSocialStep(idx)}
              className={`social-tab-item ${isActive ? 'active' : ''}`}
              title={tab.label}
              style={{
                fontSize: '1.05rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                padding: '0.25rem 0',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                '--tab-act': isActive ? '1' : '0'
              } as React.CSSProperties}
            >
              <span className="social-tab-icon">
                <Icon size={18} />
              </span>
              <span className="social-tab-label">{tab.label}</span>
              {isActive && (
                <div
                  className="social-tab-indicator home-desktop-only"
                  style={{
                    position: 'absolute',
                    bottom: '-0.75rem',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--accent-primary)'
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Sliding Continuous Indicator for Mobile Social Tabs */}
        <div className="social-tabs-sliding-indicator home-mobile-only" />
      </div>

      {/* Floating Centered Refresh Button */}
      {hasNewUpdates && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '-1rem',
          marginBottom: '-0.5rem',
          position: 'sticky',
          top: '1rem',
          zIndex: 30
        }}>
          <button
            onClick={handleApplyUpdates}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.15rem',
              borderRadius: '24px',
              border: '1px solid var(--accent-primary)',
              background: 'var(--bg-secondary, #1e2029)',
              color: 'var(--accent-primary, #6366f1)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(99,102,241,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
            }}
          >
            <RefreshCw size={14} />
            <span>{isEs ? 'Actualizar' : 'Update'}</span>
          </button>
        </div>
      )}

      {/* Edge-to-Edge 1:1 Native Swipe ViewPager across Social Feeds */}
      <SwipeViewPager
        currentIndex={currentSocialStep}
        totalSlides={4}
        onSlideChange={goToSocialStep}
        onScrollProgress={handleScrollProgress}
      >
        <div style={{ width: "100%", flex: 1 }}>{renderSocialFeed('following')}</div>
        <div style={{ width: "100%", flex: 1 }}>{renderSocialFeed('discover')}</div>
        <div style={{ width: "100%", flex: 1 }}>{renderSocialFeed('reviews')}</div>
        <div style={{ width: "100%", flex: 1 }}>{renderSocialFeed('me')}</div>
      </SwipeViewPager>

      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          isOwnProfile={true}
          profileId={user?.id}
          onClose={() => setSelectedItem(null)}
          onOpenItem={(item) => handleOpenItem(item)}
          onUpdate={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
            const controller = new AbortController();
            abortControllerRef.current = controller;
            fetchTabFeed(activeSocialTab, true, controller.signal);
          }}
        />
      )}
    </div>
  );
};
export default Social;
