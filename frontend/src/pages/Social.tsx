import React, { useState, useEffect, useRef } from 'react';
import { Users, Compass, Star, User, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { SocialActivityCard } from '../components/SocialActivityCard';
import type { ActivityCardData } from '../components/SocialActivityCard';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { PathdLoader } from '../components/PathdLoader';
import { Link } from 'react-router-dom';

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

  const [activeTab, setActiveTab] = useState<SocialTab>('following');
  const [activities, setActivities] = useState<ActivityCardData[]>(() => getCachedFeed('following'));
  const [loading, setLoading] = useState<boolean>(() => getCachedFeed('following').length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const fetchTabFeed = async (tab: SocialTab, isRefresh = false) => {
    const cached = getCachedFeed(tab);
    if (!isRefresh && cached.length > 0) {
      setActivities(cached);
      setLoading(false);
    } else if (!isRefresh && activities.length === 0) {
      setLoading(true);
    }

    if (isRefresh) setRefreshing(true);

    try {
      let endpoint = '/social/feed/following';
      if (tab === 'discover') endpoint = '/social/feed/discover';
      else if (tab === 'reviews') endpoint = '/social/feed/reviews';
      else if (tab === 'me') endpoint = '/social/feed/me';

      const res = await apiClient.get(endpoint);
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

          // Check for work completion unification:
          // An episode/issue event and a work completed event (item_completed or status=completed/read)
          const isWorkCompletion = (item.activity_type === 'item_completed' || item.activity_type === 'item_status_changed') &&
            (itemMeta.status === 'completed' || itemMeta.status === 'read' || (item.details || '').toLowerCase() === 'completed' || (item.details || '').toLowerCase() === 'read');

          const isUnitConsumption = (item.activity_type === 'episode_watched' || item.activity_type === 'issue_read' || item.activity_type === 'item_progress_updated' || item.activity_type === 'item_status_changed') &&
            ((item.external_id && (String(item.external_id).startsWith('tvm-ep-') || String(item.external_id).startsWith('cv_issue_'))) || item.item_type === 'episode');

          let mergedWithExisting = false;

          if (isWorkCompletion) {
            // Find recent unit consumption event by the same user for this work (within the consolidated list)
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
                // Merge completion flag into target unit activity
                const targetMeta = target.metadata_json ? (typeof target.metadata_json === 'string' ? JSON.parse(target.metadata_json) : target.metadata_json) : {};
                targetMeta.finished_work = true;
                target.metadata_json = JSON.stringify(targetMeta);
                mergedWithExisting = true;
                break;
              }
            }
          } else if (isUnitConsumption) {
            // Check if there is already a work completion event for this work in consolidated
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
                  // Replace the stand-alone completion event with this episode/issue event, marking it finished_work = true
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

        setActivities(consolidated);
        const serialized = JSON.stringify(consolidated);
        try {
          sessionStorage.setItem(`pathd_social_feed_${tab}`, serialized);
          localStorage.setItem(`pathd_social_feed_${tab}`, serialized);
        } catch (_) {}
      }
    } catch (err) {
      console.error(`Error loading social feed for tab ${tab}:`, err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const lastFeedFetchRef = useRef<number>(Date.now());

  useEffect(() => {
    fetchTabFeed(activeTab);
    setHasNewUpdates(false);
    lastFeedFetchRef.current = Date.now();
  }, [activeTab]);

  // Check for updates when user returns to the tab after 45s
  useEffect(() => {
    const handleVisibilityOrFocus = async () => {
      if (document.visibilityState === 'visible') {
        const timePassed = Date.now() - lastFeedFetchRef.current;
        if (timePassed > 45000 && !loading && !refreshing) {
          // Peek silently to see if first activity changed
          try {
            let endpoint = '/social/feed/following';
            if (activeTab === 'discover') endpoint = '/social/feed/discover';
            else if (activeTab === 'reviews') endpoint = '/social/feed/reviews';
            else if (activeTab === 'me') endpoint = '/social/feed/me';

            const res = await apiClient.get(endpoint);
            if (Array.isArray(res.data) && res.data.length > 0) {
              const latestId = res.data[0]?.id;
              const currentId = activities[0]?.id;
              if (latestId && currentId && latestId !== currentId) {
                setHasNewUpdates(true);
              }
            }
          } catch (e) {
            // ignore silent peek errors
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [activeTab, activities, loading, refreshing]);

  const handleTabChange = (tab: SocialTab) => {
    setHasNewUpdates(false);
    setActiveTab(tab);
  };

  const handleApplyUpdates = () => {
    setHasNewUpdates(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchTabFeed(activeTab, true);
  };

  const handleVisibilityToggle = (id: number, isHidden: boolean) => {
    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, is_hidden: isHidden } : a))
    );
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.85rem', fontWeight: 800 }}>
            {isEs ? 'Comunidad' : 'Community'}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {tabsConfig.find(t => t.id === activeTab)?.description}
          </p>
        </div>

        {/* 4 Tabs Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            padding: '0.4rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflowX: 'auto'
          }}
        >
          {tabsConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
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

      {/* Feed Content */}
      {loading ? (
        <div style={{ minHeight: '45vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
          <PathdLoader size="medium" message={isEs ? 'Cargando comunidad...' : 'Loading community...'} />
        </div>
      ) : activities.length === 0 ? (
        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {activeTab === 'following'
              ? (isEs ? 'Tu muro está en silencio' : 'Your feed is quiet')
              : (isEs ? 'No hay actividad disponible' : 'No activity available')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
            {activeTab === 'following'
              ? (isEs ? 'Los usuarios que sigues no han registrado actividad recientemente. ¡Explora la pestaña Descubrir para conectar con más personas!' : 'Users you follow have not recorded activity recently. Explore Discover to find new people!')
              : activeTab === 'me'
              ? (isEs ? 'Todavía no has registrado actividad pública. Completa obras o califícalas para ver tu progreso aquí.' : 'You have not logged public activity yet. Complete items or rate them to see your progress.')
              : (isEs ? 'No se encontraron publicaciones con los criterios actuales.' : 'No entries found with the current criteria.')}
          </p>
          {activeTab === 'following' && (
            <button
              onClick={() => setActiveTab('discover')}
              className="btn-primary"
              style={{ padding: '0.7rem 1.75rem', borderRadius: '25px', fontWeight: 600 }}
            >
              {isEs ? 'Ir a Descubrir' : 'Go to Discover'}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
            alignItems: 'stretch'
          }}
        >
          {activities.map(act => (
            <SocialActivityCard
              key={act.id}
              activity={act}
              isOwnActivity={Boolean(user && user.id === act.user_id)}
              onVisibilityToggle={handleVisibilityToggle}
              onOpenItem={(item) => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          isOwnProfile={true}
          profileId={user?.id}
          onClose={() => setSelectedItem(null)}
          onOpenItem={(item) => setSelectedItem(item)}
          onUpdate={() => {
            fetchTabFeed(activeTab, true);
          }}
        />
      )}
    </div>
  );
};
export default Social;
