import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { ItemDetailsModal } from '../components/ItemDetailsModal';

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
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book';
  external_id: string;
  title: string;
  image_url: string;
  status: string;
  is_favorite: boolean;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
  last_seen_episode?: string;
  pages_read?: number;
  tracking_list_id?: number;
}

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
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user_id');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'game' | 'movie' | 'series' | 'anime' | 'book'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !userIdParam || String(profile?.id) === String(currentUser?.id);

  useEffect(() => {
    if (libraryItems.length > 0) {
      const openItemId = searchParams.get('openItem');
      if (openItemId && !selectedItem) {
        const itemToOpen = libraryItems.find(item => item.id.toString() === openItemId);
        if (itemToOpen) {
          handleOpenItemDetails(itemToOpen);
        }
      }
    }
  }, [libraryItems, searchParams]);

  // Viewer state for full list details
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // Shelf expansion & pagination states
  const [isShelfExpanded, setIsShelfExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');

  // Overlay modal states for shelf items details
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
                        
  // Favorites state (local highlight mock for UX polish)
  const [favorites, setFavorites] = useState<LibraryItem[]>([]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatReleaseDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (/^\d{4}$/.test(dateStr)) return dateStr;
    try {
      const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return formatDate(date);
        }
      }
      const date = new Date(cleanStr + 'T00:00:00');
      if (isNaN(date.getTime())) return dateStr;
      return formatDate(date);
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    fetchProfileAndLibrary();
  }, []);

  const fetchProfileAndLibrary = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const meRes = await apiClient.get('/users/me');
      setCurrentUser(meRes.data);

      const targetProfileUrl = userIdParam ? `/users/profile/${userIdParam}` : '/users/me';
      const profileRes = await apiClient.get(targetProfileUrl);
      setProfile(profileRes.data);

      const targetLibraryUrl = userIdParam ? `/library/?user_id=${userIdParam}` : '/library/';
      const libraryRes = await apiClient.get(targetLibraryUrl);
      setLibraryItems(libraryRes.data);

      // Set favorites state from items explicitly marked as favorites
      const favs = libraryRes.data.filter((item: LibraryItem) => item.is_favorite);
      setFavorites(favs);

      // Fetch user activities
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const activityRes = await apiClient.get(targetActivityUrl);
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
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
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
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
      setActivities(actRes.data);
    } catch(err) {
      console.error(err);
    }
  };

  const handleOpenItemDetails = (item: any) => {
    setSelectedItem(item);
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm(language === 'es' ? '¿Seguro que deseas eliminar este elemento?' : 'Are you sure you want to delete this item?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.delete(`/library/${itemId}`);
      setLibraryItems(prev => prev.filter(item => item.id !== itemId));
      setSuccessMsg(language === 'es' ? 'Elemento eliminado de la estantería.' : 'Item removed from shelf.');
      
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
      setActivities(actRes.data);
      
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

      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
      setActivities(actRes.data);

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
      let matchesMedia = false;
      if (mediaFilter === 'all') matchesMedia = true;
      else if (mediaFilter === 'series') matchesMedia = item.item_type === 'series';
      else if (mediaFilter === 'anime') matchesMedia = item.item_type === 'anime';
      else matchesMedia = item.item_type === mediaFilter;
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

  const visualLibraryItems = libraryItems.filter(item => !item.external_id?.startsWith('tmdb-ep-'));

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
              <span><strong>{visualLibraryItems.length}</strong> {language === 'es' ? 'En Estantería' : 'On Shelf'}</span>
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
                const baseTypes = ['all', 'movie', 'series', 'anime', 'book', 'comic', 'manga', 'game'] as const;
                const allowedTypes = baseTypes.filter(type => {
                  if (type === 'all') return true;
                  if (type === 'series') return libraryItems.some(item => item.item_type === 'series');
                  if (type === 'anime') return libraryItems.some(item => item.item_type === 'anime');
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
                    {type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : type === 'manga' ? 'Manga' : t('media' + type.charAt(0).toUpperCase() + type.slice(1))}
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
                            {mediaFilter === 'all' && (item.item_type === 'comic' || item.item_type === 'manga' || item.item_type === 'book' || item.item_type === 'anime') && (
                              <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'var(--accent-primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, zIndex: 10, textTransform: 'uppercase' }}>
                                {item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type}
                              </div>
                            )}
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
                              {item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type === 'manga' ? 'Manga' : t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                            </span>
                            {/* Last completed episode for series */}
                            {(item.item_type === 'series' || item.item_type === 'anime') && item.last_seen_episode && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '-0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.last_seen_episode}>
                                {item.last_seen_episode.includes(' - ') ? item.last_seen_episode.split(' - ').slice(1).join(' - ') : item.last_seen_episode}
                              </span>
                            )}

                            {/* Pages read for books, comics, mangas */}
                            {['book', 'comic', 'manga'].includes(item.item_type) && item.pages_read !== undefined && item.pages_read > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '-0.3rem' }}>
                                {item.pages_read} {language === 'es' ? 'páginas leídas' : 'pages read'}
                              </span>
                            )}

                            {/* Completion date if completed */}
                            {item.completed_at && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block', marginTop: '-0.3rem' }}>
                                {formatDate(new Date(item.completed_at))}
                              </span>
                            )}
                          </div>

                          {/* Status selection */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <select
                              className="input-field"
                              disabled={!isOwnProfile}
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

                            {isOwnProfile && (
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
                            )}
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
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: list.visibility === 'draft' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 58, 237, 0.1)',
                        color: list.visibility === 'draft' ? '#f59e0b' : 'var(--accent-primary)',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {list.visibility === 'draft'
                          ? (language === 'es' ? 'Borrador' : 'Draft')
                          : (list.visibility === 'private'
                              ? (language === 'es' ? 'Privada' : 'Private')
                              : (language === 'es' ? 'Pública' : 'Public')
                            )
                        }
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      {isOwnProfile && (
                        <>
                          <button onClick={() => navigate(`/create?edit=${list.id}`)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                            <Edit size={14} /> {language === 'es' ? 'Editar' : 'Edit'}
                          </button>
                          <button onClick={() => handleDeleteGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                            <Trash2 size={14} /> {language === 'es' ? 'Eliminar' : 'Delete'}
                          </button>
                        </>
                      )}
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
              {language === 'es' ? 'Marca obras en tu estantería como favoritas (con el ícono de corazón) para destacarlas aquí.' : 'Mark items on your shelf as favorites (with the heart icon) to highlight them here.'}
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
                <span>{language === 'es' ? 'Creaste tu cuenta de Pathd.' : 'Created your Pathd account.'}</span>
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
              } else if (act.activity_type === 'shelf_remove') {
                msg = language === 'es'
                  ? `Eliminaste "${act.item_title}" de tu estantería.`
                  : `Removed "${act.item_title}" from your shelf.`;
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
              } else if (act.activity_type === 'guide_created') {
                msg = language === 'es'
                  ? `Creaste una nueva guía: "${act.item_title}".`
                  : `Created a new guide: "${act.item_title}".`;
              } else if (act.activity_type === 'guide_published') {
                msg = language === 'es'
                  ? `Publicaste la guía: "${act.item_title}".`
                  : `Published the guide: "${act.item_title}".`;
              } else if (act.activity_type === 'guide_deleted') {
                msg = language === 'es'
                  ? `Eliminaste la guía: "${act.item_title}".`
                  : `Deleted the guide: "${act.item_title}".`;
              } else if (act.activity_type === 'guide_followed') {
                msg = language === 'es'
                  ? `Comenzaste a seguir la guía: "${act.item_title}".`
                  : `Started following the guide: "${act.item_title}".`;
              } else if (act.activity_type === 'guide_unfollowed') {
                msg = language === 'es'
                  ? `Dejaste de seguir la guía: "${act.item_title}".`
                  : `Stopped following the guide: "${act.item_title}".`;
              } else if (act.activity_type === 'item_reviewed' || act.activity_type === 'item_rated') {
                msg = language === 'es'
                  ? `Reseñaste o valoraste "${act.item_title}".`
                  : `Reviewed or rated "${act.item_title}".`;
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
      {selectedItem && (
        <ItemDetailsModal 
          item={selectedItem} 
          isOwnProfile={isOwnProfile} 
          userIdParam={userIdParam} 
          profileId={profile?.id} 
          onClose={() => setSelectedItem(null)} 
          onUpdate={() => {
            apiClient.get(userIdParam ? `/library/?user_id=${userIdParam}` : '/library/').then(res => {
              setLibraryItems(res.data);
              const favs = res.data.filter((item: any) => item.is_favorite);
              setFavorites(favs);
            });
            apiClient.get(userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity').then(res => setActivities(res.data));
          }}
          onOpenItem={(item) => {
            const mainSeriesItem = libraryItems.find(li => li.tracking_list_id === item.list_id);
            if (mainSeriesItem) {
              handleOpenItemDetails(mainSeriesItem);
            } else {
              setSelectedItem(null);
            }
          }}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onStatusChange={handleStatusChange}
        />
      )}

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
