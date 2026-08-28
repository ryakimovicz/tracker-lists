import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getProfileTheme } from '../utils/profileThemes';
import { apiClient } from '../api/client';
import { Star, Heart, X, Flag, CheckCircle, Check, Plus, MoreVertical, Trash2, ArrowLeft, Clock, ChevronUp, ChevronDown, RotateCcw, BookOpen, Gamepad2, Package, Sparkles, Puzzle, Layers, ChevronLeft, ChevronRight } from 'lucide-react';




import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { useAuth } from '../context/AuthContext';




interface ItemDetailsModalProps {
  item: any;
  isOwnProfile: boolean;
  userIdParam?: string | null;
  profileId?: number;
  profileColor?: string | null;
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

const ModalScrollRow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 260;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); scroll('left'); }}
        style={{
          position: 'absolute',
          left: '-8px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 5,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          color: 'var(--text-primary)'
        }}
      >
        <ChevronLeft size={18} />
      </button>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '0.65rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          width: '100%',
          padding: '0.25rem 1.25rem'
        }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); scroll('right'); }}
        style={{
          position: 'absolute',
          right: '-8px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 5,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          color: 'var(--text-primary)'
        }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = (props) => {
  return <ErrorBoundary><ItemDetailsModalInner {...props} /></ErrorBoundary>;
};


const ItemDetailsModalInner: React.FC<ItemDetailsModalProps> = ({
  item: initialItem,
  isOwnProfile,
  userIdParam,
  profileId,
  profileColor,
  onClose,
  onUpdate,
  onOpenItem,
  isFavorite = false,
  onToggleFavorite,
  onStatusChange
}) => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isLight = theme === 'light';
  const effectiveColor = profileColor || user?.profile_color;
  const isProActive = Boolean(user?.is_pro || (profileId && profileId === user?.id && user?.is_pro));
  const profileTheme = getProfileTheme(effectiveColor, isLight);

  
  const [selectedItem, setSelectedItem] = useState<any>(initialItem);
  const [isCoverPeek, setIsCoverPeek] = useState(false);
  
  const shouldBlurCover = selectedItem?.is_nsfw && !user?.show_nsfw && !isCoverPeek;
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState<string>('');
  const [pagesReadVal, setPagesReadVal] = useState<number | ''>(0);
  const [totalPagesVal, setTotalPagesVal] = useState<number | ''>('');
  const [hasInteractedWithTime, setHasInteractedWithTime] = useState<boolean>(false);
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Game relations & Navigation history
  const [gameRelations, setGameRelations] = useState<{ collections?: any[], bundle_games?: any[], editions?: any[], dlcs?: any[], parent_game?: any } | null>(null);
  const [isLoadingGameRelations, setIsLoadingGameRelations] = useState<boolean>(false);
  const [historyStack, setHistoryStack] = useState<any[]>([]);

  const [descExpanded, setDescExpanded] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginalDesc, setShowOriginalDesc] = useState(true);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [seasonNumber: number]: any[] }>({});
  const [globalProgress, setGlobalProgress] = useState<Record<string, boolean>>({});
  const [isLoadingSeasonEpisodes, setIsLoadingSeasonEpisodes] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShelfMenu, setShowShelfMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [openEpisodeMenuId, setOpenEpisodeMenuId] = useState<number | null>(null);

  const handleTranslateDescription = async (textToTranslate: string) => {
    if (!textToTranslate) return;
    if (translatedDesc) {
      setShowOriginalDesc(false);
      return;
    }
    try {
      setIsTranslating(true);
      const res = await apiClient.post('/translate/', { text: textToTranslate, target_language: 'es' });
      if (res.data && res.data.translated_text) {
        setTranslatedDesc(res.data.translated_text);
        setShowOriginalDesc(false);
      }
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  const getDefaultStatus = (type: string) => {
    if (type === 'game') return 'plan_to_play';
    if (['book', 'comic', 'manga'].includes(type)) return 'plan_to_read';
    return 'plan_to_watch';
  };

  const getCompletedStatus = (type: string) => {
    if (['book', 'comic', 'manga'].includes(type)) return 'read';
    return 'completed';
  };

  const handleAddToShelf = async () => {
    if (!selectedItem) return;
    if (selectedItem.id) {
      // Already in shelf, show menu
      setShowShelfMenu(!showShelfMenu);
    } else {
      const defaultStatus = getDefaultStatus(selectedItem.item_type);
      const resId = await ensureTracked(defaultStatus);
      if (resId) {
        onUpdate && onUpdate();
      }
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedItem) return;
    const compStatus = getCompletedStatus(selectedItem.item_type);
    if (selectedItem.id) {
      try {
        await apiClient.put(`/library/${selectedItem.id}`, { status: compStatus });
        setSelectedItem((prev: any) => prev ? { ...prev, status: compStatus, completed_at: new Date().toISOString() } : null);
        onUpdate && onUpdate();
      } catch (e) {
        console.error(e);
      }
    } else {
      await ensureTracked(compStatus);
    }
  };

  const handleMarkDropped = async () => {
    if (!selectedItem) return;
    setShowMenu(false);
    
    const isDropped = selectedItem.status === 'dropped';
    let targetStatus = 'dropped';
    if (isDropped) {
      if (selectedItem.item_type === 'game') targetStatus = 'playing';
      else if (['book', 'comic', 'manga'].includes(selectedItem.item_type)) targetStatus = 'reading';
      else targetStatus = 'watching';
    }

    if (selectedItem.id) {
      try {
        await apiClient.put(`/library/${selectedItem.id}`, { status: targetStatus });
        setSelectedItem((prev: any) => prev ? { ...prev, status: targetStatus } : null);
        onUpdate && onUpdate();
      } catch (e) {
        console.error(e);
      }
    } else {
      await ensureTracked(targetStatus);
    }
  };

  const handleToggleStatus = async (statusId: string) => {
    if (!selectedItem) return;
    const isCurrentlyActive = selectedItem.status === statusId;
    const newStatus = isCurrentlyActive ? getDefaultStatus(selectedItem.item_type) : statusId;
    
    if (selectedItem.id) {
      try {
        await apiClient.put(`/library/${selectedItem.id}`, { status: newStatus });
        setSelectedItem((prev: any) => prev ? { ...prev, status: newStatus } : null);
        onUpdate && onUpdate();
      } catch (e) {
        console.error(e);
      }
    } else {
      await ensureTracked(newStatus);
    }
  };

  const handleMarkConsumedAgain = async () => {
    if (!selectedItem || !selectedItem.id) return;
    setShowShelfMenu(false);
    try {
      const res = await apiClient.post(`/library/${selectedItem.id}/mark-consumed`);
      setSelectedItem((prev: any) => prev ? { ...prev, ...res.data } : null);
      onUpdate && onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFromShelf = async () => {
    if (!selectedItem || !selectedItem.id) return;
    setShowMenu(false);
    setShowShelfMenu(false);
    try {
      await apiClient.delete(`/library/${selectedItem.id}`);
      setSelectedItem(null);
      onClose();
      onUpdate && onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

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
    const cacheKeyAll = `${seriesId}_all_episodes_v2`;
    const cachedAll = getCachedSeries(cacheKeyAll);
    
    const processAllEps = (allEps: any[]) => {
      const extIds = allEps.map(e => `tvm-ep-${e.id}`);
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
      setCachedSeries(cacheKeyAll, res.data);
      processAllEps(res.data || []);
    } catch (err) {
      console.error("Failed to load season episodes", err);
    } finally {
      setIsLoadingSeasonEpisodes(false);
    }
  };
  const lastInitialKeyRef = React.useRef<string>('');

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    if (!initialItem) return;

    const currentKey = `${initialItem.external_id || initialItem.id}_${initialItem.item_type}`;
    if (lastInitialKeyRef.current === currentKey) {
      // Avoid resetting all episode progress states when only parent shelf list refreshed
      return;
    }
    lastInitialKeyRef.current = currentKey;
    
    const initModal = async (incomingItem: any) => {
      let item = incomingItem;

      // If viewing another user's profile, decouple personal tracking and check the logged-in user's own library
      const isOtherUserProfile = !isOwnProfile || (userIdParam && user?.id && String(userIdParam) !== String(user.id));
      if (isOtherUserProfile && user && incomingItem.external_id) {
        try {
          const myLibRes = await apiClient.get('/library/');
          const myLib = myLibRes.data || [];
          const myMatch = myLib.find((li: any) => li.external_id === incomingItem.external_id && li.item_type === incomingItem.item_type);
          if (myMatch) {
            item = {
              ...incomingItem,
              id: myMatch.id,
              status: myMatch.status,
              completed_at: myMatch.completed_at,
              pages_read: myMatch.pages_read,
              total_pages: myMatch.total_pages || incomingItem.total_pages,
              tracking_list_id: myMatch.tracking_list_id,
              is_favorite: myMatch.is_favorite
            };
          } else {
            // Logged-in user does not have this item tracked
            item = {
              ...incomingItem,
              id: undefined,
              status: undefined,
              completed_at: null,
              pages_read: 0,
              tracking_list_id: undefined,
              is_favorite: false
            };
          }
        } catch (err) {
          console.error("Failed to check personal library state", err);
        }
      }

      setSelectedItem(item);
      setUserRating(0);
      setUserComment('');
      setPagesReadVal(item.pages_read || 0);
      setTotalPagesVal(item.total_pages || item.page_count || '');
      setHasInteractedWithTime(false);
      setItemReviews([]);
      setDescExpanded(false);


      const isActualEpisode = item.external_id && item.external_id.startsWith('tvm-ep-');
      if ((item.item_type === 'series' || item.item_type === 'anime') && !isActualEpisode) {
        try {
          let itemsList: any[] = [];
          if (item.tracking_list_id) {
            try {
              const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
              itemsList = listRes.data.items || [];
              setEpisodes(itemsList);
            } catch (err) {
              console.error("Failed to fetch tracking list", err);
            }
          }

          const seriesId = item.external_id;
          const cacheKey = `${seriesId}_metadata`;
          const cached = getCachedSeries(cacheKey);
          let seriesData: any = null;
          let filteredSeasons: any[] = [];
          
          if (cached && cached.seasons && cached.image_url !== undefined) {
            seriesData = cached;
            filteredSeasons = cached.seasons;
          } else {
            const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
            seriesData = seriesRes.data || {};
            filteredSeasons = (seriesData?.seasons || []).filter((s: any) => s.season_number > 0);
            if (filteredSeasons.length === 0 && (item.item_type === 'series' || item.item_type === 'anime')) {
              filteredSeasons = [{ id: 1, season_number: 1, episode_count: item.latest_episode || 12 }];
            }
            setCachedSeries(cacheKey, { ...seriesData, seasons: filteredSeasons });
          }
          
          if (seriesData && (!item.description || !item.release_date || !item.image_url)) {
            setSelectedItem((prev: any) => prev ? {
              ...prev,
              description: prev.description || seriesData.overview || '',
              release_date: prev.release_date || seriesData.first_air_date || '',
              image_url: prev.image_url || seriesData.image_url || null
            } : null);
          }
          setSeasons(filteredSeasons);

          const nextSeason = item.tracking_list_id ? findNextSeasonToSee(itemsList, filteredSeasons) : (filteredSeasons.length > 0 ? filteredSeasons[0].season_number : 1);
          setActiveSeason(nextSeason);

          const cacheKeyAll = `${item.external_id}_all_episodes`;
          const cachedAll = getCachedSeries(cacheKeyAll);
          
          const processAllEps = (allEps: any[]) => {
            const extIds = allEps.map(e => `tvm-ep-${e.id}`);
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

            // Clean seasons list to only include seasons with actual episodes or valid counts
            setSeasons(prevSeasons => {
              if (!prevSeasons || prevSeasons.length === 0) return prevSeasons;
              const validSeasons = prevSeasons.filter(s => {
                const countInEps = (grouped[s.season_number] || []).length;
                return countInEps > 0 || (s.episode_count && s.episode_count < 900);
              }).map(s => {
                const countInEps = (grouped[s.season_number] || []).length;
                return {
                  ...s,
                  episode_count: countInEps > 0 ? countInEps : s.episode_count
                };
              });
              return validSeasons.length > 0 ? validSeasons : prevSeasons;
            });
          };

          if (cachedAll && Array.isArray(cachedAll)) {
            processAllEps(cachedAll);
          } else {
            setIsLoadingSeasonEpisodes(true);
            apiClient.get(`/search/series/${item.external_id}/episodes`)
              .then(res => {
                setCachedSeries(cacheKeyAll, res.data);
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

      // Fetch game relations (collections, DLCs, editions, base game)
      if (item.item_type === 'game' && item.external_id) {
        setIsLoadingGameRelations(true);
        apiClient.get(`/search/game/${item.external_id}/relations`)
          .then(res => {
            setGameRelations(res.data || null);
          })
          .catch(e => {
            console.error("Failed to load game relations", e);
            setGameRelations(null);
          })
          .finally(() => setIsLoadingGameRelations(false));
      } else {
        setGameRelations(null);
      }

      // Movie metadata enrichment (if poster is missing or placeholder)
      if (item.item_type === 'movie') {
        const hasPlaceholderPoster = !item.image_url || item.image_url.includes('photo-1489599849927') || item.image_url.includes('photo-1543002588');
        const isWikiItem = item.external_id && item.external_id.startsWith('wiki_');

        if (hasPlaceholderPoster || isWikiItem || !item.description) {
          apiClient.get(`/search/?q=${encodeURIComponent(item.title)}&type=movie`)
            .then(movieSearchRes => {
              const matches = movieSearchRes.data || [];
              if (matches.length > 0) {
                const found = matches[0];
                const validNewPoster = found.image_url && !found.image_url.includes('photo-1489599849927') && !found.image_url.includes('photo-1543002588');
                if (validNewPoster || found.description) {
                  setSelectedItem((prev: any) => prev ? {
                    ...prev,
                    image_url: validNewPoster ? found.image_url : prev.image_url,
                    description: found.description || prev.description,
                    release_date: found.release_date || prev.release_date,
                    external_id: found.external_id || prev.external_id
                  } : null);

                  // If this item was in the user library, sync it permanently
                  if (item.id && validNewPoster) {
                    apiClient.put(`/library/${item.id}`, {
                      image_url: found.image_url,
                      description: found.description || item.description,
                      release_date: found.release_date || item.release_date,
                      external_id: found.external_id || item.external_id
                    }).then(() => {
                      onUpdate && onUpdate();
                    }).catch(console.error);
                  }
                }
              }
            })
            .catch(console.error);
        }
      }

      try {
        const res = await apiClient.get(`/reviews/${item.item_type}/${item.external_id}`);
        setItemReviews(res.data);
        
        // Find review belonging to the CURRENT logged-in user (not foreign profileId!)
        const currentUserId = user?.id;
        if (currentUserId) {
          const myReview = res.data.find((r: any) => r.user_id === currentUserId);
          if (myReview) {
            setUserRating(myReview.rating || 0);
            setUserComment(myReview.content || '');
          } else {
            setUserRating(0);
            setUserComment('');
          }
        }
      } catch(e) {
        console.error(e);
      }

      const descCacheKey = `desc_${item.item_type}_${item.external_id}`;
      const cachedDesc = getCachedSeries(descCacheKey);
      if (cachedDesc) {
        setIsLoadingMetadata(false);
        setSelectedItem((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            custom_notes: JSON.stringify({ description: cachedDesc.description, release_date: cachedDesc.release_date })
          };
        });
      } else if (item.item_type === 'episode' || isActualEpisode) {
        if (item.imdb_id && item.imdb_id.startsWith('tvm_')) {
          setIsLoadingMetadata(true);
          const showId = item.imdb_id.replace('tvm_', '');
          apiClient.get(`/search/series/tvm_${showId}`)
            .then(showRes => {
              const showData = showRes.data;
              const seriesName = showData?.title || showData?.name || 'Series';
              const epNum = item.latest_episode || item.episode_number || item.number;
              const seasonNum = item.latest_season || item.season_number || item.season || 1;
              const epTitle = `${seriesName} - S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
              
              setSelectedItem((prev: any) => prev ? {
                ...prev,
                title: epTitle,
                parent_series: {
                  external_id: `tvm_${showId}`,
                  title: seriesName,
                  item_type: 'series'
                }
              } : null);

              // Also fetch overview for this episode
              apiClient.get(`/search/series/tvm_${showId}/episodes`)
                .then(allEpsRes => {
                  const eps = allEpsRes.data || [];
                  const thisEp = eps.find((e: any) => e.id === item.id || `tvm-ep-${e.id}` === item.external_id || (e.season === seasonNum && e.number === epNum));
                  if (thisEp) {
                    const descVal = { description: thisEp.summary || thisEp.overview || '', release_date: thisEp.airdate || null };
                    setCachedSeries(descCacheKey, descVal);
                    setSelectedItem((prev: any) => prev ? {
                      ...prev,
                      image_url: prev.image_url || thisEp.image?.original || thisEp.image?.medium || null,
                      custom_notes: JSON.stringify(descVal)
                    } : null);
                  }
                })
                .catch(console.error)
                .finally(() => setIsLoadingMetadata(false));
            })
            .catch(e => { console.error(e); setIsLoadingMetadata(false); });
        } else {
          const match = item.external_id.match(/tmdb-tv-(\d+)-s(\d+)-e(\d+)/);
          if (match) {
            setIsLoadingMetadata(true);
            const actualSeriesId = `tmdb-tv-${match[1]}`;
            apiClient.get(`/search/series/${actualSeriesId}`)
              .then(seriesRes => {
                const seriesData = seriesRes.data;
                const seriesName = seriesData?.name || seriesData?.title || 'Series';
                const epTitle = `${seriesName} - S${match[2].padStart(2, '0')}E${match[3].padStart(2, '0')}`;
                
                setSelectedItem((prev: any) => prev ? {
                  ...prev,
                  title: epTitle,
                  parent_series: {
                    external_id: actualSeriesId,
                    title: seriesName,
                    item_type: 'series'
                  }
                } : null);
                
                if (seriesData?.seasons) {
                  const seasonObj = seriesData.seasons.find((s: any) => s.season_number === parseInt(match[2]));
                  const epCount = seasonObj?.episode_count || 10;
                  const seasonEps = Array.from({ length: epCount }, (_, i) => ({
                    id: `${actualSeriesId}-s${match[2]}-e${i + 1}`,
                    season_number: parseInt(match[2]),
                    episode_number: i + 1,
                    title: `Episodio ${i + 1}`
                  }));
                  setSeasonEpisodes(prev => ({ ...prev, [parseInt(match[2])]: seasonEps }));
                  
                  apiClient.get(`/search/series/${actualSeriesId}/episodes`)
                    .then(allEpsRes => {
                      const allEps = allEpsRes.data || [];
                      const matchedEp = allEps.find((e: any) => 
                        (e.season_number === parseInt(match[2]) && e.episode_number === parseInt(match[3]))
                      );
                      if (matchedEp) {
                        setSelectedItem((prev: any) => prev ? {
                          ...prev,
                          custom_notes: JSON.stringify({ description: matchedEp.overview || '', release_date: matchedEp.air_date || null }),
                        } : null);
                      }
                    })
                    .catch(e => console.error(e))
                    .finally(() => setIsLoadingMetadata(false));
                }
              })
              .catch(e => { console.error(e); setIsLoadingMetadata(false); });
          } else {
            setIsLoadingMetadata(false);
          }
        }
      } else {
        if (item.description) {
          const cachedVal = { description: item.description, release_date: item.release_date || null };
          setCachedSeries(descCacheKey, cachedVal);
          setSelectedItem((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              custom_notes: JSON.stringify(cachedVal)
            };
          });
          setIsLoadingMetadata(false);
        } else {
          setIsLoadingMetadata(true);
          apiClient.get('/search/', { params: { q: item.title, type: item.item_type === 'anime' ? 'series' : item.item_type } })
            .then(searchRes => {
              const match = searchRes.data.find((x: any) => x.external_id === item.external_id) || searchRes.data[0];
              if (match) {
                const cachedVal = { description: match.description || '', release_date: match.release_date || null };
                setCachedSeries(descCacheKey, cachedVal);
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
      }
    };

    initModal(initialItem);
  }, [initialItem?.external_id, initialItem?.id, profileId]);

  const isItemTracked = Boolean(selectedItem?.id && selectedItem?.status);

  const handleSaveRating = async (ratingVal: number) => {
    if (!selectedItem || !selectedItem.external_id || !isItemTracked) return;
    setUserRating(ratingVal);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: ratingVal
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to save rating", err);
    }
  };

  const handleDeleteRating = async () => {
    if (!selectedItem || !selectedItem.external_id) return;
    setUserRating(0);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: null
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch (err) {
      console.error("Failed to delete rating", err);
    }
  };

  const handleSaveComment = async () => {
    if (!selectedItem || !selectedItem.external_id) return;
    setIsSavingReview(true);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        content: userComment.trim() ? userComment : null
      });
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch(err) {
      console.error("Failed to save comment", err);
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!selectedItem || !selectedItem.external_id) return;
    setIsSavingReview(true);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        content: null
      });
      setUserComment('');
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
    } catch(err) {
      console.error("Failed to delete comment", err);
    } finally {
      setIsSavingReview(false);
    }
  };


  
  const ensureTrackedPromiseRef = React.useRef<Promise<any | null> | null>(null);

  const ensureTracked = async (status: string) => {
    if (selectedItem.tracking_list_id && selectedItem.id) return selectedItem;
    if (ensureTrackedPromiseRef.current) {
      return await ensureTrackedPromiseRef.current;
    }
    
    ensureTrackedPromiseRef.current = (async () => {
      try {
        const res = await apiClient.post('/library/', {
          external_id: selectedItem.external_id,
          title: selectedItem.title,
          image_url: selectedItem.image_url,
          description: selectedItem.description,
          item_type: selectedItem.item_type,
          release_date: selectedItem.release_date,
          total_pages: totalPagesVal !== '' ? totalPagesVal : (selectedItem.total_pages || selectedItem.page_count || null),
          pages_read: (status === 'read' && totalPagesVal !== '') ? totalPagesVal : (pagesReadVal !== '' ? pagesReadVal : 0),
          status: status
        });
        
        const newItem = res.data;
        setSelectedItem((prev: any) => ({
          ...prev,
          ...newItem
        }));
        onUpdate && onUpdate(newItem);
        return newItem;
      } catch (e) {
        console.error("Failed to add to library", e);
        return null;
      } finally {
        ensureTrackedPromiseRef.current = null;
      }
    })();

    return await ensureTrackedPromiseRef.current;
  };

  const checkCompletionStatus = async (effectiveListId: number, currentEpisodes: any[]) => {
    if (!seasons || seasons.length === 0) return;
    const totalEpisodes = seasons.reduce((acc: number, s: any) => acc + (s.episode_count || 0), 0);
    const completedEpisodes = currentEpisodes.filter((ep: any) => ep.is_completed).length;
    
    // Check if all episodes are completed
    let isAllDone = totalEpisodes > 0 && completedEpisodes >= totalEpisodes;

    // If not all episodes are completed, check if the user is "Up to Date" (all currently released episodes watched)
    if (!isAllDone) {
      const cacheKeyAll = `${selectedItem.external_id}_all_episodes`;
      const allEps = getCachedSeries(cacheKeyAll);
      if (allEps && Array.isArray(allEps)) {
        const todayStr = new Date().toISOString().split('T')[0];
        // Find the first uncompleted episode
        const uncompletedEps = allEps.filter(ep => !currentEpisodes.some(tracked => (tracked.external_id === `tvm-ep-${ep.id}` || tracked.id === ep.id) && tracked.is_completed));
        if (uncompletedEps.length > 0) {
          const nextEpToWatch = uncompletedEps[0];
          // If the next uncompleted episode's air date is in the future, the user is caught up!
          const airDate = nextEpToWatch.airdate || nextEpToWatch.air_date;
          if (airDate && airDate > todayStr) {
            isAllDone = true;
          }
        }
      }
    }

    if (isAllDone) {
      try {
        let targetId = selectedItem.id;
        if (!targetId) {
          const libRes = await apiClient.get('/library/');
          const match = (libRes.data || []).find((x: any) => x.external_id === selectedItem.external_id || (effectiveListId && x.tracking_list_id === effectiveListId));
          if (match) {
            targetId = match.id;
          }
        }
        if (targetId) {
          await apiClient.put(`/library/${targetId}`, { status: 'completed' });
          setSelectedItem((prev: any) => ({ ...prev, status: 'completed', id: targetId }));
        }
      } catch (e) {
        console.error("Failed to auto-complete", e);
      }
    }
  };

  const handleOpenRelatedGame = (related: any) => {
    setHistoryStack(prev => [...prev, selectedItem]);
    const target = {
      external_id: String(related.external_id || related.id),
      title: related.title,
      image_url: related.image_url,
      item_type: 'game'
    };
    if (onOpenItem) {
      onOpenItem(target);
    } else {
      setSelectedItem(target);
    }
  };

  const handleGoBackHistory = () => {
    if (historyStack.length > 0) {
      const prevItem = historyStack[historyStack.length - 1];
      setHistoryStack(prev => prev.slice(0, -1));
      if (onOpenItem) {
        onOpenItem(prevItem);
      } else {
        setSelectedItem(prevItem);
      }
    }
  };

  const handleToggleEpisode = async (listId: number, ep: any, action?: string) => {

    let effectiveListId = listId;
    if (!effectiveListId) {
      if (selectedItem.parent_series) {
        try {
          const res = await apiClient.post('/library/', {
            external_id: selectedItem.parent_series.external_id,
            title: selectedItem.parent_series.title,
            image_url: selectedItem.parent_series.image_url,
            item_type: selectedItem.parent_series.item_type,
            status: 'watching'
          });
          effectiveListId = res.data.tracking_list_id;
        } catch (e) {
          console.error("Failed to track parent series", e);
        }
      }

      if (!effectiveListId && selectedItem.id && selectedItem.item_type === 'episode') {
        try {
           const isComplete = !!(selectedItem.completed_at || selectedItem.is_completed);
           const res = await apiClient.put(`/library/${selectedItem.id}`, { completed_at: isComplete ? null : new Date().toISOString() });
           setSelectedItem((prev: any) => prev ? { ...prev, completed_at: res.data.completed_at, is_completed: !!res.data.completed_at } : null);
           onUpdate && onUpdate();
           return;
        } catch (e) {
           console.error("Failed to update standalone episode", e);
           return;
        }
      }

      if (!effectiveListId) {
        try {
          const tracked = await ensureTracked('watching');
          if (!tracked) return;
          effectiveListId = tracked.tracking_list_id || tracked;
        } catch (err) {
          console.error("Failed to track series automatically", err);
          return;
        }
      }
    }
    
    try {
      const url = action ? `/lists/${effectiveListId}/toggle-series-episode?action=${action}` : `/lists/${effectiveListId}/toggle-series-episode`;
      const res = await apiClient.post(url, {
        episode_id: ep.id,
        title: ep.title || `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled Episode'}`,
        image_url: ep.image_url || ep.image?.original || ep.image?.medium || ep.still_path || selectedItem.image_url,
        overview: ep.custom_notes || ep.overview,
        season_number: ep.season_number,
        episode_number: ep.episode_number
      });
      
      const listRes = await apiClient.get(`/lists/${effectiveListId}`);
      const updatedList = listRes.data.items || [];
      setEpisodes(updatedList);

      if (selectedItem && (selectedItem.external_id === `tvm-ep-${ep.id}` || selectedItem.id === ep.id || selectedItem.rawEpisodeId === ep.id)) {
        setSelectedItem((prev: any) => prev ? { ...prev, completed_at: res.data.completed_at, is_completed: res.data.is_completed } : null);
      }
      
      await checkCompletionStatus(effectiveListId, updatedList);
      onUpdate();
    } catch (err) {
      console.error("Failed to toggle episode", err);
    }
  };

  const handleSavePagesRead = async (val: number) => {
    if (!selectedItem) return;
    try {
      let targetId = selectedItem.id;
      if (!targetId) {
        const defaultStatus = ['book', 'comic', 'manga'].includes(selectedItem.item_type) ? 'reading' : (selectedItem.item_type === 'game' ? 'playing' : 'watching');
        const tracked = await ensureTracked(defaultStatus);
        if (tracked) targetId = tracked.id;
      }
      if (targetId) {
        const res = await apiClient.put(`/library/${targetId}`, {
          pages_read: val
        });
        setSelectedItem((prev: any) => prev ? { ...prev, pages_read: res.data.pages_read, status: res.data.status } : null);
        onUpdate && onUpdate();
      }
    } catch (err) {
      console.error("Failed to update pages read", err);
    }
  };

  const isEpisode = !!(String(selectedItem?.external_id || '').startsWith('tvm-ep-') || selectedItem?.item_type === 'episode' || selectedItem?.list_id);
  const ratings = (itemReviews || []).filter(r => r.rating !== null && r.rating !== 0).map(r => r.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null;

  const getEpisodeHeaderInfo = () => {
    if (!isEpisode) return null;
    let seriesName = selectedItem.parent_series?.title || selectedItem.series_title || '';
    let seasonNum = selectedItem.season_number;
    let episodeNum = selectedItem.episode_number;
    let episodeName = selectedItem.episode_name || '';

    const rawTitle = selectedItem.title || '';
    const matchFull = rawTitle.match(/^(.*?)\s*-\s*S(\d+)E(\d+)\s*-\s*(.*)$/i);
    if (matchFull) {
      if (!seriesName) seriesName = matchFull[1].trim();
      if (!seasonNum) seasonNum = parseInt(matchFull[2], 10);
      if (!episodeNum) episodeNum = parseInt(matchFull[3], 10);
      if (!episodeName) episodeName = matchFull[4].trim();
    } else {
      const matchSimple = rawTitle.match(/^(.*?)\s*-\s*S(\d+)E(\d+)/i);
      if (matchSimple) {
        if (!seriesName) seriesName = matchSimple[1].trim();
        if (!seasonNum) seasonNum = parseInt(matchSimple[2], 10);
        if (!episodeNum) episodeNum = parseInt(matchSimple[3], 10);
      }
    }

    if (!episodeName && rawTitle) {
      const cleaned = rawTitle.replace(/^(.*?)\s*-\s*S\d+E\d+\s*-\s*/i, '').trim();
      episodeName = cleaned || rawTitle;
    }
    if (!episodeName) {
      episodeName = language === 'es' ? 'Episodio sin título' : 'Untitled Episode';
    }

    const sStr = seasonNum !== undefined && seasonNum !== null ? (seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`) : null;
    const eStr = episodeNum !== undefined && episodeNum !== null ? (episodeNum < 10 ? `0${episodeNum}` : `${episodeNum}`) : null;

    return {
      seriesName: seriesName || (selectedItem.parent_series ? selectedItem.parent_series.title : null),
      seasonNum,
      episodeNum,
      seasonBadge: sStr && eStr ? (language === 'es' ? `Temporada ${seasonNum} • Episodio ${episodeNum}` : `Season ${seasonNum} • Episode ${episodeNum}`) : null,
      episodeName
    };
  };

  const epHeaderInfo = isEpisode ? getEpisodeHeaderInfo() : null;

  const getModalTheme = () => {
    let cat = selectedItem?.item_type || 'movie';
    if (isEpisode) {
      if (selectedItem.parent_series?.item_type === 'anime' || selectedItem.category === 'anime') {
        cat = 'anime';
      } else {
        cat = 'series';
      }
    }

    const colorConfig: Record<string, { accent: string; text: string; border: string; glow: string }> = {
      movie: {
        accent: 'var(--color-movie)',
        text: 'var(--color-text-movie)',
        border: 'rgba(74, 222, 128, 0.35)',
        glow: 'rgba(74, 222, 128, 0.25)'
      },
      series: {
        accent: 'var(--color-series)',
        text: 'var(--color-text-series)',
        border: 'rgba(253, 224, 71, 0.35)',
        glow: 'rgba(253, 224, 71, 0.25)'
      },
      anime: {
        accent: 'var(--color-anime)',
        text: 'var(--color-text-anime)',
        border: 'rgba(251, 146, 60, 0.35)',
        glow: 'rgba(251, 146, 60, 0.25)'
      },
      game: {
        accent: 'var(--color-game)',
        text: 'var(--color-text-game)',
        border: 'rgba(192, 132, 252, 0.35)',
        glow: 'rgba(192, 132, 252, 0.25)'
      },
      comic: {
        accent: 'var(--color-comic)',
        text: 'var(--color-text-comic)',
        border: 'rgba(248, 113, 113, 0.35)',
        glow: 'rgba(248, 113, 113, 0.25)'
      },
      manga: {
        accent: 'var(--color-manga)',
        text: 'var(--color-text-manga)',
        border: 'rgba(96, 165, 250, 0.35)',
        glow: 'rgba(96, 165, 250, 0.25)'
      },
      book: {
        accent: 'var(--color-book)',
        text: 'var(--color-text-book)',
        border: 'rgba(180, 83, 9, 0.4)',
        glow: 'rgba(180, 83, 9, 0.3)'
      },
      music: {
        accent: 'var(--color-user)',
        text: 'var(--color-text-user)',
        border: 'rgba(244, 114, 182, 0.35)',
        glow: 'rgba(244, 114, 182, 0.25)'
      }
    };
    const cfg = colorConfig[cat] || colorConfig.movie;
    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
    const bgGradient = isLightMode
      ? `linear-gradient(180deg, ${cfg.border} 0%, rgba(255, 255, 255, 0.98) 45%)`
      : `linear-gradient(180deg, ${cfg.border} 0%, rgba(9, 13, 22, 0.98) 45%)`;


    return {
      category: cat,
      ...cfg,
      cssVariables: {
        '--accent-primary': cfg.accent,
        '--accent-secondary': cfg.accent,
        '--accent-hover': cfg.accent,
        '--border-color': cfg.border,
        '--border-glow': cfg.glow,
        '--card-shadow': `0 20px 50px -10px ${cfg.glow}`
      } as React.CSSProperties,
      modalStyles: {
        background: bgGradient,
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 25px 50px rgba(0,0,0,0.6), 0 0 35px ${cfg.glow}`
      }
    };
  };

  const modalTheme = getModalTheme();

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
              zIndex: 2000,
              ...modalTheme.cssVariables
            }}
          >
            <div
              className="glass-card"
              style={{
                position: 'relative',
                width: '650px',
                maxHeight: '90vh',
                padding: '4rem 2rem 2rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto',
                textAlign: 'left',
                ...modalTheme.modalStyles,
                ...modalTheme.cssVariables
              }}
            >

              {/* Back Button (for episode or game history navigation) */}

              {(isEpisode || historyStack.length > 0) && (
                <button
                    onClick={async () => {
                      if (historyStack.length > 0) {
                        handleGoBackHistory();
                        return;
                      }
                      if (selectedItem.parent_series && selectedItem.parent_series.external_id && onOpenItem) {
                        onOpenItem(selectedItem.parent_series);
                      } else if (onOpenItem) {
                        try {
                            if (selectedItem.list_id || selectedItem.tracking_list_id) {
                              const libRes = await apiClient.get('/library/');
                              const libraryItems = libRes.data || [];
                              const parentSeriesInLib = libraryItems.find((li: any) => 
                                (li.item_type === 'series' || li.item_type === 'anime') && 
                                li.tracking_list_id && 
                                (li.tracking_list_id === selectedItem.tracking_list_id || li.tracking_list_id === selectedItem.list_id)
                              );
                              if (parentSeriesInLib) {
                                 onOpenItem(parentSeriesInLib);
                                 return;
                              }
                            }
                            
                            const match = selectedItem.title?.match(/^(.*?)\s*-\s*S(\d+)E(\d+)/i);
                            const seriesName = selectedItem.parent_series?.title || selectedItem.series_title || selectedItem.last_seen_episode || (match ? match[1].trim() : null);
                            
                            if (seriesName) {
                               const searchRes = await apiClient.get(`/search?q=${encodeURIComponent(seriesName)}&type=series`);
                               if (searchRes.data && searchRes.data.length > 0) {
                                  const matchedSeries = searchRes.data[0];
                                  const libRes2 = await apiClient.get('/library/');
                                  const libSeries = (libRes2.data || []).find((li: any) => 
                                     li.external_id === matchedSeries.external_id || 
                                     ( (li.item_type === 'series' || li.item_type === 'anime') && li.title.toLowerCase() === matchedSeries.title.toLowerCase() )
                                  );
                                  onOpenItem(libSeries || matchedSeries);
                                  return;
                               }
                            }
                            onClose();
                        } catch {
                            onClose();
                        }
                      } else {
                        onClose();
                      }
                    }}
                  style={{ 
                    position: 'absolute',
                    top: '1.25rem',
                    left: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    zIndex: 10
                  }}
                  title={historyStack.length > 0 ? (language === 'es' ? 'Volver al elemento anterior' : 'Back to previous item') : (language === 'es' ? 'Volver a la serie' : 'Back to series')}
                >
                  <ArrowLeft size={16} />
                  <span>{language === 'es' ? 'Volver' : 'Back'}</span>
                </button>
              )}

              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {isEpisode && epHeaderInfo ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {epHeaderInfo.seriesName && (
                        <div 
                          onClick={async () => {
                            if (selectedItem.parent_series && onOpenItem) {
                              onOpenItem(selectedItem.parent_series);
                            } else {
                              handleGoBackHistory();
                            }
                          }}
                          style={{ 
                            fontSize: '0.9rem', 
                            fontWeight: 600, 
                            color: 'var(--accent-primary)', 
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            width: 'fit-content'
                          }}
                          title={language === 'es' ? 'Ver serie completa' : 'View full series'}
                        >
                          <span>{epHeaderInfo.seriesName}</span>
                        </div>
                      )}

                      <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.25' }}>
                        {epHeaderInfo.episodeName}
                      </h2>

                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {epHeaderInfo.seasonBadge && (
                          <span style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                          }}>
                            {epHeaderInfo.seasonBadge}
                          </span>
                        )}

                        {avgRating && (
                          <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                            ★ {avgRating} / 5 ({ratings.length} {language === 'es' ? 'val.' : 'ratings'})
                          </span>
                        )}
                        {selectedItem.completed_at && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            ✓ {language === 'es' ? 'Visto el: ' : 'Watched on: '}
                            {formatDate(new Date(selectedItem.completed_at))}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{selectedItem.title}</h2>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        {selectedItem?.item_type !== 'episode' && (
                          <span className={`tag-badge tag-${selectedItem?.item_type || 'movie'}`} style={{ fontSize: '0.7rem' }}>
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
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Button + (Add to Shelf / Follow) */}
                  {user && !isEpisode && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={handleAddToShelf}
                        className="btn-secondary"
                        title={language === 'es' ? 'Seguir / Añadir' : 'Follow / Add'}
                        style={{
                          padding: '0.4rem',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: selectedItem?.id ? `var(--color-${selectedItem.item_type || 'movie'})` : 'var(--bg-tertiary)',
                          borderColor: selectedItem?.id ? `var(--color-${selectedItem.item_type || 'movie'})` : 'var(--border-color)',
                          color: selectedItem?.id ? `var(--color-text-${selectedItem.item_type || 'movie'})` : 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={18} />
                      </button>

                      {showShelfMenu && selectedItem?.id && (
                        <div
                          className="glass-card"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            zIndex: 3000,
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            minWidth: '220px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                          }}
                        >
                          {selectedItem.item_type !== 'series' && selectedItem.item_type !== 'anime' && (
                            <button
                              type="button"
                              onClick={handleMarkConsumedAgain}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                                padding: '0.4rem 0.6rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                              }}
                            >
                              <span>🔁</span>
                              {selectedItem.item_type === 'movie' 
                                ? (language === 'es' ? 'Volver a marcar como vista' : 'Mark as seen again')
                                : selectedItem.item_type === 'game'
                                ? (language === 'es' ? 'Volver a marcar como jugado' : 'Mark as played again')
                                : ['book', 'comic', 'manga'].includes(selectedItem.item_type)
                                ? (language === 'es' ? 'Volver a marcar como leído' : 'Mark as read again')
                                : (language === 'es' ? 'Volver a marcar' : 'Mark again')
                              }
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={handleRemoveFromShelf}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              textAlign: 'left',
                              padding: '0.4rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            <Trash2 size={14} />
                            {language === 'es' ? 'Quitar de estantería' : 'Remove from shelf'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completion Tick Button for Episodes (Top Right) */}
                  {user && isEpisode && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          const isComplete = !!(selectedItem.completed_at || selectedItem.is_completed);
                          if (isComplete) {
                            setShowEpisodeMenu(!showEpisodeMenu);
                          } else {
                            await handleToggleEpisode(selectedItem.list_id || selectedItem.tracking_list_id, {
                              id: selectedItem.rawEpisodeId || (selectedItem.external_id ? parseInt(selectedItem.external_id.replace('tvm-ep-', '')) : selectedItem.id),
                              title: selectedItem.title,
                              image_url: selectedItem.image_url,
                              custom_notes: selectedItem.custom_notes,
                              season_number: selectedItem.season_number,
                              episode_number: selectedItem.episode_number
                            });
                          }
                        }}
                      title={language === 'es' ? 'Marcar como visto' : 'Mark as seen'}
                      style={{
                        background: (selectedItem.completed_at || selectedItem.is_completed) ? modalTheme.accent : 'transparent',
                        border: (selectedItem.completed_at || selectedItem.is_completed) ? 'none' : '2px solid var(--text-muted)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: (selectedItem.completed_at || selectedItem.is_completed) ? modalTheme.text : 'var(--text-muted)',
                        opacity: (selectedItem.completed_at || selectedItem.is_completed) ? 1 : 0.6,
                        transition: 'all 0.2s ease',
                        padding: 0
                      }}

                    >
                      <Check size={18} strokeWidth={3} />
                    </button>

                    {showEpisodeMenu && (selectedItem.completed_at || selectedItem.is_completed) && (
                        <div
                          className="glass-card"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            zIndex: 3000,
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            minWidth: '220px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                          }}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              setShowEpisodeMenu(false);
                              await handleToggleEpisode(selectedItem.list_id || selectedItem.tracking_list_id, {
                                id: selectedItem.rawEpisodeId || (selectedItem.external_id ? parseInt(selectedItem.external_id.replace('tvm-ep-', '')) : selectedItem.id),
                                title: selectedItem.title,
                                image_url: selectedItem.image_url,
                                custom_notes: selectedItem.custom_notes,
                                season_number: selectedItem.season_number,
                                episode_number: selectedItem.episode_number
                              }, 'mark_again');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              padding: '0.4rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            <span>🔁</span>
                            {language === 'es' ? 'Volver a marcar como visto' : 'Mark as seen again'}
                          </button>
                          
                          <button
                            type="button"
                            onClick={async () => {
                              setShowEpisodeMenu(false);
                              await handleToggleEpisode(selectedItem.list_id || selectedItem.tracking_list_id, {
                                id: selectedItem.rawEpisodeId || (selectedItem.external_id ? parseInt(selectedItem.external_id.replace('tvm-ep-', '')) : selectedItem.id),
                                title: selectedItem.title,
                                image_url: selectedItem.image_url,
                                custom_notes: selectedItem.custom_notes,
                                season_number: selectedItem.season_number,
                                episode_number: selectedItem.episode_number
                              }, 'remove');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              textAlign: 'left',
                              padding: '0.4rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            <Trash2 size={14} />
                            {language === 'es' ? 'Desmarcar / Quitar' : 'Unwatch / Remove'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Button ⋮ (Vertical 3 dots menu) */}
                  {user && selectedItem?.id && !isEpisode && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setShowMenu(!showMenu)}
                        className="btn-secondary"
                        title={language === 'es' ? 'Más opciones' : 'More options'}
                        style={{
                          padding: '0.4rem',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {showMenu && (
                        <div
                          className="glass-card"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            zIndex: 3000,
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            minWidth: '170px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                                onToggleFavorite && onToggleFavorite(selectedItem.id, isFavorite);
                                setShowMenu(false);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: isFavorite ? 'var(--accent-primary)' : 'var(--text-primary)',
                              textAlign: 'left',
                              padding: '0.4rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            <Heart size={14} fill={isFavorite ? 'var(--accent-primary)' : 'none'} />
                            {isFavorite
                              ? (language === 'es' ? 'Quitar Destacado' : 'Remove Featured')
                              : (language === 'es' ? 'Destacar (Favorito)' : 'Feature (Favorite)')
                            }
                          </button>
                          {selectedItem?.item_type !== 'movie' && (
                            <button
                              type="button"
                              onClick={handleMarkDropped}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: selectedItem?.status === 'dropped' ? '#3b82f6' : '#f59e0b',
                                textAlign: 'left',
                                padding: '0.4rem 0.6rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                              }}
                            >
                              {selectedItem?.status === 'dropped' ? (
                                selectedItem?.item_type === 'game' 
                                  ? (language === 'es' ? '▶️ Seguir jugando' : '▶️ Resume playing')
                                  : ['book', 'comic', 'manga'].includes(selectedItem?.item_type)
                                  ? (language === 'es' ? '▶️ Seguir leyendo' : '▶️ Resume reading')
                                  : (language === 'es' ? '▶️ Seguir viendo' : '▶️ Resume watching')
                              ) : (
                                `🚫 ${language === 'es' ? 'Marcar como abandonado' : 'Mark as dropped'}`
                              )}
                            </button>
                          )}
                          {selectedItem?.id && (
                            <button
                              type="button"
                              onClick={handleRemoveFromShelf}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                textAlign: 'left',
                                padding: '0.4rem 0.6rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                              }}
                            >
                              <Trash2 size={14} />
                              {language === 'es' ? 'Quitar de estantería' : 'Remove from shelf'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onClose()}
                    title={language === 'es' ? 'Cerrar' : 'Close'}
                    style={{
                      position: 'absolute',
                      top: '1.25rem',
                      right: '1.25rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
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
                      {selectedItem.image_url && selectedItem.image_url.includes('489599849927-2ee91cede3ba') && !shouldBlurCover && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '52%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0.5rem', textAlign: 'center', pointerEvents: 'none',
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 80%, transparent 100%)',
                          boxSizing: 'border-box', borderRadius: '8px 8px 0 0'
                        }}>
                          <span style={{
                            color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, lineHeight: '1.2',
                            textShadow: '0 2px 6px rgba(0,0,0,0.9)', letterSpacing: '0.02em',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                          }}>
                            {selectedItem.title}
                          </span>
                        </div>
                      )}
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
                    let cleanText = stripHtml(notes.description || '');
                    const isTranslatedView = language === 'es' && !showOriginalDesc && translatedDesc;
                    if (isTranslatedView) {
                      cleanText = stripHtml(translatedDesc);
                    }
                    
                    const shouldTruncate = cleanText.length > 180;
                    const displayedText = shouldTruncate && !descExpanded
                      ? cleanText.slice(0, 180).replace(/\.\.\.$/, '') + '...'
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
                            
                            {language === 'es' && (
                              <button
                                onClick={() => {
                                  if (showOriginalDesc) {
                                    handleTranslateDescription(notes.description || '');
                                  } else {
                                    setShowOriginalDesc(true);
                                  }
                                }}
                                disabled={isTranslating}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: isTranslating ? 'wait' : 'pointer',
                                  fontWeight: 500,
                                  fontSize: '0.8rem',
                                  marginTop: '0.35rem',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  opacity: isTranslating ? 0.7 : 1
                                }}
                              >
                                🌐 {isTranslating 
                                  ? 'Traduciendo...' 
                                  : (showOriginalDesc ? 'Ver traducción' : 'Mostrar texto original')
                                }
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '2rem' }}>
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
                          {selectedItem.item_type === 'movie' && (selectedItem.total_pages || selectedItem.page_count) && (
                            <div>
                              <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>
                                {language === 'es' ? 'Duración:' : 'Duration:'}
                              </h5>
                              <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {(() => { const m = selectedItem.total_pages || selectedItem.page_count; const h = Math.floor(m / 60); const mins = m % 60; return h > 0 ? `${h}h ${mins > 0 ? `${String(mins).padStart(2, '0')}m` : ''}` : `${mins}m`; })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Star rating selector */}
                  <div>
                    <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Tu Calificación:' : 'Your Rating:'}</h5>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          disabled={!user || !isItemTracked}
                          onClick={() => handleSaveRating(star)}
                          title={!isItemTracked 
                            ? (language === 'es' ? 'Añade este elemento a tu estantería para calificarlo' : 'Add this item to your shelf to rate it')
                            : `${star} ${star === 1 ? 'estrella' : 'estrellas'}`
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: (user && isItemTracked) ? 'pointer' : 'not-allowed',
                            padding: 0,
                            opacity: (user && isItemTracked) ? 1 : 0.35,
                            transition: 'opacity 0.2s ease'
                          }}
                        >
                          <Star
                            size={24}
                            fill={star <= userRating ? '#f59e0b' : 'none'}
                            color={star <= userRating ? '#f59e0b' : 'var(--text-muted)'}
                          />
                        </button>
                      ))}
                      {user && isItemTracked && userRating > 0 && (
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
                    {!isItemTracked && user && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginTop: '0.25rem' }}>
                        {language === 'es' 
                          ? 'Añade este elemento a tu estantería para poder puntuarlo con estrellas.'
                          : 'Add this item to your shelf to rate it with stars.'}
                      </span>
                    )}
                  </div>

                  {/* Favorite toggler moved to 3-dots menu */}

                  {/* Modern & Comfortable Pages Read Picker for books, comics and mangas */}
                  {!isEpisode && selectedItem && ['book', 'comic', 'manga'].includes(selectedItem.item_type) && (
                    ['reading', 'dropped'].includes(selectedItem.status) || (hasInteractedWithTime && selectedItem.status === 'read')
                  ) && (() => {
                    const currentPages = typeof pagesReadVal === 'number' ? pagesReadVal : 0;
                    const maxPages = (typeof totalPagesVal === 'number' && totalPagesVal > 0) ? totalPagesVal : 0;
                    const progressPercent = maxPages > 0 ? Math.min(100, Math.round((currentPages / maxPages) * 100)) : 0;

                    const handleUpdatePages = (newPages: number) => {
                      setHasInteractedWithTime(true);
                      let finalPages = Math.max(0, isNaN(newPages) ? 0 : newPages);
                      if (maxPages > 0) {
                        if (finalPages >= maxPages) {
                          finalPages = maxPages;
                          if (selectedItem.status !== 'read') {
                            handleToggleStatus('read');
                          }
                        } else if (selectedItem.status === 'read') {
                          handleToggleStatus('reading');
                        }
                      }
                      setPagesReadVal(finalPages);
                      handleSavePagesRead(finalPages);
                    };

                    const handleTotalPagesBlur = () => {
                      const finalTotal = (totalPagesVal === '' || totalPagesVal === 0) ? null : totalPagesVal;
                      setTotalPagesVal(totalPagesVal);
                      if (selectedItem.id) {
                        apiClient.put(`/library/${selectedItem.id}`, { total_pages: finalTotal }).then(() => {
                          setSelectedItem((prev: any) => prev ? { ...prev, total_pages: finalTotal } : null);
                          onUpdate && onUpdate();
                        });
                      }
                    };

                    return (
                      <div style={{
                        marginTop: '0.6rem',
                        padding: '0.65rem 0.9rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {/* Main row: Label + [ Pages Read ] / [ Total Pages ] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <BookOpen size={15} color="var(--accent-primary)" />
                            {language === 'es' ? 'Páginas leídas:' : 'Pages read:'}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {/* Current Pages Input Box */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.4rem',
                              gap: '0.2rem'
                            }}>
                              <input
                                type="number"
                                min={0}
                                max={maxPages > 0 ? maxPages : 99999}
                                disabled={!user}
                                value={currentPages === 0 ? (pagesReadVal === '' ? '' : 0) : currentPages}
                                placeholder="0"
                                onFocus={() => {
                                  if (pagesReadVal === 0) setPagesReadVal('');
                                }}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                                  if (typeof val === 'number') {
                                    handleUpdatePages(val);
                                  } else {
                                    setPagesReadVal('');
                                  }
                                }}
                                onBlur={() => {
                                  if (pagesReadVal === '') handleUpdatePages(0);
                                }}
                                onWheel={(e) => {
                                  if (user) {
                                    handleUpdatePages(currentPages + (e.deltaY < 0 ? 1 : -1));
                                  }
                                }}

                                style={{
                                  width: '46px',
                                  textAlign: 'center',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  outline: 'none',
                                  padding: 0
                                }}
                              />
                            </div>

                            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>/</span>

                            {/* Total Pages Input Box (Editable if needed) */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.4rem',
                              gap: '0.2rem'
                            }}>
                              <input
                                type="number"
                                min={0}
                                max={99999}
                                disabled={!user}
                                value={totalPagesVal}
                                placeholder={language === 'es' ? 'Total' : 'Total'}
                                onFocus={() => {
                                  if (totalPagesVal === 0) setTotalPagesVal('');
                                }}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                                  setTotalPagesVal(val);
                                }}
                                onBlur={handleTotalPagesBlur}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleTotalPagesBlur();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                style={{
                                  width: '46px',
                                  textAlign: 'center',
                                  background: 'transparent',
                                  border: 'none',
                                  color: totalPagesVal ? 'var(--text-primary)' : 'var(--text-muted)',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  outline: 'none',
                                  padding: 0
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {language === 'es' ? 'págs' : 'pages'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Subtle Progress Slider when Total Pages is Known */}
                        {user && maxPages > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                            <input
                              type="range"
                              min={0}
                              max={maxPages}
                              value={currentPages}
                              onChange={(e) => handleUpdatePages(parseInt(e.target.value) || 0)}
                              style={{
                                width: '100%',
                                accentColor: 'var(--accent-primary)',
                                cursor: 'pointer',
                                height: '5px'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>
                              {progressPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}


                  {/* Clean & Comfortable Hours and Minutes Picker */}
                  {!isEpisode && selectedItem && ( 
                    (selectedItem.item_type === 'game' && ['completed', 'playing', 'dropped', 'endless'].includes(selectedItem.status)) || 
                    (selectedItem.item_type === 'movie' && (['watching', 'dropped'].includes(selectedItem.status) || (hasInteractedWithTime && selectedItem.status === 'completed'))) 
                  ) && (() => {
                    const currentTotalMins = typeof pagesReadVal === 'number' ? pagesReadVal : 0;
                    const currentHours = Math.floor(currentTotalMins / 60);
                    const currentMinutes = currentTotalMins % 60;
                    const maxDurationMins = selectedItem.total_pages || selectedItem.page_count || 0;

                    const updateDuration = (newTotalMins: number) => {
                      setHasInteractedWithTime(true);
                      let finalMins = Math.max(0, newTotalMins);
                      if (selectedItem.item_type === 'movie' && maxDurationMins > 0) {
                        if (finalMins >= maxDurationMins) {
                          finalMins = maxDurationMins;
                          if (selectedItem.status !== 'completed') {
                            handleToggleStatus('completed');
                          }
                        } else if (selectedItem.status === 'completed') {
                          handleToggleStatus('watching');
                        }
                      }
                      setPagesReadVal(finalMins);
                      handleSavePagesRead(finalMins);
                    };

                    const handleHoursChange = (h: number) => {
                      const validH = Math.max(0, isNaN(h) ? 0 : h);
                      updateDuration(validH * 60 + currentMinutes);
                    };

                    const handleMinutesChange = (m: number) => {
                      let validM = isNaN(m) ? 0 : m;
                      if (validM >= 60) {
                        updateDuration((currentHours + Math.floor(validM / 60)) * 60 + (validM % 60));
                      } else if (validM < 0) {
                        updateDuration(Math.max(0, currentHours * 60 + validM));
                      } else {
                        updateDuration(currentHours * 60 + validM);
                      }
                    };


                    return (
                      <div style={{
                        marginTop: '0.6rem',
                        padding: '0.65rem 0.9rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {/* Main row: Label + [ HH ] h : [ MM ] min + Total Duration */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={15} color="var(--accent-primary)" />
                            {selectedItem.item_type === 'movie' 
                              ? (language === 'es' ? 'Tiempo visto:' : 'Time watched:')
                              : (language === 'es' ? 'Horas jugadas:' : 'Hours played:')}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {/* Hours Input Box */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.4rem',
                              gap: '0.2rem'
                            }}>
                              <input
                                type="number"
                                min={0}
                                max={999}
                                disabled={!user}
                                value={currentHours}
                                onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
                                onWheel={(e) => {
                                  if (user) {
                                    handleHoursChange(currentHours + (e.deltaY < 0 ? 1 : -1));
                                  }
                                }}
                                style={{
                                  width: '32px',
                                  textAlign: 'center',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  outline: 'none',
                                  padding: 0
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>h</span>
                            </div>

                            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>:</span>

                            {/* Minutes Input Box */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.4rem',
                              gap: '0.2rem'
                            }}>
                              <input
                                type="number"
                                min={0}
                                max={59}
                                disabled={!user}
                                value={String(currentMinutes).padStart(2, '0')}
                                onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
                                onWheel={(e) => {
                                  if (user) {
                                    handleMinutesChange(currentMinutes + (e.deltaY < 0 ? 1 : -1));
                                  }
                                }}

                                style={{
                                  width: '32px',
                                  textAlign: 'center',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  outline: 'none',
                                  padding: 0
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>m</span>
                            </div>

                            {maxDurationMins > 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                                / {Math.floor(maxDurationMins / 60)}h {String(maxDurationMins % 60).padStart(2, '0')}m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subtle Progress Slider for Movies */}
                        {user && maxDurationMins > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                            <input
                              type="range"
                              min={0}
                              max={maxDurationMins}
                              value={currentTotalMins}
                              onChange={(e) => updateDuration(parseInt(e.target.value) || 0)}
                              style={{
                                width: '100%',
                                accentColor: 'var(--accent-primary)',
                                cursor: 'pointer',
                                height: '5px'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>
                              {Math.min(100, Math.round((currentTotalMins / maxDurationMins) * 100))}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}



                  {/* Completion / Status Buttons */}
                  {user && !isEpisode && selectedItem?.item_type !== 'series' && selectedItem?.item_type !== 'anime' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {selectedItem?.item_type === 'game' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus('playing')}
                            style={{
                              background: selectedItem?.status === 'playing' ? 'var(--color-game)' : 'var(--bg-tertiary)',
                              border: selectedItem?.status === 'playing' ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: selectedItem?.status === 'playing' ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {language === 'es' ? 'Jugando' : 'Playing'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus('completed')}
                            style={{
                              background: selectedItem?.status === 'completed' ? 'var(--color-game)' : 'var(--bg-tertiary)',
                              border: selectedItem?.status === 'completed' ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: selectedItem?.status === 'completed' ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {language === 'es' ? 'Completado' : 'Completed'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus('endless')}
                            style={{
                              background: selectedItem?.status === 'endless' ? '#8b5cf6' : 'var(--bg-tertiary)',
                              border: selectedItem?.status === 'endless' ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: selectedItem?.status === 'endless' ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {language === 'es' ? 'Infinito' : 'Endless'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus('dropped')}
                            style={{
                              background: selectedItem?.status === 'dropped' ? '#ef4444' : 'var(--bg-tertiary)',
                              border: selectedItem?.status === 'dropped' ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: selectedItem?.status === 'dropped' ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {language === 'es' ? 'Abandonado' : 'Dropped'}
                          </button>
                        </div>
                      ) : ['movie', 'book', 'comic', 'manga'].includes(selectedItem?.item_type) ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const isCurrentlyActive = selectedItem.status === (['book', 'comic', 'manga'].includes(selectedItem.item_type) ? 'read' : 'completed');
                              if (!isCurrentlyActive) {
                                if (['book', 'comic', 'manga'].includes(selectedItem.item_type) && totalPagesVal !== '') {
                                  // Auto-fill pages_read to totalPagesVal
                                  setPagesReadVal(totalPagesVal);
                                  if (selectedItem.id) {
                                    apiClient.put(`/library/${selectedItem.id}`, { pages_read: totalPagesVal }).catch(console.error);
                                  }
                                } else if (selectedItem.item_type === 'movie') {
                                  const movieTotal = selectedItem.total_pages || selectedItem.page_count;
                                  if (movieTotal) {
                                    setPagesReadVal(movieTotal);
                                    if (selectedItem.id) {
                                      apiClient.put(`/library/${selectedItem.id}`, { pages_read: movieTotal }).catch(console.error);
                                    }
                                  }
                                }
                              }
                              handleToggleStatus(['book', 'comic', 'manga'].includes(selectedItem.item_type) ? 'read' : 'completed');
                            }}
                            style={{
                              background: ['completed', 'read'].includes(selectedItem?.status) ? (selectedItem.item_type === 'movie' ? 'var(--color-movie)' : 'var(--color-book)') : 'var(--bg-tertiary)',
                              border: ['completed', 'read'].includes(selectedItem?.status) ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: ['completed', 'read'].includes(selectedItem?.status) ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {['book', 'comic', 'manga'].includes(selectedItem.item_type) ? (language === 'es' ? 'Leído' : 'Read') : (language === 'es' ? 'Visto' : 'Watched')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(['book', 'comic', 'manga'].includes(selectedItem.item_type) ? 'reading' : 'watching')}
                            style={{
                              background: ['watching', 'reading'].includes(selectedItem?.status) ? '#3b82f6' : 'var(--bg-tertiary)',
                              border: ['watching', 'reading'].includes(selectedItem?.status) ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: ['watching', 'reading'].includes(selectedItem?.status) ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {['book', 'comic', 'manga'].includes(selectedItem.item_type) ? (language === 'es' ? 'Leyendo' : 'Reading') : (language === 'es' ? 'Pausa' : 'Paused')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus('dropped')}
                            style={{
                              background: selectedItem?.status === 'dropped' ? '#ef4444' : 'var(--bg-tertiary)',
                              border: selectedItem?.status === 'dropped' ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              color: selectedItem?.status === 'dropped' ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {language === 'es' ? 'Abandonado' : 'Dropped'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            disabled={!isOwnProfile}
                            onClick={handleMarkCompleted}
                            style={{
                              background: (selectedItem?.status === 'completed' || selectedItem?.status === 'read') ? `var(--color-${selectedItem.item_type || 'movie'})` : 'var(--bg-tertiary)',
                              border: (selectedItem?.status === 'completed' || selectedItem?.status === 'read') ? 'none' : '1px solid var(--border-color)',
                              borderRadius: '20px',
                              padding: '0.45rem 1rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: isOwnProfile ? 'pointer' : 'default',
                              color: (selectedItem?.status === 'completed' || selectedItem?.status === 'read') ? `var(--color-text-${selectedItem.item_type || 'movie'})` : 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Check size={16} strokeWidth={3} />
                            <span>
                              {(selectedItem?.status === 'completed' || selectedItem?.status === 'read')
                                ? (selectedItem.item_type === 'game' ? (language === 'es' ? 'Jugado' : 'Played') : (language === 'es' ? 'Visto' : 'Watched'))
                                : (selectedItem.item_type === 'game' ? (language === 'es' ? 'Marcar como jugado' : 'Mark as played') : (language === 'es' ? 'Marcar como visto' : 'Mark as seen'))
                              }
                            </span>
                          </button>
                        </div>
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
                      const isSeasonDone = (() => {
                        const listSeps = (episodes || []).filter(x => x.section === `Season ${s.season_number}`);
                        const seriesEps = seasonEpisodes[s.season_number] || [];
                        if (!Array.isArray(seriesEps)) return false;
                        if (seriesEps.length === 0) return listSeps.length > 0 && listSeps.every(x => x.is_completed);
                        return seriesEps.every((te: any) => globalProgress[`tvm-ep-${te.id}`] || (episodes || []).some(x => x.external_id === `tvm-ep-${te.id}` && x.is_completed));
                      })();
                      return (
                        <div key={s.id || s.season_number} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div
                            role="button"
                            tabIndex={0}
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
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  let effectiveListId = selectedItem.tracking_list_id;
                                  if (!effectiveListId) {
                                    const tracked = await ensureTracked('watching');
                                    if (!tracked) return;
                                    effectiveListId = tracked.tracking_list_id || tracked;
                                  }
                                  
                                  const checkedVal = !isSeasonDone;
                                  let seriesEps = seasonEpisodes[s.season_number];
                                  if (!seriesEps || seriesEps.length === 0) {
                                    const cacheKeyAll = `${selectedItem.external_id}_all_episodes`;
                                    const cachedAll = getCachedSeries(cacheKeyAll);
                                    if (cachedAll && Array.isArray(cachedAll)) {
                                      seriesEps = cachedAll.filter((ep: any) => ep.season_number === s.season_number);
                                    }
                                  }
                                  
                                  // Update global progress optimistically
                                  if (seriesEps && seriesEps.length > 0) {
                                    const newProg: Record<string, boolean> = {};
                                    seriesEps.forEach((ep: any) => {
                                      newProg[`tvm-ep-${ep.id}`] = checkedVal;
                                    });
                                    setGlobalProgress(prev => ({ ...prev, ...newProg }));
                                  }

                                  try {
                                    await apiClient.post(`/lists/${effectiveListId}/bulk-toggle-season`, {
                                      season_number: s.season_number,
                                      episodes: seriesEps || null,
                                      completed: checkedVal
                                    });
                                    
                                    const listRes = await apiClient.get(`/lists/${effectiveListId}`);
                                    const updatedList = listRes.data.items || [];
                                    setEpisodes(updatedList);
                                    
                                    // Also sync global progress in case backend populated new episodes
                                    const extIds = updatedList.map((x: any) => x.external_id).filter(Boolean);
                                    if (extIds.length > 0) {
                                      const progRes = await apiClient.post('/users/me/progress/bulk-check', { external_ids: extIds });
                                      setGlobalProgress(prev => ({ ...prev, ...progRes.data }));
                                    }

                                    await checkCompletionStatus(effectiveListId, updatedList);
                                    onUpdate && onUpdate();
                                  } catch (err) {
                                    console.error("Bulk toggle failed", err);
                                  }
                                }}
                                style={{
                                  background: isSeasonDone ? `var(--color-${selectedItem.item_type || 'movie'})` : 'transparent',
                                  border: isSeasonDone ? 'none' : '1px solid var(--border-color)',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  marginRight: '0.6rem',
                                  verticalAlign: 'middle',
                                  color: isSeasonDone ? `var(--color-text-${selectedItem.item_type || 'movie'})` : 'var(--text-muted)',
                                  opacity: isSeasonDone ? 1 : 0.6,
                                  padding: 0,
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <Check size={12} strokeWidth={3} />
                              </span>
                              {language === 'es' ? `Temporada ${s.season_number}` : `Season ${s.season_number}`}
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
                                ({s.episode_count} {language === 'es' ? 'capítulos' : 'episodes'})
                              </span>
                            </span>
                            <span>{isSeasonActive ? '▼' : '►'}</span>
                          </div>

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
                                  const dbEp = (episodes || []).find(x => x.external_id === `tvm-ep-${ep.id}`);
                                  const isCompleted = !!globalProgress[`tvm-ep-${ep.id}`] || !!dbEp?.is_completed;
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
                                        <div style={{ position: 'relative' }}>
                                          <button
                                            type="button"
                                            disabled={!user}
                                            onClick={() => {
                                              const currentIsCompleted = !!globalProgress[`tvm-ep-${ep.id}`] || !!dbEp?.is_completed;
                                              if (currentIsCompleted) {
                                                setOpenEpisodeMenuId(openEpisodeMenuId === ep.id ? null : ep.id);
                                              } else {
                                                setGlobalProgress(prev => ({ ...prev, [`tvm-ep-${ep.id}`]: true }));
                                                handleToggleEpisode(selectedItem.tracking_list_id, ep);
                                              }
                                            }}
                                            style={{
                                              background: isCompleted ? `var(--color-${selectedItem.item_type || 'movie'})` : 'transparent',
                                              border: isCompleted ? 'none' : '1px solid var(--border-color)',
                                              borderRadius: '50%',
                                              width: '20px',
                                              height: '20px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: user ? 'pointer' : 'default',
                                              color: isCompleted ? `var(--color-text-${selectedItem.item_type || 'movie'})` : 'var(--text-muted)',
                                              opacity: isCompleted ? 1 : 0.6,
                                              transition: 'all 0.2s ease',
                                              padding: 0
                                            }}
                                          >
                                            <Check size={12} strokeWidth={3} />
                                          </button>

                                          {openEpisodeMenuId === ep.id && isCompleted && (
                                            <div
                                              className="glass-card"
                                              style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                marginTop: '0.5rem',
                                                zIndex: 3000,
                                                padding: '0.5rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.4rem',
                                                minWidth: '220px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                                              }}
                                            >
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  setOpenEpisodeMenuId(null);
                                                  await handleToggleEpisode(selectedItem.tracking_list_id, ep, 'mark_again');
                                                }}
                                                style={{
                                                  background: 'transparent',
                                                  border: 'none',
                                                  color: 'var(--text-primary)',
                                                  textAlign: 'left',
                                                  padding: '0.4rem 0.6rem',
                                                  cursor: 'pointer',
                                                  fontSize: '0.85rem',
                                                  borderRadius: '4px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '0.4rem'
                                                }}
                                              >
                                                <span>🔁</span>
                                                {language === 'es' ? 'Volver a marcar como visto' : 'Mark as seen again'}
                                              </button>
                                              
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  setOpenEpisodeMenuId(null);
                                                  setGlobalProgress(prev => ({ ...prev, [`tvm-ep-${ep.id}`]: false }));
                                                  await handleToggleEpisode(selectedItem.tracking_list_id, ep, 'remove');
                                                }}
                                                style={{
                                                  background: 'transparent',
                                                  border: 'none',
                                                  color: '#ef4444',
                                                  textAlign: 'left',
                                                  padding: '0.4rem 0.6rem',
                                                  cursor: 'pointer',
                                                  fontSize: '0.85rem',
                                                  borderRadius: '4px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '0.4rem'
                                                }}
                                              >
                                                <Trash2 size={14} />
                                                {language === 'es' ? 'Desmarcar / Quitar' : 'Unwatch / Remove'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                          {ep.episode_number}. {ep.name || 'Untitled'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => onOpenItem && onOpenItem({
                                          id: dbEp ? dbEp.id : ep.id,
                                          list_id: selectedItem.tracking_list_id,
                                          item_type: 'episode',
                                          external_id: `tvm-ep-${ep.id}`,
                                          title: `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled'}`,
                                          image_url: ep.image_url || ep.image?.original || ep.image?.medium || ep.still_path || selectedItem.image_url,
                                          custom_notes: JSON.stringify({ description: ep.overview || '', release_date: ep.air_date || null }),
                                          completed_at: dbEp?.completed_at,
                                          is_completed: isCompleted,
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

              {/* Game Relations: Base Game, Collections, Editions, DLCs */}
              {selectedItem?.item_type === 'game' && !isEpisode && (gameRelations || isLoadingGameRelations) && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {isLoadingGameRelations && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      {language === 'es' ? 'Cargando contenido relacionado...' : 'Loading related content...'}
                    </div>
                  )}

                  {/* Parent Base Game (if current item is a DLC or expansion) */}
                  {gameRelations?.parent_game && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Gamepad2 size={16} color="var(--accent-primary)" />
                        {language === 'es' ? 'Juego Base Principal' : 'Base Game'}
                      </h5>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenRelatedGame(gameRelations.parent_game)}
                        className="glass-card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <div style={{ width: '40px', height: '52px', borderRadius: '4px', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                          {gameRelations.parent_game.image_url ? (
                            <img src={gameRelations.parent_game.image_url} alt={gameRelations.parent_game.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Gamepad2 size={18} /></div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {gameRelations.parent_game.title}
                          </span>
                          {gameRelations.parent_game.release_year && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {gameRelations.parent_game.release_year}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bundle Games (if current item is a collection or bundle) */}
                  {gameRelations?.bundle_games && gameRelations.bundle_games.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Package size={16} color="#10b981" />
                        {language === 'es' ? 'Juegos y Contenido de esta Colección' : 'Games in this Collection'}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({gameRelations.bundle_games.length})</span>
                      </h5>
                      <ModalScrollRow>
                        {gameRelations.bundle_games.map((g: any) => (
                          <div
                            key={g.id || g.external_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenRelatedGame(g)}
                            className="glass-card"
                            style={{
                              minWidth: '120px',
                              maxWidth: '120px',
                              padding: '0.4rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <div style={{ width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {g.image_url ? (
                                <img src={g.image_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Gamepad2 size={24} color="var(--text-muted)" />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>
                                {g.title}
                              </span>
                              {g.release_year && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.release_year}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </ModalScrollRow>
                    </div>
                  )}

                  {/* Collections Containing This Game */}
                  {gameRelations?.collections && gameRelations.collections.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Layers size={16} color="#3b82f6" />
                        {language === 'es' ? 'Incluido en Colecciones y Trilogías' : 'Included in Collections & Bundles'}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({gameRelations.collections.length})</span>
                      </h5>
                      <ModalScrollRow>
                        {gameRelations.collections.map((g: any) => (
                          <div
                            key={g.id || g.external_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenRelatedGame(g)}
                            className="glass-card"
                            style={{
                              minWidth: '120px',
                              maxWidth: '120px',
                              padding: '0.4rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <div style={{ width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {g.image_url ? (
                                <img src={g.image_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Package size={24} color="var(--text-muted)" />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>
                                {g.title}
                              </span>
                              {g.release_year && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.release_year}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </ModalScrollRow>
                    </div>
                  )}

                  {/* Editions and Versions */}
                  {gameRelations?.editions && gameRelations.editions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Sparkles size={16} color="#f59e0b" />
                        {language === 'es' ? 'Distintas Ediciones y Versiones' : 'Editions & Alternative Versions'}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({gameRelations.editions.length})</span>
                      </h5>
                      <ModalScrollRow>
                        {gameRelations.editions.map((g: any) => (
                          <div
                            key={g.id || g.external_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenRelatedGame(g)}
                            className="glass-card"
                            style={{
                              minWidth: '120px',
                              maxWidth: '120px',
                              padding: '0.4rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <div style={{ width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {g.image_url ? (
                                <img src={g.image_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Sparkles size={24} color="var(--text-muted)" />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>
                                {g.title}
                              </span>
                              {g.release_year && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.release_year}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </ModalScrollRow>
                    </div>
                  )}

                  {/* DLCs & Expansions */}
                  {gameRelations?.dlcs && gameRelations.dlcs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Puzzle size={16} color="#8b5cf6" />
                        {language === 'es' ? 'Expansiones y DLCs' : 'Expansions & DLCs'}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({gameRelations.dlcs.length})</span>
                      </h5>
                      <ModalScrollRow>
                        {gameRelations.dlcs.map((g: any) => (
                          <div
                            key={g.id || g.external_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenRelatedGame(g)}
                            className="glass-card"
                            style={{
                              minWidth: '120px',
                              maxWidth: '120px',
                              padding: '0.4rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <div style={{ width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {g.image_url ? (
                                <img src={g.image_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Puzzle size={24} color="var(--text-muted)" />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>
                                {g.title}
                              </span>
                              {g.release_year && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.release_year}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </ModalScrollRow>
                    </div>
                  )}

                </div>
              )}

              {/* Comment write area */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'es' ? 'Tu Comentario' : 'Your Comment'}</h4>
                <textarea
                  className="input-field"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder={language === 'es' ? '¿Qué te pareció este elemento? Escribe tu comentario aquí...' : 'What did you think of this item? Write your comment here...'}
                  style={{ width: '100%', minHeight: '80px', padding: '0.75rem', background: 'var(--bg-secondary)', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                  {userComment && (
                    <button
                      type="button"
                      onClick={handleDeleteComment}
                      disabled={isSavingReview}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        padding: '0.4rem 0.6rem'
                      }}
                    >
                      {language === 'es' ? 'Eliminar comentario' : 'Delete comment'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    className="btn-primary"
                    disabled={isSavingReview || !user}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                  >
                    {isSavingReview
                      ? (language === 'es' ? 'Guardando...' : 'Saving...')
                      : (language === 'es' ? 'Guardar Comentario' : 'Save Comment')
                    }
                  </button>
                </div>
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

              {/* Data Provider Attribution Footer */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {language === 'es' ? 'Datos y recursos provistos por ' : 'Data and resources powered by '}
                {selectedItem.item_type === 'game' && (
                  <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    IGDB / Twitch
                  </a>
                )}
                {selectedItem.item_type === 'book' && (
                  (selectedItem.external_id || '').startsWith('openlibrary-') ? (
                    <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      Open Library
                    </a>
                  ) : (
                    <a href="https://books.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      Google Books
                    </a>
                  )
                )}
                {selectedItem.item_type === 'movie' && (
                  <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    OMDb API
                  </a>
                )}
                {(selectedItem.item_type === 'series' || selectedItem.item_type === 'anime' || selectedItem.item_type === 'episode' || (selectedItem.external_id || '').startsWith('tvm-ep-')) && (
                  <a href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    TVMaze
                  </a>
                )}
                {selectedItem.item_type === 'manga' && (
                  <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    AniList
                  </a>
                )}
                {selectedItem.item_type === 'comic' && (
                  <a href="https://comicvine.gamespot.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    Comic Vine
                  </a>
                )}
                {selectedItem.item_type === 'music' && (
                  <a href="https://www.last.fm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    Last.fm
                  </a>
                )}
              </div>
            </div>
          </div>
        );
};
