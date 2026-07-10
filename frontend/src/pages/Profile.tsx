import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  BookOpen,
  Calendar,
  Grid,
  Heart,
  History,
  Trash2,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit,
  Star,
  X
} from 'lucide-react';

interface LibraryItem {
  id: number;
  item_type: 'game' | 'movie' | 'series' | 'comic' | 'manga' | 'book';
  external_id: string;
  title: string;
  image_url: string;
  status: string;
  is_favorite: boolean;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
  last_seen_episode?: string;
  tracking_list_id?: number;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  photo_url: string;
  is_admin: boolean;
  created_at: string;
  created_lists: any[];
  saved_lists: any[];
}

export const Profile: React.FC = () => {
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'game' | 'movie' | 'series' | 'book' | 'comic' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Viewer state for full list details
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // Shelf expansion & pagination states
  const [isShelfExpanded, setIsShelfExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');

  // Overlay modal states for shelf items details
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [seasonNumber: number]: any[] }>({});
  const [isLoadingSeasonEpisodes, setIsLoadingSeasonEpisodes] = useState(false);

  // Favorites state (local highlight mock for UX polish)
  const [favorites, setFavorites] = useState<LibraryItem[]>([]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    fetchProfileAndLibrary();
  }, []);

  const fetchProfileAndLibrary = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const profileRes = await apiClient.get('/users/me');
      setProfile(profileRes.data);

      const libraryRes = await apiClient.get('/library/');
      setLibraryItems(libraryRes.data);

      // Set favorites state from items explicitly marked as favorites
      const favs = libraryRes.data.filter((item: LibraryItem) => item.is_favorite);
      setFavorites(favs);

      // Fetch user activities
      const activityRes = await apiClient.get('/users/me/activity');
      setActivities(activityRes.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to fetch library information.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemId: number, newStatus: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.put(`/library/${itemId}`, { status: newStatus });
      setLibraryItems(prev => prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
      setSuccessMsg(language === 'es' ? 'Estado actualizado con éxito.' : 'Status updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Refresh activities
      const actRes = await apiClient.get('/users/me/activity');
      setActivities(actRes.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update item status.');
    }
  };
  const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
    try {
      await apiClient.put(`/library/${itemId}`, { is_favorite: !currentFav });
      setLibraryItems(prev => prev.map(item => item.id === itemId ? { ...item, is_favorite: !currentFav } : item));
      
      setFavorites(prev => {
        const item = libraryItems.find(li => li.id === itemId);
        if (!item) return prev;
        if (!currentFav) {
          return [...prev, { ...item, is_favorite: true }];
        } else {
          return prev.filter(li => li.id !== itemId);
        }
      });

      // Refresh activities
      const actRes = await apiClient.get('/users/me/activity');
      setActivities(actRes.data);
    } catch(err) {
      console.error(err);
    }
  };

  const findNextSeasonToSee = (items: any[]) => {
    const completed = items.filter(ep => ep.is_completed);
    if (completed.length === 0) return 1;
    
    const sorted = [...completed].sort((a, b) => {
      const sA = parseInt(a.section?.match(/Season (\d+)/)?.[1] || '0');
      const sB = parseInt(b.section?.match(/Season (\d+)/)?.[1] || '0');
      if (sA !== sB) return sA - sB;
      // Extract episode number if possible
      const epA = parseInt(a.title?.match(/E(\d+)/)?.[1] || '0');
      const epB = parseInt(b.title?.match(/E(\d+)/)?.[1] || '0');
      if (epA !== epB) return epA - epB;
      return a.order_index - b.order_index;
    });
    
    const lastCompleted = sorted[sorted.length - 1];
    const lastSeasonNum = parseInt(lastCompleted.section?.match(/Season (\d+)/)?.[1] || '1');
    
    const hasUncompletedInLastSeason = items.some(ep => {
      const sNum = parseInt(ep.section?.match(/Season (\d+)/)?.[1] || '0');
      return sNum === lastSeasonNum && !ep.is_completed;
    });
    
    if (hasUncompletedInLastSeason) {
      return lastSeasonNum;
    } else {
      return lastSeasonNum + 1;
    }
  };

  const handleLoadSeasonEpisodes = async (seriesId: string, seasonNumber: number) => {
    if (seasonEpisodes[seasonNumber]) return;
    setIsLoadingSeasonEpisodes(true);
    try {
      const res = await apiClient.get(`/search/series/${seriesId}/season/${seasonNumber}`);
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

  const handleOpenItemDetails = async (item: any) => {
    setSelectedItem(item);
    setUserRating(0);
    setUserComment('');
    setItemReviews([]);
    setDescExpanded(false);

    if (item.item_type === 'series' && item.tracking_list_id) {
      try {
        const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
        const itemsList = listRes.data.items || [];
        setEpisodes(itemsList);
        setSeasonEpisodes({});
        
        const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
        const filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
        setSeasons(filteredSeasons);

        const nextSeason = findNextSeasonToSee(itemsList);
        setActiveSeason(nextSeason);
        handleLoadSeasonEpisodes(item.external_id, nextSeason);
      } catch (err) {
        console.error("Failed to fetch episodes", err);
      }
    } else {
      setEpisodes([]);
      setSeasons([]);
    }

    try {
      const res = await apiClient.get(`/reviews/${item.item_type}/${item.external_id}`);
      setItemReviews(res.data);
      
      if (profile) {
        const myReview = res.data.find((r: any) => r.user_id === profile.id);
        if (myReview) {
          setUserRating(myReview.rating || 0);
          setUserComment(myReview.content || '');
        }
      }
    } catch(e) {
      console.error(e);
    }

    apiClient.get('/search/', { params: { q: item.title, type: item.item_type } })
      .then(searchRes => {
        const match = searchRes.data.find((x: any) => x.external_id === item.external_id);
        if (match && match.description) {
          setSelectedItem((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              custom_notes: JSON.stringify({ description: match.description })
            };
          });
        }
      })
      .catch(e => console.error(e));
  };

  const handleSaveRating = async (ratingVal: number) => {
    if (!selectedItem) return;
    setUserRating(ratingVal);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: ratingVal,
        content: userComment || null
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to save rating", err);
    }
  };

  const handleDeleteRating = async () => {
    if (!selectedItem) return;
    setUserRating(0);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: null,
        content: userComment || null
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to delete rating", err);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedItem) return;
    setIsSavingReview(true);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: userRating || null,
        content: userComment || null
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
      alert(language === 'es' ? 'Comentario guardado con éxito.' : 'Comment saved successfully.');
    } catch(err) {
      console.error(err);
      alert(language === 'es' ? 'Error al guardar el comentario.' : 'Failed to save comment.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleToggleEpisode = async (listId: number, ep: any) => {
    try {
      await apiClient.post(`/lists/${listId}/toggle-tmdb-episode`, {
        tmdb_episode_id: ep.id,
        title: `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled Episode'}`,
        image_url: ep.still_path ? `https://image.tmdb.org/t/p/w185${ep.still_path}` : null,
        overview: ep.overview,
        season_number: ep.season_number,
        episode_number: ep.episode_number
      });
      
      const listRes = await apiClient.get(`/lists/${listId}`);
      setEpisodes(listRes.data.items || []);
      
      const libraryRes = await apiClient.get('/library/');
      setLibraryItems(libraryRes.data);
      
      const actRes = await apiClient.get('/users/me/activity');
      setActivities(actRes.data);
    } catch (err) {
      console.error("Failed to toggle episode", err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm(language === 'es' ? '¿Seguro que deseas eliminar este elemento?' : 'Are you sure you want to delete this item?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.delete(`/library/${itemId}`);
      setLibraryItems(prev => prev.filter(item => item.id !== itemId));
      setSuccessMsg(language === 'es' ? 'Elemento eliminado de la estantería.' : 'Item removed from shelf.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to delete item.');
    }
  };
  const handleOpenGuide = (guideId: number) => {
    navigate(`/guide/${guideId}`);
  };


  const handleDeleteGuide = async (listId: number) => {
    if (!window.confirm(language === 'es' ? '¿Estás seguro de que deseas eliminar esta guía?' : 'Are you sure you want to delete this guide?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.delete(`/lists/${listId}`);
      
      // Update local profile list
      setProfile((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          created_lists: (prev.created_lists || []).filter((l: any) => l.id !== listId),
          saved_lists: (prev.saved_lists || []).filter((l: any) => l.id !== listId)
        };
      });

      setSuccessMsg(language === 'es' ? 'Guía eliminada con éxito.' : 'Guide deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'No se pudo eliminar la guía.' : 'Failed to delete guide.');
    }
  };
  // Get allowed statuses based on item type
  const getAllowedStatuses = (type: string) => {
    if (type === 'game') {
      return [
        { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
        { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
        { value: 'completed', label: language === 'es' ? 'Terminado' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (type === 'movie') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'completed', label: language === 'es' ? 'Visto' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (type === 'series') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'watching', label: language === 'es' ? 'Viendo' : 'Watching' },
        { value: 'completed', label: language === 'es' ? 'Terminada' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    // comic, manga, book
    return [
      { value: 'plan_to_read', label: language === 'es' ? 'Por Leer' : 'Plan to Read' },
      { value: 'reading', label: language === 'es' ? 'Leyendo' : 'Reading' },
      { value: 'read', label: language === 'es' ? 'Leído' : 'Read' },
      { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
    ];
  };



  const filteredItems = libraryItems
    .filter(item => {
      const matchesMedia = mediaFilter === 'all' || item.item_type === mediaFilter;
      const matchesSearch = item.title.toLowerCase().includes(shelfSearchQuery.toLowerCase());
      const isEp = item.external_id?.startsWith('tmdb-ep-');
      return matchesMedia && matchesSearch && !isEp;
    })
    .sort((a, b) => {
      const dateA = new Date(a.completed_at || a.updated_at || 0).getTime();
      const dateB = new Date(b.completed_at || b.updated_at || 0).getTime();
      return dateB - dateA;
    });

  const isFavorite = selectedItem && libraryItems.some(li =>
    li.item_type === selectedItem.item_type &&
    li.external_id === selectedItem.external_id &&
    li.is_favorite
  );

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando información...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px', margin: '0 auto', padding: '2rem 0' }}>
      
      {/* Profile Header Card */}
      {profile && (
        <div className="glass-card" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', padding: '2.5rem' }}>
          <img
            src={profile.photo_url}
            alt={profile.username}
            style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid var(--accent-primary)', boxShadow: 'var(--shadow-md)' }}
          />
          <div style={{ flex: 1, minWidth: 250, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{profile.username}</h1>
              {profile.is_admin && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ADMIN
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} /> {language === 'es' ? 'Miembro desde' : 'Joined'} {formatDate(new Date(profile.created_at))}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
              <span><strong>0</strong> {language === 'es' ? 'Seguidores' : 'Followers'}</span>
              <span><strong>0</strong> {language === 'es' ? 'Seguidos' : 'Following'}</span>
              <span><strong>{libraryItems.length}</strong> {language === 'es' ? 'En Estantería' : 'On Shelf'}</span>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('shelf')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'shelf' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'shelf' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'shelf' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Grid size={18} /> {language === 'es' ? 'Estantería' : 'My Shelf'}
        </button>

        <button
          onClick={() => setActiveTab('guides')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'guides' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'guides' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'guides' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <BookOpen size={18} /> {language === 'es' ? 'Mis Guías' : 'My Guides'}
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'favorites' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'favorites' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'favorites' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Heart size={18} /> {language === 'es' ? 'Destacados' : 'Favorites'}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'shelf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Media Filter Selectors & Search Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(() => {
                const baseTypes = ['all', 'movie', 'series', 'book', 'comic', 'manga', 'game'] as const;
                const allowedTypes = baseTypes.filter(type => {
                  if (type === 'all') return true;
                  return libraryItems.some(item => item.item_type === type);
                });
                return allowedTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setMediaFilter(type)}
                    className={mediaFilter === type ? 'btn-primary' : 'btn-secondary'}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.85rem',
                      textTransform: 'capitalize'
                    }}
                  >
                    {t('media' + type.charAt(0).toUpperCase() + type.slice(1))}
                  </button>
                ));
              })()}
            </div>
            
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <input
                type="text"
                className="input-field"
                value={shelfSearchQuery}
                onChange={(e) => {
                  setShelfSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={language === 'es' ? 'Buscar en mi estantería...' : 'Search my shelf...'}
                style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'No hay elementos en esta categoría.' : 'No items found in this category.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Expand / Collapse Control */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setIsShelfExpanded(!isShelfExpanded);
                    setCurrentPage(1);
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  {isShelfExpanded
                    ? (language === 'es' ? 'Contraer' : 'Collapse')
                    : (language === 'es' ? 'Expandir' : 'Expand')
                  }
                </button>
              </div>

              {/* Grid of cards */}
              {(() => {
                const itemsPerRow = 5;
                const itemsPerPage = 15;
                const displayedItems = isShelfExpanded
                  ? filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  : filteredItems.slice(0, itemsPerRow);

                return (
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '1.5rem'
                    }}>
                      {displayedItems.map(item => (
                        <div key={item.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => handleOpenItemDetails(item)}>
                            <img
                              src={item.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150'}
                              alt={item.title}
                              style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '8px' }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(item.id, item.is_favorite);
                              }}
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'rgba(9, 9, 12, 0.75)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: item.is_favorite ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                transition: 'transform 0.2s ease'
                              }}
                              title={language === 'es' ? 'Destacar' : 'Favorite'}
                            >
                              <Heart size={16} fill={item.is_favorite ? 'var(--accent-primary)' : 'none'} />
                            </button>
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleOpenItemDetails(item)}>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                              {item.title}
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                              {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                            </span>
                          </div>

                          {/* Last completed episode for series */}
                          {item.item_type === 'series' && item.last_seen_episode && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 500, display: 'block', marginTop: '-0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.last_seen_episode}>
                              {language === 'es' ? 'Último visto: ' : 'Last watched: '}
                              {item.last_seen_episode}
                            </span>
                          )}

                          {/* Completion date if completed */}
                          {item.completed_at && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block', marginTop: '-0.3rem' }}>
                              {item.item_type === 'movie'
                                ? (language === 'es' ? 'Visto: ' : 'Watched: ')
                                : (language === 'es' ? 'Terminado: ' : 'Completed: ')
                              }
                              {formatDate(new Date(item.completed_at))}
                            </span>
                          )}

                          {/* Status selection */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <select
                              className="input-field"
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                            >
                              {getAllowedStatuses(item.item_type).map(status => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="btn-secondary"
                              style={{
                                padding: '0.25rem',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                color: '#ef4444',
                                background: 'transparent',
                                border: 'none'
                              }}
                            >
                              <Trash2 size={14} /> {language === 'es' ? 'Quitar' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination controls */}
                    {isShelfExpanded && filteredItems.length > itemsPerPage && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="btn-secondary"
                          disabled={currentPage === 1}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                        >
                          {language === 'es' ? 'Anterior' : 'Previous'}
                        </button>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {language === 'es'
                            ? `Página ${currentPage} de ${Math.ceil(filteredItems.length / itemsPerPage)}`
                            : `Page ${currentPage} of ${Math.ceil(filteredItems.length / itemsPerPage)}`
                          }
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredItems.length / itemsPerPage)))}
                          className="btn-secondary"
                          disabled={currentPage * itemsPerPage >= filteredItems.length}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                        >
                          {language === 'es' ? 'Siguiente' : 'Next'}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'guides' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
          <div>
            <h3>{language === 'es' ? 'Guías Creadas' : 'Created Guides'}</h3>
            {profile.created_lists.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Aún no has creado ninguna guía.' : 'You have not created any guides yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {profile.created_lists.map((list: any) => (
                  <div key={list.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{list.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>{list.description}</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                        {list.visibility}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      <button onClick={() => navigate(`/create?edit=${list.id}`)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Edit size={14} /> {language === 'es' ? 'Editar' : 'Edit'}
                      </button>
                      <button onClick={() => handleDeleteGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <Trash2 size={14} /> {language === 'es' ? 'Eliminar' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3>{language === 'es' ? 'Guías Guardadas' : 'Saved Guides'}</h3>
            {profile.saved_lists.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Aún no tienes guías guardadas.' : 'You have no saved guides yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {profile.saved_lists.map((list: any) => (
                  <div key={list.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{list.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>{list.description}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          <h3>{language === 'es' ? 'Mis Obras Destacadas' : 'My Featured Favorites'}</h3>
          {favorites.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'Marca obras en tu estantería como "Terminado" para destacarlas aquí.' : 'Mark items on your shelf as "Completed" to highlight them here.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
              {favorites.map(item => (
                <div
                  key={item.id}
                  className="glass-card"
                  onClick={() => handleOpenItemDetails(item)}
                  style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', cursor: 'pointer' }}
                >
                  <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(124,58,237,0.9)', padding: '0.3rem', borderRadius: '50%', display: 'flex' }}>
                    <Heart size={16} fill="white" color="white" />
                  </div>
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <h4>{item.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History log mockup in footer to meet spec */}
      {/* History log in footer */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem', textAlign: 'left' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <History size={20} /> {language === 'es' ? 'Historial de Actividad' : 'Activity History'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activities.length === 0 ? (
            <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem' }}>
              <CheckCircle size={16} color="#10b981" />
              <div>
                <span>{language === 'es' ? 'Creaste tu cuenta de TrackerLists.' : 'Created your TrackerLists account.'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '1rem' }}>
                  {profile ? formatDate(new Date(profile.created_at)) : formatDate(new Date())}
                </span>
              </div>
            </div>
          ) : (
            activities.map((act) => {
              const getStatusLabel = (status: string) => {
                const all = [
                  { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
                  { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
                  { value: 'completed', label: language === 'es' ? 'Terminado / Visto' : 'Completed / Watched' },
                  { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' },
                  { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
                  { value: 'watching', label: language === 'es' ? 'Viendo' : 'Watching' },
                  { value: 'plan_to_read', label: language === 'es' ? 'Por Leer' : 'Plan to Read' },
                  { value: 'reading', label: language === 'es' ? 'Leyendo' : 'Reading' },
                  { value: 'read', label: language === 'es' ? 'Leído' : 'Read' }
                ];
                return all.find(s => s.value === status)?.label || status;
              };

              let msg = '';
              if (act.activity_type === 'shelf_add') {
                msg = language === 'es' 
                  ? `Agregaste "${act.item_title}" a tu estantería como "${getStatusLabel(act.details)}".`
                  : `Added "${act.item_title}" to shelf as "${getStatusLabel(act.details)}".`;
              } else if (act.activity_type === 'shelf_status') {
                msg = language === 'es'
                  ? `Cambiaste el estado de "${act.item_title}" a "${getStatusLabel(act.details)}".`
                  : `Changed status of "${act.item_title}" to "${getStatusLabel(act.details)}".`;
              } else if (act.activity_type === 'shelf_favorite') {
                msg = language === 'es'
                  ? (act.details === 'starred' ? `Destacaste "${act.item_title}".` : `Quitaste de destacados a "${act.item_title}".`)
                  : (act.details === 'starred' ? `Featured "${act.item_title}".` : `Removed "${act.item_title}" from featured.`);
              } else if (act.activity_type === 'item_completed') {
                msg = language === 'es'
                  ? `Marcaste "${act.item_title}" como completado.`
                  : `Marked "${act.item_title}" as completed.`;
              } else {
                msg = `${act.activity_type} - ${act.item_title}`;
              }

              return (
                <div key={act.id} className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem' }}>
                  <CheckCircle size={16} color="#10b981" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>{msg}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {formatDate(new Date(act.created_at))}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Standalone Item Details Modal (at the top) */}
      {selectedItem && (() => {
        const isEpisode = !!(selectedItem.external_id?.startsWith('tmdb-ep-') || selectedItem.list_id);
        const ratings = itemReviews.filter(r => r.rating !== null && r.rating !== 0).map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null;
        return (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000
            }}
          >
            <div
              className="glass-card"
              style={{
                width: '650px',
                maxHeight: '90vh',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto',
                textAlign: 'left'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {isEpisode && (
                    <button
                      onClick={async () => {
                        const mainSeriesItem = libraryItems.find(li => li.tracking_list_id === selectedItem.list_id);
                        if (mainSeriesItem) {
                          handleOpenItemDetails(mainSeriesItem);
                        } else {
                          // Try searching by name if no tracking_list_id matches directly
                          setSelectedItem(null);
                        }
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center' }}
                    >
                      &larr; {language === 'es' ? 'Volver' : 'Back'}
                    </button>
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{selectedItem.title}</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {t('media' + selectedItem.item_type.charAt(0).toUpperCase() + selectedItem.item_type.slice(1))}
                      </span>
                      {avgRating && (
                        <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                          ★ {avgRating} / 5 ({ratings.length} {language === 'es' ? 'val.' : 'ratings'})
                        </span>
                      )}
                      {selectedItem.completed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          • {selectedItem.item_type === 'movie' || selectedItem.item_type === 'series'
                            ? (language === 'es' ? 'Visto el: ' : 'Watched on: ')
                            : (language === 'es' ? 'Terminado el: ' : 'Completed on: ')
                          }
                          {formatDate(new Date(selectedItem.completed_at))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Info */}
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
                  {/* Description info */}
                  {(() => {
                    const parseNotes = (notes: string) => {
                      try {
                        if (notes.startsWith('{')) return JSON.parse(notes);
                      } catch(e){}
                      return { description: notes, sub_items: [] };
                    };
                    const stripHtml = (html: string) => {
                      if (!html) return '';
                      const clean = html.replace(/<[^>]*>/g, '');
                      const txt = document.createElement('textarea');
                      txt.innerHTML = clean;
                      return txt.value;
                    };
                    const notes = parseNotes(selectedItem.custom_notes || '');
                    if (!notes.description) return null;
                    const cleanText = stripHtml(notes.description);
                    const shouldTruncate = cleanText.length > 180;
                    const displayedText = shouldTruncate && !descExpanded
                      ? cleanText.slice(0, 180) + '...'
                      : cleanText;

                    return (
                      <div>
                        <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Descripción:' : 'Description:'}</h5>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                          {displayedText}
                          {shouldTruncate && (
                            <button
                              onClick={() => setDescExpanded(!descExpanded)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                marginLeft: '0.4rem',
                                padding: 0
                              }}
                            >
                              {descExpanded
                                ? (language === 'es' ? 'Leer menos' : 'Read less')
                                : (language === 'es' ? 'Leer más' : 'Read more')
                              }
                            </button>
                          )}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Star rating selector */}
                  <div>
                    <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Tu Calificación:' : 'Your Rating:'}</h5>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleSaveRating(star)}
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
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            marginLeft: '0.75rem',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          {language === 'es' ? 'Eliminar puntuación' : 'Clear rating'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Favorite toggler */}
                  {!isEpisode && (
                    <div>
                      <button
                        onClick={() => handleToggleFavorite(selectedItem.id, isFavorite)}
                        className="btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.8rem',
                          borderColor: isFavorite ? 'var(--accent-primary)' : 'var(--border-color)',
                          background: isFavorite ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                          color: isFavorite ? 'var(--accent-primary)' : 'var(--text-primary)'
                        }}
                      >
                        <Heart size={16} fill={isFavorite ? 'var(--accent-primary)' : 'none'} />
                        {isFavorite
                          ? (language === 'es' ? 'Destacado (Quitar)' : 'Featured (Remove)')
                          : (language === 'es' ? 'Destacar (Favorito)' : 'Feature (Favorite)')
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* TV Series Season Accordion Tracking */}
              {selectedItem.item_type === 'series' && seasons.length > 0 && !isEpisode && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {language === 'es' ? 'Seguimiento de Temporadas' : 'Season Tracking'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {seasons.map((s) => {
                      const isSeasonActive = activeSeason === s.season_number;
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
                            <span>
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
                                  const isCompleted = !!dbEp?.is_completed;
                                  return (
                                    <div
                                      key={ep.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.4rem 0.6rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        gap: '1rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <input
                                          type="checkbox"
                                          checked={isCompleted}
                                          onChange={() => handleToggleEpisode(selectedItem.tracking_list_id, ep)}
                                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                          {ep.episode_number}. {ep.name || 'Untitled'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleOpenItemDetails({
                                          id: dbEp ? dbEp.id : ep.id,
                                          list_id: selectedItem.tracking_list_id,
                                          item_type: 'series',
                                          external_id: `tmdb-ep-${ep.id}`,
                                          title: `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled'}`,
                                          image_url: ep.still_path ? `https://image.tmdb.org/t/p/w185${ep.still_path}` : selectedItem.image_url,
                                          custom_notes: ep.overview,
                                          completed_at: dbEp?.completed_at
                                        })}
                                        className="btn-secondary"
                                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.74rem' }}
                                      >
                                        {language === 'es' ? 'Ver Info' : 'View Info'}
                                      </button>
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

              {/* Comment write area */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'es' ? 'Escribe tu reseña o comentario' : 'Write your review or comment'}</h4>
                <textarea
                  className="input-field"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder={language === 'es' ? '¿Qué te pareció este elemento? Escribe aquí...' : 'What did you think of this item? Write here...'}
                  style={{ width: '100%', minHeight: '80px', padding: '0.75rem', background: 'var(--bg-secondary)', resize: 'vertical' }}
                />
                <button
                  onClick={handleSaveReview}
                  className="btn-primary"
                  disabled={isSavingReview}
                  style={{ alignSelf: 'flex-end', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  {isSavingReview
                    ? (language === 'es' ? 'Guardando...' : 'Saving...')
                    : (language === 'es' ? 'Guardar Valoración' : 'Save Review')
                  }
                </button>
              </div>

              {/* Community Reviews List */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'es' ? 'Comentarios de la Comunidad' : 'Community Comments'}</h4>
                {itemReviews.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {language === 'es' ? 'Nadie ha comentado sobre esto aún.' : 'No comments on this item yet.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {itemReviews.map((rev: any) => (
                      <div key={rev.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>{rev.username}</span>
                          {rev.rating && (
                            <div style={{ display: 'flex', gap: '0.1rem' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={12}
                                  fill={star <= rev.rating ? '#f59e0b' : 'none'}
                                  color={star <= rev.rating ? '#f59e0b' : 'var(--text-muted)'}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {rev.content && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                            {rev.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Image Zoom Modal */}
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
          <img
            src={zoomedImage}
            alt="Zoomed preview"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

    </div>
  );
};
export default Profile;
