import { HorizontalScroll } from '../components/HorizontalScroll';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { MediaPoster } from '../components/MediaPoster';

import { Search as SearchIcon, AlertCircle, CheckCircle, Plus, X, Heart, Star, Users, BookOpen } from 'lucide-react';

interface SearchResultItem {
  external_id: string;
  title: string;
  image_url: string;
  description: string;
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book' | 'user' | 'guide' | 'comic' | 'manga';
  release_date?: string;
  imdb_id?: string;
  is_nsfw?: boolean;
  status?: string;
}

const stripHtml = (html: string) => {
  if (!html) return '';
  const clean = html.replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return txt.value;
};

export const Search: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'game' | 'user' | 'guide' | 'comic' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [exploreData, setExploreData] = useState<any>(null);
  const [loadingExplore, setLoadingExplore] = useState(false);

  const exploreCategories = React.useMemo(() => {
    const items = exploreData?.nuevo || [];
    if (items.length === 0) return [];

    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grouped[item.item_type]) grouped[item.item_type] = [];
      grouped[item.item_type].push(item);
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
      });
    });

    const categoryOrder = ['movie', 'series', 'anime', 'book', 'comic', 'manga', 'game'];
    return categoryOrder.map(type => ({
      type,
      title: type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
             type === 'series' ? 'Series' :
             type === 'anime' ? 'Anime' :
             type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
             type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') : 
             type === 'manga' ? 'Mangas' : 
             type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type,
      items: grouped[type] || []
    })).filter(g => g.items.length > 0);
  }, [exploreData, language]);
  const [selectedItemForShelf, setSelectedItemForShelf] = useState<SearchResultItem | null>(null);
  const [shelfStatus, setShelfStatus] = useState('');

  // Details Modal states
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
            const [zoomedImage, setZoomedImage] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    if (submittedQuery === '') {
      const fetchExplore = async () => {
        try {
          setLoadingExplore(true);
          const res = await apiClient.get('/search/explore/tabs');
          setExploreData(res.data);
        } catch (err) {
          console.error("Failed to load recommendations", err);
        } finally {
          setLoadingExplore(false);
        }
      };
      fetchExplore();
    }
  }, [submittedQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSubmittedQuery('');
      setResults([]);
      return;
    }

    setSubmittedQuery(cleanQuery);
    setIsSearching(true);
    setErrorMsg('');
    try {
      const response = await apiClient.get('/search/all', {
        params: { q: cleanQuery }
      });
      setResults(response.data);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setErrorMsg(t('errRateLimit'));
      } else {
        setErrorMsg(t('errSearchFailed'));
      }
      setResults([]);
    } finally {
      setIsSearching(false);
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

  const handleOpenAddShelf = (item: SearchResultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const defaultStatuses = getStatusesForType(item.item_type);
    setSelectedItemForShelf(item);
    setShelfStatus(defaultStatuses[0].value);
  };

  const handleAddToShelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForShelf || !shelfStatus) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.post('/library/', {
        item_type: selectedItemForShelf.item_type,
        external_id: selectedItemForShelf.external_id,
        title: selectedItemForShelf.title,
        image_url: selectedItemForShelf.image_url,
        imdb_id: selectedItemForShelf.imdb_id,
        status: shelfStatus
      });
      setSuccessMsg(t('searchItemAdded'));
      setSelectedItemForShelf(null);
      await loadShelfItems();
      
      // If modal details is open, refresh its shelf state
      if (selectedItem && selectedItem.external_id === selectedItemForShelf.external_id) {
        // Shelf is already reloaded via loadShelfItems() above.
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to your library shelf.');
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

  const normType = selectedItem ? (selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type) : '';
  const currentShelfItem = selectedItem ? shelfItems.find(x => x.external_id === selectedItem.external_id && x.item_type === selectedItem.item_type) : null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Search Header Form */}
      <section className="glass-card" style={{ padding: '2.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2>{t('searchTitle')}</h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (val.trim() === '') {
                  setSubmittedQuery('');
                  setResults([]);
                }
              }}
              style={{ paddingLeft: '2.5rem' }}
            />
            <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 2.5rem' }}>
            {isSearching ? '...' : t('searchButton')}
          </button>
        </form>
      </section>

      {submittedQuery === '' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
          
          <div style={{ display: "flex", gap: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", position: "relative" }}>
            <div 
              style={{
                fontSize: "1.1rem", fontWeight: 600,
                color: "var(--text-primary)",
                padding: "0.5rem 0", position: "relative"
              }}
            >
              {t('exploreNew')}
              <div style={{ position: "absolute", bottom: "-0.5rem", left: 0, right: 0, height: "2px", background: "var(--accent-primary)" }} />
            </div>
          </div>

          {loadingExplore ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
          ) : exploreCategories.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {exploreCategories.map(({ type, title, items }) => (
                <HorizontalScroll key={type} title={title}>
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="glass-card" style={{ minWidth: '200px', width: '200px', padding: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={() => handleOpenItemDetails(item)}>
                      <div style={{ position: 'relative', width: '100%', height: '280px', overflow: 'hidden', borderRadius: '8px' }}>
                        <MediaPoster
                          src={item.image_url}
                          title={item.title}
                          itemType={item.item_type}
                          height="100%"
                          width="100%"
                          borderRadius="8px"
                          isNsfw={item.is_nsfw}
                          showNsfw={currentUser?.show_nsfw}
                        />

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

                        {item.item_type && (
                          <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem' }}>
                            <span className={getTagClass(item.item_type)}>{item.item_type}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
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
          ) : (
            <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>{language === 'es' ? 'No hay elementos disponibles.' : 'No items available.'}</div>
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

      {/* Horizontal Scrollable Tabs */}
      {results.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { value: 'all', label: language === 'es' ? 'Todo' : 'All' },
            { value: 'movie', label: language === 'es' ? 'Películas' : 'Movies' },
            { value: 'series', label: language === 'es' ? 'Series' : 'Series' },
            { value: 'anime', label: 'Anime' },
            { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
            { value: 'comic', label: language === 'es' ? 'Cómics' : 'Comics' },
            { value: 'manga', label: 'Mangas' },
            { value: 'game', label: language === 'es' ? 'Juegos' : 'Games' },
            { value: 'user', label: language === 'es' ? 'Usuarios' : 'Users' },
            { value: 'guide', label: language === 'es' ? 'Guías' : 'Guides' }
          ].map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value as any)}
              style={{
                padding: '0.5rem 1.2rem',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: activeTab === tab.value ? 'var(--accent-primary)' : 'var(--border-color)',
                background: activeTab === tab.value ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === tab.value ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Search Results Display */}
      {filteredResults.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {filteredResults.map((item) => {
            if (item.item_type === 'user') {
              const isFollowing = followingUsers.some(u => String(u.id) === item.external_id);
              const isMe = currentUser && String(currentUser.id) === item.external_id;
              return (
                <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/profile?user_id=${item.external_id}`)}>
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

            const onShelf = shelfItems.some(x => x.external_id === item.external_id && x.item_type === item.item_type);
            return (
              <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', position: 'relative' }} onClick={() => handleOpenItemDetails(item)}>

                <div style={{ width: '100%', height: '260px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MediaPoster
                    src={item.image_url}
                    title={item.title}
                    itemType={item.item_type}
                    height="100%"
                    width="100%"
                    borderRadius="8px"
                    isNsfw={item.is_nsfw}
                    showNsfw={currentUser?.show_nsfw}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                    {item.title}
                  </h4>
                  {item.release_date && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {formatReleaseDate(item.release_date)}
                    </div>
                  )}
                  <span className={getTagClass(item.item_type)} style={{ marginBottom: '0.5rem', alignSelf: 'flex-start' }}>
                    {item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type === 'manga' ? 'Manga' : t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                  </span>
                </div>

                {onShelf && (
                  <div style={{ fontSize: '0.82rem', color: '#10b981', textAlign: 'center', padding: '0.4rem', fontWeight: 500 }}>
                    {language === 'es' ? '✓ En estantería' : '✓ On shelf'}
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Add To Shelf Overlay Modal */}
      {selectedItemForShelf && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2100
        }}>
          <div className="glass-card" style={{ width: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, textAlign: 'left' }}>{t('searchSelectStatus')}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
              {selectedItemForShelf.title}
            </p>

            <form onSubmit={handleAddToShelfSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <select
                className="input-field"
                value={shelfStatus}
                onChange={(e) => setShelfStatus(e.target.value)}
              >
                {getStatusesForType(selectedItemForShelf.item_type).map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedItemForShelf(null)}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" className="btn-primary">
                  {language === 'es' ? 'Agregar' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemDetailsModal 
          item={currentShelfItem ? { ...selectedItem, ...currentShelfItem } : selectedItem}
          isOwnProfile={true}
          profileId={currentUser?.id}
          onClose={() => setSelectedItem(null)}
          onOpenItem={(item) => setSelectedItem(item)}
          onUpdate={(updatedItem) => {
            if (updatedItem && updatedItem.is_nsfw !== undefined) {
              setResults(prev => prev.map(r => 
                r.item_type === selectedItem.item_type && r.external_id === selectedItem.external_id 
                ? { ...r, ...updatedItem } 
                : r
              ));
            }
            // Re-fetch shelf items to reflect status/favorite changes
            apiClient.get('/library/').then(res => setShelfItems(res.data));
          }}

        />
      )}

    </div>
  );
};
export default Search;

