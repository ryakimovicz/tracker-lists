import { HorizontalScroll } from '../components/HorizontalScroll';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { MediaPoster } from '../components/MediaPoster';
import { AdBanner } from '../components/AdBanner';
import { ReplaceFavoriteModal } from '../components/ReplaceFavoriteModal';
import { ProModal } from '../components/ProModal';
import { getOrderedCategories, sortFilterTabs, getCategoryIcon } from '../utils/categoryOrder';
import { prefetchMediaDetails } from '../utils/prefetch';
import { removeCachedSeries, clearCachedSeriesMatching } from '../utils/seriesCache';

import { Search as SearchIcon, AlertCircle, CheckCircle, Plus, X, Heart, Star, Users, BookOpen, Package, Puzzle, Sparkles, Gamepad2, Trash2, Flame, TrendingUp, Trophy, Bookmark, Film, Tv, Book, MessageSquare, MessageCircle } from 'lucide-react';

interface SearchResultItem {
  external_id: string;
  title: string;
  image_url: string;
  description: string;
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book' | 'user' | 'guide' | 'comic' | 'manga';
  release_date?: string;
  imdb_id?: string;
  status?: string;
  badge?: string;
}

export const renderMediaBadge = (badge?: string | null, language: string = 'es') => {
  if (!badge) return null;
  let label = badge;
  let icon = null;
  let borderColor = 'rgba(255, 255, 255, 0.25)';

  if (badge === 'pack') {
    label = language === 'es' ? 'Pack' : 'Pack';
    icon = <Package size={11} color="#38bdf8" />;
    borderColor = 'rgba(56, 189, 248, 0.5)';
  } else if (badge === 'collection') {
    label = language === 'es' ? 'Colección' : 'Collection';
    icon = <Package size={11} color="#10b981" />;
    borderColor = 'rgba(16, 185, 129, 0.5)';
  } else if (badge === 'dlc') {
    label = 'DLC';
    icon = <Puzzle size={11} color="#8b5cf6" />;
    borderColor = 'rgba(139, 92, 246, 0.5)';
  } else if (badge === 'expansion') {
    label = language === 'es' ? 'Expansión' : 'Expansion';
    icon = <Sparkles size={11} color="#3b82f6" />;
    borderColor = 'rgba(59, 130, 246, 0.5)';
  } else if (badge === 'edition') {
    label = language === 'es' ? 'Edición' : 'Edition';
    icon = <Sparkles size={11} color="#f59e0b" />;
    borderColor = 'rgba(245, 158, 11, 0.5)';
  } else if (badge === 'remake') {
    label = 'Remake';
    icon = <Gamepad2 size={11} color="#ec4899" />;
    borderColor = 'rgba(236, 72, 153, 0.5)';
  } else if (badge === 'remaster') {
    label = 'Remaster';
    icon = <Sparkles size={11} color="#06b6d4" />;
    borderColor = 'rgba(6, 182, 212, 0.5)';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '0.5rem',
        left: '0.5rem',
        padding: '0.2rem 0.45rem',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        zIndex: 2,
        letterSpacing: '0.02em'
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

const stripHtml = (html: string) => {
  if (!html) return '';
  const clean = html.replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return txt.value;
};

interface ExploreSectionProps {
  subTab?: string;
  loading: boolean;
  categories: Array<{ type: string; title: string; items: any[] }>;
  language: string;
  currentUser: any;
  onOpenItem: (item: any) => void;
  getTagClass: (type: string) => string;
}

const ExploreSection = React.memo<ExploreSectionProps>(({
  subTab = 'explore',
  loading,
  categories,
  language,
  currentUser,
  onOpenItem,
  getTagClass
}) => {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>{language === 'es' ? 'Cargando...' : 'Loading...'}</div>;
  }

  if (categories.length === 0) {
    return <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>{language === 'es' ? 'No hay elementos disponibles.' : 'No items available.'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {categories.map(({ type, title, items }) => (
        <HorizontalScroll 
          key={`${subTab}_${type}`} 
          title={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {getCategoryIcon(type, { size: 18 })}
              </span>
              <span>{title}</span>
            </>
          } 
          outlineColor={`var(--color-${type})`}
        >
          {items.map((item: any, idx: number) => (
            <div key={idx} className="glass-card" style={{ minWidth: '200px', width: '200px', padding: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={() => onOpenItem(item)} onMouseEnter={() => prefetchMediaDetails(item)}>
              <div style={{ position: 'relative', width: '100%', height: '280px', overflow: 'hidden', borderRadius: '8px' }}>
                <MediaPoster
                  src={item.image_url}
                  title={item.title}
                  itemType={item.item_type}
                  isUpcomingMovie={item.item_type === 'movie'}
                  height="100%"
                  width="100%"
                  borderRadius="8px"
                />

                {/* Game/Media Badge (Colección, DLC, etc.) */}
                {renderMediaBadge(item.badge, language)}

                {/* Status Badge */}
                {item.status && ['completed', 'watching', 'dropped', 'read', 'reading'].includes(item.status) && (
                  <div style={{ 
                    position: 'absolute', top: '0.5rem', right: '0.5rem', 
                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                    background: (item.status === 'completed' || item.status === 'read') ? 'var(--color-movie)' : (item.status === 'watching' || item.status === 'reading') ? '#3b82f6' : '#ef4444',
                    color: (item.status === 'completed' || item.status === 'read') ? 'var(--color-text-movie)' : '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }}>
                    {(item.status === 'completed' || item.status === 'read') ? (item.item_type === 'series' || item.item_type === 'anime' ? (language === 'es' ? 'Terminado' : 'Completed') : ['book', 'comic', 'manga'].includes(item.item_type) ? (language === 'es' ? 'Leído' : 'Read') : (language === 'es' ? 'Visto' : 'Watched')) : (item.status === 'watching' || item.status === 'reading') ? (item.item_type === 'movie' ? (language === 'es' ? 'En pausa' : 'Paused') : ['book', 'comic', 'manga'].includes(item.item_type) ? (language === 'es' ? 'Leyendo' : 'Reading') : (language === 'es' ? 'Viendo' : 'Watching')) : (language === 'es' ? 'Abandonado' : 'Dropped')}
                  </div>
                )}
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>{item.title}</h4>
                {(item.item_type === 'series' || item.item_type === 'anime') && item.latest_episode != null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {language === 'es' ? 'T' : 'S'}{String(item.latest_season || 1).padStart(2, '0')} | E{String(item.latest_episode).padStart(2, '0')}
                    </span>
                    {item.release_date && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.release_date}</span>}
                  </div>
                ) : (
                  item.release_date && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.release_date}</span>
                )}
              </div>
            </div>
          ))}
        </HorizontalScroll>
      ))}
    </div>
  );
});

interface ExploreGuidesSectionProps {
  loading: boolean;
  guidesData: any;
  language: string;
  t: (key: string) => string;
  navigate: (path: string) => void;
}

const ExploreGuidesSection = React.memo<ExploreGuidesSectionProps>(({
  loading,
  guidesData,
  language,
  t,
  navigate
}) => {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>{language === 'es' ? 'Cargando guías...' : 'Loading guides...'}</div>;
  }

  const rows = [
    { 
      key: 'populares', 
      title: t('guidesPopular'), 
      icon: <Flame size={18} color="#f97316" />, 
      outlineColor: '#f97316',
      items: guidesData?.populares || [] 
    },
    { 
      key: 'mejor_valoradas', 
      title: t('guidesTopRated'), 
      icon: <Trophy size={18} color="#eab308" />, 
      outlineColor: '#eab308',
      items: guidesData?.mejor_valoradas || [] 
    },
    { 
      key: 'mas_guardadas', 
      title: t('guidesMostSaved'), 
      icon: <Plus size={18} color="#ec4899" strokeWidth={2.5} />, 
      outlineColor: '#ec4899',
      items: guidesData?.mas_guardadas || [] 
    },
    { 
      key: 'nuevas', 
      title: t('guidesNew'), 
      icon: <Sparkles size={18} color="var(--accent-primary)" />, 
      outlineColor: 'var(--accent-primary)',
      items: guidesData?.nuevas || [] 
    },
  ].filter(r => r.items.length > 0);

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem' }}>
        <BookOpen size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
        <p style={{ margin: 0 }}>{language === 'es' ? 'Aún no hay guías públicas disponibles.' : 'No public guides available yet.'}</p>
      </div>
    );
  }

  const renderMediaIcon = (mt: string) => {
    switch (mt) {
      case 'movie':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Películas' : 'Movies'}><Film size={13} color="var(--color-movie)" /></span>;
      case 'series':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Series' : 'Shows'}><Tv size={13} color="var(--color-series)" /></span>;
      case 'anime':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title="Anime"><Sparkles size={13} color="var(--color-anime)" /></span>;
      case 'manga':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title="Manga"><MessageCircle size={13} color="var(--color-manga)" /></span>;
      case 'game':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Juegos' : 'Games'}><Gamepad2 size={13} color="var(--color-game)" /></span>;
      case 'book':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Libros' : 'Books'}><Book size={13} color="var(--color-book)" /></span>;
      case 'comic':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Cómics' : 'Comics'}><MessageSquare size={13} color="var(--color-comic)" /></span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {rows.map(row => (
        <HorizontalScroll 
          key={row.key} 
          title={
            <>
              {row.icon}
              <span>{row.title}</span>
            </>
          } 
          outlineColor={row.outlineColor}
        >
          {row.items.map((guide: any) => (
            <div
              key={guide.id}
              className="glass-card"
              style={{
                minWidth: '240px',
                width: '240px',
                padding: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                borderRadius: '10px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={() => navigate(`/list/${guide.id}`)}
            >
              {/* Cover Collage */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '140px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {guide.covers && guide.covers.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: guide.covers.length >= 2 ? '1fr 1fr' : '1fr',
                    gridTemplateRows: guide.covers.length >= 3 ? '1fr 1fr' : '1fr',
                    width: '100%',
                    height: '100%',
                    gap: '2px',
                    background: '#000'
                  }}>
                    {guide.covers.slice(0, 4).map((img: string, cIdx: number) => (
                      <img
                        key={cIdx}
                        src={img}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <BookOpen size={36} color="var(--color-guide)" />
                  </div>
                )}

                {/* Items count overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(4px)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#fff'
                }}>
                  {guide.items_count} {t('guidesWorksCount')}
                </div>
              </div>

              {/* Title & Creator */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.25'
                }} title={guide.title}>
                  {guide.title}
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#fff',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {guide.creator_photo_url ? (
                      <img src={guide.creator_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      guide.creator_username?.charAt(0).toUpperCase() || 'P'
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {guide.creator_username}
                  </span>
                </div>
              </div>

              {/* Badges & Metrics Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem', marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {guide.media_types?.map((mt: string) => renderMediaIcon(mt))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {guide.average_rating != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#eab308', fontWeight: 600 }}>
                      <Star size={12} fill="#eab308" color="#eab308" />
                      {guide.average_rating}
                    </span>
                  )}
                  {guide.saves_count > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#ec4899', fontWeight: 600 }} title={language === 'es' ? 'Guardados' : 'Saved'}>
                      <Plus size={12} strokeWidth={2.5} />
                      {guide.saves_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </HorizontalScroll>
      ))}
    </div>
  );
});

export const Search: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const getTagClass = (type: string) => {
    switch (type) {
      case 'movie': return 'tag-badge tag-movie';
      case 'series': return 'tag-badge tag-series';
      case 'anime': return 'tag-badge tag-anime';
      case 'book': return 'tag-badge tag-book';
      case 'comic': return 'tag-badge tag-comic';
      case 'manga': return 'tag-badge tag-manga';
      case 'game': return 'tag-badge tag-game';
      case 'guide': return 'tag-badge tag-guide';
      case 'user': return 'tag-badge tag-user';
      default: return 'tag-badge';
    }
  };

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(24);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'game' | 'user' | 'guide' | 'comic' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Reset visibleCount on tab change or new search query
  useEffect(() => {
    setVisibleCount(24);
  }, [activeTab, submittedQuery]);

  const [exploreData, setExploreData] = useState<any>(null);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [exploreSubTab, setExploreSubTab] = useState<'nuevo' | 'tendencias' | 'guias'>('nuevo');
  const [guidesData, setGuidesData] = useState<any>(null);
  const [loadingGuides, setLoadingGuides] = useState(false);

  const buildCategorizedList = (items: any[]) => {
    if (!items || items.length === 0) return [];
    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grouped[item.item_type]) grouped[item.item_type] = [];
      grouped[item.item_type].push(item);
    });

    const categoryOrder = getOrderedCategories(user?.category_order);
    return categoryOrder.map(type => ({
      type,
      title: type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
             type === 'series' ? (language === 'es' ? 'Series' : 'Shows') :
             type === 'anime' ? 'Anime' :
             type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
             type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') : 
             type === 'manga' ? 'Mangas' : 
             type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type,
      items: grouped[type] || []
    })).filter(g => g.items.length > 0);
  };

  const exploreNewCategories = React.useMemo(() => {
    const items = exploreData?.nuevo || [];
    const cats = buildCategorizedList(items);
    cats.forEach(c => {
      c.items.sort((a, b) => {
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
      });
    });
    return cats;
  }, [exploreData, language, user?.category_order]);

  const exploreTrendingCategories = React.useMemo(() => {
    const items = exploreData?.tendencias || [];
    return buildCategorizedList(items);
  }, [exploreData, language, user?.category_order]);

  const filteredExploreCategories = React.useMemo(() => {
    const targetCats = exploreSubTab === 'tendencias' ? exploreTrendingCategories : exploreNewCategories;
    if (activeTab === 'all') return targetCats;
    return targetCats.filter(cat => cat.type === activeTab);
  }, [exploreSubTab, exploreTrendingCategories, exploreNewCategories, activeTab]);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'movie': return language === 'es' ? 'Películas' : 'Movies';
      case 'series': return language === 'es' ? 'Series' : 'Shows';
      case 'anime': return 'Anime';
      case 'book': return language === 'es' ? 'Libros' : 'Books';
      case 'comic': return language === 'es' ? 'Cómics' : 'Comics';
      case 'manga': return 'Mangas';
      case 'game': return language === 'es' ? 'Juegos' : 'Games';
      case 'user': return language === 'es' ? 'Usuarios' : 'Users';
      case 'guide': return language === 'es' ? 'Guías' : 'Guides';
      default: return language === 'es' ? 'Todo' : 'All';
    }
  };

  const getSingleCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'movie': return language === 'es' ? 'Película' : 'Movie';
      case 'series': return language === 'es' ? 'Serie' : 'Show';
      case 'anime': return 'Anime';
      case 'book': return language === 'es' ? 'Libro' : 'Book';
      case 'comic': return language === 'es' ? 'Cómic' : 'Comic';
      case 'manga': return 'Manga';
      case 'game': return language === 'es' ? 'Juego' : 'Game';
      case 'user': return language === 'es' ? 'Usuario' : 'User';
      case 'guide': return language === 'es' ? 'Guía' : 'Guide';
      default: return cat;
    }
  };

  // Shelf tracking states
  const [shelfItems, setShelfItems] = useState<any[]>([]);
  const [itemToRemoveFromShelf, setItemToRemoveFromShelf] = useState<any | null>(null);

  // Details Modal states
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Replace Favorite Modal State & Pro Modal
  const [replaceModalState, setReplaceModalState] = useState<{
    isOpen: boolean;
    newItem: any | null;
    currentFavorites: any[];
  }>({
    isOpen: false,
    newItem: null,
    currentFavorites: []
  });
  const [showProModal, setShowProModal] = useState(false);

  // TV Tracking states inside details modal
          
  // User & Guide search tracking
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [savedGuides, setSavedGuides] = useState<any[]>([]);

  const loadShelfItems = async () => {
    try {
      const res = await apiClient.get('/library/');
      setShelfItems(res.data);
    } catch (e) {
      console.error("Failed to load shelf items", e);
    }
  };

  const loadSocialMetadata = async () => {
    try {
      const profileRes = await apiClient.get('/users/me');
      setCurrentUser(profileRes.data);
      const followingRes = await apiClient.get(`/social/users/${profileRes.data.id}/following`);
      setFollowingUsers(followingRes.data);
      setSavedGuides(profileRes.data.saved_lists || []);
    } catch(e) {
      console.error("Failed to load user social data", e);
    }
  };

  useEffect(() => {
    loadShelfItems();
    loadSocialMetadata();
    const handleLibUpdated = () => {
      loadShelfItems();
    };
    window.addEventListener('library-updated', handleLibUpdated);
    return () => {
      window.removeEventListener('library-updated', handleLibUpdated);
    };
  }, []);

  useEffect(() => {
    if (submittedQuery === '') {
      const fetchExplore = async () => {
        // 1. Instant cache check from sessionStorage
        const cachedRaw = sessionStorage.getItem('pathd_explore_cache');
        if (cachedRaw) {
          try {
            const cachedParsed = JSON.parse(cachedRaw);
            if (cachedParsed?.nuevo?.length > 0 || cachedParsed?.tendencias?.length > 0) {
              setExploreData(cachedParsed);
            }
          } catch (e) {}
        } else {
          setLoadingExplore(true);
        }

        // 2. Fetch fresh data from backend
        try {
          const res = await apiClient.get('/search/explore/tabs');
          setExploreData(res.data);
          sessionStorage.setItem('pathd_explore_cache', JSON.stringify(res.data));
        } catch (err) {
          console.error("Failed to load recommendations", err);
        } finally {
          setLoadingExplore(false);
        }
      };
      fetchExplore();
    }
  }, [submittedQuery]);

  useEffect(() => {
    if (submittedQuery === '' && exploreSubTab === 'guias' && !guidesData) {
      const fetchGuides = async () => {
        const cachedRaw = sessionStorage.getItem('pathd_guides_explore_cache');
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed) setGuidesData(parsed);
          } catch (e) {}
        } else {
          setLoadingGuides(true);
        }
        try {
          const res = await apiClient.get('/lists/explore');
          setGuidesData(res.data);
          sessionStorage.setItem('pathd_guides_explore_cache', JSON.stringify(res.data));
        } catch (e) {
          console.error("Failed to load explore guides", e);
        } finally {
          setLoadingGuides(false);
        }
      };
      fetchGuides();
    }
  }, [submittedQuery, exploreSubTab, guidesData]);

  const debounceTimerRef = React.useRef<any>(null);
  const searchRequestIdRef = React.useRef<number>(0);

  const executeSearch = async (targetQuery: string, currentTab: string) => {
    const cleanQuery = targetQuery.trim();
    if (!cleanQuery) {
      setSubmittedQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    const currentReqId = ++searchRequestIdRef.current;
    setSubmittedQuery(cleanQuery);
    setIsSearching(true);
    setErrorMsg('');

    try {
      if (currentTab !== 'all' && ['comic', 'book', 'manga', 'game', 'movie', 'anime', 'series'].includes(currentTab)) {
        // 1. Fetch only the active category first (Super fast: ~150ms response)
        const primaryRes = await apiClient.get('/search/', {
          params: { q: cleanQuery, type: currentTab }
        });
        if (searchRequestIdRef.current !== currentReqId) return;

        const initialData = Array.isArray(primaryRes.data) ? primaryRes.data : [];
        setResults(initialData);
        setIsSearching(false);
        if (initialData.length > 0) {
          initialData.slice(0, 8).forEach((r: any) => prefetchMediaDetails(r));
        }

        // 2. In background, fetch the rest of categories silently
        const otherTypes = ['movie', 'series', 'anime', 'game', 'book', 'comic', 'manga'].filter(t => t !== currentTab);
        Promise.allSettled(
          otherTypes.map(t => apiClient.get('/search/', { params: { q: cleanQuery, type: t } }))
        ).then(resultsArr => {
          if (searchRequestIdRef.current !== currentReqId) return;
          setResults(prev => {
            const existingIds = new Set(prev.map(p => p.external_id));
            const newItems: SearchResultItem[] = [];
            resultsArr.forEach(resObj => {
              if (resObj.status === 'fulfilled' && Array.isArray(resObj.value.data)) {
                resObj.value.data.forEach((item: SearchResultItem) => {
                  if (!existingIds.has(item.external_id)) {
                    existingIds.add(item.external_id);
                    newItems.push(item);
                  }
                });
              }
            });
            return [...prev, ...newItems];
          });
        }).catch(() => {});

      } else {
        // 'all', 'user', or 'guide'
        const response = await apiClient.get('/search/all', {
          params: { q: cleanQuery }
        });
        if (searchRequestIdRef.current !== currentReqId) return;
        setResults(response.data);
        setIsSearching(false);
        if (Array.isArray(response.data)) {
          response.data.slice(0, 8).forEach((r: any) => prefetchMediaDetails(r));
        }
      }
    } catch (err: any) {
      if (searchRequestIdRef.current !== currentReqId) return;
      if (err.response?.status === 429) {
        setErrorMsg(t('errRateLimit'));
      } else {
        setErrorMsg(t('errSearchFailed'));
      }
      setIsSearching(false);
    }
  };

  // Auto-search debounce after 600ms of inactivity if query is at least 3 characters
  useEffect(() => {
    const cleanQuery = query.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!cleanQuery) {
      setSubmittedQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (cleanQuery.length >= 3 && cleanQuery !== submittedQuery) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(cleanQuery, activeTab);
      }, 600);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, activeTab]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    executeSearch(query, activeTab);
  };

  const handleTabClick = (tabValue: any) => {
    setActiveTab(tabValue);
    const cleanQuery = query.trim();
    if (cleanQuery) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      executeSearch(cleanQuery, tabValue);
    }
  };

  const getStatusesForType = (type: string) => {
    const normType = type === 'anime' ? 'series' : type;
    if (normType === 'game') {
      return [
        { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
        { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
        { value: 'completed', label: language === 'es' ? 'Terminado' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (normType === 'movie') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'completed', label: language === 'es' ? 'Visto' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (normType === 'series') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'watching', label: language === 'es' ? 'Viendo' : 'Watching' },
        { value: 'completed', label: language === 'es' ? 'Terminada' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    return [
      { value: 'plan_to_read', label: language === 'es' ? 'Por Leer' : 'Plan to Read' },
      { value: 'reading', label: language === 'es' ? 'Leyendo' : 'Reading' },
      { value: 'read', label: language === 'es' ? 'Leído' : 'Read' },
      { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
    ];
  };

  const getDefaultStatus = (type: string) => {
    if (type === 'game') return 'plan_to_play';
    if (['book', 'comic', 'manga'].includes(type)) return 'plan_to_read';
    return 'plan_to_watch';
  };

  const handleQuickAddToShelf = async (item: SearchResultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setErrorMsg('');
    const status = getDefaultStatus(item.item_type);

    // Optimistic UI update: immediately paint the button as added
    const tempId = -Date.now();
    const optimisticItem = {
      id: tempId,
      external_id: item.external_id,
      item_type: item.item_type,
      title: item.title,
      image_url: item.image_url,
      imdb_id: item.imdb_id,
      custom_badge: item.badge || null,
      release_date: item.release_date || null,
      status: status
    };

    setShelfItems(prev => {
      const filtered = prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type));
      return [...filtered, optimisticItem];
    });

    try {
      await apiClient.post('/library/', {
        item_type: item.item_type,
        external_id: item.external_id,
        title: item.title,
        image_url: item.image_url,
        imdb_id: item.imdb_id,
        custom_badge: item.badge || null,
        release_date: item.release_date || null,
        status: status
      });
      await loadShelfItems();
    } catch (err: any) {
      // Revert optimistic state on failure
      setShelfItems(prev => prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type)));
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to your library shelf.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmRemoveFromShelf = async (deleteHistory = false) => {
    if (!itemToRemoveFromShelf || !itemToRemoveFromShelf.id) return;
    try {
      const url = deleteHistory ? `/library/${itemToRemoveFromShelf.id}?delete_history=true` : `/library/${itemToRemoveFromShelf.id}`;
      await apiClient.delete(url);

      if (deleteHistory) {
        const cleanId = String(itemToRemoveFromShelf.external_id || itemToRemoveFromShelf.id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '').replace('tvm-ep-', '').replace('tvm_', '');
        clearCachedSeriesMatching(`issue_state_`);
        if (cleanId) {
          removeCachedSeries(`comic_vol_${cleanId}`);
          removeCachedSeries(`series_${cleanId}`);
          removeCachedSeries(`${cleanId}_all_episodes`);
          removeCachedSeries(`${cleanId}_all_episodes_v2`);
          removeCachedSeries(`${cleanId}_metadata`);
        }
        if (itemToRemoveFromShelf.tracking_list_id) {
          removeCachedSeries(`list_${itemToRemoveFromShelf.tracking_list_id}`);
        }
      }

      setSuccessMsg(deleteHistory
        ? (language === 'es' ? 'Elemento y su historial eliminados por completo.' : 'Item and all history deleted completely.')
        : (language === 'es' ? 'Elemento eliminado de tu estantería (historial conservado).' : 'Item removed from your shelf (history preserved).')
      );
      setResults(prev => prev.map(r => 
        r.item_type === itemToRemoveFromShelf.item_type && r.external_id === itemToRemoveFromShelf.external_id 
        ? { ...r, id: undefined, status: undefined, tracking_list_id: undefined, completed_at: undefined, is_favorite: false } 
        : r
      ));
      setItemToRemoveFromShelf(null);
      await loadShelfItems();
      window.dispatchEvent(new CustomEvent('progress-updated', { detail: { deletedExternalId: itemToRemoveFromShelf.external_id, deleteHistory } }));
      window.dispatchEvent(new Event('library-updated'));
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to remove item.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleOpenItemDetails = (item: SearchResultItem) => {
    if ((item as any).id && (item as any).list_title && !item.external_id) {
      navigate(`/guide/${(item as any).id}`);
      return;
    }
    setSelectedItem(item);
  };

  const handleToggleFollowUser = async (userId: number) => {
    try {
      const res = await apiClient.post(`/social/users/${userId}/follow`);
      await loadSocialMetadata();
      setSuccessMsg(res.data.following
        ? (language === 'es' ? 'Comenzaste a seguir a este usuario.' : 'Started following this user.')
        : (language === 'es' ? 'Dejaste de seguir a este usuario.' : 'Unfollowed this user.')
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(err) {
      console.error("Failed to follow user", err);
    }
  };

  const handleToggleSaveGuide = async (guideId: number, isSaved: boolean) => {
    try {
      if (isSaved) {
        await apiClient.delete(`/lists/${guideId}/save`);
        setSuccessMsg(language === 'es' ? 'Guía quitada de tu biblioteca.' : 'Guide removed from library.');
      } else {
        await apiClient.post(`/lists/${guideId}/save`);
        setSuccessMsg(language === 'es' ? 'Guía guardada en tu biblioteca.' : 'Guide saved to library.');
      }
      await loadSocialMetadata();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(err) {
      console.error("Failed to toggle guide save", err);
    }
  };

  const formatReleaseDate = (raw: string | undefined) => {
    if (!raw) return '';
    const clean = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) return clean;
      const months = language === 'es'
        ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return language === 'es'
        ? `${parseInt(day)} de ${months[date.getMonth()]} de ${year}`
        : `${months[date.getMonth()]} ${parseInt(day)}, ${year}`;
    }
    return clean;
  };

  const filteredResults = activeTab === 'all'
    ? results
    : results.filter(item => {
        if (activeTab === 'series') return item.item_type === 'series';
        if (activeTab === 'anime') return item.item_type === 'anime';
        if (activeTab === 'movie') return item.item_type === 'movie';
        if (activeTab === 'book') return item.item_type === 'book';
        if (activeTab === 'comic') return item.item_type === 'comic';
        if (activeTab === 'manga') return item.item_type === 'manga';
        if (activeTab === 'game') return item.item_type === 'game';
        if (activeTab === 'user') return item.item_type === 'user';
        if (activeTab === 'guide') return item.item_type === 'guide';
        return true;
      });

  const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
    const targetItem = shelfItems.find(li => li.id === itemId);
    if (!targetItem) return;

    if (!currentFav) {
      const isDlcOrExpansion = targetItem.item_type === 'game' && ['dlc', 'expansion'].includes(targetItem.badge || targetItem.custom_badge || '');
      const isUnconsumed = !isDlcOrExpansion && ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(targetItem.status);
      if (isUnconsumed) {
        setErrorMsg(language === 'es' 
          ? 'Solo puedes destacar elementos que hayas empezado a consumir o completado.' 
          : 'You can only feature items that you have started or completed.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }

      const isPro = Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip);
      const sameCategoryFavs = shelfItems.filter(f => f.item_type === targetItem.item_type && f.is_favorite);
      const maxAllowed = isPro ? 10 : 1;

      if (sameCategoryFavs.length >= maxAllowed) {
        setReplaceModalState({
          isOpen: true,
          newItem: targetItem,
          currentFavorites: sameCategoryFavs
        });
        return;
      }
    }

    try {
      await apiClient.put(`/library/${itemId}`, { is_favorite: !currentFav });
      setShelfItems(prev => prev.map(item => item.id === itemId ? { ...item, is_favorite: !currentFav } : item));
      setSuccessMsg(!currentFav 
        ? (language === 'es' ? 'Elemento añadido a destacados.' : 'Item added to favorites.')
        : (language === 'es' ? 'Elemento quitado de destacados.' : 'Item removed from favorites.')
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error updating favorite status');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmReplace = async (itemToReplaceId: number, newItemId: number) => {
    try {
      await apiClient.put(`/library/${itemToReplaceId}`, { is_favorite: false });
      await apiClient.put(`/library/${newItemId}`, { is_favorite: true });

      setShelfItems(prev => prev.map(item => {
        if (item.id === itemToReplaceId) return { ...item, is_favorite: false };
        if (item.id === newItemId) return { ...item, is_favorite: true };
        return item;
      }));

      setSuccessMsg(language === 'es' ? 'Obra destacada actualizada correctamente.' : 'Featured item updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error updating featured item');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setIsSearching(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const normType = selectedItem ? (selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type) : '';
  const currentShelfItem = selectedItem ? shelfItems.find(x => x.external_id === selectedItem.external_id && x.item_type === selectedItem.item_type) : null;
  const isFavorite = Boolean(currentShelfItem?.is_favorite);

  const modalItem = React.useMemo(() => {
    if (!selectedItem) return null;
    if (selectedItem.item_type === 'guide' || selectedItem.item_type === 'user') {
      return selectedItem;
    }
    if (currentShelfItem) {
      return { ...selectedItem, ...currentShelfItem };
    }
    // If not in shelfItems, strip any stale shelf/tracking properties from previous sessions
    const clean: any = { ...selectedItem };
    delete clean.id;
    delete clean.tracking_list_id;
    delete clean.status;
    delete clean.completed_at;
    delete clean.is_favorite;
    return clean;
  }, [selectedItem, currentShelfItem]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Search Header Form */}
      <section className="glass-card" style={{ padding: '2rem 2.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2>{t('searchTitle')}</h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder={activeTab === 'all' 
                ? t('searchPlaceholder')
                : (language === 'es' ? `Buscar en ${getCategoryLabel(activeTab)}...` : `Search in ${getCategoryLabel(activeTab)}...`)}
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (val.trim() === '') {
                  setSubmittedQuery('');
                  setResults([]);
                }
              }}
              style={{ paddingLeft: '2.5rem', paddingRight: query ? '2.5rem' : '1rem' }}
            />
            <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                title={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                aria-label={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0,
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 2.5rem' }}>
            {isSearching ? '...' : t('searchButton')}
          </button>
        </form>

        {/* Permanent Category Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          WebkitOverflowScrolling: 'touch'
        }}>
          {sortFilterTabs([
            { value: 'all', label: language === 'es' ? 'Todo' : 'All' },
            { value: 'movie', label: language === 'es' ? 'Películas' : 'Movies' },
            { value: 'series', label: language === 'es' ? 'Series' : 'Shows' },
            { value: 'anime', label: 'Anime' },
            { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
            { value: 'comic', label: language === 'es' ? 'Cómics' : 'Comics' },
            { value: 'manga', label: 'Mangas' },
            { value: 'game', label: language === 'es' ? 'Juegos' : 'Games' },
            { value: 'user', label: language === 'es' ? 'Usuarios' : 'Users' },
            { value: 'guide', label: language === 'es' ? 'Guías' : 'Guides' }
          ], user?.category_order).map(tab => {
            const isSelected = activeTab === tab.value;
            const tabColor = tab.value === 'all' 
              ? 'var(--accent-primary)' 
              : tab.value === 'user' 
              ? 'var(--color-user, #ec4899)' 
              : `var(--color-${tab.value})`;
            const tabTextColor = tab.value === 'all' 
              ? '#ffffff' 
              : `var(--color-text-${tab.value})`;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabClick(tab.value as any)}
                className={`profile-category-tab ${isSelected ? 'selected' : ''}`}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  '--tab-color': tabColor,
                  '--tab-text': tabTextColor
                } as React.CSSProperties}
              >
                {getCategoryIcon(tab.value, { size: 14, color: isSelected ? tabTextColor : tabColor })}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {submittedQuery === '' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.25rem", position: "relative" }}>
            <button 
              onClick={() => setExploreSubTab('nuevo')}
              style={{
                fontSize: "1.05rem", fontWeight: exploreSubTab === 'nuevo' ? 700 : 500,
                color: exploreSubTab === 'nuevo' ? "var(--text-primary)" : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.4rem 0.2rem",
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.2s ease"
              }}
            >
              <Sparkles size={17} color={exploreSubTab === 'nuevo' ? "var(--accent-primary)" : "currentColor"} />
              <span>{t('exploreNew')}</span>
              {exploreSubTab === 'nuevo' && (
                <div style={{ position: "absolute", bottom: "-0.3rem", left: 0, right: 0, height: "2.5px", background: "var(--accent-primary)", borderRadius: "3px" }} />
              )}
            </button>

            <button 
              onClick={() => setExploreSubTab('tendencias')}
              style={{
                fontSize: "1.05rem", fontWeight: exploreSubTab === 'tendencias' ? 700 : 500,
                color: exploreSubTab === 'tendencias' ? "var(--text-primary)" : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.4rem 0.2rem",
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.2s ease"
              }}
            >
              <Flame size={17} color={exploreSubTab === 'tendencias' ? "#f97316" : "currentColor"} />
              <span>{t('exploreTrending')}</span>
              {exploreSubTab === 'tendencias' && (
                <div style={{ position: "absolute", bottom: "-0.3rem", left: 0, right: 0, height: "2.5px", background: "#f97316", borderRadius: "3px" }} />
              )}
            </button>

            <button 
              onClick={() => setExploreSubTab('guias')}
              style={{
                fontSize: "1.05rem", fontWeight: exploreSubTab === 'guias' ? 700 : 500,
                color: exploreSubTab === 'guias' ? "var(--text-primary)" : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.4rem 0.2rem",
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.2s ease"
              }}
            >
              <BookOpen size={17} color={exploreSubTab === 'guias' ? "var(--color-guide)" : "currentColor"} />
              <span>{t('exploreGuides')}</span>
              {exploreSubTab === 'guias' && (
                <div style={{ position: "absolute", bottom: "-0.3rem", left: 0, right: 0, height: "2.5px", background: "var(--color-guide)", borderRadius: "3px" }} />
              )}
            </button>
          </div>

          {exploreSubTab === 'guias' ? (
            <ExploreGuidesSection
              loading={loadingGuides}
              guidesData={guidesData}
              language={language}
              t={t}
              navigate={navigate}
            />
          ) : (
            <ExploreSection
              subTab={exploreSubTab}
              loading={loadingExplore}
              categories={filteredExploreCategories}
              language={language}
              currentUser={currentUser}
              onOpenItem={handleOpenItemDetails}
              getTagClass={getTagClass}
            />
          )}
        </div>
      ) : (
        <>

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Results Display */}
      {filteredResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {filteredResults.slice(0, visibleCount).map((item) => {
              return (
                <React.Fragment key={`${item.external_id}-${item.item_type}`}>
                  {(() => {
              if (item.item_type === 'user') {
                const isFollowing = followingUsers.some(u => String(u.id) === item.external_id);
                const isMe = currentUser && String(currentUser.id) === item.external_id;
                return (
                  <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/user/${encodeURIComponent(item.title || item.external_id)}`)}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <Users size={40} color="var(--accent-primary)" />
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 600 }}>{item.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'es' ? 'Usuario' : 'User'}
                      </span>
                    </div>
                    {!isMe && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollowUser(parseInt(item.external_id));
                        }}
                        className={isFollowing ? "btn-secondary" : "btn-primary"}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }}
                      >
                        {isFollowing 
                          ? (language === 'es' ? 'Siguiendo (Dejar)' : 'Following (Unfollow)') 
                          : (language === 'es' ? 'Seguir' : 'Follow')
                        }
                      </button>
                    )}
                  </div>
                );
              }

              if (item.item_type === 'guide') {
                const isSaved = savedGuides.some(g => String(g.id) === item.external_id);
                return (
                  <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookOpen size={18} color="var(--accent-primary)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'es' ? 'Guía Pública' : 'Public Guide'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.title}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {item.description}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/guide/${item.external_id}`)}
                        className="btn-primary"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem' }}
                      >
                        {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSaveGuide(parseInt(item.external_id), isSaved);
                        }}
                        className="btn-secondary"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem', color: isSaved ? 'var(--accent-primary)' : 'var(--text-primary)', borderColor: isSaved ? 'var(--accent-primary)' : 'var(--border-color)', background: isSaved ? 'rgba(124, 58, 237, 0.1)' : 'transparent' }}
                      >
                        {isSaved 
                          ? (language === 'es' ? 'Siguiendo' : 'Following') 
                          : (language === 'es' ? 'Seguir' : 'Follow')
                        }
                      </button>
                    </div>
                  </div>
                );
              }

              const shelfItem = shelfItems.find(x => x.external_id === item.external_id && x.item_type === item.item_type);
              const onShelf = Boolean(shelfItem);
              const itemTypeColor = `var(--color-${item.item_type || 'movie'})`;
              const itemTypeTextColor = `var(--color-text-${item.item_type || 'movie'})`;

              return (
                <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', position: 'relative' }} onClick={() => handleOpenItemDetails(item)} onMouseEnter={() => prefetchMediaDetails(item)}>

                  <div style={{ position: 'relative', width: '100%', height: '260px', borderRadius: '8px', overflow: 'hidden' }}>
                    <MediaPoster
                      src={item.image_url}
                      title={item.title}
                      itemType={item.item_type}
                      height="100%"
                      width="100%"
                      borderRadius="8px"
                    />
                    {renderMediaBadge(item.badge, language)}
                  </div>

                  {(() => {
                    const isComicIssue = item.item_type === 'comic' && (String(item.external_id || '').startsWith('cv_issue_') || item.badge === 'issue');
                    return (
                      <>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'left', paddingRight: (user && !isComicIssue) ? '36px' : 0 }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                            {item.title}
                          </h4>
                          {item.release_date && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              {formatReleaseDate(item.release_date)}
                            </div>
                          )}
                          {activeTab === 'all' && (
                            <span
                              className={getTagClass(item.item_type)}
                              style={{ 
                                alignSelf: 'flex-start', 
                                padding: '0.2rem 0.55rem', 
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                letterSpacing: 'normal'
                              }}
                            >
                              {getCategoryIcon(item.item_type, { size: 13, color: 'currentColor' })}
                              <span>{getSingleCategoryLabel(item.item_type)}</span>
                            </span>
                          )}
                        </div>

                        {user && !isComicIssue && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (shelfItem) {
                                const hasProgress = shelfItem.status !== 'plan_to_watch' && 
                                                    shelfItem.status !== 'plan_to_play' && 
                                                    shelfItem.status !== 'plan_to_read' && 
                                                    shelfItem.status !== 'untracked' && 
                                                    Boolean(shelfItem.status || shelfItem.completed_at || shelfItem.last_seen_episode || shelfItem.rating || shelfItem.consumption_count > 0 || shelfItem.total_time_spent > 0);
                                if (!hasProgress) {
                                  const previousShelf = shelfItems;
                                  setShelfItems(prev => prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type)));
                                  try {
                                    if (shelfItem.id && shelfItem.id > 0) {
                                      await apiClient.delete(`/library/${shelfItem.id}?delete_history=true`);
                                      const cleanId = String(shelfItem.external_id || shelfItem.id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '').replace('tvm-ep-', '').replace('tvm_', '');
                                      clearCachedSeriesMatching(`issue_state_`);
                                      if (cleanId) {
                                        removeCachedSeries(`comic_vol_${cleanId}`);
                                        removeCachedSeries(`series_${cleanId}`);
                                        removeCachedSeries(`${cleanId}_all_episodes`);
                                        removeCachedSeries(`${cleanId}_all_episodes_v2`);
                                        removeCachedSeries(`${cleanId}_metadata`);
                                      }
                                      if (shelfItem.tracking_list_id) {
                                        removeCachedSeries(`list_${shelfItem.tracking_list_id}`);
                                      }
                                      window.dispatchEvent(new CustomEvent('progress-updated', { detail: { deletedExternalId: shelfItem.external_id, deleteHistory: true } }));
                                      window.dispatchEvent(new Event('library-updated'));
                                    }
                                    setSuccessMsg(language === 'es' ? 'Elemento eliminado de tu estantería.' : 'Item removed from your shelf.');
                                    await loadShelfItems();
                                    setTimeout(() => setSuccessMsg(''), 3000);
                                  } catch (err: any) {
                                    setShelfItems(previousShelf);
                                    setErrorMsg(err.response?.data?.detail || 'Failed to remove item.');
                                    setTimeout(() => setErrorMsg(''), 4000);
                                  }
                                } else {
                                  setItemToRemoveFromShelf(shelfItem);
                                }
                              } else {
                                handleQuickAddToShelf(item, e);
                              }
                            }}
                            className={`btn-card-add-shelf ${onShelf ? 'on-shelf' : ''}`}
                            title={onShelf 
                              ? (language === 'es' ? 'Quitar de estantería' : 'Remove from shelf')
                              : (language === 'es' ? 'Agregar a estantería' : 'Add to shelf')
                            }
                            style={{
                              position: 'absolute',
                              bottom: '0.75rem',
                              right: '0.75rem',
                              width: '32px',
                              height: '32px',
                              '--category-color': itemTypeColor,
                              '--category-text-color': itemTypeTextColor,
                            } as React.CSSProperties}
                          >
                            <Plus size={18} />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
              })()}
              </React.Fragment>
              );
            })}
          </div>

          {/* Load More Centered Button */}
          {visibleCount < filteredResults.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + 24)}
                className="btn-secondary"
                style={{
                  padding: '0.65rem 2rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderRadius: '24px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {t('loadMoreResults')}
              </button>
            </div>
          )}
        </div>
      )}

      {results.length > 0 && filteredResults.length === 0 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {language === 'es' ? 'No se encontraron elementos en esta categoría.' : 'No items found in this category.'}
        </div>
      )}

      {results.length === 0 && !isSearching && submittedQuery && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('searchNoResults')}
        </div>
      )}
      </>
      )}

      {/* Remove From Shelf Confirmation Modal */}
      {itemToRemoveFromShelf && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setItemToRemoveFromShelf(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {language === 'es' ? '¿Quitar de la estantería?' : 'Remove from shelf?'}
              </h3>
              <button
                type="button"
                onClick={() => setItemToRemoveFromShelf(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {language === 'es'
                ? 'Elige cómo deseas remover esta obra de tu biblioteca:'
                : 'Choose how you would like to remove this item from your library:'
              }
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => handleConfirmRemoveFromShelf(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Trash2 size={16} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{language === 'es' ? 'Quitar conservando historial' : 'Remove keeping history'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    {language === 'es'
                      ? 'Se quita de tu biblioteca pero se mantienen tus visualizaciones y estadísticas'
                      : 'Removes from shelf but preserves your completions and statistics'
                    }
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmRemoveFromShelf(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Trash2 size={16} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{language === 'es' ? 'Quitar eliminando todo' : 'Remove deleting everything'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    {language === 'es'
                      ? 'Borra todo el progreso, historial de visualizaciones y calificaciones'
                      : 'Wipes all progress, completion history, and reviews'
                    }
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setItemToRemoveFromShelf(null)}
              style={{
                padding: '0.55rem',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Non-intrusive Explore / Search Bottom AdBanner */}
      <AdBanner />

      {selectedItem && (
        <ItemDetailsModal 
          item={modalItem || selectedItem}
          isOwnProfile={true}
          profileId={currentUser?.id}
          onClose={() => setSelectedItem(null)}
          onOpenItem={(item) => setSelectedItem(item)}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onUpdate={(updatedItem) => {
            if (updatedItem && updatedItem.id) {
              setResults(prev => prev.map(r => 
                r.item_type === selectedItem.item_type && r.external_id === selectedItem.external_id 
                ? { ...r, ...updatedItem } 
                : r
              ));
            } else {
              setResults(prev => prev.map(r => 
                r.item_type === selectedItem?.item_type && r.external_id === selectedItem?.external_id 
                ? { ...r, id: undefined, status: undefined, tracking_list_id: undefined, completed_at: undefined, is_favorite: false } 
                : r
              ));
            }
            // Re-fetch shelf items to reflect status/favorite changes
            loadShelfItems();
          }}
        />
      )}

      {/* Pro / Premium Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}

      {/* Replace Favorite Modal (Confirmation & 10/10 Selector) */}
      <ReplaceFavoriteModal
        isOpen={replaceModalState.isOpen}
        onClose={() => setReplaceModalState({ isOpen: false, newItem: null, currentFavorites: [] })}
        newItem={replaceModalState.newItem}
        currentFavorites={replaceModalState.currentFavorites}
        isPro={Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip)}
        onConfirmReplace={handleConfirmReplace}
        onOpenProModal={() => setShowProModal(true)}
      />

    </div>
  );
};
export default Search;

