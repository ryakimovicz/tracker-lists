import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Star, Heart, X, Flag, CheckCircle } from 'lucide-react';
import { getCachedTMDB, setCachedTMDB } from '../utils/tmdbCache';
import { useAuth } from '../context/AuthContext';



interface ItemDetailsModalProps {
  item: any;
  isOwnProfile: boolean;
  userIdParam?: string | null;
  profileId?: number;
  onClose: () => void;
  onUpdate: (updatedItem?: any) => void; // Triggered when item details/status changes
  onOpenItem?: (item: any) => void;
  isFavorite?: boolean; // Prop from parent
  onToggleFavorite?: (itemId: number, currentFav: boolean) => void;
  onStatusChange?: (itemId: number, newStatus: string) => void;
}

class ErrorBoundary extends React.Component<{children: any}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error("Modal Error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '2rem', color: 'red' }}>
            <h3>Error Rendering Modal</h3>
            <p>{String(this.state.error)}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = (props) => {
  return <ErrorBoundary><ItemDetailsModalInner {...props} /></ErrorBoundary>;
};

const ItemDetailsModalInner: React.FC<ItemDetailsModalProps> = ({
  item: initialItem,
  isOwnProfile,
  userIdParam,
  profileId,
  onClose,
  onUpdate,
  onOpenItem,
  isFavorite = false,
  onToggleFavorite,
  onStatusChange
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  
  const [selectedItem, setSelectedItem] = useState<any>(initialItem);
  const [isCoverPeek, setIsCoverPeek] = useState(false);
  
  const shouldBlurCover = selectedItem?.is_nsfw && !user?.show_nsfw && !isCoverPeek;
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState<string>('');
  const [pagesReadVal, setPagesReadVal] = useState<number | ''>(0);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [seasonNumber: number]: any[] }>({});
  const [globalProgress, setGlobalProgress] = useState<Record<string, boolean>>({});
  const [isLoadingSeasonEpisodes, setIsLoadingSeasonEpisodes] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

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
    if (type === 'series' || type === 'anime') {
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

  const findNextSeasonToSee = (items: any[], seasonsList: any[]) => {
    const completed = items.filter(ep => ep.is_completed);
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
    const cacheKeyAll = `${seriesId}_all_episodes`;
    const cachedAll = getCachedTMDB(cacheKeyAll);
    
    const processAllEps = (allEps: any[]) => {
      const extIds = allEps.map(e => `tmdb-ep-${e.id}`);
      if (extIds.length > 0) {
        apiClient.post('/users/me/progress/bulk-check', { external_ids: extIds })
          .then(progRes => {
            setGlobalProgress(prev => ({ ...prev, ...progRes.data }));
          })
          .catch(e => console.error("Failed to fetch global progress", e));
      }

      const grouped: Record<number, any[]> = {};
      allEps.forEach(ep => {
        if (!grouped[ep.season_number]) grouped[ep.season_number] = [];
        grouped[ep.season_number].push(ep);
      });
      setSeasonEpisodes(prev => ({ ...prev, ...grouped }));
    };

    if (cachedAll && Array.isArray(cachedAll)) {
      processAllEps(cachedAll);
      return;
    }

    setIsLoadingSeasonEpisodes(true);
    try {
      const res = await apiClient.get(`/search/series/${seriesId}/episodes`);
      setCachedTMDB(cacheKeyAll, res.data);
      processAllEps(res.data || []);
    } catch (err) {
      console.error("Failed to load season episodes", err);
    } finally {
      setIsLoadingSeasonEpisodes(false);
    }
  };

  useEffect(() => {
    if (!initialItem) return;
    
    const initModal = async (item: any) => {
      setSelectedItem(item);
      setUserRating(0);
      setUserComment('');
      setPagesReadVal(item.pages_read || 0);
      setItemReviews([]);
      setDescExpanded(false);

      if (item.item_type === 'series' || item.item_type === 'anime') {
        try {
          let itemsList: any[] = [];
          if (item.tracking_list_id) {
            try {
              const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
              itemsList = listRes.data.items || [];
              setEpisodes(itemsList);
            } catch (err) {
              console.error("Failed to fetch tracking list", err);
              // Continue loading TMDB data even if list fails
            }
          }
          
          let filteredSeasons = [];
          const cacheKey = `tvmaze_series_${item.external_id}`;
          const cached = getCachedTMDB(cacheKey);
          let seriesData = null;
          
          if (cached && cached.seasons) {
            seriesData = cached;
            filteredSeasons = cached.seasons;
          } else {
            const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
            seriesData = seriesRes.data;
            filteredSeasons = (seriesData.seasons || []).filter((s: any) => s.season_number > 0);
            setCachedTMDB(cacheKey, { ...seriesData, seasons: filteredSeasons });
          }
          
          if (!item.description || !item.release_date) {
            setSelectedItem((prev: any) => prev ? {
              ...prev,
              description: prev.description || seriesData.overview,
              release_date: prev.release_date || seriesData.first_air_date,
              image_url: prev.image_url || (seriesData.poster_path ? `https://image.tmdb.org/t/p/w185${seriesData.poster_path}` : null)
            } : null);
          }
          setSeasons(filteredSeasons);

          const nextSeason = item.tracking_list_id ? findNextSeasonToSee(itemsList, filteredSeasons) : (filteredSeasons.length > 0 ? filteredSeasons[0].season_number : 1);
          setActiveSeason(nextSeason);

          const cacheKeyAll = `${item.external_id}_all_episodes`;
          const cachedAll = getCachedTMDB(cacheKeyAll);
          
          const processAllEps = (allEps: any[]) => {
            const extIds = allEps.map(e => `tmdb-ep-${e.id}`);
            if (extIds.length > 0) {
              apiClient.post('/users/me/progress/bulk-check', { external_ids: extIds })
                .then(progRes => {
                  setGlobalProgress(prev => ({ ...prev, ...progRes.data }));
                })
                .catch(e => console.error("Failed to fetch global progress", e));
            }

            const grouped: Record<number, any[]> = {};
            allEps.forEach(ep => {
              if (!grouped[ep.season_number]) grouped[ep.season_number] = [];
              grouped[ep.season_number].push(ep);
            });
            setSeasonEpisodes(prev => ({ ...prev, ...grouped }));
          };

          if (cachedAll && Array.isArray(cachedAll)) {
            processAllEps(cachedAll);
          } else {
            setIsLoadingSeasonEpisodes(true);
            apiClient.get(`/search/series/${item.external_id}/episodes`)
              .then(res => {
                setCachedTMDB(cacheKeyAll, res.data);
                processAllEps(res.data || []);
              })
              .catch(e => console.error(e))
              .finally(() => setIsLoadingSeasonEpisodes(false));
          }
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
        
        if (profileId) {
          const myReview = res.data.find((r: any) => r.user_id === profileId);
          if (myReview) {
            setUserRating(myReview.rating || 0);
            setUserComment(myReview.content || '');
          }
        }
      } catch(e) {
        console.error(e);
      }

      const descCacheKey = `desc_${item.item_type}_${item.external_id}`;
      const cachedDesc = getCachedTMDB(descCacheKey);
      if (cachedDesc) {
        setIsLoadingMetadata(false);
        setSelectedItem((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            custom_notes: JSON.stringify({ description: cachedDesc.description, release_date: cachedDesc.release_date })
          };
        });
      } else if (item.item_type === 'episode') {
        setIsLoadingMetadata(false);
      } else {
        setIsLoadingMetadata(true);
        apiClient.get('/search/', { params: { q: item.title, type: item.item_type === 'anime' ? 'series' : item.item_type } })
          .then(searchRes => {
            const match = searchRes.data.find((x: any) => x.external_id === item.external_id);
            if (match) {
              const cachedVal = { description: match.description || '', release_date: match.release_date || null };
              setCachedTMDB(descCacheKey, cachedVal);
              setSelectedItem((prev: any) => {
                if (!prev) return null;
                return {
                  ...prev,
                  custom_notes: JSON.stringify(cachedVal)
                };
              });
            }
          })
          .catch(e => console.error(e))
          .finally(() => {
            setIsLoadingMetadata(false);
          });
      }
    };

    initModal(initialItem);
  }, [initialItem, profileId]);

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

  const handleToggleFavoriteInner = async () => {
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

  
  const ensureTracked = async (status: string) => {
    if (selectedItem.tracking_list_id) return selectedItem.tracking_list_id;
    
    try {
      const res = await apiClient.post('/library/', {
        external_id: selectedItem.external_id,
        title: selectedItem.title,
        image_url: selectedItem.image_url,
        description: selectedItem.description,
        item_type: selectedItem.item_type,
        release_date: selectedItem.release_date,
        status: status
      });
      
      const newItem = res.data;
      setSelectedItem((prev: any) => ({
        ...prev,
        ...newItem
      }));
      onUpdate && onUpdate(newItem);
      return newItem.tracking_list_id;
    } catch (e) {
      console.error("Failed to add to library", e);
      return null;
    }
  };

  const checkCompletionStatus = async (effectiveListId: number, currentEpisodes: any[]) => {
    if (!seasons || seasons.length === 0) return;
    const totalEpisodes = seasons.reduce((acc: number, s: any) => acc + (s.episode_count || 0), 0);
    const completedEpisodes = currentEpisodes.filter((ep: any) => ep.is_completed).length;
    
    if (totalEpisodes > 0 && completedEpisodes >= totalEpisodes && selectedItem.status !== 'completed') {
      try {
        await apiClient.put(`/library/${selectedItem.id}`, { status: 'completed' });
        setSelectedItem((prev: any) => ({ ...prev, status: 'completed' }));
        onUpdate && onUpdate();
      } catch (e) {
        console.error("Failed to auto-complete", e);
      }
    }
  };

  const handleToggleEpisode = async (listId: number, ep: any) => {
    let effectiveListId = listId;
    if (!effectiveListId) {
      const newId = await ensureTracked('watching');
      if (!newId) return;
      effectiveListId = newId;
    }
    
    try {
      const res = await apiClient.post(`/lists/${effectiveListId}/toggle-tmdb-episode`, {
        tmdb_episode_id: ep.id,
        title: ep.title || `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled Episode'}`,
        image_url: ep.image_url || ep.image?.original || ep.image?.medium || (ep.still_path ? (ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w185${ep.still_path}`) : selectedItem.image_url),
        overview: ep.custom_notes || ep.overview,
        season_number: ep.season_number,
        episode_number: ep.episode_number
      });
      
      const listRes = await apiClient.get(`/lists/${effectiveListId}`);
      const updatedList = listRes.data.items || [];
      setEpisodes(updatedList);

      if (selectedItem && (selectedItem.external_id === `tmdb-ep-${ep.id}` || selectedItem.id === ep.id)) {
        setSelectedItem((prev: any) => prev ? { ...prev, completed_at: res.data.completed_at } : null);
      }
      
      onUpdate();
    } catch (err) {
      console.error("Failed to toggle episode", err);
    }
  };

  const handleSavePagesRead = async (val: number) => {
    if (!selectedItem) return;
    try {
      const res = await apiClient.put(`/library/${selectedItem.id}`, {
        pages_read: val
      });
      setSelectedItem((prev: any) => prev ? { ...prev, pages_read: res.data.pages_read, status: res.data.status } : null);
      onUpdate();
    } catch (err) {
      console.error("Failed to update pages read", err);
    }
  };

  const isEpisode = !!(String(selectedItem?.external_id || '').startsWith('tmdb-ep-') || selectedItem?.list_id);
  const ratings = (itemReviews || []).filter(r => r.rating !== null && r.rating !== 0).map(r => r.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null;

  if (!selectedItem) return null;
  
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
                          if (selectedItem.parent_series && onOpenItem) {
                            onOpenItem(selectedItem.parent_series);
                          } else if (onOpenItem && selectedItem.external_id && selectedItem.external_id.startsWith('tmdb-ep-')) {
                            try {
                               const epId = selectedItem.external_id.replace('tmdb-ep-', '');
                               const res = await fetch(`https://api.tvmaze.com/episodes/${epId}?embed=show`);
                               const data = await res.json();
                               if (data._embedded && data._embedded.show) {
                                   const show = data._embedded.show;
                                   onOpenItem({
                                       external_id: `tvm_${show.id}`,
                                       title: show.name,
                                       image_url: show.image?.original || null,
                                       item_type: 'series'
                                   });
                               } else {
                                   onClose();
                               }
                            } catch {
                               onClose();
                            }
                          } else {
                            onClose();
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
                      {selectedItem?.item_type !== 'episode' && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {selectedItem?.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : selectedItem?.item_type === 'manga' ? 'Manga' : t('media' + (selectedItem?.item_type || 'movie').charAt(0).toUpperCase() + (selectedItem?.item_type || 'movie').slice(1))}
                        </span>
                      )}
                      {avgRating && (
                        <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                          ★ {avgRating} / 5 ({ratings.length} {language === 'es' ? 'val.' : 'ratings'})
                        </span>
                      )}
                      {selectedItem.completed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          ✓ {selectedItem.item_type === 'movie' || selectedItem.item_type === 'series' || selectedItem.item_type === 'anime'
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
                  onClick={() => onClose()}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Info */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedItem.image_url && (
                    <div style={{ position: 'relative', width: '130px', height: '190px' }}>
                      <img
                        src={selectedItem.image_url}
                        alt={selectedItem.title}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onClick={() => {
                          if (shouldBlurCover) setIsCoverPeek(true);
                          else setZoomedImage(selectedItem.image_url);
                        }}
                        style={{ 
                          width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', 
                          cursor: shouldBlurCover ? 'pointer' : 'zoom-in', 
                          boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                          filter: shouldBlurCover ? 'blur(15px)' : 'none',
                          transition: 'filter 0.3s'
                        }}
                      />
                      {shouldBlurCover && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.3)', borderRadius: '8px', pointerEvents: 'none',
                          color: 'white', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem'
                        }}>
                          Haz clic para ver portada
                        </div>
                      )}
                    </div>
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

                    if (isLoadingMetadata) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
                          <div>
                            <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Descripción:' : 'Description:'}</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              <div className="skeleton" style={{ height: '0.85rem', width: '100%' }}></div>
                              <div className="skeleton" style={{ height: '0.85rem', width: '92%' }}></div>
                              <div className="skeleton" style={{ height: '0.85rem', width: '95%' }}></div>
                              {selectedItem.genres && <p style={{ margin: '0 0 0.5rem 0' }}><strong>{language === 'es' ? 'Géneros' : 'Genres'}:</strong> {selectedItem.genres}</p>}
                            </div>
                          </div>
                          <div>
                            <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Fecha de lanzamiento:' : 'Release Date:'}</h5>
                            <div className="skeleton" style={{ height: '0.9rem', width: '130px' }}></div>
                          </div>
                        </div>
                      );
                    }

                    const notes = parseNotes(selectedItem.custom_notes || '');
                    const cleanText = stripHtml(notes.description || '');
                    const shouldTruncate = cleanText.length > 180;
                    const displayedText = shouldTruncate && !descExpanded
                      ? cleanText.slice(0, 180) + '...'
                      : cleanText;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {cleanText && (
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
                        )}
                        {(selectedItem.release_date || notes.release_date) && (
                          <div>
                            <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>
                              {language === 'es' ? 'Fecha de lanzamiento:' : 'Release Date:'}
                            </h5>
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {formatReleaseDate(selectedItem.release_date || notes.release_date)}
                            </span>
                          </div>
                        )}
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
                          disabled={!isOwnProfile}
                          onClick={() => handleSaveRating(star)}
                          style={{ background: 'transparent', border: 'none', cursor: isOwnProfile ? 'pointer' : 'default', padding: 0 }}
                        >
                          <Star
                            size={24}
                            fill={star <= userRating ? '#f59e0b' : 'none'}
                            color={star <= userRating ? '#f59e0b' : 'var(--text-muted)'}
                          />
                        </button>
                      ))}
                      {isOwnProfile && userRating > 0 && (
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
                  {isOwnProfile && !isEpisode && (
                    <div>
                      <button
                        onClick={() => onToggleFavorite && onToggleFavorite(selectedItem.id, isFavorite)}
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

                  {/* Status selection inside modal */}
                  {!isEpisode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {language === 'es' ? 'Estado:' : 'Status:'}
                      </h5>
                      <select
                        className="input-field"
                        disabled={!isOwnProfile}
                        value={selectedItem.status || ''}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          if (onStatusChange) {
                            await onStatusChange(selectedItem.id, newStatus);
                          }
                          setSelectedItem((prev: any) => prev ? { ...prev, status: newStatus } : null);
                          if ((selectedItem.item_type === 'series' || selectedItem.item_type === 'anime') && newStatus === 'completed' && selectedItem.tracking_list_id) {
                            const listRes = await apiClient.get(`/lists/${selectedItem.tracking_list_id}`);
                            setEpisodes(listRes.data.items || []);
                          }
                        }}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.85rem',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          maxWidth: '200px'
                        }}
                      >
                        {getAllowedStatuses(selectedItem.item_type).map(status => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pages read input for books/comics/mangas */}
                  {!isEpisode && selectedItem && ['book', 'comic', 'manga'].includes(selectedItem.item_type) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {language === 'es' ? 'Páginas leídas:' : 'Pages read:'}
                      </h5>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="input-field"
                          disabled={!isOwnProfile}
                          value={pagesReadVal}
                          min={0}
                          onFocus={() => {
                            if (pagesReadVal === 0) setPagesReadVal('');
                          }}
                          onBlur={() => {
                            const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                            setPagesReadVal(finalVal);
                            handleSavePagesRead(finalVal);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                              setPagesReadVal(finalVal);
                              handleSavePagesRead(finalVal);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                            setPagesReadVal(val);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.85rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            maxWidth: '120px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Episode seen checkbox and date completed */}
                  {isEpisode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={!isOwnProfile}
                          checked={!!selectedItem.completed_at}
                          onChange={async () => {
                            await handleToggleEpisode(selectedItem.list_id, {
                              id: selectedItem.rawEpisodeId,
                              title: selectedItem.title,
                              image_url: selectedItem.image_url,
                              custom_notes: selectedItem.custom_notes,
                              season_number: selectedItem.season_number,
                              episode_number: selectedItem.episode_number
                            });
                          }}
                          style={{ width: '18px', height: '18px', cursor: isOwnProfile ? 'pointer' : 'default' }}
                        />
                        {language === 'es' ? 'Marcar como visto' : 'Mark as seen'}
                      </label>
                      {selectedItem.completed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {language === 'es' ? 'Visto el: ' : 'Watched on: '}
                          {formatDate(new Date(selectedItem.completed_at))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* TV Series Season Accordion Tracking */}
              {(selectedItem.item_type === 'series' || selectedItem.item_type === 'anime') && seasons.length > 0 && !isEpisode && (
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
                              <input
                                type="checkbox"
                                disabled={!isOwnProfile}
                                checked={(() => {
                                  const listSeps = (episodes || []).filter(x => x.section === `Season ${s.season_number}`);
                                  const tmdbEps = seasonEpisodes[s.season_number] || [];
                                  if (!Array.isArray(tmdbEps)) return false;
                                  if (tmdbEps.length === 0) {
                                    return listSeps.length > 0 && listSeps.every(x => x.is_completed);
                                  }
                                  return tmdbEps.every((te: any) => globalProgress[`tmdb-ep-${te.id}`] || (episodes || []).some(x => x.external_id === `tmdb-ep-${te.id}` && x.is_completed));
                                })()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onChange={async (e) => {
                                  e.stopPropagation();
                                  let effectiveListId = selectedItem.tracking_list_id;
                                  if (!effectiveListId) {
                                    const newId = await ensureTracked('watching');
                                    if (!newId) return;
                                    effectiveListId = newId;
                                  }
                                  
                                  const checkedVal = e.target.checked;
                                  const cacheKey = `${selectedItem.external_id}_s${s.season_number}`;
                                  const tmdbEps = getCachedTMDB(cacheKey);
                                  
                                  try {
                                    await apiClient.post(`/lists/${effectiveListId}/bulk-toggle-season`, {
                                      season_number: s.season_number,
                                      episodes: tmdbEps || null,
                                      completed: checkedVal
                                    });
                                    
                                    const listRes = await apiClient.get(`/lists/${effectiveListId}`);
                                    const updatedList = listRes.data.items || [];
                                    setEpisodes(updatedList);
                                    await checkCompletionStatus(effectiveListId, updatedList);
                                    onUpdate && onUpdate();
                                  } catch (err) {
                                    console.error("Bulk toggle failed", err);
                                  }
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '0.6rem', verticalAlign: 'middle' }}
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
                              ) : (Array.isArray(seasonEpisodes[s.season_number]) ? seasonEpisodes[s.season_number] : []).length === 0 ? (
                                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {language === 'es' ? 'No se encontraron capítulos.' : 'No episodes found.'}
                                </div>
                              ) : (
                                (Array.isArray(seasonEpisodes[s.season_number]) ? seasonEpisodes[s.season_number] : []).map((ep: any) => {
                                  const dbEp = (episodes || []).find(x => x.external_id === `tmdb-ep-${ep.id}`);
                                  const isCompleted = !!globalProgress[`tmdb-ep-${ep.id}`] || !!dbEp?.is_completed;
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
                                          disabled={!isOwnProfile}
                                          checked={isCompleted}
                                          onChange={() => {
                                            const currentIsCompleted = !!globalProgress[`tmdb-ep-${ep.id}`] || !!dbEp?.is_completed;
                                            setGlobalProgress(prev => ({ ...prev, [`tmdb-ep-${ep.id}`]: !currentIsCompleted }));
                                            handleToggleEpisode(selectedItem.tracking_list_id, ep);
                                          }}
                                          style={{ width: '18px', height: '18px', cursor: isOwnProfile ? 'pointer' : 'default' }}
                                        />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                          {ep.episode_number}. {ep.name || 'Untitled'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => onOpenItem && onOpenItem({
                                          id: dbEp ? dbEp.id : ep.id,
                                          list_id: selectedItem.tracking_list_id,
                                          item_type: 'episode',
                                          external_id: `tmdb-ep-${ep.id}`,
                                          title: `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled'}`,
                                          image_url: ep.image_url || ep.image?.original || ep.image?.medium || (ep.still_path ? (ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w185${ep.still_path}`) : selectedItem.image_url),
                                          custom_notes: ep.overview,
                                          completed_at: dbEp?.completed_at,
                                          season_number: ep.season_number,
                                          episode_number: ep.episode_number,
                                          rawEpisodeId: ep.id,
                                          release_date: ep.air_date,
                                          parent_series: selectedItem
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
};
