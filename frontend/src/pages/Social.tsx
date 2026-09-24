import React, { useState, useEffect } from 'react';
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
        setActivities(res.data);
        const serialized = JSON.stringify(res.data);
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

  useEffect(() => {
    fetchTabFeed(activeTab);
  }, [activeTab]);

  const handleTabChange = (tab: SocialTab) => {
    setActiveTab(tab);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.85rem', fontWeight: 800 }}>
              {isEs ? 'Comunidad' : 'Community'}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {tabsConfig.find(t => t.id === activeTab)?.description}
            </p>
          </div>

          <button
            onClick={() => fetchTabFeed(activeTab, true)}
            disabled={refreshing || loading}
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isEs ? 'Actualizar' : 'Refresh'}</span>
          </button>
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

      {/* Feed Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          activities.map(act => (
            <SocialActivityCard
              key={act.id}
              activity={act}
              isOwnActivity={Boolean(user && user.id === act.user_id)}
              onVisibilityToggle={handleVisibilityToggle}
              onOpenItem={(item) => setSelectedItem(item)}
            />
          ))
        )}
      </div>

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
