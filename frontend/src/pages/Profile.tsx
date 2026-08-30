import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getProfileTheme } from '../utils/profileThemes';

import { apiClient } from '../api/client';
import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { MediaPoster } from '../components/MediaPoster';
import { AvatarSelectorModal } from '../components/AvatarSelectorModal';
import { BannerSelectorModal } from '../components/BannerSelectorModal';
import { BackgroundSelectorModal } from '../components/BackgroundSelectorModal';
import { ProModal } from '../components/ProModal';
import { ReplaceFavoriteModal } from '../components/ReplaceFavoriteModal';
import { AdBanner } from '../components/AdBanner';
import { ConfirmModal } from '../components/ConfirmModal';


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
  Settings,
  Star,
  UserPlus,
  UserCheck,
  Users,
  X,
  Pencil,
  Image as ImageIcon,
  Monitor,
  Crown,
  AlertTriangle,
  Lock,
  Music,
  ExternalLink,
  HelpCircle
} from 'lucide-react';

import { MusicServiceGuideModal } from '../components/MusicServiceGuideModal';





interface LibraryItem {
  id: number;
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'episode' | 'season' | string;
  external_id: string;
  title: string;
  image_url: string | null;
  imdb_id?: string;
  status: string;
  is_favorite: boolean;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
  last_seen_episode?: string;
  pages_read?: number;
  total_pages?: number;
  tracking_list_id?: number;
  is_nsfw?: boolean;
}



interface UserProfile {
  id: number;
  username: string;
  email: string;
  photo_url: string;
  banner_url?: string;
  background_url?: string;
  is_admin: boolean;
  show_nsfw: boolean;
  created_at: string;
  created_lists: any[];
  saved_lists: any[];
  is_pro?: boolean;
  is_vip?: boolean;
  admin_warning?: string;
  profile_color?: string;
  lastfm_username?: string;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
}


export const getTagClass = (type: string) => {
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
    default: return 'tag-badge tag-series';
  }
};

