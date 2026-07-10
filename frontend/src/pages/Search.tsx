import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Search as SearchIcon, AlertCircle, CheckCircle, Plus, X, Heart, Star, Users, BookOpen } from 'lucide-react';

interface SearchResultItem {
  external_id: string;
  title: string;
  image_url: string;
  description: string;
  item_type: 'game' | 'movie' | 'series' | 'comic' | 'manga' | 'book' | 'anime' | 'user' | 'guide';
  release_date?: string;
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

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game' | 'user' | 'guide'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Shelf tracking states
  const [shelfItems, setShelfItems] = useState<any[]>([]);
  const [selectedItemForShelf, setSelectedItemForShelf] = useState<SearchResultItem | null>(null);
  const [shelfStatus, setShelfStatus] = useState('');

  // Details Modal states
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [pagesReadVal, setPagesReadVal] = useState<number | ''>(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // TV Tracking states inside details modal
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [seasonNumber: number]: any[] }>({});
  const [isLoadingSeasonEpisodes, setIsLoadingSeasonEpisodes] = useState(false);

  // User & Guide search tracking
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [savedGuides, setSavedGuides] = useState<any[]>([]);

  const getCachedTMDB = (key: string) => {
    try {
      const item = localStorage.getItem(`tmdb_cache_${key}`);
      if (item) {
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp < 6 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch(e){}
    return null;
  };

  const setCachedTMDB = (key: string, data: any) => {
    try {
      localStorage.setItem(`tmdb_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch(e){}
  };

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
      const followingRes = await apiClient.get(`/users/${profileRes.data.id}/following`);
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    try {
      const response = await apiClient.get('/search/all', {
        params: { q: query }
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
        status: shelfStatus
      });
      setSuccessMsg(t('searchItemAdded'));
      setSelectedItemForShelf(null);
      await loadShelfItems();
      
      // If modal details is open, refresh its shelf state
      if (selectedItem && selectedItem.external_id === selectedItemForShelf.external_id) {
        const updatedShelf = await apiClient.get('/library/');
        const fresh = updatedShelf.data.find((x: any) => x.external_id === selectedItem.external_id && x.item_type === (selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type));
        if (fresh) {
          setPagesReadVal(fresh.pages_read || 0);
        }
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to your library shelf.');
    }
  };

  const findNextSeasonToSee = (itemsList: any[], seasonsList: any[]) => {
    const completed = itemsList.filter(ep => ep.is_completed);
    if (completed.length === 0) return 1;
    
    const sorted = [...completed].sort((a, b) => {
      const sA = parseInt(a.section?.match(/Season (\d+)/)?.[1] || '0');
      const sB = parseInt(b.section?.match(/Season (\d+)/)?.[1] || '0');
      if (sA !== sB) return sA - sB;
      const epA = parseInt(a.title?.match(/E(\d+)/)?.[1] || '0');
      const epB = parseInt(b.title?.match(/E(\d+)/)?.[1] || '0');
      if (epA !== epB) return epA - epB;
      return a.order_index - b.order_index;
    });
    
    const lastCompleted = sorted[sorted.length - 1];
    const lastSeasonNum = parseInt(lastCompleted.section?.match(/Season (\d+)/)?.[1] || '1');
    const lastEpisodeNum = parseInt(lastCompleted.title?.match(/E(\d+)/)?.[1] || '1');
    
    const seasonInfo = seasonsList.find(s => s.season_number === lastSeasonNum);
    const maxEpisodes = seasonInfo ? seasonInfo.episode_count : 0;
    
    if (lastEpisodeNum < maxEpisodes) {
      return lastSeasonNum;
    } else {
      const nextSeasonNum = lastSeasonNum + 1;
      const hasNextSeason = seasonsList.some(s => s.season_number === nextSeasonNum);
      return hasNextSeason ? nextSeasonNum : lastSeasonNum;
    }
  };

  const handleLoadSeasonEpisodes = async (seriesId: string, seasonNumber: number) => {
    if (seasonEpisodes[seasonNumber]) return;
    const cacheKey = `${seriesId}_s${seasonNumber}`;
    const cached = getCachedTMDB(cacheKey);
    if (cached) {
      setSeasonEpisodes(prev => ({
        ...prev,
        [seasonNumber]: cached
      }));
      return;
    }

    setIsLoadingSeasonEpisodes(true);
    try {
      const res = await apiClient.get(`/search/series/${seriesId}/season/${seasonNumber}`);
      setCachedTMDB(cacheKey, res.data);
      setSeasonEpisodes(prev => ({
        ...prev,
        [seasonNumber]: res.data || []
      }));
    } catch (err) {
      console.error("Failed to load season episodes", err);
    } finally {
      setIsLoadingSeasonEpisodes(false);
    }
  };

  const handleToggleEpisode = async (listId: number, ep: any) => {
    try {
      await apiClient.post(`/lists/${listId}/toggle-tmdb-episode`, {
        tmdb_episode_id: ep.id,
        title: ep.title || `${selectedItem?.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled Episode'}`,
        image_url: ep.image_url || (ep.still_path ? `https://image.tmdb.org/t/p/w185${ep.still_path}` : null),
        overview: ep.custom_notes || ep.overview,
        season_number: ep.season_number,
        episode_number: ep.episode_number
      });
      
      const listRes = await apiClient.get(`/lists/${listId}`);
      setEpisodes(listRes.data.items || []);
      await loadShelfItems();
    } catch (err) {
      console.error("Failed to toggle episode", err);
    }
  };

  const handleOpenItemDetails = async (item: SearchResultItem) => {
    setSelectedItem(item);
    setUserRating(0);
    setUserComment('');
    setItemReviews([]);
    setPagesReadVal(0);
    setSeasons([]);
    setEpisodes([]);
    setActiveSeason(null);
    setSeasonEpisodes({});

    const normType = item.item_type === 'anime' ? 'series' : item.item_type;
    const matchedShelf = shelfItems.find(x => x.external_id === item.external_id && x.item_type === normType);
    if (matchedShelf) {
      setPagesReadVal(matchedShelf.pages_read || 0);
    }

    try {
      const revRes = await apiClient.get(`/reviews/${normType}/${item.external_id}`);
      setItemReviews(revRes.data);
      const myRev = revRes.data.find((r: any) => r.is_own);
      if (myRev) {
        setUserRating(myRev.rating || 0);
        setUserComment(myRev.content || '');
      }
    } catch (err) {
      console.error("Failed to load item reviews", err);
    }

    if (item.item_type === 'series') {
      try {
        let filteredSeasons = [];
        const cacheKey = `series_${item.external_id}`;
        const cached = getCachedTMDB(cacheKey);
        if (cached) {
          filteredSeasons = cached;
        } else {
          const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
          filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
          setCachedTMDB(cacheKey, filteredSeasons);
        }
        setSeasons(filteredSeasons);

        if (matchedShelf && matchedShelf.tracking_list_id) {
          const listRes = await apiClient.get(`/lists/${matchedShelf.tracking_list_id}`);
          const itemsList = listRes.data.items || [];
          setEpisodes(itemsList);

          const nextSeason = findNextSeasonToSee(itemsList, filteredSeasons);
          setActiveSeason(nextSeason);

          const cacheKeyS = `${item.external_id}_s${nextSeason}`;
          const cachedS = getCachedTMDB(cacheKeyS);
          if (cachedS) {
            setSeasonEpisodes({ [nextSeason]: cachedS });
          } else {
            setIsLoadingSeasonEpisodes(true);
            apiClient.get(`/search/series/${item.external_id}/season/${nextSeason}`)
              .then(res => {
                setCachedTMDB(cacheKeyS, res.data);
                setSeasonEpisodes({ [nextSeason]: res.data || [] });
              })
              .catch(e => console.error(e))
              .finally(() => setIsLoadingSeasonEpisodes(false));
          }
        } else {
          setActiveSeason(1);
          const cacheKeyS = `${item.external_id}_s1`;
          const cachedS = getCachedTMDB(cacheKeyS);
          if (cachedS) {
            setSeasonEpisodes({ 1: cachedS });
          } else {
            setIsLoadingSeasonEpisodes(true);
            apiClient.get(`/search/series/${item.external_id}/season/1`)
              .then(res => {
                setCachedTMDB(cacheKeyS, res.data);
                setSeasonEpisodes({ 1: res.data || [] });
              })
              .catch(e => console.error(e))
              .finally(() => setIsLoadingSeasonEpisodes(false));
          }
        }
      } catch (e) {
        console.error("Failed to load TV series seasons", e);
      }
    }
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

  const handleRatingChange = async (newRating: number) => {
    if (!selectedItem) return;
    const normType = selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type;
    try {
      await apiClient.post(`/reviews/${normType}/${selectedItem.external_id}`, {
        rating: newRating,
        content: userComment || null
      });
      setUserRating(newRating);
      const revRes = await apiClient.get(`/reviews/${normType}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to save rating", err);
    }
  };

  const handleDeleteRating = async () => {
    if (!selectedItem) return;
    const normType = selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type;
    try {
      await apiClient.post(`/reviews/${normType}/${selectedItem.external_id}`, {
        rating: null,
        content: userComment || null
      });
      setUserRating(0);
      const revRes = await apiClient.get(`/reviews/${normType}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to clear rating", err);
    }
  };

  const handleSaveComment = async () => {
    if (!selectedItem) return;
    const normType = selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type;
    setIsSavingReview(true);
    try {
      await apiClient.post(`/reviews/${normType}/${selectedItem.external_id}`, {
        rating: userRating || null,
        content: userComment || null
      });
      const revRes = await apiClient.get(`/reviews/${normType}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
      alert(language === 'es' ? 'Comentario guardado con éxito.' : 'Comment saved successfully.');
    } catch (err) {
      console.error("Failed to save comment", err);
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleStatusChangeOnModal = async (itemId: number, newStatus: string) => {
    try {
      await apiClient.put(`/library/${itemId}`, { status: newStatus });
      await loadShelfItems();
    } catch (err) {
      console.error("Failed to change shelf status on modal", err);
    }
  };

  const handleToggleFavoriteOnModal = async (itemId: number, isFav: boolean) => {
    try {
      await apiClient.put(`/library/${itemId}`, { is_favorite: !isFav });
      await loadShelfItems();
    } catch (err) {
      console.error("Failed to toggle favorite on modal", err);
    }
  };

  const handleSavePagesRead = async (itemId: number, val: number) => {
    try {
      const res = await apiClient.put(`/library/${itemId}`, { pages_read: val });
      setPagesReadVal(res.data.pages_read);
      await loadShelfItems();
    } catch (err) {
      console.error("Failed to save pages read on modal", err);
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
        if (activeTab === 'anime') return item.item_type === 'anime';
        if (activeTab === 'series') return item.item_type === 'series';
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
  const currentShelfItem = selectedItem ? shelfItems.find(x => x.external_id === selectedItem.external_id && x.item_type === normType) : null;

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
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 2.5rem' }}>
            {isSearching ? '...' : t('searchButton')}
          </button>
        </form>
      </section>

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
            { value: 'anime', label: language === 'es' ? 'Animes' : 'Anime' },
            { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
            { value: 'comic', label: language === 'es' ? 'Cómics' : 'Comics' },
            { value: 'manga', label: language === 'es' ? 'Mangas' : 'Manga' },
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
                <div key={item.external_id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <div key={item.external_id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
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
                      style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem', color: isSaved ? '#ef4444' : 'var(--text-primary)', borderColor: isSaved ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)' }}
                    >
                      {isSaved 
                        ? (language === 'es' ? 'Dejar de seguir' : 'Unfollow') 
                        : (language === 'es' ? 'Seguir' : 'Follow')
                      }
                    </button>
                  </div>
                </div>
              );
            }

            const onShelf = shelfItems.some(x => x.external_id === item.external_id && x.item_type === (item.item_type === 'anime' ? 'series' : item.item_type));
            return (
              <div key={item.external_id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer' }} onClick={() => handleOpenItemDetails(item)}>
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150'}
                  alt={item.title}
                  style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                    {item.title}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '0.4rem' }}>
                    {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                  </span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, height: '3.2rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {stripHtml(item.description)}
                  </p>
                </div>

                {onShelf ? (
                  <div style={{ fontSize: '0.82rem', color: '#10b981', textAlign: 'center', padding: '0.4rem', fontWeight: 500 }}>
                    {language === 'es' ? '✓ En estantería' : '✓ On shelf'}
                  </div>
                ) : (
                  <button onClick={(e) => handleOpenAddShelf(item, e)} className="btn-secondary" style={{ width: '100%', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> {t('searchAddShelf')}
                  </button>
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

      {results.length === 0 && !isSearching && query && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('searchNoResults')}
        </div>
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
          zIndex: 2000
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

      {/* Item Details Overlay Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1.5rem'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.4rem' }}>{selectedItem.title}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('media' + selectedItem.item_type.charAt(0).toUpperCase() + selectedItem.item_type.slice(1))}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  onClick={() => setZoomedImage(selectedItem.image_url)}
                  style={{ width: '130px', height: '190px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                />
              )}
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '250px' }}>
                {/* Description */}
                <div>
                  <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    {language === 'es' ? 'Descripción:' : 'Description:'}
                  </h5>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, textAlign: 'left', maxHeight: '150px', overflowY: 'auto' }}>
                    {stripHtml(selectedItem.description) || (language === 'es' ? 'Sin descripción disponible.' : 'No description available.')}
                  </p>
                </div>

                {/* Release date */}
                {selectedItem.release_date && (
                  <div>
                    <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      {language === 'es' ? 'Fecha de lanzamiento:' : 'Release Date:'}
                    </h5>
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block', textAlign: 'left' }}>
                      {formatReleaseDate(selectedItem.release_date)}
                    </span>
                  </div>
                )}

                {/* Controls (Add to Shelf vs Shelf Controls) */}
                {currentShelfItem ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    {/* Favorite toggler */}
                    <div>
                      <button
                        onClick={() => handleToggleFavoriteOnModal(currentShelfItem.id, currentShelfItem.is_favorite)}
                        className="btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.8rem',
                          borderColor: currentShelfItem.is_favorite ? 'var(--accent-primary)' : 'var(--border-color)',
                          background: currentShelfItem.is_favorite ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                          color: currentShelfItem.is_favorite ? 'var(--accent-primary)' : 'var(--text-primary)'
                        }}
                      >
                        <Heart size={16} fill={currentShelfItem.is_favorite ? 'var(--accent-primary)' : 'none'} />
                        {currentShelfItem.is_favorite
                          ? (language === 'es' ? 'Destacado (Quitar)' : 'Featured (Remove)')
                          : (language === 'es' ? 'Destacar (Favorito)' : 'Feature (Favorite)')
                        }
                      </button>
                    </div>

                    {/* Status Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                      <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {language === 'es' ? 'Estado:' : 'Status:'}
                      </h5>
                      <select
                        className="input-field"
                        value={currentShelfItem.status || ''}
                        onChange={(e) => handleStatusChangeOnModal(currentShelfItem.id, e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', maxWidth: '200px' }}
                      >
                        {getStatusesForType(selectedItem.item_type).map(status => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pages Read (Books/Comics/Mangas) */}
                    {['book', 'comic', 'manga'].includes(normType) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                        <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {language === 'es' ? 'Páginas leídas:' : 'Pages read:'}
                        </h5>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="input-field"
                            value={pagesReadVal}
                            min={0}
                            onFocus={() => {
                              if (pagesReadVal === 0) setPagesReadVal('');
                            }}
                            onBlur={() => {
                              const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                              setPagesReadVal(finalVal);
                              handleSavePagesRead(currentShelfItem.id, finalVal);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                                setPagesReadVal(finalVal);
                                handleSavePagesRead(currentShelfItem.id, finalVal);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                              setPagesReadVal(val);
                            }}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', maxWidth: '120px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', alignItems: 'flex-start' }}>
                    <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {language === 'es' ? 'No está en tu estantería' : 'Not on your library shelf'}
                    </h5>
                    <button
                      onClick={() => handleOpenAddShelf(selectedItem)}
                      className="btn-primary"
                      style={{ padding: '0.4rem 1.2rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={16} /> {language === 'es' ? 'Agregar a la estantería' : 'Add to shelf'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* TV Series Season Accordion Tracking */}
            {selectedItem.item_type === 'series' && seasons.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {language === 'es' ? 'Seguimiento de Temporadas' : 'Season Tracking'}
                </h4>
                {!currentShelfItem && (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                    {language === 'es' 
                      ? 'Para marcar capítulos como vistos, primero debes añadir esta serie a tu estantería.' 
                      : 'To mark episodes as watched, you must first add this series to your shelf.'}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {seasons.map((s) => {
                    const isSeasonActive = activeSeason === s.season_number;
                    const isCompleted = currentShelfItem ? (() => {
                      const listSeps = episodes.filter(x => x.section === `Season ${s.season_number}`);
                      const cacheKey = `${selectedItem.external_id}_s${s.season_number}`;
                      const tmdbEps = getCachedTMDB(cacheKey) || [];
                      if (tmdbEps.length === 0) {
                        return listSeps.length > 0 && listSeps.every(x => x.is_completed);
                      }
                      return tmdbEps.every((te: any) => episodes.some(x => x.external_id === `tmdb-ep-${te.id}` && x.is_completed));
                    })() : false;

                    return (
                      <div key={s.id || s.season_number} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isSeasonActive) {
                              setActiveSeason(null);
                            } else {
                              setActiveSeason(s.season_number);
                              handleLoadSeasonEpisodes(selectedItem.external_id, s.season_number);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: 'var(--bg-secondary)',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              disabled={!currentShelfItem}
                              checked={isCompleted}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onChange={async (e) => {
                                e.stopPropagation();
                                if (!currentShelfItem) return;
                                const checkedVal = e.target.checked;
                                const cacheKey = `${selectedItem.external_id}_s${s.season_number}`;
                                const tmdbEps = getCachedTMDB(cacheKey);
                                
                                try {
                                  await apiClient.post(`/lists/${currentShelfItem.tracking_list_id}/bulk-toggle-season`, {
                                    season_number: s.season_number,
                                    episodes: tmdbEps || null,
                                    completed: checkedVal
                                  });
                                  
                                  const listRes = await apiClient.get(`/lists/${currentShelfItem.tracking_list_id}`);
                                  setEpisodes(listRes.data.items || []);
                                  await loadShelfItems();
                                } catch (err) {
                                  console.error("Bulk toggle failed", err);
                                }
                              }}
                              style={{ width: '16px', height: '16px', cursor: currentShelfItem ? 'pointer' : 'default', marginRight: '0.6rem', verticalAlign: 'middle' }}
                            />
                            {language === 'es' ? `Temporada ${s.season_number}` : `Season ${s.season_number}`}
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
                              ({s.episode_count} {language === 'es' ? 'capítulos' : 'episodes'})
                            </span>
                          </span>
                          <span>{isSeasonActive ? '▼' : '►'}</span>
                        </button>

                        {isSeasonActive && (
                          <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                            {isLoadingSeasonEpisodes ? (
                              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {language === 'es' ? 'Cargando capítulos...' : 'Loading episodes...'}
                              </div>
                            ) : (seasonEpisodes[s.season_number] || []).length === 0 ? (
                              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {language === 'es' ? 'No se encontraron capítulos.' : 'No episodes found.'}
                              </div>
                            ) : (
                              (seasonEpisodes[s.season_number] || []).map((ep: any) => {
                                const dbEp = episodes.find(x => x.external_id === `tmdb-ep-${ep.id}`);
                                const isEpCompleted = dbEp ? dbEp.is_completed : false;
                                return (
                                  <div key={ep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                      <input
                                        type="checkbox"
                                        disabled={!currentShelfItem}
                                        checked={isEpCompleted}
                                        onChange={async () => {
                                          if (currentShelfItem && currentShelfItem.tracking_list_id) {
                                            await handleToggleEpisode(currentShelfItem.tracking_list_id, ep);
                                          }
                                        }}
                                        style={{ width: '15px', height: '15px', cursor: currentShelfItem ? 'pointer' : 'default' }}
                                      />
                                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                        E{ep.episode_number}
                                      </span>
                                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ep.name}>
                                        {ep.name}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ratings and Comments section (Only if on shelf) */}
            {currentShelfItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
                {/* Rating */}
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                    {language === 'es' ? 'Tu Valoración:' : 'Your Rating:'}
                  </h5>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => handleRatingChange(star)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star
                          size={24}
                          fill={star <= userRating ? '#f59e0b' : 'none'}
                          color={star <= userRating ? '#f59e0b' : 'var(--text-muted)'}
                        />
                      </button>
                    ))}
                    {userRating > 0 && (
                      <button
                        onClick={handleDeleteRating}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', marginLeft: '0.75rem', padding: 0, textDecoration: 'underline' }}
                      >
                        {language === 'es' ? 'Eliminar puntuación' : 'Clear rating'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h5 style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {language === 'es' ? 'Tu Comentario:' : 'Your Comment:'}
                  </h5>
                  <textarea
                    className="input-field"
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    placeholder={language === 'es' ? 'Escribe tu opinión aquí...' : 'Write your opinion here...'}
                    style={{ width: '100%', minHeight: '80px', padding: '0.5rem 0.75rem', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSaveComment}
                      disabled={isSavingReview}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
                    >
                      {isSavingReview ? '...' : (language === 'es' ? 'Guardar Comentario' : 'Save Comment')}
                    </button>
                  </div>
                </div>

                {/* Community Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                  <h5 style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {language === 'es' ? 'Comentarios de la Comunidad:' : 'Community Comments:'}
                  </h5>
                  {itemReviews.filter(r => !r.is_own).length === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {language === 'es' ? 'No hay otros comentarios aún.' : 'No other comments yet.'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {itemReviews.filter(r => !r.is_own).map((rev: any) => (
                        <div key={rev.id} style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rev.username}</span>
                            {rev.rating && (
                              <div style={{ display: 'flex', gap: '0.1rem', alignItems: 'center' }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} size={12} fill={s <= rev.rating ? '#f59e0b' : 'none'} color={s <= rev.rating ? '#f59e0b' : 'var(--text-muted)'} />
                                ))}
                              </div>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{rev.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image zoom modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            cursor: 'zoom-out'
          }}
        >
          <img src={zoomedImage} alt="Zoomed" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
        </div>
      )}

    </div>
  );
};
export default Search;