export const Profile: React.FC = () => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { username: usernameParam } = useParams<{ username?: string }>();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user_id');
  const targetUserIdentifier = usernameParam || userIdParam;
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const isLight = theme === 'light';

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showMusicGuideModal, setShowMusicGuideModal] = useState(false);
  const [replaceModalState, setReplaceModalState] = useState<{
    isOpen: boolean;
    newItem: LibraryItem | null;
    currentFavorites: LibraryItem[];
  }>({
    isOpen: false,
    newItem: null,
    currentFavorites: []
  });

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites' | 'music'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning';
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const isOwnProfile = Boolean(!targetUserIdentifier || String(profile?.id) === String(currentUser?.id) || (currentUser?.username && usernameParam?.toLowerCase() === currentUser.username.toLowerCase()));

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

  // Handle return from Dodo Payments checkout flow
  useEffect(() => {
    const payment = searchParams.get('payment');
    const subscriptionId = searchParams.get('subscription_id');
    const status = searchParams.get('status');

    if (payment === 'success') {
      apiClient.post('/payments/verify-success', {
        subscription_id: subscriptionId,
        status: status || 'active'
      }).then(async () => {
        await refreshProfile();
        await fetchProfileAndLibrary();
        setSuccessMsg(language === 'es' ? '⭐ ¡Bienvenido a Pathd Premium! Tu suscripción se activó con éxito.' : '⭐ Welcome to Pathd Premium! Your subscription was successfully activated.');
        setTimeout(() => setSuccessMsg(''), 6000);
      }).catch(err => {
        console.error('Error verifying payment:', err);
      });
    }
  }, [searchParams, language]);



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

  // Only display extra favorites beyond 1-per-category if user has active Pro
  const displayedFavorites = React.useMemo(() => {
    if (profile?.is_pro) {
      return favorites;
    }
    const seenCategories = new Set<string>();
    return favorites.filter(item => {
      const type = item.item_type;
      if (!seenCategories.has(type)) {
        seenCategories.add(type);
        return true;
      }
      return false;
    });
  }, [favorites, profile?.is_pro]);


  // Last.fm states
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [topAlbums, setTopAlbums] = useState<any[]>([]);
  const [isConnectingLastFm, setIsConnectingLastFm] = useState(false);
  const [lastFmTokenInput, setLastFmTokenInput] = useState('');

  // Followers & Following floating modal states
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const handleOpenFollowModal = async (initialTab: 'followers' | 'following') => {
    setFollowModalTab(initialTab);
    setShowFollowModal(true);
    setFollowListLoading(true);
    try {
      const myId = currentUser?.id || profile?.id;
      const [followersRes, followingRes] = await Promise.all([
        apiClient.get(`/social/users/${myId}/followers`),
        apiClient.get(`/social/users/${myId}/following`)
      ]);
      setFollowersList(followersRes.data);
      setFollowingList(followingRes.data);
    } catch (err) {
      console.error('Failed to load followers/following', err);
    } finally {
      setFollowListLoading(false);
    }
  };

  const handleToggleFollowUserInModal = async (targetUser: UserProfile) => {
    try {
      const res = await apiClient.post(`/social/users/${targetUser.id}/follow`);
      const isNowFollowing = res.data.following;

      // Update in followers list
      setFollowersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_following: isNowFollowing } : u));

      // Update in following list
      if (!isNowFollowing) {
        setFollowingList(prev => prev.filter(u => u.id !== targetUser.id));
      } else {
        setFollowingList(prev => {
          if (prev.some(u => u.id === targetUser.id)) {
            return prev.map(u => u.id === targetUser.id ? { ...u, is_following: true } : u);
          }
          return [...prev, { ...targetUser, is_following: true }];
        });
      }

      // Update profile following count
      setProfile(prev => prev ? {
        ...prev,
        following_count: Math.max(0, (prev.following_count || 0) + (isNowFollowing ? 1 : -1))
      } : null);
    } catch (err: any) {
      console.error('Failed to toggle follow in modal', err);
    }
  };

  const handleToggleFollowProfileUser = async () => {
    if (!profile) return;
    try {
      const res = await apiClient.post(`/social/users/${profile.id}/follow`);
      const isNowFollowing = res.data.following;
      setProfile(prev => prev ? {
        ...prev,
        is_following: isNowFollowing,
        followers_count: Math.max(0, (prev.followers_count || 0) + (isNowFollowing ? 1 : -1))
      } : null);
      setSuccessMsg(isNowFollowing 
        ? (language === 'es' ? 'Comenzaste a seguir a este usuario.' : 'Started following this user.')
        : (language === 'es' ? 'Dejaste de seguir a este usuario.' : 'Unfollowed this user.')
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error updating follow status');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    setShowFollowModal(false);
    fetchProfileAndLibrary();

    const handleProfileUpdate = () => {
      fetchProfileAndLibrary();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, [usernameParam, userIdParam]);


  const fetchProfileAndLibrary = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const meRes = await apiClient.get('/users/me');
      setCurrentUser(meRes.data);

      const targetProfileUrl = targetUserIdentifier ? `/users/profile/${targetUserIdentifier}` : '/users/me';
      const profileRes = await apiClient.get(targetProfileUrl);
      setProfile(profileRes.data);

      const targetId = profileRes.data.id;
      const targetLibraryUrl = (targetUserIdentifier && targetId !== meRes.data.id) ? `/library/?user_id=${targetId}` : '/library/';
      const libraryRes = await apiClient.get(targetLibraryUrl);
      setLibraryItems(libraryRes.data);

      // Set favorites state from items explicitly marked as favorites
      const favs = libraryRes.data.filter((item: LibraryItem) => item.is_favorite);
      setFavorites(favs);

      // Fetch user activities
      const targetActivityUrl = (targetUserIdentifier && targetId !== meRes.data.id) ? `/users/${targetId}/activity` : '/users/me/activity';
      const activityRes = await apiClient.get(targetActivityUrl);
      setActivities(activityRes.data);
      
      // Fetch Last.fm data if applicable
      const targetLastfmUser = profileRes.data.lastfm_username;
      if (targetLastfmUser) {
        try {
          const targetNpUrl = `/users/${targetId}/music/now-playing`;
          const targetTaUrl = `/users/${targetId}/music/top-albums`;
          const [npRes, taRes] = await Promise.allSettled([
            apiClient.get(targetNpUrl),
            apiClient.get(targetTaUrl)
          ]);
          setNowPlaying(npRes.status === 'fulfilled' ? npRes.value.data : null);
          setTopAlbums(taRes.status === 'fulfilled' ? (taRes.value.data || []) : []);
        } catch(e) {
          setNowPlaying(null);
          setTopAlbums([]);
        }
      } else {
        setNowPlaying(null);
        setTopAlbums([]);
      }
      
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to fetch library information.');
    } finally {
      setLoading(false);
    }
  };

  const tokenProcessed = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !tokenProcessed.current) {
      tokenProcessed.current = true;
      connectLastFm(token);
    }
  }, [searchParams]);

  const connectLastFm = async (token: string) => {
    try {
      await apiClient.post(`/users/me/lastfm/connect?token=${token}`);
      setSuccessMsg(language === 'es' ? 'Conectado a Last.fm exitosamente.' : 'Connected to Last.fm successfully.');
      searchParams.delete('token');
      navigate('/profile', { replace: true });
      fetchProfileAndLibrary();
    } catch(err) {
      setErrorMsg('Error connecting to Last.fm');
    }
  };

  // Auto-refresh Now Playing track every 30 seconds (pauses when browser tab is inactive)
  useEffect(() => {
    if (!profile?.lastfm_username || !profile?.id) return;

    const targetId = profile.id;
    const targetNpUrl = `/users/${targetId}/music/now-playing`;

    const pollNowPlaying = async () => {
      if (document.hidden) return;
      try {
        const npRes = await apiClient.get(targetNpUrl);
        setNowPlaying(npRes.data || null);
      } catch (e) {
        // Silently keep previous state or ignore network hiccups
      }
    };

    const intervalId = setInterval(pollNowPlaying, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        pollNowPlaying();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile?.lastfm_username, profile?.id]);

  const handleLastFmLogin = () => {
    const currentOrigin = window.location.origin;
    window.location.href = `http://www.last.fm/api/auth/?api_key=de5acce61bdd8b3e4bd181ebce8a69e8&cb=${encodeURIComponent(`${currentOrigin}/profile`)}`;
  };

  const handleLastFmDisconnect = () => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'es' ? '¿Desconectar Last.fm?' : 'Disconnect Last.fm?',
      message: language === 'es' ? 'Tu cuenta de Last.fm se desvinculará de tu perfil.' : 'Your Last.fm account will be unlinked from your profile.',
      type: 'danger',
      confirmText: language === 'es' ? 'Desconectar' : 'Disconnect',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.delete('/users/me/lastfm/disconnect');
          setProfile(prev => prev ? { ...prev, lastfm_username: undefined } : null);
          setNowPlaying(null);
          setTopAlbums([]);
          setSuccessMsg(language === 'es' ? 'Desconectado de Last.fm.' : 'Disconnected from Last.fm.');
        } catch(err) {
          setErrorMsg('Error disconnecting from Last.fm');
        }
      }
    });
  };








  const handleDismissWarning = async () => {
    try {
      await apiClient.post('/users/me/dismiss-warning');
      setProfile(prev => prev ? { ...prev, admin_warning: undefined } : null);
    } catch (e) {
      console.error('Failed to dismiss warning:', e);
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
    const targetItem = libraryItems.find(li => li.id === itemId);
    if (!targetItem) return;

    if (!currentFav) {
      const isUnconsumed = ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(targetItem.status);
      if (isUnconsumed) {
        setErrorMsg(language === 'es' 
          ? 'Solo puedes destacar elementos que hayas empezado a consumir o completado.' 
          : 'You can only feature items that you have started or completed.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }

      const isPro = Boolean(profile?.is_pro || currentUser?.is_pro);
      const sameCategoryFavs = displayedFavorites.filter(f => f.item_type === targetItem.item_type);
      const maxAllowed = isPro ? 10 : 1;

      if (sameCategoryFavs.length >= maxAllowed) {
        // Open confirmation/replace modal instead of hard blocking or blind swapping
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
      setLibraryItems(prev => prev.map(item => item.id === itemId ? { ...item, is_favorite: !currentFav } : item));
      
      setFavorites(prev => {
        if (!currentFav) {
          return [...prev, { ...targetItem, is_favorite: true }];
        } else {
          return prev.filter(li => li.id !== itemId);
        }
      });

      // Refresh activities
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
      setActivities(actRes.data);
    } catch(err: any) {
      setErrorMsg(err.response?.data?.detail || (language === 'es' ? 'Error al actualizar destacado' : 'Failed to update favorite'));
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleConfirmReplace = async (itemToReplaceId: number, newItemId: number) => {
    const newItemObj = libraryItems.find(li => li.id === newItemId);
    if (!newItemObj) return;

    try {
      // 1. Unfavorite the old item
      await apiClient.put(`/library/${itemToReplaceId}`, { is_favorite: false });
      // 2. Favorite the new item
      await apiClient.put(`/library/${newItemId}`, { is_favorite: true });

      setLibraryItems(prev => prev.map(item => {
        if (item.id === itemToReplaceId) return { ...item, is_favorite: false };
        if (item.id === newItemId) return { ...item, is_favorite: true };
        return item;
      }));

      setFavorites(prev => {
        const filtered = prev.filter(li => li.id !== itemToReplaceId && li.id !== newItemId);
        return [...filtered, { ...newItemObj, is_favorite: true }];
      });

      setSuccessMsg(language === 'es' ? 'Obra destacada actualizada correctamente.' : 'Featured item updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);

      // Refresh activities
      const targetActivityUrl = userIdParam ? `/users/${userIdParam}/activity` : '/users/me/activity';
      const actRes = await apiClient.get(targetActivityUrl);
      setActivities(actRes.data);
    } catch(err: any) {
      setErrorMsg(err.response?.data?.detail || (language === 'es' ? 'Error al reemplazar destacado' : 'Failed to replace favorite'));
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };



  const handleOpenItemDetails = (item: any) => {
    setSelectedItem(item);
  };

  const handleDeleteItem = (itemId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'es' ? '¿Eliminar de la estantería?' : 'Remove from shelf?',
      message: language === 'es' ? 'Esta obra se eliminará de tu estantería y de tu historial.' : 'This title will be removed from your shelf and activity history.',
      type: 'danger',
      confirmText: language === 'es' ? 'Eliminar' : 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
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
      }
    });
  };

  const handleOpenGuide = (guideId: number) => {
    navigate(`/guide/${guideId}`);
  };


  const handleDeleteGuide = (listId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'es' ? '¿Eliminar esta guía?' : 'Delete this guide?',
      message: language === 'es' ? 'Esta acción eliminará la guía y sus elementos de forma permanente.' : 'This action will permanently delete this guide and its items.',
      type: 'danger',
      confirmText: language === 'es' ? 'Eliminar Guía' : 'Delete Guide',
      onConfirm: async () => {
        setConfirmDialog(null);
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
          setErrorMsg(err.response?.data?.detail || 'Failed to delete guide.');
        }
      }
    });
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



  const isLooseEpisodeOrSeason = (item: LibraryItem) => {
    const isLooseType = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
    if (!isLooseType) return false;
    
    const parentTitle = item.last_seen_episode || '';
    const followsParentSeries = libraryItems.some(li => 
      (li.item_type === 'series' || li.item_type === 'anime') && 
      (li.title === parentTitle || item.title.startsWith(li.title))
    );
    return isLooseType && !followsParentSeries;
  };

  const filteredItems = libraryItems
    .filter(item => {
      let matchesMedia = false;
      if (mediaFilter === 'all') matchesMedia = true;
      else if (mediaFilter === 'series') matchesMedia = item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season';
      else if (mediaFilter === 'anime') matchesMedia = item.item_type === 'anime';
      else matchesMedia = item.item_type === mediaFilter;
      
      const normalizeSearch = (str: string) => {
        return str.toLowerCase().replace(/\b(y|and)\b|\s+&\s+/g, ' & ').replace(/\s+/g, ' ').trim();
      };
      
      const normalizedQuery = normalizeSearch(shelfSearchQuery);
      const matchesSearch = normalizeSearch(item.title).includes(normalizedQuery);
      
      const isLoose = isLooseEpisodeOrSeason(item);
      const isSeriesOrRegular = item.item_type !== 'episode' && item.item_type !== 'season' && !item.external_id?.startsWith('tvm-ep-');
      const isNotStartedSeries = (item.item_type === 'series' || item.item_type === 'anime') && !item.last_seen_episode;
      const isPlanToStatus = ['plan_to_watch', 'plan_to_play', 'plan_to_read'].includes(item.status);

      return matchesMedia && matchesSearch && (isSeriesOrRegular || isLoose) && !isNotStartedSeries && !isPlanToStatus;
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

  const visualLibraryItems = libraryItems.filter(item => {
    const isPlanToStatus = ['plan_to_watch', 'plan_to_play', 'plan_to_read'].includes(item.status);
    if (isPlanToStatus) return false;

    const isNotStartedSeries = (item.item_type === 'series' || item.item_type === 'anime') && !item.last_seen_episode;
    if (isNotStartedSeries) return false;
    
    const isLooseType = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
    if (!isLooseType) return true;
    const parentTitle = item.last_seen_episode || '';
    const followsParentSeries = libraryItems.some(li => 
      (li.item_type === 'series' || li.item_type === 'anime') && 
      (li.title === parentTitle || item.title.startsWith(li.title))
    );
    return !followsParentSeries;
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando información...</div>;
  }

  const profileTheme = getProfileTheme(profile?.profile_color, isLight);

  return (
    <div 
      style={{ 
        position: 'relative',
        zIndex: 1,
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2.5rem', 
        maxWidth: '1000px', 
        margin: '0 auto', 
        padding: '2rem 0',
        ...(profile?.is_pro && profile?.profile_color ? profileTheme.cssVariables : {})
      }}
    >

      {/* Immersive Ambient Background Wallpaper (Fixed Background Layer - Only for Premium) */}
      {profile?.is_pro && profile?.background_url && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${profile.background_url})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          {/* Subtle blur and dark atmospheric vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(9, 13, 22, 0.65) 0%, rgba(9, 13, 22, 0.88) 75%, rgba(9, 13, 22, 0.97) 100%)',
              backdropFilter: 'blur(3px)',
            }}
          />
        </div>
      )}


      {/* Profile Header Card */}
      {profile && (
        <div 
          className="glass-card" 
          style={{ 
            position: 'relative',
            display: 'flex', 
            gap: '2rem', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            padding: '2.5rem',
            borderRadius: '20px',
            overflow: 'hidden',
            border: profile.is_pro && profile.banner_url ? '1px solid rgba(255, 255, 255, 0.12)' : undefined,
            boxShadow: profile.is_pro && profile.banner_url ? '0 12px 30px rgba(0, 0, 0, 0.4)' : undefined,
          }}
        >
          {profile.is_pro && profile.banner_url && (
            <>
              {/* Banner Image Layer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${profile.banner_url})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  zIndex: 0,
                }}
              />
              {/* Darkening & Gradient overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(15, 15, 20, 0.45) 0%, rgba(15, 15, 20, 0.85) 55%, rgba(15, 15, 20, 0.98) 100%)',
                  zIndex: 1,
                }}
              />
            </>
          )}

          {/* Header Settings Button */}
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings')}
              className="btn-secondary"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                padding: '0.55rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
              }}
              title={language === 'es' ? 'Ajustes de Perfil y Cuenta' : 'Profile & Account Settings'}
            >
              <Settings size={20} />
            </button>
          )}

          <div style={{ position: 'relative', zIndex: 2 }}>
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.username}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent-primary)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: '3px solid var(--accent-primary)',
                  boxShadow: 'var(--shadow-md)',
                  background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                }}
              >
                {profile.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 250, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{profile.username}</h1>
              {profile.is_pro && (
                <span 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'default',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                    userSelect: 'none'
                  }}
                >
                  <Star size={12} fill="white" />
                  PREMIUM
                </span>
              )}

              {/* VIP Badge - only visible if viewer is Admin or VIP */}
              {profile.is_vip && (currentUser?.is_admin || currentUser?.is_vip) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)'
                  }}
                  title={language === 'es' ? 'Usuario VIP (Insignia visible solo para Admins y VIPs)' : 'VIP User (Badge visible only to Admins & VIPs)'}
                >
                  <Crown size={12} fill="white" />
                  VIP
                </span>
              )}

              {profile.is_admin && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ADMIN
                </span>
              )}


              {/* Follow / Unfollow button on other users' profiles */}

              {!isOwnProfile && currentUser && (
                <button
                  type="button"
                  onClick={handleToggleFollowProfileUser}
                  className={profile.is_following ? 'btn-secondary' : 'btn-primary'}
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '8px',
                    marginLeft: 'auto'
                  }}
                >
                  {profile.is_following ? (
                    <>
                      <UserCheck size={16} />
                      {language === 'es' ? 'Siguiendo' : 'Following'}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      {language === 'es' ? 'Seguir' : 'Follow'}
                    </>
                  )}
                </button>
              )}

            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} /> {language === 'es' ? 'Miembro desde' : 'Joined'} {formatDate(new Date(profile.created_at))}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenFollowModal('followers')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.background = 'none'; }}
                    title={language === 'es' ? 'Ver seguidores' : 'View followers'}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>{profile.followers_count ?? 0}</strong> {language === 'es' ? 'Seguidores' : 'Followers'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenFollowModal('following')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.background = 'none'; }}
                    title={language === 'es' ? 'Ver seguidos' : 'View following'}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>{profile.following_count ?? 0}</strong> {language === 'es' ? 'Seguidos' : 'Following'}
                  </button>
                </>
              ) : (
                <>
                  <span><strong>{profile.followers_count ?? 0}</strong> {language === 'es' ? 'Seguidores' : 'Followers'}</span>
                  <span><strong>{profile.following_count ?? 0}</strong> {language === 'es' ? 'Seguidos' : 'Following'}</span>
                </>
              )}
              <span><strong>{visualLibraryItems.length}</strong> {language === 'es' ? 'En Estantería' : 'On Shelf'}</span>
            </div>
            
            {/* Now Playing Widget */}
            {nowPlaying && (
              <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#333' }}>
                  {nowPlaying.image && <img src={nowPlaying.image} alt="Album Art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {nowPlaying.is_playing ? (
                      <><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} /> {language === 'es' ? 'Escuchando ahora' : 'Now Playing'}</>
                    ) : (
                      language === 'es' ? 'Última canción escuchada' : 'Last Played'
                    )}
                  </span>
                  <a href={nowPlaying.url} target="_blank" rel="noopener noreferrer" style={{ margin: '0.2rem 0 0.1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {nowPlaying.name}
                  </a>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{nowPlaying.artist}</span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {profile?.admin_warning && isOwnProfile && (

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '1rem 1.25rem', borderRadius: 12, fontSize: '0.95rem', margin: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} style={{ flexShrink: 0 }} />
            <div>
              <strong>{language === 'es' ? 'Aviso de la Administración:' : 'Administration Warning:'}</strong>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{profile.admin_warning}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissWarning}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}
          >
            {language === 'es' ? 'Entendido' : 'Dismiss'}
          </button>
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

        {Boolean(profile?.lastfm_username) && (
          <button
            onClick={() => setActiveTab('music')}
            className="btn-secondary"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'music' ? '2px solid var(--accent-primary)' : 'none',
              color: activeTab === 'music' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'music' ? 600 : 400,
              borderRadius: 0,
              padding: '0.75rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Music size={18} /> {language === 'es' ? 'Música' : 'Music'}
          </button>
        )}
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
                  if (type === 'series') return libraryItems.some(item => item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-'));
                  if (type === 'anime') return libraryItems.some(item => item.item_type === 'anime');
                  return libraryItems.some(item => item.item_type === type);
                });
                return allowedTypes.map(type => {
                  const typeColor = type === 'all' ? 'var(--accent-primary)' : `var(--color-${type})`;
                  const typeTextColor = type === 'all' ? '#ffffff' : `var(--color-text-${type})`;
                  const isSelected = mediaFilter === type;

                  return (
                    <button
                      key={type}
                      onClick={() => setMediaFilter(type)}
                      className={`profile-category-tab ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.85rem',
                        textTransform: 'capitalize',
                        '--tab-color': typeColor,
                        '--tab-text': typeTextColor
                      } as React.CSSProperties}
                    >
                      {type === 'all' ? (language === 'es' ? 'Todo' : 'All') :
                       type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
                       type === 'series' ? (language === 'es' ? 'Series' : 'Series') :
                       type === 'anime' ? 'Anime' :
                       type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
                       type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') :
                       type === 'manga' ? 'Mangas' :
                       type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type}
                    </button>
                  );
                });
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
                          <div style={{ position: 'relative', cursor: 'pointer', width: '100%', height: '240px', borderRadius: '8px', overflow: 'hidden' }} onClick={() => handleOpenItemDetails(item)}>
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
                            
                            {mediaFilter === 'all' && (
                              <div className={getTagClass(item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-') ? 'series' : item.item_type)} style={{ position: "absolute", top: "0.5rem", left: "0.5rem", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.9, backdropFilter: 'blur(4px)', zIndex: 1 }}>
                                {(item.item_type === 'episode' || item.external_id?.startsWith('tvm-ep-'))
                                  ? (language === 'es' ? 'Serie' : 'Series')
                                  : item.item_type === 'season'
                                  ? (language === 'es' ? 'Temporada' : 'Season')
                                  : item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type === 'manga' ? 'Manga' : t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))
                                }
                              </div>
                            )}
                            
                            {(() => {
                              const isEffectiveFav = displayedFavorites.some(df => df.id === item.id);
                              const isUnconsumed = ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status);
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item.id, isEffectiveFav);
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
                                    cursor: isUnconsumed && !isEffectiveFav ? 'not-allowed' : 'pointer',
                                    opacity: isUnconsumed && !isEffectiveFav ? 0.35 : 1,
                                    color: isEffectiveFav ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    transition: 'transform 0.2s ease'
                                  }}
                                  title={isUnconsumed && !isEffectiveFav
                                    ? (language === 'es' ? 'Empieza a consumir esta obra para poder destacarla' : 'Start consuming this item to feature it')
                                    : (isEffectiveFav
                                      ? (language === 'es' ? 'Quitar Destacado' : 'Remove Featured')
                                      : (language === 'es' ? 'Destacar' : 'Favorite'))
                                  }
                                >
                                  <Heart size={16} fill={isEffectiveFav ? 'var(--accent-primary)' : 'none'} />
                                </button>
                              );
                            })()}

                          </div>
                          <div style={{ flex: 1, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleOpenItemDetails(item)}>
                            {(() => {
                              const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                              const isEpOrSeason = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
                              
                              if (isEpOrSeason && match) {
                                const series = match[1].trim();
                                const s = match[2];
                                const e = match[3];
                                const epName = match[4].replace(/^\s*-\s*/, '').trim();
                                const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.25rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>{series}</h4>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                                    {epName && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                                  </div>
                                );
                              }
                              
                              let displayTitle = item.title;
                              if (isEpOrSeason && item.last_seen_episode && item.title.toLowerCase().startsWith(item.last_seen_episode.toLowerCase() + ' - ')) {
                                displayTitle = item.title.slice(item.last_seen_episode.length + 3);
                              }
                              
                              return (
                                <>
                                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                                    {displayTitle}
                                  </h4>
                                  {isEpOrSeason && item.last_seen_episode && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.1rem' }}>
                                      {language === 'es' ? 'Serie: ' : 'Show: '}{item.last_seen_episode}
                                    </span>
                                  )}
                                </>
                              );
                            })()}

                            {/* Unified Badges System (under title) */}
                            {(() => {
                              const isUnitEpisode = item.item_type === 'episode' || item.external_id?.startsWith('tvm-ep-') || !!(item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                              if (isUnitEpisode) return null;

                              const badges = [];
                              
                              // Dropped (All)
                              if (item.status === 'dropped') {
                                badges.push({ text: language === 'es' ? 'Abandonado' : 'Dropped', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' });
                              }
                              // Endless (Games)
                              else if (item.status === 'endless') {
                                badges.push({ text: language === 'es' ? 'Infinito' : 'Endless', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' });
                              }
                              // Games
                              else if (item.item_type === 'game') {
                                if (item.status === 'playing') badges.push({ text: language === 'es' ? 'Jugando' : 'Playing', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                                else if (item.status === 'completed') badges.push({ text: language === 'es' ? 'Completado' : 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                              }
                              // Movies
                              else if (item.item_type === 'movie') {
                                if (item.status === 'watching') badges.push({ text: language === 'es' ? 'Pausa' : 'Paused', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                                else if (item.status === 'completed') badges.push({ text: language === 'es' ? 'Visto' : 'Watched', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                              }
                              // Series / Anime
                              else if (item.item_type === 'series' || item.item_type === 'anime') {
                                if (item.status === 'watching') {
                                  badges.push({ text: language === 'es' ? 'Viendo' : 'Watching', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                                } else if (item.status === 'completed') {
                                  // Check if series is completely ended or just up to date with released episodes
                                  const cacheKey = `series_${item.external_id}`;
                                  const cached = item.external_id ? getCachedSeries(cacheKey) : null;
                                  const anyItem = item as any;
                                  const sStatus = cached?.status || anyItem.series_status;
                                  const isEnded = sStatus === 'Ended' || anyItem.is_ended === true;

                                  if (isEnded) {
                                    badges.push({ text: language === 'es' ? 'Terminada' : 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                                  } else {
                                    badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                                  }
                                }
                              }
                              // Reading (Books, Comics, Manga)
                              else if (['book', 'comic', 'manga'].includes(item.item_type)) {
                                if (item.status === 'reading') badges.push({ text: language === 'es' ? 'Leyendo' : 'Reading', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                                else if (item.status === 'read' || item.status === 'completed') badges.push({ text: language === 'es' ? 'Leído' : 'Read', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                              }

                              if (badges.length === 0) return null;

                              return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                                  {badges.map((badge, idx) => (
                                    <span key={idx} style={{
                                      fontSize: '0.72rem',
                                      background: badge.bg,
                                      color: badge.color,
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                      display: 'inline-block'
                                    }}>
                                      {badge.text}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Followed series last completed episode */}
                            {(item.item_type === 'series' || item.item_type === 'anime') && item.last_seen_episode && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.35rem' }}>
                                {(() => {
                                  const match = item.last_seen_episode.match(/S(\d+)E(\d+)/i);
                                  let formatted = item.last_seen_episode;
                                  if (match) {
                                    const s = String(match[1]).padStart(2, '0');
                                    const e = String(match[2]).padStart(2, '0');
                                    formatted = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                  }
                                  return `${language === 'es' ? 'Último: ' : 'Last: '}${formatted}`;
                                })()}
                              </span>
                            )}

                            {/* Movie Duration / Watched Time */}
                            {item.item_type === 'movie' && (item.pages_read || item.total_pages || 0) > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.2rem' }}>
                                ⏱️ {(() => {
                                  const mins = item.pages_read || item.total_pages || 0;
                                  const h = Math.floor(mins / 60);
                                  const m = mins % 60;
                                  return h > 0 ? `${h}h ${m > 0 ? `${String(m).padStart(2, '0')}m` : '00m'}` : `${m}m`;
                                })()}
                              </span>
                            )}

                            {/* Game Hours Played */}
                            {item.item_type === 'game' && (item.pages_read || 0) > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.2rem' }}>
                                ⏱️ {Math.floor((item.pages_read || 0) / 60)}h {String((item.pages_read || 0) % 60).padStart(2, '0')}m
                              </span>
                            )}

                            {/* Formatted Date */}
                            {(item.completed_at || item.updated_at) && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block', marginTop: '0.3rem' }}>
                                {formatDate(new Date(item.completed_at || item.updated_at || new Date()))}
                              </span>
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
                      {list.can_edit === false && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <Lock size={12} /> {language === 'es' ? 'Solo Lectura' : 'Read-Only'}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      {isOwnProfile && (
                        <>
                          <button 
                            onClick={() => {
                              if (list.can_edit !== false) {
                                navigate(`/create?edit=${list.id}`);
                              } else {
                                setShowProModal(true);
                              }
                            }} 
                            className="btn-secondary" 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.4rem', 
                              fontSize: '0.82rem', 
                              padding: '0.35rem 0.75rem',
                              color: list.can_edit === false ? '#f59e0b' : 'inherit',
                              borderColor: list.can_edit === false ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'
                            }}
                          >
                            {list.can_edit === false ? <Lock size={14} /> : <Edit size={14} />} {language === 'es' ? 'Editar' : 'Edit'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>{language === 'es' ? 'Mis Obras Destacadas' : 'My Featured Favorites'}</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {profile?.is_pro
                  ? (language === 'es' ? 'Plan Premium: Puedes destacar hasta 10 elementos por categoría.' : 'Premium Plan: You can feature up to 10 items per category.')
                  : (language === 'es' ? 'Plan Gratuito: 1 elemento destacado por categoría. Pasa a Premium para destacar hasta 10.' : 'Free Plan: 1 featured item per category. Upgrade to Premium to feature up to 10.')
                }

              </p>


            </div>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              background: profile?.is_pro ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: profile?.is_pro ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}>
              {displayedFavorites.length} / {profile?.is_pro ? '70' : '7'} {language === 'es' ? 'destacados' : 'featured'}
            </span>
          </div>

          {displayedFavorites.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'Marca obras en tu estantería como favoritas (con el ícono de corazón) para destacarlas aquí.' : 'Mark items on your shelf as favorites (with the heart icon) to highlight them here.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {displayedFavorites.map(item => (

                <div
                  key={item.id}
                  className="glass-card"
                  onClick={() => handleOpenItemDetails(item)}
                  style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', cursor: 'pointer' }}
                >
                  <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(124,58,237,0.9)', padding: '0.3rem', borderRadius: '50%', display: 'flex', zIndex: 2 }}>
                    <Heart size={16} fill="white" color="white" />
                  </div>
                  <MediaPoster
                    src={item.image_url}
                    title={item.title}
                    itemType={item.item_type}
                    height="240px"
                    width="100%"
                    borderRadius="8px"
                    isNsfw={item.is_nsfw}
                  />
                  <h4 style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                    {item.title}
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {activeTab === 'music' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          <h3>{language === 'es' ? 'Estantería Musical (Últimos 7 días)' : 'Music Shelf (Last 7 days)'}</h3>
          {topAlbums.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <Music size={32} color="#ef4444" style={{ opacity: 0.8 }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'es' ? 'No hay álbumes escuchados en los últimos 7 días.' : 'No albums played in the last 7 days.'}
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '450px', lineHeight: '1.45' }}>
                {isOwnProfile
                  ? (language === 'es'
                    ? 'Asegúrate de vincular tu reproductor de música (Spotify, Apple Music, YouTube Music, Deezer, Tidal, etc.) en Last.fm para que tus reproducciones se sincronicen automáticamente aquí.'
                    : 'Make sure to connect your music player (Spotify, Apple Music, YouTube Music, Deezer, Tidal, etc.) in Last.fm so your scrobbles sync automatically here.')
                  : (language === 'es'
                    ? 'Este usuario aún no ha reproducido música en este período.'
                    : 'This user has not played any music during this period.')}
              </p>
              {isOwnProfile && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowMusicGuideModal(true)}
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.85rem',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    <HelpCircle size={14} />
                    {language === 'es' ? '¿Cómo conectar mi música?' : 'How to connect my music?'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2rem' }}>
              {topAlbums.map((album, i) => (
                <div
                  key={`${album.name}-${i}`}
                  className="glass-card"
                  style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden' }}>
                    <MediaPoster
                      src={album.image}
                      title={album.name}
                      itemType="music"
                      height="100%"
                      width="100%"
                      borderRadius="8px"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <a href={album.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{album.name}</h4>
                    </a>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{album.artist}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                    {album.playcount} {language === 'es' ? 'reproducciones' : 'plays'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AdBanner placed directly above Activity History */}
      <AdBanner style={{ margin: '1.5rem auto 2.5rem auto' }} />

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
              } else if (act.activity_type === 'item_added') {
                msg = language === 'es'
                  ? `Agregaste "${act.item_title}" a una guía.`
                  : `Added "${act.item_title}" to a guide.`;
              } else if (act.activity_type === 'item_removed') {
                msg = language === 'es'
                  ? `Eliminaste "${act.item_title}" de una guía.`
                  : `Removed "${act.item_title}" from a guide.`;
              } else if (act.activity_type === 'item_moved') {
                msg = language === 'es'
                  ? `Moviste "${act.item_title}" en una guía.`
                  : `Moved "${act.item_title}" in a guide.`;
              } else if (act.activity_type === 'block_edited') {
                if (act.item_title === "un bloque") {
                  msg = language === 'es' ? `Editaste un bloque en una guía.` : `Edited a block in a guide.`;
                } else if (act.item_title.startsWith("type:")) {
                  const typeMatch = act.item_title.match(/type:([^|]*)(?:\|id:([^|]*))?\|title:(.*)/);
                  if (typeMatch) {
                    const elType = typeMatch[1];
                    const elTitle = typeMatch[3];
                    let typeName = language === 'es' ? 'un bloque' : 'a block';
                    if (elType === 'section') typeName = language === 'es' ? 'una sección' : 'a section';
                    else if (elType === 'subblock') typeName = language === 'es' ? 'un sub-bloque' : 'a sub-block';
                    
                    if (elTitle) {
                      msg = language === 'es' ? `Editaste ${typeName === 'una sección' ? 'la sección' : typeName === 'un sub-bloque' ? 'el sub-bloque' : 'el bloque'} '${elTitle}' en una guía.` : `Edited the ${elType} '${elTitle}' in a guide.`;
                    } else {
                      msg = language === 'es' ? `Editaste ${typeName} sin título en una guía.` : `Edited an untitled ${elType} in a guide.`;
                    }
                  } else {
                    msg = language === 'es' ? `Editaste un bloque en una guía.` : `Edited a block in a guide.`;
                  }
                } else {
                  msg = language === 'es' ? `Editaste el bloque '${act.item_title}' en una guía.` : `Edited the block '${act.item_title}' in a guide.`;
                }
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
          profileColor={profile?.profile_color}
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
            setSelectedItem(item);
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



      {/* Followers / Following Floating Modal */}
      {showFollowModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4000,
            padding: '1rem'
          }} 
          onClick={() => setShowFollowModal(false)}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '560px', 
              maxHeight: '80vh', 
              display: 'flex', 
              flexDirection: 'column', 
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '1.25rem 1.5rem', 
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setFollowModalTab('followers')}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    background: followModalTab === 'followers' ? 'var(--accent-primary)' : 'transparent',
                    color: followModalTab === 'followers' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {language === 'es' ? 'Seguidores' : 'Followers'} ({followersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFollowModalTab('following')}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    background: followModalTab === 'following' ? 'var(--accent-primary)' : 'transparent',
                    color: followModalTab === 'following' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {language === 'es' ? 'Siguiendo' : 'Following'} ({followingList.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFollowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, minHeight: '260px' }}>
              {followListLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                  {language === 'es' ? 'Cargando lista...' : 'Loading list...'}
                </div>
              ) : (
                (() => {
                  const currentList = followModalTab === 'followers' ? followersList : followingList;

                  if (currentList.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <Users size={36} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                          {followModalTab === 'followers' 
                            ? (language === 'es' ? 'No tienes seguidores todavía.' : 'No followers yet.')
                            : (language === 'es' ? 'No estás siguiendo a ningún usuario todavía.' : 'Not following anyone yet.')}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.85rem' }}>
                      {currentList.map(u => {
                        const isSelf = u.id === currentUser?.id;

                        return (
                          <div
                            key={u.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.65rem 0.85rem',
                              background: 'var(--bg-primary)',
                              borderRadius: '10px',
                              border: '1px solid var(--border-color)',
                              transition: 'border-color 0.2s ease'
                            }}
                          >
                            <div 
                              onClick={() => {
                                setShowFollowModal(false);
                                navigate(`/user/${encodeURIComponent(u.username)}`);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: 1, minWidth: 0 }}
                              title={language === 'es' ? `Ver perfil de ${u.username}` : `View ${u.username}'s profile`}
                            >
                              <img
                                src={u.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                                alt={u.username}
                                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--accent-primary)' }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.username}
                                  </span>
                                  {u.is_pro && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 700 }}>
                                      PREMIUM
                                    </span>

                                  )}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                  {u.followers_count ?? 0} {language === 'es' ? 'seguidores' : 'followers'}
                                </span>
                              </div>
                            </div>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleFollowUserInModal(u)}
                                className={u.is_following ? "btn-secondary" : "btn-primary"}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  flexShrink: 0,
                                  ...(u.is_following ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : {})
                                }}
                              >
                                {u.is_following ? (
                                  <>
                                    <UserCheck size={13} />
                                    {language === 'es' ? 'Siguiendo' : 'Following'}
                                  </>
                                ) : (
                                  <>
                                    <UserPlus size={13} />
                                    {language === 'es' ? 'Seguir' : 'Follow'}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Avatar Selector Modal */}
      <AvatarSelectorModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentPhotoUrl={profile?.photo_url}
        isPro={profile?.is_pro || currentUser?.is_pro}
        onAvatarUpdated={(newUrl) => {
          setProfile(prev => prev ? { ...prev, photo_url: newUrl || '' } : null);
          setCurrentUser(prev => prev ? { ...prev, photo_url: newUrl || '' } : null);
        }}
      />

      {/* Banner Selector Modal (Premium) */}
      <BannerSelectorModal
        isOpen={showBannerModal}
        onClose={() => setShowBannerModal(false)}
        currentBannerUrl={profile?.banner_url}
        onBannerUpdated={(newUrl) => {
          setProfile(prev => prev ? { ...prev, banner_url: newUrl || '' } : null);
          setCurrentUser(prev => prev ? { ...prev, banner_url: newUrl || '' } : null);
        }}
      />

      {/* Background Wallpaper Selector Modal (Premium) */}
      <BackgroundSelectorModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
        currentBackgroundUrl={profile?.background_url}
        onBackgroundUpdated={(newUrl) => {
          setProfile(prev => prev ? { ...prev, background_url: newUrl || '' } : null);
          setCurrentUser(prev => prev ? { ...prev, background_url: newUrl || '' } : null);
        }}
      />

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
        isPro={Boolean(profile?.is_pro || currentUser?.is_pro)}
        onConfirmReplace={handleConfirmReplace}
        onOpenProModal={() => setShowProModal(true)}
      />

      {/* Global Confirm Modal */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          type={confirmDialog.type || 'danger'}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {/* Music Service Connection Guide Modal */}
      <MusicServiceGuideModal
        isOpen={showMusicGuideModal}
        onClose={() => setShowMusicGuideModal(false)}
      />
    </div>
  );
};
export default Profile;




