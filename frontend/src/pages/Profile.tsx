import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getProfileTheme } from '../utils/profileThemes';

import { apiClient } from '../api/client';
import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { ItemDetailsModal, StarRatingDisplay } from '../components/ItemDetailsModal';
import { MediaPoster } from '../components/MediaPoster';
import { AvatarSelectorModal } from '../components/AvatarSelectorModal';
import { BannerSelectorModal } from '../components/BannerSelectorModal';
import { BackgroundSelectorModal } from '../components/BackgroundSelectorModal';
import { ProModal } from '../components/ProModal';
import { ReplaceFavoriteModal } from '../components/ReplaceFavoriteModal';
import { AdBanner } from '../components/AdBanner';
import { ConfirmModal } from '../components/ConfirmModal';
import { PathdLoader } from '../components/PathdLoader';
import { getOrderedCategories, getCategoryIcon } from '../utils/categoryOrder';
import { useContinuousScroll } from '../hooks/useContinuousScroll';


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
  HelpCircle,
  Clock,
  Trophy,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Plus,
  Film,
  Tv,
  Gamepad2,
  Book,
  MessageSquare,
  MessageCircle,
  Sparkles,
  ArrowDownToLine,
  Disc,
  Mic,
  Headphones,
  Infinity as InfinityIcon,
  CalendarDays
} from 'lucide-react';

import { MusicServiceGuideModal } from '../components/MusicServiceGuideModal';
import { MusicDetailsModal } from '../components/MusicDetailsModal';
import { batchPrefetchMusicItems, prefetchMusicDetails } from '../utils/musicPrefetch';





interface LibraryItem {
  id: number;
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'episode' | 'season' | string;
  external_id: string;
  title: string;
  image_url: string | null;
  imdb_id?: string;
  status: string;
  is_favorite: boolean;
  favorited_at?: string;
  favorite_order?: number;
  is_hundred_percent?: boolean;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
  last_seen_episode?: string;
  badge?: string;
  custom_badge?: string;
  pages_read?: number;
  total_pages?: number;
  tracking_list_id?: number;
  times_completed?: number;
  times_completed_standard?: number;
  times_completed_hundred?: number;
  last_seen_episode_count?: number;
  completed_episodes_count?: number;
  release_date?: string;
}



interface UserProfile {
  id: number;
  username: string;
  email: string;
  photo_url: string;
  banner_url?: string;
  background_url?: string;
  is_admin: boolean;
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
  category_order?: string;
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

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (!targetUserIdentifier) {
      try {
        const cached = sessionStorage.getItem('pathd_me_cache');
        return cached ? JSON.parse(cached) : null;
      } catch { return null; }
    } else {
      try {
        const cached = sessionStorage.getItem(`pathd_user_cache_${targetUserIdentifier.toLowerCase()}`);
        return cached ? JSON.parse(cached) : null;
      } catch { return null; }
    }
  });

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => {
    if (!targetUserIdentifier) {
      try {
        const cached = sessionStorage.getItem('pathd_lib_cache');
        return cached ? JSON.parse(cached) : [];
      } catch { return []; }
    } else {
      try {
        const cached = sessionStorage.getItem(`pathd_user_lib_${targetUserIdentifier.toLowerCase()}`);
        return cached ? JSON.parse(cached) : [];
      } catch { return []; }
    }
  });
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites' | 'music'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');
  const [shelfStatusFilter, setShelfStatusFilter] = useState<string>('all');
  const [favoritesMediaFilter, setFavoritesMediaFilter] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');
  const [showReorderTooltip, setShowReorderTooltip] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(() => {
    if (!targetUserIdentifier) {
      try {
        return !sessionStorage.getItem('pathd_me_cache');
      } catch { return true; }
    } else {
      try {
        return !sessionStorage.getItem(`pathd_user_cache_${targetUserIdentifier.toLowerCase()}`);
      } catch { return true; }
    }
  });
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
  }, [searchParams]);



  // Viewer state for full list details
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // Shelf expansion & pagination states
  const [isShelfExpanded, setIsShelfExpanded] = useState(false);
  const [isCreatedGuidesExpanded, setIsCreatedGuidesExpanded] = useState(false);
  const [isSavedGuidesExpanded, setIsSavedGuidesExpanded] = useState(false);
  const [createdGuidesPage, setCreatedGuidesPage] = useState(1);
  const [savedGuidesPage, setSavedGuidesPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [shelfViewMode, setShelfViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('pathd_shelf_view_mode');
      return (saved === 'list' || saved === 'grid') ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');
  const shelfContainerRef = useRef<HTMLDivElement>(null);
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const shelfListScrollRef = useRef<HTMLDivElement>(null);
  const [canShelfScrollLeft, setCanShelfScrollLeft] = useState(false);
  const [canShelfScrollRight, setCanShelfScrollRight] = useState(false);
  const [shelfContainerWidth, setShelfContainerWidth] = useState(0);

  const guidesContainerRef = useRef<HTMLDivElement>(null);
  const [guidesContainerWidth, setGuidesContainerWidth] = useState(0);

  const createdGuidesScrollRef = useRef<HTMLDivElement>(null);
  const [canCreatedGuidesScrollLeft, setCanCreatedGuidesScrollLeft] = useState(false);
  const [canCreatedGuidesScrollRight, setCanCreatedGuidesScrollRight] = useState(false);

  const savedGuidesScrollRef = useRef<HTMLDivElement>(null);
  const [canSavedGuidesScrollLeft, setCanSavedGuidesScrollLeft] = useState(false);
  const [canSavedGuidesScrollRight, setCanSavedGuidesScrollRight] = useState(false);

  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
  const [favoritesViewMode, setFavoritesViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('pathd_favorites_view_mode');
      return (saved === 'list' || saved === 'grid') ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const favoritesContainerRef = useRef<HTMLDivElement>(null);
  const favoritesScrollRef = useRef<HTMLDivElement>(null);
  const favoritesListScrollRef = useRef<HTMLDivElement>(null);
  const [canFavoritesScrollLeft, setCanFavoritesScrollLeft] = useState(false);
  const [canFavoritesScrollRight, setCanFavoritesScrollRight] = useState(false);
  const [favoritesContainerWidth, setFavoritesContainerWidth] = useState(0);

  const shelfContinuousScroll = useContinuousScroll(shelfScrollRef, isShelfExpanded ? 360 : 300);
  const createdContinuousScroll = useContinuousScroll(createdGuidesScrollRef, isCreatedGuidesExpanded ? 480 : 360);
  const savedContinuousScroll = useContinuousScroll(savedGuidesScrollRef, isSavedGuidesExpanded ? 480 : 360);
  const favoritesContinuousScroll = useContinuousScroll(favoritesScrollRef, isFavoritesExpanded ? 360 : 300);

  const updateShelfScrollState = useCallback(() => {
    const el = shelfScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canLeft = scrollLeft > 4;
    const canRight = scrollLeft < scrollWidth - clientWidth - 4;
    setCanShelfScrollLeft(prev => (prev !== canLeft ? canLeft : prev));
    setCanShelfScrollRight(prev => (prev !== canRight ? canRight : prev));
  }, []);

  const updateCreatedGuidesScrollState = useCallback(() => {
    const el = createdGuidesScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canLeft = scrollLeft > 4;
    const canRight = scrollLeft < scrollWidth - clientWidth - 4;
    setCanCreatedGuidesScrollLeft(prev => (prev !== canLeft ? canLeft : prev));
    setCanCreatedGuidesScrollRight(prev => (prev !== canRight ? canRight : prev));

    const containerWidth = guidesContainerRef.current?.clientWidth || clientWidth;
    const availableWidth = Math.max(0, containerWidth - 90);
    const maxGuidesInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 276));
    const col = Math.round(scrollLeft / 276);
    const page = Math.max(1, Math.floor(col / maxGuidesInOneRow) + 1);
    setCreatedGuidesPage(prev => (prev !== page ? page : prev));
  }, []);

  const updateSavedGuidesScrollState = useCallback(() => {
    const el = savedGuidesScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canLeft = scrollLeft > 4;
    const canRight = scrollLeft < scrollWidth - clientWidth - 4;
    setCanSavedGuidesScrollLeft(prev => (prev !== canLeft ? canLeft : prev));
    setCanSavedGuidesScrollRight(prev => (prev !== canRight ? canRight : prev));

    const containerWidth = guidesContainerRef.current?.clientWidth || clientWidth;
    const availableWidth = Math.max(0, containerWidth - 90);
    const maxGuidesInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 276));
    const col = Math.round(scrollLeft / 276);
    const page = Math.max(1, Math.floor(col / maxGuidesInOneRow) + 1);
    setSavedGuidesPage(prev => (prev !== page ? page : prev));
  }, []);

  const updateFavoritesScrollState = useCallback(() => {
    const el = favoritesScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canLeft = scrollLeft > 4;
    const canRight = scrollLeft < scrollWidth - clientWidth - 4;
    setCanFavoritesScrollLeft(prev => (prev !== canLeft ? canLeft : prev));
    setCanFavoritesScrollRight(prev => (prev !== canRight ? canRight : prev));

    const containerWidth = favoritesContainerRef.current?.clientWidth || clientWidth;
    const availableWidth = Math.max(0, containerWidth - 90);
    const maxVisibleInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 196));
    const col = Math.round(scrollLeft / 201);
    const page = Math.max(1, Math.floor(col / maxVisibleInOneRow) + 1);
    setFavoritesPage(prev => (prev !== page ? page : prev));
  }, []);

  const handleToggleShelfExpanded = useCallback(() => {
    const el = shelfScrollRef.current;
    if (el && shelfViewMode === 'grid') {
      const currentScrollLeft = el.scrollLeft;
      const colWidth = 201; // 185px card + 16px gap
      const isExpanding = !isShelfExpanded;
      const targetScrollLeft = isExpanding
        ? Math.floor((currentScrollLeft / colWidth) / 2) * colWidth
        : Math.floor(currentScrollLeft / colWidth) * 2 * colWidth;

      setIsShelfExpanded(isExpanding);
      requestAnimationFrame(() => {
        if (shelfScrollRef.current) {
          shelfScrollRef.current.scrollLeft = targetScrollLeft;
          updateShelfScrollState();
        }
      });
    } else {
      setIsShelfExpanded(!isShelfExpanded);
    }
  }, [isShelfExpanded, shelfViewMode, updateShelfScrollState]);

  const handleToggleCreatedGuidesExpanded = useCallback(() => {
    const el = createdGuidesScrollRef.current;
    if (el) {
      const currentScrollLeft = el.scrollLeft;
      const colWidth = 276; // 260px card + 16px gap
      const isExpanding = !isCreatedGuidesExpanded;
      const targetScrollLeft = isExpanding
        ? Math.floor((currentScrollLeft / colWidth) / 2) * colWidth
        : Math.floor(currentScrollLeft / colWidth) * 2 * colWidth;

      setIsCreatedGuidesExpanded(isExpanding);
      requestAnimationFrame(() => {
        if (createdGuidesScrollRef.current) {
          createdGuidesScrollRef.current.scrollLeft = targetScrollLeft;
          updateCreatedGuidesScrollState();
        }
      });
    } else {
      setIsCreatedGuidesExpanded(!isCreatedGuidesExpanded);
    }
  }, [isCreatedGuidesExpanded, updateCreatedGuidesScrollState]);

  const handleToggleSavedGuidesExpanded = useCallback(() => {
    const el = savedGuidesScrollRef.current;
    if (el) {
      const currentScrollLeft = el.scrollLeft;
      const colWidth = 276; // 260px card + 16px gap
      const isExpanding = !isSavedGuidesExpanded;
      const targetScrollLeft = isExpanding
        ? Math.floor((currentScrollLeft / colWidth) / 2) * colWidth
        : Math.floor(currentScrollLeft / colWidth) * 2 * colWidth;

      setIsSavedGuidesExpanded(isExpanding);
      requestAnimationFrame(() => {
        if (savedGuidesScrollRef.current) {
          savedGuidesScrollRef.current.scrollLeft = targetScrollLeft;
          updateSavedGuidesScrollState();
        }
      });
    } else {
      setIsSavedGuidesExpanded(!isSavedGuidesExpanded);
    }
  }, [isSavedGuidesExpanded, updateSavedGuidesScrollState]);

  const handleToggleFavoritesExpanded = useCallback(() => {
    const el = favoritesScrollRef.current;
    if (el && favoritesViewMode === 'grid') {
      const currentScrollLeft = el.scrollLeft;
      const colWidth = 201; // 185px card + 16px gap
      const isExpanding = !isFavoritesExpanded;
      const targetScrollLeft = isExpanding
        ? Math.floor((currentScrollLeft / colWidth) / 2) * colWidth
        : Math.floor(currentScrollLeft / colWidth) * 2 * colWidth;

      setIsFavoritesExpanded(isExpanding);
      requestAnimationFrame(() => {
        if (favoritesScrollRef.current) {
          favoritesScrollRef.current.scrollLeft = targetScrollLeft;
          updateFavoritesScrollState();
        }
      });
    } else {
      setIsFavoritesExpanded(!isFavoritesExpanded);
    }
  }, [isFavoritesExpanded, favoritesViewMode, updateFavoritesScrollState]);

  const handleSetFavoritesViewMode = useCallback((newMode: 'grid' | 'list') => {
    if (newMode === favoritesViewMode) return;

    let targetIndex = 0;
    if (favoritesViewMode === 'grid') {
      const el = favoritesScrollRef.current;
      if (el) {
        const sl = el.scrollLeft;
        const colWidth = 201; // 185px + 16px
        if (!isFavoritesExpanded) {
          targetIndex = Math.max(0, Math.round(sl / colWidth));
        } else {
          const col = Math.max(0, Math.floor(sl / colWidth));
          targetIndex = col * 2;
        }
      }
    } else {
      const listEl = favoritesListScrollRef.current;
      if (listEl) {
        const st = listEl.scrollTop;
        const children = Array.from(listEl.children) as HTMLElement[];
        if (children.length > 0) {
          let found = 0;
          for (let i = 0; i < children.length; i++) {
            if (children[i].offsetTop + children[i].offsetHeight / 2 >= st) {
              found = i;
              break;
            }
          }
          targetIndex = found;
        } else {
          targetIndex = Math.max(0, Math.round(st / 78));
        }
      }
    }

    setFavoritesViewMode(newMode);
    try { localStorage.setItem('pathd_favorites_view_mode', newMode); } catch {}

    requestAnimationFrame(() => {
      if (newMode === 'list') {
        const listEl = favoritesListScrollRef.current;
        if (listEl) {
          const children = listEl.children;
          if (children && children.length > 0 && children[targetIndex]) {
            const firstChild = children[0] as HTMLElement;
            const targetChild = children[targetIndex] as HTMLElement;
            listEl.scrollTop = targetChild.offsetTop - firstChild.offsetTop;
          } else {
            listEl.scrollTop = targetIndex * 78;
          }
        }
      } else {
        const el = favoritesScrollRef.current;
        if (el) {
          const colWidth = 201;
          const targetScrollLeft = isFavoritesExpanded
            ? Math.floor(targetIndex / 2) * colWidth
            : targetIndex * colWidth;
          el.scrollLeft = targetScrollLeft;
          updateFavoritesScrollState();
        }
      }
    });
  }, [favoritesViewMode, isFavoritesExpanded, updateFavoritesScrollState]);

  const handleSetShelfViewMode = useCallback((newMode: 'grid' | 'list') => {
    if (newMode === shelfViewMode) return;

    let targetIndex = 0;
    if (shelfViewMode === 'grid') {
      // Transitioning Grid -> List: find leftmost visible item
      const el = shelfScrollRef.current;
      if (el) {
        const sl = el.scrollLeft;
        const colWidth = 201; // 185px + 16px
        if (!isShelfExpanded) {
          targetIndex = Math.max(0, Math.round(sl / colWidth));
        } else {
          const col = Math.max(0, Math.floor(sl / colWidth));
          targetIndex = col * 2;
        }
      }
    } else {
      // Transitioning List -> Grid: find topmost visible item
      const listEl = shelfListScrollRef.current;
      if (listEl) {
        const st = listEl.scrollTop;
        const children = Array.from(listEl.children) as HTMLElement[];
        if (children.length > 0) {
          let found = 0;
          for (let i = 0; i < children.length; i++) {
            if (children[i].offsetTop + children[i].offsetHeight / 2 >= st) {
              found = i;
              break;
            }
          }
          targetIndex = found;
        } else {
          targetIndex = Math.max(0, Math.round(st / 78));
        }
      }
    }

    setShelfViewMode(newMode);
    try { localStorage.setItem('pathd_shelf_view_mode', newMode); } catch {}

    requestAnimationFrame(() => {
      if (newMode === 'list') {
        const listEl = shelfListScrollRef.current;
        if (listEl) {
          const children = listEl.children;
          if (children && children.length > 0 && children[targetIndex]) {
            const firstChild = children[0] as HTMLElement;
            const targetChild = children[targetIndex] as HTMLElement;
            listEl.scrollTop = targetChild.offsetTop - firstChild.offsetTop;
          } else {
            listEl.scrollTop = targetIndex * 78;
          }
        }
      } else {
        const el = shelfScrollRef.current;
        if (el) {
          const colWidth = 201;
          const targetScrollLeft = isShelfExpanded
            ? Math.floor(targetIndex / 2) * colWidth
            : targetIndex * colWidth;
          el.scrollLeft = targetScrollLeft;
          updateShelfScrollState();
        }
      }
    });
  }, [shelfViewMode, isShelfExpanded, updateShelfScrollState]);

  useEffect(() => {
    if (activeTab !== 'shelf') return;
    const el = shelfScrollRef.current;
    if (!el) return;
    updateShelfScrollState();
    const raf = requestAnimationFrame(updateShelfScrollState);
    const timer1 = setTimeout(updateShelfScrollState, 50);
    const timer2 = setTimeout(updateShelfScrollState, 150);
    el.addEventListener('scroll', updateShelfScrollState, { passive: true });
    window.addEventListener('resize', updateShelfScrollState);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
      el.removeEventListener('scroll', updateShelfScrollState);
      window.removeEventListener('resize', updateShelfScrollState);
    };
  }, [updateShelfScrollState, activeTab, isShelfExpanded, shelfViewMode, libraryItems, shelfSearchQuery, mediaFilter, shelfStatusFilter]);

  useEffect(() => {
    if (activeTab !== 'guides') return;
    const el = createdGuidesScrollRef.current;
    if (!el) return;
    updateCreatedGuidesScrollState();
    const raf = requestAnimationFrame(updateCreatedGuidesScrollState);
    const timer1 = setTimeout(updateCreatedGuidesScrollState, 50);
    const timer2 = setTimeout(updateCreatedGuidesScrollState, 150);
    el.addEventListener('scroll', updateCreatedGuidesScrollState, { passive: true });
    window.addEventListener('resize', updateCreatedGuidesScrollState);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
      el.removeEventListener('scroll', updateCreatedGuidesScrollState);
      window.removeEventListener('resize', updateCreatedGuidesScrollState);
    };
  }, [updateCreatedGuidesScrollState, activeTab, isCreatedGuidesExpanded, profile?.created_lists]);

  useEffect(() => {
    if (activeTab !== 'guides') return;
    const el = savedGuidesScrollRef.current;
    if (!el) return;
    updateSavedGuidesScrollState();
    const raf = requestAnimationFrame(updateSavedGuidesScrollState);
    const timer1 = setTimeout(updateSavedGuidesScrollState, 50);
    const timer2 = setTimeout(updateSavedGuidesScrollState, 150);
    el.addEventListener('scroll', updateSavedGuidesScrollState, { passive: true });
    window.addEventListener('resize', updateSavedGuidesScrollState);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
      el.removeEventListener('scroll', updateSavedGuidesScrollState);
      window.removeEventListener('resize', updateSavedGuidesScrollState);
    };
  }, [updateSavedGuidesScrollState, activeTab, isSavedGuidesExpanded, profile?.saved_lists]);



  useEffect(() => {
    const updateWidth = () => {
      if (shelfContainerRef.current) {
        setShelfContainerWidth(shelfContainerRef.current.clientWidth);
      }
      if (guidesContainerRef.current) {
        setGuidesContainerWidth(guidesContainerRef.current.clientWidth);
      }
      if (favoritesContainerRef.current) {
        setFavoritesContainerWidth(favoritesContainerRef.current.clientWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            if (entry.target === shelfContainerRef.current) {
              setShelfContainerWidth(entry.contentRect.width);
            }
            if (entry.target === guidesContainerRef.current) {
              setGuidesContainerWidth(entry.contentRect.width);
            }
            if (entry.target === favoritesContainerRef.current) {
              setFavoritesContainerWidth(entry.contentRect.width);
            }
          }
        }
      });
      if (shelfContainerRef.current) ro.observe(shelfContainerRef.current);
      if (guidesContainerRef.current) ro.observe(guidesContainerRef.current);
      if (favoritesContainerRef.current) ro.observe(favoritesContainerRef.current);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  // Overlay modal states for shelf items details
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [seriesEndedMap, setSeriesEndedMap] = useState<Record<string, boolean>>({});
  const [seriesEpisodesMap, setSeriesEpisodesMap] = useState<Record<string, any[]>>({});
                        
  // Favorites state (local highlight mock for UX polish)
  const [favorites, setFavorites] = useState<LibraryItem[]>(() => {
    if (!targetUserIdentifier) {
      try {
        const cached = sessionStorage.getItem('pathd_lib_cache');
        return cached ? JSON.parse(cached).filter((i: LibraryItem) => i.is_favorite) : [];
      } catch { return []; }
    } else {
      try {
        const cached = sessionStorage.getItem(`pathd_user_lib_${targetUserIdentifier.toLowerCase()}`);
        return cached ? JSON.parse(cached).filter((i: LibraryItem) => i.is_favorite) : [];
      } catch { return []; }
    }
  });

  // Only display extra favorites beyond 1-per-category if user has active Pro, sorted by custom order then newest
  const displayedFavorites = React.useMemo(() => {
    const list = profile?.is_pro
      ? favorites
      : (() => {
          const seenCategories = new Set<string>();
          return favorites.filter(item => {
            const type = item.item_type;
            if (!seenCategories.has(type)) {
              seenCategories.add(type);
              return true;
            }
            return false;
          });
        })();

    return [...list].sort((a, b) => {
      const orderA = a.favorite_order ?? 0;
      const orderB = b.favorite_order ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const timeA = a.favorited_at ? new Date(a.favorited_at).getTime() : new Date(a.updated_at || a.completed_at || a.created_at || 0).getTime();
      const timeB = b.favorited_at ? new Date(b.favorited_at).getTime() : new Date(b.updated_at || b.completed_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [favorites, profile?.is_pro]);

  // Favorites Drag and Drop reordering states & edge scroller
  interface FavPointerDrag {
    item: LibraryItem;
    sourceIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  }

  const [favPointerDrag, setFavPointerDrag] = useState<FavPointerDrag | null>(null);
  const favPointerDragRef = useRef<FavPointerDrag | null>(null);
  favPointerDragRef.current = favPointerDrag;

  const [favDragOverIndex, setFavDragOverIndex] = useState<number | null>(null);
  const favDragOverIndexRef = useRef<number | null>(null);
  favDragOverIndexRef.current = favDragOverIndex;

  const favJustDraggedRef = useRef<boolean>(false);
  const favEdgeScrollIntervalRef = useRef<any>(null);

  const stopFavEdgeScroll = useCallback(() => {
    if (favEdgeScrollIntervalRef.current) {
      clearInterval(favEdgeScrollIntervalRef.current);
      favEdgeScrollIntervalRef.current = null;
    }
  }, []);

  const startFavEdgeScroll = useCallback((direction: 'left' | 'right' | 'up' | 'down', speed: number) => {
    stopFavEdgeScroll();
    favEdgeScrollIntervalRef.current = setInterval(() => {
      if (favoritesViewMode === 'list') {
        if (favoritesListScrollRef.current) {
          favoritesListScrollRef.current.scrollTop += (direction === 'up' ? -speed : speed);
        }
      } else {
        if (favoritesScrollRef.current) {
          favoritesScrollRef.current.scrollLeft += (direction === 'left' ? -speed : speed);
          updateFavoritesScrollState();
        }
      }
    }, 16);
  }, [stopFavEdgeScroll, updateFavoritesScrollState, favoritesViewMode]);

  const handleFavEdgeScrollCheck = useCallback((clientX: number, clientY: number) => {
    if (favoritesViewMode === 'list') {
      const el = favoritesListScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const edgeZone = 60;

      if (clientY < rect.top + edgeZone && clientY >= rect.top - 30) {
        const distanceIntoEdge = Math.max(1, (rect.top + edgeZone) - clientY);
        const speed = Math.min(18, Math.max(4, Math.round((distanceIntoEdge / edgeZone) * 16)));
        startFavEdgeScroll('up', speed);
      } else if (clientY > rect.bottom - edgeZone && clientY <= rect.bottom + 30) {
        const distanceIntoEdge = Math.max(1, clientY - (rect.bottom - edgeZone));
        const speed = Math.min(18, Math.max(4, Math.round((distanceIntoEdge / edgeZone) * 16)));
        startFavEdgeScroll('down', speed);
      } else {
        stopFavEdgeScroll();
      }
    } else {
      const el = favoritesScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const edgeZone = 80;

      if (clientX < rect.left + edgeZone && clientX >= rect.left - 40) {
        const distanceIntoEdge = Math.max(1, (rect.left + edgeZone) - clientX);
        const speed = Math.min(18, Math.max(4, Math.round((distanceIntoEdge / edgeZone) * 16)));
        startFavEdgeScroll('left', speed);
      } else if (clientX > rect.right - edgeZone && clientX <= rect.right + 40) {
        const distanceIntoEdge = Math.max(1, clientX - (rect.right - edgeZone));
        const speed = Math.min(18, Math.max(4, Math.round((distanceIntoEdge / edgeZone) * 16)));
        startFavEdgeScroll('right', speed);
      } else {
        stopFavEdgeScroll();
      }
    }
  }, [startFavEdgeScroll, stopFavEdgeScroll, favoritesViewMode]);

  useEffect(() => {
    if (!favPointerDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentDrag = favPointerDragRef.current;
      if (!currentDrag) return;

      const dist = Math.hypot(e.clientX - currentDrag.startX, e.clientY - currentDrag.startY);
      const isDraggingNow = currentDrag.isDragging || dist > 6;

      if (isDraggingNow) {
        favJustDraggedRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        handleFavEdgeScrollCheck(e.clientX, e.clientY);

        // Find drop index across rendered cards / list rows
        const container = favoritesViewMode === 'list' ? favoritesListScrollRef.current : favoritesScrollRef.current;
        if (container) {
          const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-fav-card-idx]'));
          if (cards.length > 0) {
            let closestIdx = -1;
            let closestDist = Infinity;
            let insertBefore = true;

            for (const card of cards) {
              const cardIdx = parseInt(card.getAttribute('data-fav-card-idx') || '0', 10);
              const rect = card.getBoundingClientRect();

              if (favoritesViewMode === 'list') {
                const centerY = rect.top + rect.height / 2;
                const d = Math.abs(e.clientY - centerY);
                if (d < closestDist) {
                  closestDist = d;
                  closestIdx = cardIdx;
                  insertBefore = e.clientY < centerY;
                }
              } else {
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const d = Math.hypot(e.clientX - centerX, e.clientY - centerY);

                if (d < closestDist) {
                  closestDist = d;
                  closestIdx = cardIdx;
                  insertBefore = e.clientX < centerX;
                }
              }
            }

            if (closestIdx !== -1) {
              const targetIdx = insertBefore ? closestIdx : closestIdx + 1;
              setFavDragOverIndex(prev => (prev === targetIdx ? prev : targetIdx));
            }
          }
        }
      }

      setFavPointerDrag(prev => prev ? {
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: isDraggingNow
      } : null);
    };

    const handlePointerUp = () => {
      stopFavEdgeScroll();
      const currentDrag = favPointerDragRef.current;
      const targetOverIdx = favDragOverIndexRef.current;

      if (currentDrag && currentDrag.isDragging && targetOverIdx !== null) {
        let finalTargetIdx = targetOverIdx;
        if (currentDrag.sourceIndex < finalTargetIdx) {
          finalTargetIdx -= 1;
        }

        if (finalTargetIdx !== currentDrag.sourceIndex) {
          const reordered = [...displayedFavorites];
          const [moved] = reordered.splice(currentDrag.sourceIndex, 1);
          reordered.splice(Math.max(0, Math.min(finalTargetIdx, reordered.length)), 0, moved);

          const updated = reordered.map((item, index) => ({
            ...item,
            favorite_order: index
          }));

          setFavorites(updated);
          setLibraryItems(prev => prev.map(li => {
            const f = updated.find(u => u.id === li.id);
            return f ? { ...li, favorite_order: f.favorite_order } : li;
          }));

          try {
            if (!targetUserIdentifier) {
              sessionStorage.setItem('pathd_lib_cache', JSON.stringify(
                (libraryItems || []).map(li => {
                  const f = updated.find(u => u.id === li.id);
                  return f ? { ...li, favorite_order: f.favorite_order } : li;
                })
              ));
            }
          } catch {}

          const item_ids = updated.map(item => item.id);
          apiClient.put('/library/favorites/reorder', { item_ids }).catch(err => {
            console.error('Failed to save favorites order', err);
          });
        }
      }

      setTimeout(() => {
        favJustDraggedRef.current = false;
      }, 120);

      setFavPointerDrag(null);
      setFavDragOverIndex(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      stopFavEdgeScroll();
    };
  }, [favPointerDrag !== null, displayedFavorites, libraryItems, targetUserIdentifier, stopFavEdgeScroll, handleFavEdgeScrollCheck]);

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    const el = favoritesScrollRef.current;
    if (!el) return;
    updateFavoritesScrollState();
    const raf = requestAnimationFrame(updateFavoritesScrollState);
    const timer1 = setTimeout(updateFavoritesScrollState, 50);
    const timer2 = setTimeout(updateFavoritesScrollState, 150);
    el.addEventListener('scroll', updateFavoritesScrollState, { passive: true });
    window.addEventListener('resize', updateFavoritesScrollState);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateFavoritesScrollState();
      });
      resizeObserver.observe(el);
      if (favoritesContainerRef.current) {
        resizeObserver.observe(favoritesContainerRef.current);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
      el.removeEventListener('scroll', updateFavoritesScrollState);
      window.removeEventListener('resize', updateFavoritesScrollState);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateFavoritesScrollState, activeTab, isFavoritesExpanded, favoritesViewMode, displayedFavorites, favoritesMediaFilter]);

  // Last.fm states
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [topAlbums, setTopAlbums] = useState<any[]>([]);
  const [musicType, setMusicType] = useState<'artists' | 'albums' | 'tracks'>('artists');
  const [musicPeriod, setMusicPeriod] = useState<'7day' | '1month' | 'overall'>('7day');
  const [musicItems, setMusicItems] = useState<any[]>([]);
  const [isMusicDataLoading, setIsMusicDataLoading] = useState<boolean>(false);
  const [isConnectingLastFm, setIsConnectingLastFm] = useState(false);
  const [isLastFmLoading, setIsLastFmLoading] = useState<boolean>(false);
  const [lastFmTokenInput, setLastFmTokenInput] = useState('');
  const [musicDetailsModal, setMusicDetailsModal] = useState<{
    isOpen: boolean;
    type: 'artist' | 'album' | 'track';
    artist: string;
    name?: string;
    image?: string;
  }>({
    isOpen: false,
    type: 'track',
    artist: ''
  });

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
      const isNowFollowing = Boolean(res.data.following);
      const isNowRequested = Boolean(res.data.requested);

      setProfile(prev => prev ? {
        ...prev,
        is_following: isNowFollowing,
        follow_request_pending: isNowRequested,
        followers_count: Math.max(0, (prev.followers_count || 0) + (isNowFollowing ? 1 : (prev.is_following ? -1 : 0)))
      } : null);

      if (isNowRequested) {
        setSuccessMsg(language === 'es' ? 'Solicitud de seguimiento enviada.' : 'Follow request sent.');
      } else if (isNowFollowing) {
        setSuccessMsg(language === 'es' ? 'Comenzaste a seguir a este usuario.' : 'Started following this user.');
      } else {
        setSuccessMsg(language === 'es' ? 'Dejaste de seguir o cancelaste la solicitud.' : 'Unfollowed or cancelled request.');
      }
      setTimeout(() => setSuccessMsg(''), 3500);
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

    // Populate from cache immediately if available to eliminate layout shift / loading delays
    if (targetUserIdentifier) {
      try {
        const cachedUser = sessionStorage.getItem(`pathd_user_cache_${targetUserIdentifier.toLowerCase()}`);
        const cachedLib = sessionStorage.getItem(`pathd_user_lib_${targetUserIdentifier.toLowerCase()}`);
        if (cachedUser) {
          setProfile(JSON.parse(cachedUser));
          if (cachedLib) {
            const parsedLib = JSON.parse(cachedLib);
            setLibraryItems(parsedLib);
            setFavorites(parsedLib.filter((i: LibraryItem) => i.is_favorite));
          }
          setLoading(false);
        } else {
          setProfile(null);
          setLibraryItems([]);
          setFavorites([]);
          setLoading(true);
        }
      } catch {
        setLoading(true);
      }
    } else {
      try {
        const cachedMe = sessionStorage.getItem('pathd_me_cache');
        const cachedLib = sessionStorage.getItem('pathd_lib_cache');
        if (cachedMe) {
          setProfile(JSON.parse(cachedMe));
          if (cachedLib) {
            const parsedLib = JSON.parse(cachedLib);
            setLibraryItems(parsedLib);
            setFavorites(parsedLib.filter((i: LibraryItem) => i.is_favorite));
          }
          setLoading(false);
        } else {
          setProfile(null);
          setLibraryItems([]);
          setFavorites([]);
          setLoading(true);
        }
      } catch {
        setLoading(true);
      }
    }

    fetchProfileAndLibrary();

    const handleProfileUpdate = () => {
      fetchProfileAndLibrary();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    window.addEventListener('library-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('library-updated', handleProfileUpdate);
    };
  }, [usernameParam, userIdParam]);


  const fetchProfileAndLibrary = async () => {
    // Only show full loading spinner if we don't have any cached data
    if (!profile && libraryItems.length === 0) {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      // 1. Parallelize current user and target profile requests
      const targetProfileUrl = targetUserIdentifier ? `/users/profile/${targetUserIdentifier}` : '/users/me';
      const [meRes, profileRes] = await Promise.all([
        apiClient.get('/users/me'),
        apiClient.get(targetProfileUrl)
      ]);

      setCurrentUser(meRes.data);
      setProfile(profileRes.data);
      if (!targetUserIdentifier) {
        try {
          sessionStorage.setItem('pathd_me_cache', JSON.stringify(profileRes.data));
        } catch (e) {}
      } else {
        try {
          sessionStorage.setItem(`pathd_user_cache_${targetUserIdentifier.toLowerCase()}`, JSON.stringify(profileRes.data));
          if (profileRes.data.username) {
            sessionStorage.setItem(`pathd_user_cache_${profileRes.data.username.toLowerCase()}`, JSON.stringify(profileRes.data));
          }
        } catch (e) {}
      }

      const targetId = profileRes.data.id;
      const targetLibraryUrl = (targetUserIdentifier && targetId !== meRes.data.id) ? `/library/?user_id=${targetId}` : '/library/';
      const targetActivityUrl = (targetUserIdentifier && targetId !== meRes.data.id) ? `/users/${targetId}/activity` : '/users/me/activity';

      // 2. Fetch library and activities in parallel
      const [libraryRes, activityRes] = await Promise.all([
        apiClient.get(targetLibraryUrl),
        apiClient.get(targetActivityUrl)
      ]);

      const rawLibItems: LibraryItem[] = (libraryRes.data || []).filter((item: LibraryItem) => !item.external_id?.startsWith('cv_issue_'));
      setLibraryItems(rawLibItems);
      setActivities(activityRes.data || []);
      if (!targetUserIdentifier) {
        try {
          sessionStorage.setItem('pathd_lib_cache', JSON.stringify(rawLibItems));
          sessionStorage.setItem('pathd_act_cache', JSON.stringify(activityRes.data || []));
          
          // Background clean up rogue standalone comic issue rows from user library
          const rogueIssues = (libraryRes.data || []).filter((item: LibraryItem) => item.external_id?.startsWith('cv_issue_'));
          rogueIssues.forEach((item: LibraryItem) => {
            apiClient.delete(`/library/${item.id}`).catch(() => {});
          });
        } catch (e) {}
      } else {
        try {
          sessionStorage.setItem(`pathd_user_lib_${targetUserIdentifier.toLowerCase()}`, JSON.stringify(rawLibItems));
          if (profileRes.data.username) {
            sessionStorage.setItem(`pathd_user_lib_${profileRes.data.username.toLowerCase()}`, JSON.stringify(rawLibItems));
          }
        } catch (e) {}
      }

      // Set favorites state from items explicitly marked as favorites
      const favs = rawLibItems.filter((item: LibraryItem) => item.is_favorite);
      setFavorites(favs);

      // Render profile immediately!
      setLoading(false);

      // 3. Preload / check 'Ended' status and episodes in background
      const endedMap: Record<string, boolean> = {};
      const allSeriesItems = rawLibItems.filter(i => (i.item_type === 'series' || i.item_type === 'anime') && i.external_id);
      
      const missingSeriesIds: string[] = [];
      const missingEpisodeSeriesIds: string[] = [];
      allSeriesItems.forEach(s => {
        const cacheKey = `series_${s.external_id}`;
        const cached = getCachedSeries(cacheKey);
        if (cached && (cached.status || cached.is_ended !== undefined)) {
          endedMap[s.external_id] = cached.status === 'Ended' || cached.status === 'Finished' || cached.status === 'Canceled' || cached.is_ended === true;
        } else {
          missingSeriesIds.push(s.external_id);
        }

        const cacheKeyAll = `${s.external_id}_all_episodes`;
        const cachedEps = getCachedSeries(cacheKeyAll);
        if (cachedEps && Array.isArray(cachedEps)) {
          setSeriesEpisodesMap(prev => ({ ...prev, [s.external_id]: cachedEps }));
        } else if (s.status === 'watching') {
          missingEpisodeSeriesIds.push(s.external_id);
        }
      });
      setSeriesEndedMap(prev => ({ ...prev, ...endedMap }));

      if (missingSeriesIds.length > 0) {
        Promise.allSettled(
          missingSeriesIds.map(async (extId) => {
            try {
              const res = await apiClient.get(`/search/series/${extId}`);
              const sData = res.data;
              const isEnded = sData.status === 'Ended' || sData.status === 'Finished' || sData.status === 'Canceled' || sData.is_ended === true;
              const cacheKey = `series_${extId}`;
              const existingCached = getCachedSeries(cacheKey) || {};
              setCachedSeries(cacheKey, { ...existingCached, ...sData, status: sData.status });
              return { extId, isEnded };
            } catch (e) {
              return { extId, isEnded: false };
            }
          })
        ).then(results => {
          const newMap: Record<string, boolean> = {};
          results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
              newMap[r.value.extId] = r.value.isEnded;
            }
          });
          setSeriesEndedMap(prev => ({ ...prev, ...newMap }));
        });
      }

      if (missingEpisodeSeriesIds.length > 0) {
        Promise.allSettled(
          missingEpisodeSeriesIds.map(async (extId) => {
            try {
              const res = await apiClient.get(`/search/series/${extId}/episodes`);
              if (Array.isArray(res.data) && res.data.length > 0) {
                setCachedSeries(`${extId}_all_episodes`, res.data);
                return { extId, episodes: res.data };
              }
              return { extId, episodes: [] };
            } catch (e) {
              return { extId, episodes: [] };
            }
          })
        ).then(results => {
          const newEpMap: Record<string, any[]> = {};
          results.forEach(r => {
            if (r.status === 'fulfilled' && r.value && r.value.episodes.length > 0) {
              newEpMap[r.value.extId] = r.value.episodes;
            }
          });
          if (Object.keys(newEpMap).length > 0) {
            setSeriesEpisodesMap(prev => ({ ...prev, ...newEpMap }));
          }
        });
      }

      // 4. Fetch Last.fm data and prefetch top music in background if connected
      const targetLastfmUser = profileRes.data.lastfm_username;
      if (targetLastfmUser) {
        setIsLastFmLoading(true);
        const targetNpUrl = `/users/${targetId}/music/now-playing`;
        const targetTaUrl = `/users/${targetId}/music/top-albums`;
        const targetArtistsUrl = `/users/${targetId}/music/top-artists?period=7day`;
        const targetTracksUrl = `/users/${targetId}/music/top-tracks?period=7day`;
        
        Promise.allSettled([
          apiClient.get(targetNpUrl),
          apiClient.get(targetTaUrl),
          apiClient.get(targetArtistsUrl),
          apiClient.get(targetTracksUrl)
        ]).then(([npRes, taRes, tartRes, ttrRes]) => {
          const npData = npRes.status === 'fulfilled' ? npRes.value.data : null;
          const taData = taRes.status === 'fulfilled' ? (taRes.value.data || []) : [];
          const tartData = tartRes.status === 'fulfilled' ? (tartRes.value.data || []) : [];
          const ttrData = ttrRes.status === 'fulfilled' ? (ttrRes.value.data || []) : [];
          
          setNowPlaying(npData);
          setTopAlbums(taData);

          // Populate music cache in background for 7day default
          if (taData && taData.length > 0) musicCacheRef.current[`${targetId}_albums_7day`] = taData;
          if (tartData && tartData.length > 0) musicCacheRef.current[`${targetId}_artists_7day`] = tartData;
          if (ttrData && ttrData.length > 0) musicCacheRef.current[`${targetId}_tracks_7day`] = ttrData;

          // If current tab is music or if musicItems is empty, set current view items
          if (musicType === 'artists' && tartData.length > 0) {
            setMusicItems(tartData);
          } else if (musicType === 'albums' && taData.length > 0) {
            setMusicItems(taData);
          } else if (musicType === 'tracks' && ttrData.length > 0) {
            setMusicItems(ttrData);
          }
        }).catch(() => {
          setNowPlaying(null);
          setTopAlbums([]);
        }).finally(() => {
          setIsLastFmLoading(false);
        });
      } else {
        setNowPlaying(null);
        setTopAlbums([]);
        setIsLastFmLoading(false);
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

  const musicCacheRef = useRef<Record<string, any[]>>({});

  // Fetch dynamic music data according to selected type and period with client cache
  useEffect(() => {
    if (!profile?.lastfm_username || !profile?.id) return;

    const targetId = profile.id;
    let endpoint = 'top-albums';
    if (musicType === 'artists') endpoint = 'top-artists';
    if (musicType === 'tracks') endpoint = 'top-tracks';

    const cacheKey = `${targetId}_${musicType}_${musicPeriod}`;
    if (musicCacheRef.current[cacheKey] && musicCacheRef.current[cacheKey].length > 0) {
      const cachedItems = musicCacheRef.current[cacheKey];
      setMusicItems(cachedItems);
      setIsMusicDataLoading(false);

      // Stagger prefetch details for top visible items in background
      const prefetchList = cachedItems.slice(0, 8).map(item => ({
        type: (musicType === 'artists' ? 'artist' : musicType === 'albums' ? 'album' : 'track') as 'artist' | 'album' | 'track',
        artist: musicType === 'artists' ? item.name : item.artist,
        name: musicType === 'artists' ? undefined : item.name
      }));
      batchPrefetchMusicItems(prefetchList, 8, 250);
    } else {
      if (activeTab === 'music') {
        setIsMusicDataLoading(true);
      }
    }

    const url = `/users/${targetId}/music/${endpoint}?period=${musicPeriod}`;

    let isMounted = true;
    apiClient.get(url)
      .then(res => {
        if (!isMounted) return;
        const items = Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          musicCacheRef.current[cacheKey] = items;
        }
        setMusicItems(items);

        // Stagger prefetch details for top visible items in background
        const prefetchList = items.slice(0, 8).map(item => ({
          type: (musicType === 'artists' ? 'artist' : musicType === 'albums' ? 'album' : 'track') as 'artist' | 'album' | 'track',
          artist: musicType === 'artists' ? item.name : item.artist,
          name: musicType === 'artists' ? undefined : item.name
        }));
        batchPrefetchMusicItems(prefetchList, 8, 250);
      })
      .catch(() => {
        if (!isMounted) return;
        if (!musicCacheRef.current[cacheKey] || musicCacheRef.current[cacheKey].length === 0) {
          setMusicItems([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsMusicDataLoading(false);
        }
      });

    // Background prefetch the other periods for this category so switching 7day -> 1month -> overall is instantaneous
    const otherPeriods = (['7day', '1month', 'overall'] as const).filter(p => p !== musicPeriod);
    otherPeriods.forEach((otherP, idx) => {
      const otherKey = `${targetId}_${musicType}_${otherP}`;
      if (!musicCacheRef.current[otherKey] || musicCacheRef.current[otherKey].length === 0) {
        setTimeout(() => {
          if (!isMounted) return;
          apiClient.get(`/users/${targetId}/music/${endpoint}?period=${otherP}`)
            .then(res => {
              if (Array.isArray(res.data)) {
                musicCacheRef.current[otherKey] = res.data;
              }
            })
            .catch(() => {});
        }, (idx + 1) * 350);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [profile?.lastfm_username, profile?.id, activeTab, musicType, musicPeriod]);

  const handleLastFmLogin = () => {
    const currentOrigin = window.location.origin;
    window.location.href = `https://www.last.fm/api/auth/?api_key=de5acce61bdd8b3e4bd181ebce8a69e8&cb=${encodeURIComponent(`${currentOrigin}/profile`)}`;
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
      window.dispatchEvent(new Event('library-updated'));
      
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
      const nowIso = new Date().toISOString();
      await apiClient.put(`/library/${itemId}`, { is_favorite: !currentFav });
      
      setLibraryItems(prev => {
        if (!currentFav) {
          return prev.map(item => {
            if (item.id === itemId) {
              return { ...item, is_favorite: true, favorited_at: nowIso, favorite_order: 0 };
            }
            if (item.is_favorite) {
              return { ...item, favorite_order: (item.favorite_order ?? 0) + 1 };
            }
            return item;
          });
        } else {
          return prev.map(item => item.id === itemId ? { ...item, is_favorite: false, favorited_at: undefined } : item);
        }
      });
      
      setFavorites(prev => {
        if (!currentFav) {
          const shifted = prev.map(li => ({
            ...li,
            favorite_order: (li.favorite_order ?? 0) + 1
          }));
          return [{ ...targetItem, is_favorite: true, favorited_at: nowIso, favorite_order: 0 }, ...shifted];
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
      const nowIso = new Date().toISOString();
      // 1. Unfavorite the old item
      await apiClient.put(`/library/${itemToReplaceId}`, { is_favorite: false });
      // 2. Favorite the new item
      await apiClient.put(`/library/${newItemId}`, { is_favorite: true });

      setLibraryItems(prev => {
        return prev.map(item => {
          if (item.id === itemToReplaceId) {
            return { ...item, is_favorite: false, favorited_at: undefined };
          }
          if (item.id === newItemId) {
            return { ...item, is_favorite: true, favorited_at: nowIso, favorite_order: 0 };
          }
          if (item.is_favorite) {
            return { ...item, favorite_order: (item.favorite_order ?? 0) + 1 };
          }
          return item;
        });
      });

      setFavorites(prev => {
        const filtered = prev.filter(li => li.id !== itemToReplaceId && li.id !== newItemId);
        const shifted = filtered.map(li => ({
          ...li,
          favorite_order: (li.favorite_order ?? 0) + 1
        }));
        return [{ ...newItemObj, is_favorite: true, favorited_at: nowIso, favorite_order: 0 }, ...shifted];
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
    if (item.external_id?.startsWith('cv_issue_')) return false;
    const isLooseType = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
    if (!isLooseType) return false;
    
    const parentTitle = item.last_seen_episode || '';
    const followsParentSeries = libraryItems.some(li => 
      (li.item_type === 'series' || li.item_type === 'anime') && 
      (li.title === parentTitle || item.title.startsWith(li.title))
    );
    return isLooseType && !followsParentSeries;
  };

  const getItemShelfStatus = useCallback((item: LibraryItem): string => {
    if (item.status === 'dropped') return 'dropped';

    const isPlanTo = ['plan_to_watch', 'plan_to_play', 'plan_to_read'].includes(item.status) ||
      ((item.item_type === 'series' || item.item_type === 'anime') &&
       !item.last_seen_episode &&
       item.status !== 'completed' &&
       item.status !== 'watching' &&
       (!item.completed_episodes_count || item.completed_episodes_count === 0));

    if (isPlanTo) return 'plan_to';

    const hasEverCompleted = (item.times_completed && item.times_completed > 0) || !!item.completed_at;

    if (item.item_type === 'game') {
      const isHundred = item.is_hundred_percent || (item.times_completed_hundred && item.times_completed_hundred > 0);
      if (isHundred) return 'hundred_percent';
      if (hasEverCompleted || item.status === 'completed') return 'completed';
      if (item.status === 'playing') return 'watching';
      return 'watching';
    }

    if (item.item_type === 'movie') {
      if (hasEverCompleted || item.status === 'completed') return 'completed';
      if (item.status === 'watching') return 'watching';
      return 'completed';
    }

    if (item.item_type === 'series' || item.item_type === 'anime') {
      const cacheKey = `series_${item.external_id}`;
      const cached = item.external_id ? (getCachedSeries(cacheKey) || getCachedSeries(`${item.external_id}_metadata`)) : null;
      const anyItem = item as any;
      const sStatus = cached?.status || anyItem.series_status;
      const isEnded = sStatus === 'Ended' || sStatus === 'Finished' || sStatus === 'Canceled' || anyItem.is_ended === true || cached?.is_ended === true || (item.external_id ? seriesEndedMap[item.external_id] === true : false);

      if ((hasEverCompleted || item.status === 'completed') && item.status !== 'watching') {
        if (isEnded) return 'completed';
        return 'watching'; // "Al día" counts as watching!
      }

      if (item.status === 'watching') {
        return 'watching';
      }

      return 'watching';
    }

    if (['book', 'comic', 'manga'].includes(item.item_type)) {
      if (item.item_type === 'comic') {
        const cleanVolId = String(item.external_id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '');
        const volMeta = getCachedSeries(`comic_vol_${item.external_id}`) || getCachedSeries(`${item.external_id}_metadata`) || getCachedSeries(`cv_vol_${cleanVolId}_metadata`) || getCachedSeries(`series_${item.external_id}`);
        const anyItem = item as any;
        const sStatus = volMeta?.status || anyItem.series_status;
        const currentYear = new Date().getFullYear();
        const titleYearMatch = item.title ? String(item.title).match(/\b(19\d\d|20\d\d)\b/) : null;
        const startYr = parseInt(item.release_date || volMeta?.start_year || volMeta?.first_air_date || (titleYearMatch ? titleYearMatch[1] : '0'));
        const isEnded = sStatus === 'Ended' || anyItem.is_ended === true || volMeta?.is_ended === true || (startYr > 0 && startYr < currentYear - 1);

        if ((hasEverCompleted || item.status === 'completed' || item.status === 'read') && item.status !== 'reading') {
          if (isEnded) return 'completed';
          return 'watching'; // "Al día" counts as reading/watching!
        }

        if (item.status === 'reading') return 'watching';
        return 'watching';
      }

      if (hasEverCompleted || item.status === 'completed' || item.status === 'read') return 'completed';
      if (item.status === 'reading') return 'watching';
      return 'completed';
    }

    return 'watching';
  }, [seriesEndedMap]);

  const getSubcategoriesForMedia = useCallback((mediaType: string, itemsForMedia: LibraryItem[]) => {
    const getCount = (statusId: string) => {
      if (statusId === 'all') return itemsForMedia.length;
      return itemsForMedia.filter(i => getItemShelfStatus(i) === statusId).length;
    };

    if (mediaType === 'movie') {
      return [
        { id: 'all', label: language === 'es' ? 'Todo' : 'All', count: getCount('all') },
        { id: 'watching', label: language === 'es' ? 'Pausadas' : 'Paused', count: getCount('watching') },
        { id: 'completed', label: language === 'es' ? 'Vistas' : 'Watched', count: getCount('completed') },
        { id: 'plan_to', label: language === 'es' ? 'Por ver' : 'Plan to watch', count: getCount('plan_to') },
        { id: 'dropped', label: language === 'es' ? 'Abandonadas' : 'Dropped', count: getCount('dropped') },
      ];
    } else if (mediaType === 'series' || mediaType === 'anime') {
      return [
        { id: 'all', label: language === 'es' ? 'Todo' : 'All', count: getCount('all') },
        { id: 'watching', label: language === 'es' ? 'Viendo' : 'Watching', count: getCount('watching') },
        { id: 'completed', label: language === 'es' ? 'Terminadas' : 'Completed', count: getCount('completed') },
        { id: 'plan_to', label: language === 'es' ? 'Por ver' : 'Plan to watch', count: getCount('plan_to') },
        { id: 'dropped', label: language === 'es' ? 'Abandonadas' : 'Dropped', count: getCount('dropped') },
      ];
    } else if (mediaType === 'game') {
      return [
        { id: 'all', label: language === 'es' ? 'Todo' : 'All', count: getCount('all') },
        { id: 'watching', label: language === 'es' ? 'Jugando' : 'Playing', count: getCount('watching') },
        { id: 'completed', label: language === 'es' ? 'Terminados' : 'Completed', count: getCount('completed') },
        { id: 'hundred_percent', label: '100%', count: getCount('hundred_percent'), hasTrophy: true },
        { id: 'plan_to', label: language === 'es' ? 'Por jugar' : 'Plan to play', count: getCount('plan_to') },
        { id: 'dropped', label: language === 'es' ? 'Abandonados' : 'Dropped', count: getCount('dropped') },
      ];
    } else {
      // book, comic, manga
      return [
        { id: 'all', label: language === 'es' ? 'Todo' : 'All', count: getCount('all') },
        { id: 'watching', label: language === 'es' ? 'Leyendo' : 'Reading', count: getCount('watching') },
        { id: 'completed', label: language === 'es' ? 'Leídos' : 'Read', count: getCount('completed') },
        { id: 'plan_to', label: language === 'es' ? 'Por leer' : 'Plan to read', count: getCount('plan_to') },
        { id: 'dropped', label: language === 'es' ? 'Abandonados' : 'Dropped', count: getCount('dropped') },
      ];
    }
  }, [getItemShelfStatus, language]);

  const filteredItems = libraryItems
    .filter(item => {
      if (item.external_id?.startsWith('cv_issue_')) return false;
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

      if (!matchesMedia || !matchesSearch || (!isSeriesOrRegular && !isLoose)) return false;

      // Status subcategory filter (active when a specific category is selected)
      if (mediaFilter !== 'all' && shelfStatusFilter !== 'all') {
        const itemStatus = getItemShelfStatus(item);
        if (itemStatus !== shelfStatusFilter) return false;
      }

      return true;
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
    if (item.external_id?.startsWith('cv_issue_')) return false;
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
    return (
      <div 
        style={{ 
          minHeight: '65vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '3rem 1rem'
        }}
      >
        <PathdLoader size="large" message={language === 'es' ? 'Cargando perfil...' : 'Loading profile...'} />
      </div>
    );
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
        maxWidth: '1200px', 
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
            minHeight: '220px',
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

          {/* Header Customize Profile Button */}
          {isOwnProfile && (
            <button
              onClick={() => navigate('/customize')}
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
              title={language === 'es' ? 'Personalizar perfil' : 'Customize profile'}
            >
              <Pencil size={19} />
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


              {/* Follow / Unfollow / Request button on other users' profiles */}
              {!isOwnProfile && currentUser && (
                <button
                  type="button"
                  onClick={handleToggleFollowProfileUser}
                  className={profile.is_following || (profile as any).follow_request_pending ? 'btn-secondary' : 'btn-primary'}
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
                  ) : (profile as any).follow_request_pending ? (
                    <>
                      <UserCheck size={16} color="var(--accent-primary)" />
                      {language === 'es' ? 'Solicitud enviada' : 'Requested'}
                    </>
                  ) : (profile as any).is_private ? (
                    <>
                      <UserPlus size={16} />
                      {language === 'es' ? 'Solicitar seguir' : 'Request to follow'}
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
            
            {/* Now Playing / Last.fm Widget */}
            {Boolean(profile?.lastfm_username) && (
              <div 
                style={{ 
                  marginTop: '1.25rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  backdropFilter: 'blur(8px)',
                  padding: '0.65rem 1rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)', 
                  width: 'fit-content',
                  maxWidth: '100%',
                  height: '76px',
                  minHeight: '76px',
                  maxHeight: '76px',
                  boxSizing: 'border-box',
                  cursor: nowPlaying ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  if (nowPlaying) {
                    setMusicDetailsModal({
                      isOpen: true,
                      type: 'track',
                      artist: nowPlaying.artist,
                      name: nowPlaying.name,
                      image: nowPlaying.image
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  if (nowPlaying) {
                    e.currentTarget.style.borderColor = 'rgba(29, 185, 84, 0.5)';
                    e.currentTarget.style.background = 'rgba(29, 185, 84, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (nowPlaying) {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                {isLastFmLoading && !nowPlaying ? (
                  // Animated equalizer skeleton (Exact same 3-row layout and 48px box as loaded state)
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '22px' }}>
                        <style>{`
                          @keyframes eqWave {
                            0%, 100% { height: 5px; }
                            50% { height: 20px; }
                          }
                        `}</style>
                        <span style={{ width: '3.5px', background: profileTheme.accent, opacity: 1, borderRadius: '2px', animation: 'eqWave 1s ease-in-out infinite', animationDelay: '0s' }} />
                        <span style={{ width: '3.5px', background: profileTheme.accent, opacity: 0.85, borderRadius: '2px', animation: 'eqWave 1s ease-in-out infinite', animationDelay: '0.2s' }} />
                        <span style={{ width: '3.5px', background: profileTheme.accent, opacity: 0.7, borderRadius: '2px', animation: 'eqWave 1s ease-in-out infinite', animationDelay: '0.4s' }} />
                        <span style={{ width: '3.5px', background: profileTheme.accent, opacity: 0.55, borderRadius: '2px', animation: 'eqWave 1s ease-in-out infinite', animationDelay: '0.15s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: profileTheme.accent, opacity: 0.7, animation: 'pulse 2s infinite' }} />
                        <div style={{ width: '85px', height: '9px', borderRadius: '4px', background: 'rgba(255,255,255,0.12)', animation: 'pulse 1.5s infinite' }} />
                      </div>
                      <div style={{ width: '170px', height: '13px', borderRadius: '4px', background: 'rgba(255,255,255,0.18)', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ width: '105px', height: '10px', borderRadius: '4px', background: 'rgba(255,255,255,0.10)', animation: 'pulse 1.5s infinite' }} />
                    </div>
                  </div>
                ) : nowPlaying ? (
                  <>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#222', flexShrink: 0 }}>
                      {nowPlaying.image ? (
                        <img src={nowPlaying.image} alt="Album Art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Music size={20} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem', lineHeight: 1.2 }}>
                        {nowPlaying.is_playing ? (
                          <>
                            <span style={{ display: 'inline-block', width: '7px', height: '7px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                            {language === 'es' ? 'Escuchando ahora' : 'Now Playing'}
                          </>
                        ) : (
                          language === 'es' ? 'Última canción escuchada' : 'Last Played'
                        )}
                      </span>
                      <div 
                        style={{ 
                          margin: '0.15rem 0', 
                          fontSize: '0.92rem', 
                          fontWeight: 600, 
                          color: 'var(--text-primary)', 
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '260px',
                          lineHeight: 1.2
                        }}
                        title={nowPlaying.name}
                      >
                        {nowPlaying.name}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '260px', lineHeight: 1.2 }}>
                        {nowPlaying.artist}
                      </span>
                    </div>
                  </>
                ) : (
                  // Idle connected badge
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: profileTheme.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: profileTheme.accent }}>
                      <Music size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Last.fm</span>
                      <span 
                        style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}
                      >
                        @{profile.lastfm_username}
                      </span>
                    </div>
                  </div>
                )}
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

      {/* Private Account Locked Screen */}
      {(profile as any)?.is_private_locked ? (
        <div
          className="glass-card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            maxWidth: '520px',
            margin: '2rem auto'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(124, 58, 237, 0.12)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}
          >
            <Lock size={32} />
          </div>

          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {language === 'es' ? 'Esta cuenta es privada' : 'This account is private'}
          </h3>

          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {language === 'es'
              ? 'Sigue a este usuario para ver su estantería cultural, guías creadas y actividad reciente.'
              : 'Follow this user to view their shelf, created guides, and recent cultural activity.'}
          </p>

          {currentUser && (
            <button
              onClick={handleToggleFollowProfileUser}
              className={(profile as any)?.follow_request_pending ? 'btn-secondary' : 'btn-primary'}
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem 1.75rem',
                borderRadius: '25px',
                fontWeight: 600,
                fontSize: '0.92rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {(profile as any)?.follow_request_pending ? (
                <>
                  <UserCheck size={18} color="var(--accent-primary)" />
                  <span>{language === 'es' ? 'Solicitud pendiente' : 'Request pending'}</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>{language === 'es' ? 'Solicitar seguir' : 'Request to follow'}</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
            <button
              onClick={() => setActiveTab('shelf')}
              className={`profile-tab-btn ${activeTab === 'shelf' ? 'active' : ''}`}
              style={{
                '--tab-color': 'var(--accent-primary)'
              } as React.CSSProperties}
            >
              {activeTab === 'shelf' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  {/* Row 1 */}
                  <rect x="3" y="3" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="3" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="3" width="4.5" height="4.5" rx="1" />
                  {/* Row 2 */}
                  <rect x="3" y="9.75" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1" />
                  {/* Row 3 */}
                  <rect x="3" y="16.5" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1" />
                </svg>
              ) : (
                <Grid size={18} strokeWidth={1.8} />
              )}
              <span>{language === 'es' ? 'Estantería' : 'My Shelf'}</span>
            </button>

        <button
          onClick={() => setActiveTab('guides')}
          className={`profile-tab-btn ${activeTab === 'guides' ? 'active' : ''}`}
          style={{
            '--tab-color': 'var(--color-guide, #2DD4BF)'
          } as React.CSSProperties}
        >
          {activeTab === 'guides' ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Single unified filled open book path with pronounced filled bottom spine tip */}
              <path
                d="M2 3h6a4 4 0 0 1 4 4v14.5a3 3 0 0 0-3-3.5H2zm20 0h-6a4 4 0 0 0-4 4v14.5a3 3 0 0 1 3-3.5h7z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              {/* Inner fold line ending before the bottom point so the bottom tip stays fully solid */}
              <line x1="12" y1="7" x2="12" y2="18.5" stroke="var(--bg-primary, #090d16)" strokeWidth="1.6" />
            </svg>
          ) : (
            <BookOpen size={18} strokeWidth={1.8} />
          )}
          <span>{language === 'es' ? 'Guías' : 'Guides'}</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`profile-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          style={{
            '--tab-color': '#F472B6'
          } as React.CSSProperties}
        >
          <Heart size={18} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'favorites' ? 2 : 1.8} /> {language === 'es' ? 'Destacados' : 'Favorites'}
        </button>

        {Boolean(profile?.lastfm_username) && (
          <button
            onClick={() => setActiveTab('music')}
            className={`profile-tab-btn ${activeTab === 'music' ? 'active' : ''}`}
            style={{
              '--tab-color': 'var(--color-music, #1DB954)'
            } as React.CSSProperties}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={activeTab === 'music' ? 2.2 : 1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" fill={activeTab === 'music' ? 'currentColor' : 'none'} />
              <circle cx="18" cy="16" r="3" fill={activeTab === 'music' ? 'currentColor' : 'none'} />
            </svg>
            <span>{language === 'es' ? 'Música' : 'Music'}</span>
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
                const orderedMedia = getOrderedCategories(profile?.category_order || currentUser?.category_order);
                const baseTypes = ['all', ...orderedMedia] as const;
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

                  const typeCount = type === 'all'
                    ? visualLibraryItems.length
                    : visualLibraryItems.filter(item => {
                        if (type === 'series') return item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season';
                        if (type === 'anime') return item.item_type === 'anime';
                        return item.item_type === type;
                      }).length;

                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setMediaFilter(type as any);
                        setShelfStatusFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`profile-category-tab ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        textTransform: 'capitalize',
                        '--tab-color': typeColor,
                        '--tab-text': typeTextColor
                      } as React.CSSProperties}
                    >
                      {getCategoryIcon(type, { size: 14, color: isSelected ? typeTextColor : typeColor })}
                      <span>
                        {type === 'all' ? (language === 'es' ? 'Todo' : 'All') :
                         type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
                         type === 'series' ? (language === 'es' ? 'Series' : 'Shows') :
                         type === 'anime' ? 'Anime' :
                         type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
                         type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') :
                         type === 'manga' ? 'Mangas' :
                         type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type}
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          opacity: isSelected ? 0.85 : 0.6,
                          fontWeight: isSelected ? 600 : 500,
                          lineHeight: 'inherit'
                        }}
                      >
                        ({typeCount})
                      </span>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Subcategories (Status Filters) */}
            {mediaFilter !== 'all' && (() => {
              const currentMediaItems = visualLibraryItems.filter(item => {
                if (mediaFilter === 'series') return item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season';
                if (mediaFilter === 'anime') return item.item_type === 'anime';
                return item.item_type === mediaFilter;
              });

              const subcategories = getSubcategoriesForMedia(mediaFilter, currentMediaItems);
              const visibleSubcategories = subcategories.filter(sub => sub.id === 'all' || sub.count > 0);

              if (visibleSubcategories.length <= 1) return null;

              return (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {visibleSubcategories.map(sub => {
                    const isSelected = shelfStatusFilter === sub.id;
                    const catColor = `var(--color-${mediaFilter})`;
                    const catTextColor = `var(--color-text-${mediaFilter})`;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setShelfStatusFilter(sub.id);
                          setCurrentPage(1);
                        }}
                        className={`profile-subcategory-tab ${isSelected ? 'selected' : ''}`}
                        style={{
                          '--tab-color': catColor,
                          '--tab-text': catTextColor
                        } as React.CSSProperties}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}>
                          {(sub as any).hasTrophy && (
                            <Trophy size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                          )}
                          <span>{sub.label}</span>
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            opacity: isSelected ? 0.85 : 0.6,
                            fontWeight: isSelected ? 600 : 500,
                            lineHeight: 'inherit'
                          }}
                        >
                          ({sub.count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            
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
            <div ref={shelfContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Shelf Header Controls: Mode Toggler (Grid/List) & Expand/Collapse */}
              {(() => {
                const isGrid = shelfViewMode === 'grid';
                // Available width accounting for 45px padding on each side (90px total)
                // Each shelf card is ~180px wide with a 16px (1rem) gap
                const availableWidth = Math.max(0, shelfContainerWidth - 90);
                const maxVisibleInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 196));
                const canExpandMore = isGrid ? (filteredItems.length > maxVisibleInOneRow) : (filteredItems.length > 4);

                const isTwoRows = isGrid && isShelfExpanded;
                const isTwoRowsByColumn = isTwoRows && filteredItems.length > 2 * maxVisibleInOneRow;
                const isTwoRowsByRow = isTwoRows && filteredItems.length <= 2 * maxVisibleInOneRow;

                const getMaskImage = () => {
                  if (canShelfScrollLeft && canShelfScrollRight) {
                    return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
                  } else if (canShelfScrollLeft) {
                    return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black 100%)';
                  } else if (canShelfScrollRight) {
                    return 'linear-gradient(to right, black 0px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
                  }
                  return 'none';
                };

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem' }}>
                      {/* View Mode Toggle Buttons */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <button
                          type="button"
                          onClick={() => handleSetShelfViewMode('grid')}
                          className={`shelf-view-toggle-btn ${shelfViewMode === 'grid' ? 'active' : ''}`}
                          title={language === 'es' ? 'Modo Cuadrícula' : 'Grid View'}
                          aria-label={language === 'es' ? 'Modo Cuadrícula' : 'Grid View'}
                          style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                        >
                          <LayoutGrid size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetShelfViewMode('list')}
                          className={`shelf-view-toggle-btn ${shelfViewMode === 'list' ? 'active' : ''}`}
                          title={language === 'es' ? 'Modo Lista' : 'List View'}
                          aria-label={language === 'es' ? 'Modo Lista' : 'List View'}
                          style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                        >
                          <List size={16} />
                        </button>
                      </div>

                      {/* Expand / Collapse Control - Shown if items exceed compact view limit */}
                      {canExpandMore && (
                        <button
                          type="button"
                          onClick={handleToggleShelfExpanded}
                          className="shelf-view-toggle-btn"
                          title={isShelfExpanded
                            ? (language === 'es' ? 'Contraer' : 'Collapse')
                            : (language === 'es' ? 'Expandir' : 'Expand')
                          }
                          aria-label={isShelfExpanded
                            ? (language === 'es' ? 'Contraer' : 'Collapse')
                            : (language === 'es' ? 'Expandir' : 'Expand')
                          }
                          style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                        >
                          {isShelfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>

                    {/* Items Container */}
                    {(() => {
                const buttonBaseStyle: React.CSSProperties = {
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  background: 'var(--bg-tertiary)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  color: 'var(--text-primary)',
                  transition: 'border-color 0.15s ease, background 0.1s ease, color 0.1s ease, transform 0.1s ease, opacity 0.2s ease, visibility 0.2s ease'
                };

                const handleMouseEnterBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                };
                const handleMouseLeaveBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                };
                const handleMouseDownBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = 'var(--accent-primary)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--bg-primary)';
                };
                const handleMouseUpBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                };

                // Helper to render media badges for Grid / List items
                const renderBadges = (item: LibraryItem) => {
                  const hasEverCompleted = (item.times_completed && item.times_completed > 0) || !!item.completed_at;
                  const badges = [];

                  if (item.status === 'dropped') {
                    badges.push({ text: language === 'es' ? 'Abandonado' : 'Dropped', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' });
                  } else if (item.status === 'endless') {
                    badges.push({ text: language === 'es' ? 'Infinito' : 'Endless', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' });
                  } else if (['plan_to_watch', 'plan_to_play', 'plan_to_read'].includes(item.status) || ((item.item_type === 'series' || item.item_type === 'anime') && !item.last_seen_episode && item.status !== 'completed' && item.status !== 'watching' && (!item.completed_episodes_count || item.completed_episodes_count === 0))) {
                    const planText = item.item_type === 'game'
                      ? (language === 'es' ? 'Por jugar' : 'Plan to play')
                      : ['book', 'comic', 'manga'].includes(item.item_type)
                      ? (language === 'es' ? 'Por leer' : 'Plan to read')
                      : (language === 'es' ? 'Por ver' : 'Plan to watch');
                    badges.push({ text: planText, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' });
                  } else if (item.item_type === 'game') {
                    if (hasEverCompleted) {
                      const hundredRuns = item.times_completed_hundred ?? (item.is_hundred_percent ? (item.times_completed || 1) : 0);
                      const standardRuns = item.times_completed_standard ?? (item.is_hundred_percent ? 0 : (item.times_completed || 1));
                      if (standardRuns > 0) {
                        badges.push({
                          text: standardRuns > 1 
                            ? `${language === 'es' ? 'Completado' : 'Completed'} x${standardRuns}`
                            : (language === 'es' ? 'Completado' : 'Completed'),
                          color: '#10b981',
                          bg: 'rgba(16, 185, 129, 0.15)'
                        });
                      }
                      if (hundredRuns > 0) {
                        badges.push({
                          text: hundredRuns > 1 ? `100% x${hundredRuns}` : '100%',
                          color: '#f59e0b',
                          bg: 'rgba(245, 158, 11, 0.15)',
                          isTrophy: true
                        });
                      }
                    } else if (item.status === 'playing') {
                      badges.push({ text: language === 'es' ? 'Jugando' : 'Playing', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                    }
                  } else if (item.item_type === 'movie') {
                    if (hasEverCompleted) {
                      badges.push({ text: language === 'es' ? 'Visto' : 'Watched', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                    } else if (item.status === 'watching') {
                      badges.push({ text: language === 'es' ? 'Pausada' : 'Paused', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                    }
                  } else if (item.item_type === 'series' || item.item_type === 'anime') {
                    const cacheKey = `series_${item.external_id}`;
                    const cached = item.external_id ? (getCachedSeries(cacheKey) || getCachedSeries(`${item.external_id}_metadata`)) : null;
                    const anyItem = item as any;
                    const sStatus = cached?.status || anyItem.series_status;
                    const isEnded = sStatus === 'Ended' || sStatus === 'Finished' || sStatus === 'Canceled' || anyItem.is_ended === true || cached?.is_ended === true || (item.external_id ? seriesEndedMap[item.external_id] === true : false);

                    if ((hasEverCompleted || item.status === 'completed') && item.status !== 'watching') {
                      if (isEnded) {
                        badges.push({ text: language === 'es' ? 'Terminada' : 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                      } else {
                        badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                      }
                    } else if (item.status === 'watching') {
                      const cacheKeyAll = `${item.external_id}_all_episodes`;
                      const allEps = item.external_id ? (seriesEpisodesMap[item.external_id] || getCachedSeries(cacheKeyAll)) : null;
                      let isUpToDate = false;
                      if (allEps && Array.isArray(allEps) && allEps.length > 0) {
                        const nowMs = Date.now();
                        const canonicalAired = allEps.filter((e: any) => {
                          const isExtra = e.is_extra || e.ep_type === 'insignificant_special' || (e.season_number === 0 && !e.is_significant_special && e.ep_type !== 'significant_special');
                          if (isExtra) return false;
                          if (e.airstamp) return new Date(e.airstamp).getTime() <= nowMs;
                          if (e.airdate || e.air_date) {
                            const ad = e.airdate || e.air_date;
                            const at = e.airtime || '00:00';
                            return new Date(`${ad}T${at}:00Z`).getTime() <= nowMs;
                          }
                          return true;
                        });

                        const completedCount = item.completed_episodes_count ?? item.pages_read ?? 0;
                        if (canonicalAired.length > 0) {
                          if (completedCount >= canonicalAired.length && completedCount > 0) {
                            isUpToDate = true;
                          } else if (item.last_seen_episode) {
                            const lastAired = canonicalAired[canonicalAired.length - 1];
                            if (lastAired) {
                              const lastAiredS = lastAired.season_number ?? 1;
                              const lastAiredE = lastAired.episode_number;
                              const matchLast = item.last_seen_episode.match(/S(\d+)E(\d+)/i);
                              if (matchLast && lastAiredE != null) {
                                const seenS = parseInt(matchLast[1], 10);
                                const seenE = parseInt(matchLast[2], 10);
                                if (seenS > lastAiredS || (seenS === lastAiredS && seenE >= lastAiredE)) {
                                  isUpToDate = true;
                                }
                              }
                            }
                          }
                        }
                      }
                      if (isUpToDate) {
                        badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                      } else {
                        badges.push({ text: language === 'es' ? 'Viendo' : 'Watching', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                      }
                    }
                  } else if (['book', 'comic', 'manga'].includes(item.item_type)) {
                    if (item.item_type === 'comic') {
                      const cleanVolId = String(item.external_id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '');
                      const volMeta = getCachedSeries(`comic_vol_${item.external_id}`) || getCachedSeries(`${item.external_id}_metadata`) || getCachedSeries(`cv_vol_${cleanVolId}_metadata`) || getCachedSeries(`series_${item.external_id}`);
                      const anyItem = item as any;
                      const sStatus = volMeta?.status || anyItem.series_status;
                      const currentYear = new Date().getFullYear();
                      const titleYearMatch = item.title ? String(item.title).match(/\b(19\d\d|20\d\d)\b/) : null;
                      const startYr = parseInt(item.release_date || volMeta?.start_year || volMeta?.first_air_date || (titleYearMatch ? titleYearMatch[1] : '0'));
                      const isEnded = sStatus === 'Ended' || anyItem.is_ended === true || volMeta?.is_ended === true || (startYr > 0 && startYr < currentYear - 1);

                      if ((hasEverCompleted || item.status === 'completed' || item.status === 'read') && item.status !== 'reading') {
                        if (isEnded) {
                          badges.push({ text: language === 'es' ? 'Leído' : 'Read', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                        } else {
                          badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                        }
                      } else if (item.status === 'reading') {
                        const cleanVolId = String(item.external_id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '');
                        const allEps = getCachedSeries(`${cleanVolId}_all_episodes`) || getCachedSeries(`cv_vol_${cleanVolId}_all_episodes`) || getCachedSeries(`${item.external_id}_all_episodes`);
                        let isUpToDate = false;
                        if (allEps && Array.isArray(allEps) && allEps.length > 0) {
                          const nowMs = Date.now();
                          const releasedIssues = allEps.filter((e: any) => {
                            if (e.air_date || e.airdate) {
                              const ad = e.air_date || e.airdate;
                              return new Date(ad).getTime() <= nowMs;
                            }
                            return true;
                          });
                          const completedIssues = item.completed_episodes_count ?? item.pages_read ?? 0;
                          if (releasedIssues.length > 0 && completedIssues >= releasedIssues.length && completedIssues > 0) {
                            isUpToDate = true;
                          }
                        }
                        if (isUpToDate) {
                          badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                        } else {
                          badges.push({ text: language === 'es' ? 'Leyendo' : 'Reading', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                        }
                      }
                    } else {
                      if ((hasEverCompleted || item.status === 'completed' || item.status === 'read') && item.status !== 'reading') {
                        badges.push({ text: language === 'es' ? 'Leído' : 'Read', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                      } else if (item.status === 'reading') {
                        badges.push({ text: language === 'es' ? 'Leyendo' : 'Reading', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                      }
                    }
                  }

                  if (item.item_type !== 'game' && item.times_completed && item.times_completed > 1) {
                    badges.push({
                      text: `x${item.times_completed}`,
                      color: 'var(--accent-primary)',
                      bg: 'rgba(99, 102, 241, 0.15)'
                    });
                  }

                  if (badges.length === 0) return null;

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                      {badges.map((badge, idx) => (
                        <span key={idx} style={{
                          fontSize: '0.72rem',
                          background: badge.bg,
                          color: badge.color,
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          lineHeight: 1.2
                        }}>
                          {badge.isTrophy && <Trophy size={11} />}
                          <span>{badge.text}</span>
                        </span>
                      ))}
                    </div>
                  );
                };

                return (
                  <div style={{ position: 'relative', width: '100%' }}>
                    {/* Grid Mode with Horizontal Smooth Scrolling, Gradient Masks & Click Blocking Zones */}
                    {isGrid ? (
                      <div style={{ position: 'relative' }}>
                        {/* Left fade click-blocking zone */}
                        {canShelfScrollLeft && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: '70px',
                              zIndex: 8,
                              pointerEvents: 'auto',
                              cursor: 'default'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}

                        {/* Left Arrow Button */}
                        <button
                          type="button"
                          onClick={() => shelfContinuousScroll.handleClick('left', isShelfExpanded ? 360 : 300)}
                          onMouseEnter={handleMouseEnterBtn}
                          onMouseLeave={(e) => {
                            handleMouseLeaveBtn(e);
                            shelfContinuousScroll.stopScrolling();
                          }}
                          onMouseDown={(e) => {
                            handleMouseDownBtn(e);
                            shelfContinuousScroll.startScrolling('left');
                          }}
                          onMouseUp={(e) => {
                            handleMouseUpBtn(e);
                            shelfContinuousScroll.stopScrolling();
                          }}
                          onTouchStart={() => shelfContinuousScroll.startScrolling('left')}
                          onTouchEnd={shelfContinuousScroll.stopScrolling}
                          onTouchCancel={shelfContinuousScroll.stopScrolling}
                          style={{
                            ...buttonBaseStyle,
                            left: '0px',
                            opacity: canShelfScrollLeft ? 1 : 0,
                            visibility: canShelfScrollLeft ? 'visible' : 'hidden',
                            pointerEvents: canShelfScrollLeft ? 'auto' : 'none'
                          }}
                          aria-label={language === 'es' ? 'Desplazar a la izquierda' : 'Scroll left'}
                        >
                          <ChevronLeft size={20} color="currentColor" />
                        </button>

                        <div
                          ref={shelfScrollRef}
                          onScroll={updateShelfScrollState}
                          style={{
                            display: isTwoRows ? 'grid' : 'flex',
                            gridTemplateColumns: isTwoRowsByRow ? `repeat(${maxVisibleInOneRow}, max-content)` : undefined,
                            gridTemplateRows: isTwoRows ? 'repeat(2, auto)' : undefined,
                            gridAutoFlow: isTwoRows ? (isTwoRowsByColumn ? 'column' : 'row') : undefined,
                            gridAutoColumns: isTwoRowsByColumn ? 'max-content' : undefined,
                            justifyContent: 'start',
                            alignContent: 'start',
                            gap: '1rem',
                            overflowX: 'auto',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            paddingTop: '8px',
                            paddingBottom: '1rem',
                            paddingLeft: '45px',
                            paddingRight: '45px',
                            WebkitMaskImage: getMaskImage(),
                            maskImage: getMaskImage()
                          }}
                        >
                          {filteredItems.map(item => (
                            <div
                              key={item.id}
                              className="glass-card"
                              style={{
                                minWidth: '185px',
                                maxWidth: '185px',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                flexShrink: 0
                              }}
                            >
                              <div style={{ position: 'relative', cursor: 'pointer', width: '100%', height: '230px', borderRadius: '8px', overflow: 'hidden' }} onClick={() => handleOpenItemDetails(item)}>
                                <MediaPoster
                                  src={item.image_url}
                                  title={item.title}
                                  itemType={item.item_type}
                                  height="100%"
                                  width="100%"
                                  borderRadius="8px"
                                />
                                
                                {/* Tag / Category Badge */}
                                {(() => {
                                  const isGame = item.item_type === 'game';
                                  const rawBadge = (item.custom_badge || '').toLowerCase();
                                  
                                  const getGameBadgeLabel = (b: string) => {
                                    if (b === 'collection' || b === 'pack') return language === 'es' ? 'Colección' : 'Collection';
                                    if (b === 'expansion') return language === 'es' ? 'Expansión' : 'Expansion';
                                    if (b === 'dlc') return 'DLC';
                                    if (b === 'edition') return language === 'es' ? 'Edición' : 'Edition';
                                    if (b === 'remake') return 'Remake';
                                    if (b === 'remaster') return 'Remaster';
                                    return null;
                                  };

                                  const specialGameLabel = isGame ? getGameBadgeLabel(rawBadge) : null;

                                  if (mediaFilter === 'all') {
                                    const normType = (item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type;
                                    const label = isGame 
                                      ? (specialGameLabel || (language === 'es' ? 'Juego' : 'Game'))
                                      : (item.item_type === 'episode' || item.external_id?.startsWith('tvm-ep-'))
                                      ? (language === 'es' ? 'Serie' : 'Show')
                                      : item.item_type === 'season'
                                      ? (language === 'es' ? 'Temporada' : 'Season')
                                      : item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type === 'manga' ? 'Manga' : t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1));

                                    return (
                                      <div
                                        className={getTagClass(normType)}
                                        style={{
                                          position: "absolute",
                                          top: "0.5rem",
                                          left: "0.5rem",
                                          padding: "0.2rem 0.35rem",
                                          borderRadius: "4px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          opacity: 0.95,
                                          backdropFilter: 'blur(4px)',
                                          zIndex: 1
                                        }}
                                        title={label}
                                      >
                                        {getCategoryIcon(normType, { size: 14, color: 'currentColor' })}
                                      </div>
                                    );
                                  }

                                  if (isGame && specialGameLabel) {
                                    return (
                                      <div className="tag-badge tag-game" style={{ position: "absolute", top: "0.5rem", left: "0.5rem", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.9, backdropFilter: 'blur(4px)', zIndex: 1 }}>
                                        {specialGameLabel}
                                      </div>
                                    );
                                  }

                                  return null;
                                })()}
                                
                                {/* Favorite Heart Button (Unified Pink) */}
                                {(() => {
                                  const isEffectiveFav = displayedFavorites.some(df => df.id === item.id);
                                  const isDlcOrExpansion = item.item_type === 'game' && ['dlc', 'expansion'].includes(item.badge || item.custom_badge || '');
                                  const isUnconsumed = !isDlcOrExpansion && ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status);
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFavorite(item.id, isEffectiveFav);
                                      }}
                                      className={`btn-favorite-heart ${isEffectiveFav ? 'is-favorite' : ''}`}
                                      style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        width: '32px',
                                        height: '32px',
                                        cursor: isUnconsumed && !isEffectiveFav ? 'not-allowed' : 'pointer',
                                        opacity: isUnconsumed && !isEffectiveFav ? 0.35 : 1,
                                        color: isEffectiveFav ? 'var(--color-user, #F472B6)' : 'var(--text-secondary)'
                                      }}
                                      title={isUnconsumed && !isEffectiveFav
                                        ? (language === 'es' ? 'Empieza a consumir esta obra para poder destacarla' : 'Start consuming this item to feature it')
                                        : (isEffectiveFav
                                          ? (language === 'es' ? 'Quitar Destacado' : 'Remove Featured')
                                          : (language === 'es' ? 'Destacar' : 'Favorite'))
                                      }
                                    >
                                      <Heart size={16} fill={isEffectiveFav ? 'var(--color-user, #F472B6)' : 'none'} />
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
                                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>{series}</h4>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                                        {epName && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                                      </div>
                                    );
                                  }
                                  
                                  let displayTitle = item.title;
                                  if (isEpOrSeason && item.last_seen_episode && item.title.toLowerCase().startsWith(item.last_seen_episode.toLowerCase() + ' - ')) {
                                    displayTitle = item.title.slice(item.last_seen_episode.length + 3);
                                  }
                                  
                                  return (
                                    <>
                                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
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

                                {/* Unified Badges System */}
                                <div style={{ marginTop: '0.25rem' }}>
                                  {renderBadges(item)}
                                </div>

                                {/* Followed series / comic volume last completed episode or issue */}
                                {(item.item_type === 'series' || item.item_type === 'anime' || item.item_type === 'comic') && item.last_seen_episode && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                                    {(() => {
                                      let formatted = item.last_seen_episode;
                                      if (item.item_type === 'comic') {
                                        const issueMatch = item.last_seen_episode.match(/#(\d+(\.\d+)?)/) || item.last_seen_episode.match(/^(\d+(\.\d+)?)$/);
                                        if (issueMatch) {
                                          formatted = `#${issueMatch[1]}`;
                                        } else if (item.last_seen_episode.startsWith(item.title)) {
                                          formatted = item.last_seen_episode.slice(item.title.length).trim() || item.last_seen_episode;
                                        }
                                      } else {
                                        const matchSpecialSeason = item.last_seen_episode.match(/S(\d+)\s*[•·-]\s*\[?Especial\]?/i);
                                        const matchSpecial = item.last_seen_episode.match(/\[?Especial\]?/i);
                                        const matchExtra = item.last_seen_episode.match(/Extras?\s*(\d+)?/i);
                                        const match = item.last_seen_episode.match(/S(\d+)E(\d+)/i);

                                        if (match) {
                                          const s = String(match[1]).padStart(2, '0');
                                          const e = String(match[2]).padStart(2, '0');
                                          formatted = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                        } else if (matchSpecialSeason) {
                                          const s = String(matchSpecialSeason[1]).padStart(2, '0');
                                          formatted = language === 'es' ? `T${s} • Especial` : `S${s} • Special`;
                                        } else if (matchExtra) {
                                          const epNum = matchExtra[1];
                                          formatted = epNum ? `Extra ${epNum}` : 'Extra';
                                        } else if (matchSpecial) {
                                          formatted = language === 'es' ? 'Especial' : 'Special';
                                        }
                                      }

                                      const seriesRuns = item.times_completed || (item.completed_at ? 1 : 0);
                                      const epRuns = item.last_seen_episode_count || 1;
                                      const showEpBadge = epRuns > 1 && epRuns !== seriesRuns;

                                      return (
                                        <>
                                          <span>{`${language === 'es' ? 'Último: ' : 'Last: '}${formatted}`}</span>
                                          {showEpBadge && (
                                            <span style={{
                                              fontSize: '0.7rem',
                                              fontWeight: 700,
                                              color: 'var(--accent-primary)',
                                              background: 'rgba(99, 102, 241, 0.15)',
                                              padding: '0.05rem 0.35rem',
                                              borderRadius: '4px'
                                            }}>
                                              {`x${epRuns}`}
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </span>
                                )}

                                {/* Movie Duration / Watched Time */}
                                {item.item_type === 'movie' && (item.pages_read || item.total_pages || 0) > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                                    <Clock size={12} />
                                    {(() => {
                                      const mins = item.pages_read || item.total_pages || 0;
                                      const h = Math.floor(mins / 60);
                                      const m = mins % 60;
                                      return h > 0 ? `${h}h ${m > 0 ? `${String(m).padStart(2, '0')}m` : '00m'}` : `${m}m`;
                                    })()}
                                  </span>
                                )}

                                {/* Game Hours Played */}
                                {item.item_type === 'game' && (item.pages_read || 0) > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                                    <Clock size={12} />
                                    {Math.floor((item.pages_read || 0) / 60)}h {String((item.pages_read || 0) % 60).padStart(2, '0')}m
                                  </span>
                                )}

                                {/* Book / Comic / Manga Pages Read */}
                                {['book', 'comic', 'manga'].includes(item.item_type) && (!item.tracking_list_id && !item.last_seen_episode) && ((item.pages_read || 0) > 0 || (item.total_pages || 0) > 0) && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                                    <BookOpen size={12} />
                                    {(() => {
                                      const read = item.pages_read || 0;
                                      const total = item.total_pages || 0;
                                      if (item.status === 'read' || item.status === 'completed') {
                                        const count = total > 0 ? total : read;
                                        return `${count} ${language === 'es' ? (count === 1 ? 'pág.' : 'págs.') : (count === 1 ? 'page' : 'pages')}`;
                                      }
                                      if (read > 0 && total > 0) {
                                        return `${read} / ${total} ${language === 'es' ? 'págs.' : 'pages'}`;
                                      }
                                      const count = read > 0 ? read : total;
                                      return `${count} ${language === 'es' ? (count === 1 ? 'pág.' : 'págs.') : (count === 1 ? 'page' : 'pages')}`;
                                    })()}
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

                        {/* Right Arrow Button */}
                        <button
                          type="button"
                          onClick={() => shelfContinuousScroll.handleClick('right', isShelfExpanded ? 360 : 300)}
                          onMouseEnter={handleMouseEnterBtn}
                          onMouseLeave={(e) => {
                            handleMouseLeaveBtn(e);
                            shelfContinuousScroll.stopScrolling();
                          }}
                          onMouseDown={(e) => {
                            handleMouseDownBtn(e);
                            shelfContinuousScroll.startScrolling('right');
                          }}
                          onMouseUp={(e) => {
                            handleMouseUpBtn(e);
                            shelfContinuousScroll.stopScrolling();
                          }}
                          onTouchStart={() => shelfContinuousScroll.startScrolling('right')}
                          onTouchEnd={shelfContinuousScroll.stopScrolling}
                          onTouchCancel={shelfContinuousScroll.stopScrolling}
                          style={{
                            ...buttonBaseStyle,
                            right: '0px',
                            opacity: canShelfScrollRight ? 1 : 0,
                            visibility: canShelfScrollRight ? 'visible' : 'hidden',
                            pointerEvents: canShelfScrollRight ? 'auto' : 'none'
                          }}
                          aria-label={language === 'es' ? 'Desplazar a la derecha' : 'Scroll right'}
                        >
                          <ChevronRight size={20} color="currentColor" />
                        </button>

                        {/* Right fade click-blocking zone */}
                        {canShelfScrollRight && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '70px',
                              zIndex: 8,
                              pointerEvents: 'auto',
                              cursor: 'default'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    ) : (
                      /* List Mode: Scrollable container without horizontal side arrow buttons */
                      <div
                        ref={shelfListScrollRef}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          height: isShelfExpanded ? '774px' : '398px',
                          maxHeight: isShelfExpanded ? '774px' : '398px',
                          overflowY: 'auto',
                          paddingRight: '0.35rem'
                        }}
                      >
                        {filteredItems.map(item => {
                          const isEffectiveFav = displayedFavorites.some(df => df.id === item.id);
                          const isDlcOrExpansion = item.item_type === 'game' && ['dlc', 'expansion'].includes(item.badge || item.custom_badge || '');
                          const isUnconsumed = !isDlcOrExpansion && ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status);

                          // Prepare title & episode formatted strings
                          const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                          const isEpOrSeason = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
                          let displayTitle = item.title;
                          let episodeSubtext = '';
                          if (isEpOrSeason && match) {
                            displayTitle = match[1].trim();
                            const s = match[2];
                            const e = match[3];
                            const epName = match[4].replace(/^\s*-\s*/, '').trim();
                            const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                            episodeSubtext = epName ? `${formattedSE} - ${epName}` : formattedSE;
                          } else if (isEpOrSeason && item.last_seen_episode && item.title.toLowerCase().startsWith(item.last_seen_episode.toLowerCase() + ' - ')) {
                            displayTitle = item.title.slice(item.last_seen_episode.length + 3);
                          }

                          // Prepare metadata snippet for Line 2
                          let metadataSnippet: React.ReactNode = null;
                          if (item.item_type === 'movie' && (item.pages_read || item.total_pages || 0) > 0) {
                            const mins = item.pages_read || item.total_pages || 0;
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            metadataSnippet = (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={12} />
                                {h > 0 ? `${h}h ${m > 0 ? `${String(m).padStart(2, '0')}m` : '00m'}` : `${m}m`}
                              </span>
                            );
                          } else if (item.item_type === 'game' && (item.pages_read || 0) > 0) {
                            metadataSnippet = (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={12} />
                                {Math.floor((item.pages_read || 0) / 60)}h {String((item.pages_read || 0) % 60).padStart(2, '0')}m
                              </span>
                            );
                          } else if ((item.item_type === 'series' || item.item_type === 'anime' || item.item_type === 'comic') && item.last_seen_episode) {
                            let formatted = item.last_seen_episode;
                            if (item.item_type === 'comic') {
                              const issueMatch = item.last_seen_episode.match(/#(\d+(\.\d+)?)/) || item.last_seen_episode.match(/^(\d+(\.\d+)?)$/);
                              if (issueMatch) formatted = `#${issueMatch[1]}`;
                              else if (item.last_seen_episode.startsWith(item.title)) formatted = item.last_seen_episode.slice(item.title.length).trim() || item.last_seen_episode;
                            } else {
                              const matchSE = item.last_seen_episode.match(/S(\d+)E(\d+)/i);
                              if (matchSE) {
                                const s = String(matchSE[1]).padStart(2, '0');
                                const e = String(matchSE[2]).padStart(2, '0');
                                formatted = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                              }
                            }
                            metadataSnippet = (
                              <span>{`${language === 'es' ? 'Último: ' : 'Last: '}${formatted}`}</span>
                            );
                          } else if (['book', 'comic', 'manga'].includes(item.item_type) && (!item.tracking_list_id && !item.last_seen_episode) && ((item.pages_read || 0) > 0 || (item.total_pages || 0) > 0)) {
                            const read = item.pages_read || 0;
                            const total = item.total_pages || 0;
                            const label = (item.status === 'read' || item.status === 'completed')
                              ? `${total > 0 ? total : read} ${language === 'es' ? 'págs.' : 'pages'}`
                              : (read > 0 && total > 0)
                              ? `${read} / ${total} ${language === 'es' ? 'págs.' : 'pages'}`
                              : `${read > 0 ? read : total} ${language === 'es' ? 'págs.' : 'pages'}`;
                            metadataSnippet = (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <BookOpen size={12} />
                                {label}
                              </span>
                            );
                          }

                          return (
                            <div
                              key={item.id}
                              className="shelf-list-item-row"
                              onClick={() => handleOpenItemDetails(item)}
                            >
                              {/* Left: Poster thumbnail */}
                              <div style={{ width: '44px', height: '62px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                <MediaPoster
                                  src={item.image_url}
                                  title={item.title}
                                  itemType={item.item_type}
                                  height="100%"
                                  width="100%"
                                  borderRadius="6px"
                                />
                              </div>

                              {/* Center: 2 Lines of info */}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
                                {/* Line 1: Title + category badge if 'all' + status badges on right */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                                      {displayTitle}
                                    </span>
                                    {mediaFilter === 'all' && (
                                      <span
                                        className={getTagClass((item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type)}
                                        style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center' }}
                                      >
                                        {getCategoryIcon((item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type, { size: 12, color: 'currentColor' })}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ flexShrink: 0 }}>
                                    {renderBadges(item)}
                                  </div>
                                </div>

                                {/* Line 2: Media metadata on left, date on right */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {episodeSubtext && (
                                      <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                                        {episodeSubtext}
                                      </span>
                                    )}
                                    {metadataSnippet}
                                  </div>
                                  {(item.completed_at || item.updated_at) && (
                                    <span style={{ fontSize: '0.72rem', fontStyle: 'italic', flexShrink: 0 }}>
                                      {formatDate(new Date(item.completed_at || item.updated_at || new Date()))}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Favorite Heart button */}
                              <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleFavorite(item.id, isEffectiveFav)}
                                  className={`btn-favorite-heart ${isEffectiveFav ? 'is-favorite' : ''}`}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    cursor: isUnconsumed && !isEffectiveFav ? 'not-allowed' : 'pointer',
                                    opacity: isUnconsumed && !isEffectiveFav ? 0.35 : 1,
                                    color: isEffectiveFav ? 'var(--color-user, #F472B6)' : 'var(--text-secondary)'
                                  }}
                                  title={isUnconsumed && !isEffectiveFav
                                    ? (language === 'es' ? 'Empieza a consumir esta obra para poder destacarla' : 'Start consuming this item to feature it')
                                    : (isEffectiveFav
                                      ? (language === 'es' ? 'Quitar Destacado' : 'Remove Featured')
                                      : (language === 'es' ? 'Destacar' : 'Favorite'))
                                  }
                                >
                                  <Heart size={16} fill={isEffectiveFav ? 'var(--color-user, #F472B6)' : 'none'} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          );
        })()}
      </div>
    )}
  </div>
)}

      {activeTab === 'guides' && profile && (
        <div ref={guidesContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', textAlign: 'left' }}>
          {(() => {
            // Calculate dynamic columns for guides cards (min-width ~240px + 20px gap)
            const computedColumns = guidesContainerWidth > 0
              ? Math.max(1, Math.floor((guidesContainerWidth + 20) / 260))
              : 4;
            const guideCols = Math.max(1, computedColumns);

            const renderGuideMediaIcon = (mt: string) => {
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

            const arrowBtnStyle: React.CSSProperties = {
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'var(--bg-tertiary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              color: 'var(--text-primary)',
              transition: 'all 0.15s ease'
            };

            // Helper to render a single guide card
            const renderGuideCard = (list: any, isSaved: boolean) => {
              return (
                <div
                  key={list.id}
                  className="glass-card"
                  style={{
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    borderRadius: '12px',
                    position: 'relative'
                  }}
                >
                  {/* Cover Collage */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '140px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenGuide(list.id)}
                  >
                    {list.covers && list.covers.length > 0 ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: list.covers.length >= 2 ? '1fr 1fr' : '1fr',
                        gridTemplateRows: list.covers.length >= 3 ? '1fr 1fr' : '1fr',
                        width: '100%',
                        height: '100%',
                        gap: '2px',
                        background: '#000'
                      }}>
                        {list.covers.slice(0, 4).map((img: string, cIdx: number) => (
                          <img
                            key={cIdx}
                            src={img}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <BookOpen size={36} color="var(--color-guide, #2DD4BF)" />
                      </div>
                    )}

                    {/* Visibility badge overlay (top-left) */}
                    {!isSaved && (
                      <span style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        background: list.visibility === 'draft' ? 'rgba(245, 158, 11, 0.9)' : list.visibility === 'private' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(45, 212, 191, 0.9)',
                        color: list.visibility === 'draft' ? '#0f172a' : '#ffffff',
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)',
                        zIndex: 2
                      }}>
                        {list.visibility === 'draft'
                          ? (language === 'es' ? 'Borrador' : 'Draft')
                          : (list.visibility === 'private'
                              ? (language === 'es' ? 'Privada' : 'Private')
                              : (language === 'es' ? 'Pública' : 'Public')
                            )
                        }
                      </span>
                    )}

                    {/* Items count overlay (bottom-right) */}
                    {(list.items_count != null || (list.items && Array.isArray(list.items))) && (
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
                        color: '#fff',
                        zIndex: 2
                      }}>
                        {list.items_count ?? list.items?.length ?? 0} {t('guidesWorksCount')}
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      title={list.title}
                      onClick={() => handleOpenGuide(list.id)}
                    >
                      {list.title}
                    </h4>

                    {list.description && (
                      <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3
                      }}>
                        {list.description}
                      </p>
                    )}
                  </div>

                  {/* Media Types & Rating Header */}
                  {list.media_types && list.media_types.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {list.media_types.map((mt: string) => renderGuideMediaIcon(mt))}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div style={{
                    display: 'flex',
                    gap: '0.4rem',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '0.5rem',
                    marginTop: 'auto'
                  }}>
                    <button
                      type="button"
                      onClick={() => handleOpenGuide(list.id)}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.3rem 0.6rem', flex: 1, justifyContent: 'center' }}
                    >
                      <Eye size={13} /> {language === 'es' ? 'Ver' : 'View'}
                    </button>
                    {!isSaved && isOwnProfile && (
                      <>
                        <button
                          type="button"
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
                            gap: '0.3rem',
                            fontSize: '0.78rem',
                            padding: '0.3rem 0.6rem',
                            color: list.can_edit === false ? '#f59e0b' : 'inherit',
                            borderColor: list.can_edit === false ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'
                          }}
                          title={language === 'es' ? 'Editar' : 'Edit'}
                        >
                          {list.can_edit === false ? <Lock size={13} /> : <Edit size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuide(list.id)}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          title={language === 'es' ? 'Eliminar' : 'Delete'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            };

            // Available width accounting for 45px padding on each side (90px total)
            // Guide card is minWidth 260px, maxWidth 260px with 1rem gap
            const availableGuidesWidth = Math.max(0, guidesContainerWidth - 90);
            const maxGuidesInOneRow = Math.max(1, Math.floor((availableGuidesWidth + 16) / 276));

            const canExpandCreated = profile.created_lists.length > maxGuidesInOneRow;
            const isCreatedTwoRows = isCreatedGuidesExpanded;
            const isCreatedTwoRowsByColumn = isCreatedTwoRows && profile.created_lists.length > 2 * maxGuidesInOneRow;
            const isCreatedTwoRowsByRow = isCreatedTwoRows && profile.created_lists.length <= 2 * maxGuidesInOneRow;

            // Created Guides pagination
            const totalCreatedCols = isCreatedTwoRows ? Math.ceil(profile.created_lists.length / 2) : profile.created_lists.length;
            const totalCreatedPages = Math.max(1, Math.ceil(totalCreatedCols / maxGuidesInOneRow));
            const currentCreatedPage = Math.min(totalCreatedPages, Math.max(1, createdGuidesPage));

            const canExpandSaved = profile.saved_lists.length > maxGuidesInOneRow;
            const isSavedTwoRows = isSavedGuidesExpanded;
            const isSavedTwoRowsByColumn = isSavedTwoRows && profile.saved_lists.length > 2 * maxGuidesInOneRow;
            const isSavedTwoRowsByRow = isSavedTwoRows && profile.saved_lists.length <= 2 * maxGuidesInOneRow;

            // Saved Guides pagination
            const totalSavedCols = isSavedTwoRows ? Math.ceil(profile.saved_lists.length / 2) : profile.saved_lists.length;
            const totalSavedPages = Math.max(1, Math.ceil(totalSavedCols / maxGuidesInOneRow));
            const currentSavedPage = Math.min(totalSavedPages, Math.max(1, savedGuidesPage));

            const getCreatedMaskImage = () => {
              if (canCreatedGuidesScrollLeft && canCreatedGuidesScrollRight) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              } else if (canCreatedGuidesScrollLeft) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black 100%)';
              } else if (canCreatedGuidesScrollRight) {
                return 'linear-gradient(to right, black 0px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              }
              return 'none';
            };

            const getSavedMaskImage = () => {
              if (canSavedGuidesScrollLeft && canSavedGuidesScrollRight) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              } else if (canSavedGuidesScrollLeft) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black 100%)';
              } else if (canSavedGuidesScrollRight) {
                return 'linear-gradient(to right, black 0px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              }
              return 'none';
            };

            const guideBtnBaseStyle: React.CSSProperties = {
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'var(--bg-tertiary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              color: 'var(--text-primary)',
              transition: 'border-color 0.15s ease, background 0.1s ease, color 0.1s ease, transform 0.1s ease, opacity 0.2s ease, visibility 0.2s ease'
            };

            const handleMouseEnterGuideBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = 'var(--color-guide, #2DD4BF)';
            };
            const handleMouseLeaveGuideBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            };
            const handleMouseDownGuideBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = 'var(--color-guide, #2DD4BF)';
              e.currentTarget.style.borderColor = 'var(--color-guide, #2DD4BF)';
              e.currentTarget.style.color = '#0f172a';
            };
            const handleMouseUpGuideBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--color-guide, #2DD4BF)';
              e.currentTarget.style.color = 'var(--text-primary)';
            };

            return (
              <>
                {/* 1. Created Guides Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h3 style={{ margin: 0 }}>{language === 'es' ? 'Guías Creadas' : 'Created Guides'}</h3>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '12px',
                          background: 'rgba(45, 212, 191, 0.15)',
                          color: 'var(--color-guide, #2DD4BF)',
                          border: '1px solid rgba(45, 212, 191, 0.3)'
                        }}
                      >
                        {profile.created_lists.length}
                      </span>
                    </div>
                    {canExpandCreated && (
                      <button
                        type="button"
                        onClick={handleToggleCreatedGuidesExpanded}
                        className="shelf-view-toggle-btn"
                        title={isCreatedGuidesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        aria-label={isCreatedGuidesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                      >
                        {isCreatedGuidesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>

                  {profile.created_lists.length === 0 ? (
                    <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {language === 'es' ? 'Aún no has creado ninguna guía.' : 'You have not created any guides yet.'}
                    </div>
                  ) : (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {/* Left fade click-blocking zone */}
                      {canCreatedGuidesScrollLeft && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '70px',
                            zIndex: 8,
                            pointerEvents: 'auto',
                            cursor: 'default'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}

                      {/* Left Arrow Button */}
                      <button
                        type="button"
                        onClick={() => createdContinuousScroll.handleClick('left', isCreatedGuidesExpanded ? 480 : 360)}
                        onMouseEnter={handleMouseEnterGuideBtn}
                        onMouseLeave={(e) => {
                          handleMouseLeaveGuideBtn(e);
                          createdContinuousScroll.stopScrolling();
                        }}
                        onMouseDown={(e) => {
                          handleMouseDownGuideBtn(e);
                          createdContinuousScroll.startScrolling('left');
                        }}
                        onMouseUp={(e) => {
                          handleMouseUpGuideBtn(e);
                          createdContinuousScroll.stopScrolling();
                        }}
                        onTouchStart={() => createdContinuousScroll.startScrolling('left')}
                        onTouchEnd={createdContinuousScroll.stopScrolling}
                        onTouchCancel={createdContinuousScroll.stopScrolling}
                        style={{
                          ...guideBtnBaseStyle,
                          left: '0px',
                          opacity: canCreatedGuidesScrollLeft ? 1 : 0,
                          visibility: canCreatedGuidesScrollLeft ? 'visible' : 'hidden',
                          pointerEvents: canCreatedGuidesScrollLeft ? 'auto' : 'none'
                        }}
                        aria-label={language === 'es' ? 'Desplazar a la izquierda' : 'Scroll left'}
                      >
                        <ChevronLeft size={20} color="currentColor" />
                      </button>

                      {/* Cards Scroll Container */}
                      <div
                        ref={createdGuidesScrollRef}
                        onScroll={updateCreatedGuidesScrollState}
                        style={{
                          display: isCreatedTwoRows ? 'grid' : 'flex',
                          gridTemplateColumns: isCreatedTwoRowsByRow ? `repeat(${maxGuidesInOneRow}, max-content)` : undefined,
                          gridTemplateRows: isCreatedTwoRows ? 'repeat(2, auto)' : undefined,
                          gridAutoFlow: isCreatedTwoRows ? (isCreatedTwoRowsByColumn ? 'column' : 'row') : undefined,
                          gridAutoColumns: isCreatedTwoRowsByColumn ? 'max-content' : undefined,
                          justifyContent: 'start',
                          alignContent: 'start',
                          gap: '1rem',
                          overflowX: 'auto',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          paddingTop: '8px',
                          paddingBottom: '1rem',
                          paddingLeft: '45px',
                          paddingRight: '45px',
                          WebkitMaskImage: getCreatedMaskImage(),
                          maskImage: getCreatedMaskImage()
                        }}
                      >
                        {profile.created_lists.map(list => (
                          <div key={list.id} style={{ minWidth: '260px', maxWidth: '260px', flexShrink: 0 }}>
                            {renderGuideCard(list, false)}
                          </div>
                        ))}
                      </div>

                      {/* Right Arrow Button */}
                      <button
                        type="button"
                        onClick={() => createdContinuousScroll.handleClick('right', isCreatedGuidesExpanded ? 480 : 360)}
                        onMouseEnter={handleMouseEnterGuideBtn}
                        onMouseLeave={(e) => {
                          handleMouseLeaveGuideBtn(e);
                          createdContinuousScroll.stopScrolling();
                        }}
                        onMouseDown={(e) => {
                          handleMouseDownGuideBtn(e);
                          createdContinuousScroll.startScrolling('right');
                        }}
                        onMouseUp={(e) => {
                          handleMouseUpGuideBtn(e);
                          createdContinuousScroll.stopScrolling();
                        }}
                        onTouchStart={() => createdContinuousScroll.startScrolling('right')}
                        onTouchEnd={createdContinuousScroll.stopScrolling}
                        onTouchCancel={createdContinuousScroll.stopScrolling}
                        style={{
                          ...guideBtnBaseStyle,
                          right: '0px',
                          opacity: canCreatedGuidesScrollRight ? 1 : 0,
                          visibility: canCreatedGuidesScrollRight ? 'visible' : 'hidden',
                          pointerEvents: canCreatedGuidesScrollRight ? 'auto' : 'none'
                        }}
                        aria-label={language === 'es' ? 'Desplazar a la derecha' : 'Scroll right'}
                      >
                        <ChevronRight size={20} color="currentColor" />
                      </button>

                      {/* Right fade click-blocking zone */}
                      {canCreatedGuidesScrollRight && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '70px',
                            zIndex: 8,
                            pointerEvents: 'auto',
                            cursor: 'default'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}

                      {/* Created Guides Page indicator */}
                      {totalCreatedPages > 1 && (
                        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {language === 'es' ? `Página ${currentCreatedPage} de ${totalCreatedPages}` : `Page ${currentCreatedPage} of ${totalCreatedPages}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Saved Guides Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h3 style={{ margin: 0 }}>{language === 'es' ? 'Guías Guardadas' : 'Saved Guides'}</h3>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '12px',
                          background: 'rgba(45, 212, 191, 0.15)',
                          color: 'var(--color-guide, #2DD4BF)',
                          border: '1px solid rgba(45, 212, 191, 0.3)'
                        }}
                      >
                        {profile.saved_lists.length}
                      </span>
                    </div>
                    {canExpandSaved && (
                      <button
                        type="button"
                        onClick={handleToggleSavedGuidesExpanded}
                        className="shelf-view-toggle-btn"
                        title={isSavedGuidesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        aria-label={isSavedGuidesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                      >
                        {isSavedGuidesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>

                  {profile.saved_lists.length === 0 ? (
                    <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {language === 'es' ? 'Aún no tienes guías guardadas.' : 'You have no saved guides yet.'}
                    </div>
                  ) : (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {/* Left fade click-blocking zone */}
                      {canSavedGuidesScrollLeft && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '70px',
                            zIndex: 8,
                            pointerEvents: 'auto',
                            cursor: 'default'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}

                      {/* Left Arrow Button */}
                      <button
                        type="button"
                        onClick={() => savedContinuousScroll.handleClick('left', isSavedGuidesExpanded ? 480 : 360)}
                        onMouseEnter={handleMouseEnterGuideBtn}
                        onMouseLeave={(e) => {
                          handleMouseLeaveGuideBtn(e);
                          savedContinuousScroll.stopScrolling();
                        }}
                        onMouseDown={(e) => {
                          handleMouseDownGuideBtn(e);
                          savedContinuousScroll.startScrolling('left');
                        }}
                        onMouseUp={(e) => {
                          handleMouseUpGuideBtn(e);
                          savedContinuousScroll.stopScrolling();
                        }}
                        onTouchStart={() => savedContinuousScroll.startScrolling('left')}
                        onTouchEnd={savedContinuousScroll.stopScrolling}
                        onTouchCancel={savedContinuousScroll.stopScrolling}
                        style={{
                          ...guideBtnBaseStyle,
                          left: '0px',
                          opacity: canSavedGuidesScrollLeft ? 1 : 0,
                          visibility: canSavedGuidesScrollLeft ? 'visible' : 'hidden',
                          pointerEvents: canSavedGuidesScrollLeft ? 'auto' : 'none'
                        }}
                        aria-label={language === 'es' ? 'Desplazar a la izquierda' : 'Scroll left'}
                      >
                        <ChevronLeft size={20} color="currentColor" />
                      </button>

                      {/* Cards Scroll Container */}
                      <div
                        ref={savedGuidesScrollRef}
                        onScroll={updateSavedGuidesScrollState}
                        style={{
                          display: isSavedTwoRows ? 'grid' : 'flex',
                          gridTemplateColumns: isSavedTwoRowsByRow ? `repeat(${maxGuidesInOneRow}, max-content)` : undefined,
                          gridTemplateRows: isSavedTwoRows ? 'repeat(2, auto)' : undefined,
                          gridAutoFlow: isSavedTwoRows ? (isSavedTwoRowsByColumn ? 'column' : 'row') : undefined,
                          gridAutoColumns: isSavedTwoRowsByColumn ? 'max-content' : undefined,
                          justifyContent: 'start',
                          alignContent: 'start',
                          gap: '1rem',
                          overflowX: 'auto',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          paddingTop: '8px',
                          paddingBottom: '1rem',
                          paddingLeft: '45px',
                          paddingRight: '45px',
                          WebkitMaskImage: getSavedMaskImage(),
                          maskImage: getSavedMaskImage()
                        }}
                      >
                        {profile.saved_lists.map(list => (
                          <div key={list.id} style={{ minWidth: '260px', maxWidth: '260px', flexShrink: 0 }}>
                            {renderGuideCard(list, true)}
                          </div>
                        ))}
                      </div>

                      {/* Right Arrow Button */}
                      <button
                        type="button"
                        onClick={() => savedContinuousScroll.handleClick('right', isSavedGuidesExpanded ? 480 : 360)}
                        onMouseEnter={handleMouseEnterGuideBtn}
                        onMouseLeave={(e) => {
                          handleMouseLeaveGuideBtn(e);
                          savedContinuousScroll.stopScrolling();
                        }}
                        onMouseDown={(e) => {
                          handleMouseDownGuideBtn(e);
                          savedContinuousScroll.startScrolling('right');
                        }}
                        onMouseUp={(e) => {
                          handleMouseUpGuideBtn(e);
                          savedContinuousScroll.stopScrolling();
                        }}
                        onTouchStart={() => savedContinuousScroll.startScrolling('right')}
                        onTouchEnd={savedContinuousScroll.stopScrolling}
                        onTouchCancel={savedContinuousScroll.stopScrolling}
                        style={{
                          ...guideBtnBaseStyle,
                          right: '0px',
                          opacity: canSavedGuidesScrollRight ? 1 : 0,
                          visibility: canSavedGuidesScrollRight ? 'visible' : 'hidden',
                          pointerEvents: canSavedGuidesScrollRight ? 'auto' : 'none'
                        }}
                        aria-label={language === 'es' ? 'Desplazar a la derecha' : 'Scroll right'}
                      >
                        <ChevronRight size={20} color="currentColor" />
                      </button>

                      {/* Right fade click-blocking zone */}
                      {canSavedGuidesScrollRight && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '70px',
                            zIndex: 8,
                            pointerEvents: 'auto',
                            cursor: 'default'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}

                      {/* Saved Guides Page indicator */}
                      {totalSavedPages > 1 && (
                        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {language === 'es' ? `Página ${currentSavedPage} de ${totalSavedPages}` : `Page ${currentSavedPage} of ${totalSavedPages}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {activeTab === 'favorites' && (
        <div ref={favoritesContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          {/* Favorites Category Filter Selectors - Top row */}
          {displayedFavorites.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(() => {
                const orderedMedia = getOrderedCategories(profile?.category_order || currentUser?.category_order);
                const baseTypes = ['all', ...orderedMedia] as const;
                const allowedTypes = baseTypes.filter(type => {
                  if (type === 'all') return true;
                  if (type === 'series') return displayedFavorites.some(item => item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-'));
                  if (type === 'anime') return displayedFavorites.some(item => item.item_type === 'anime');
                  return displayedFavorites.some(item => item.item_type === type);
                });
                return allowedTypes.map(type => {
                  const typeColor = type === 'all' ? 'var(--color-user, #F472B6)' : `var(--color-${type})`;
                  const typeTextColor = type === 'all' ? '#ffffff' : `var(--color-text-${type})`;
                  const isSelected = favoritesMediaFilter === type;

                  return (
                    <button
                      key={type}
                      onClick={() => setFavoritesMediaFilter(type as any)}
                      className={`profile-category-tab ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        textTransform: 'capitalize',
                        '--tab-color': typeColor,
                        '--tab-text': typeTextColor
                      } as React.CSSProperties}
                    >
                      {getCategoryIcon(type, { size: 14, color: isSelected ? typeTextColor : typeColor })}
                      <span>
                        {type === 'all' ? (language === 'es' ? 'Todo' : 'All') :
                         type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
                         type === 'series' ? (language === 'es' ? 'Series' : 'Shows') :
                         type === 'anime' ? 'Anime' :
                         type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
                         type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') :
                         type === 'manga' ? 'Mangas' :
                         type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          )}

          {(() => {
            const filteredFavorites = displayedFavorites.filter(item => {
              if (favoritesMediaFilter === 'all') return true;
              if (favoritesMediaFilter === 'series') {
                return item.item_type === 'series' || item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
              }
              if (favoritesMediaFilter === 'anime') {
                return item.item_type === 'anime';
              }
              return item.item_type === favoritesMediaFilter;
            });

            if (displayedFavorites.length === 0) {
              return (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {language === 'es' ? 'Marca obras en tu estantería como favoritas (con el ícono de corazón) para destacarlas aquí.' : 'Mark items on your shelf as favorites (with the heart icon) to highlight them here.'}
                </div>
              );
            }

            if (filteredFavorites.length === 0) {
              return (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {language === 'es' ? 'No hay elementos destacados en esta categoría.' : 'No featured items in this category.'}
                </div>
              );
            }

            const isGrid = favoritesViewMode === 'grid';
            const availableWidth = Math.max(0, (favoritesContainerWidth || shelfContainerWidth) - 90);
            const maxVisibleInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 201));
            const canExpandMore = isGrid ? (filteredFavorites.length > maxVisibleInOneRow) : (filteredFavorites.length > 4);

            const isTwoRows = isGrid && isFavoritesExpanded;
            const isTwoRowsByColumn = isTwoRows && filteredFavorites.length > 2 * maxVisibleInOneRow;
            const isTwoRowsByRow = isTwoRows && filteredFavorites.length <= 2 * maxVisibleInOneRow;

            // Favorites pagination
            const totalFavoritesCols = isTwoRows ? Math.ceil(filteredFavorites.length / 2) : filteredFavorites.length;
            const totalFavoritesPages = Math.max(1, Math.ceil(totalFavoritesCols / maxVisibleInOneRow));
            const currentFavoritesPage = Math.min(totalFavoritesPages, Math.max(1, favoritesPage));

            const getFavoritesMaskImage = () => {
              if (canFavoritesScrollLeft && canFavoritesScrollRight) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              } else if (canFavoritesScrollLeft) {
                return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black 100%)';
              } else if (canFavoritesScrollRight) {
                return 'linear-gradient(to right, black 0px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
              }
              return 'none';
            };

            const favBtnBaseStyle: React.CSSProperties = {
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'var(--bg-tertiary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              color: 'var(--text-primary)',
              transition: 'border-color 0.15s ease, background 0.1s ease, color 0.1s ease, transform 0.1s ease, opacity 0.2s ease, visibility 0.2s ease'
            };

            const handleMouseEnterFavBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = 'var(--color-user, #F472B6)';
            };
            const handleMouseLeaveFavBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            };
            const handleMouseDownFavBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = 'var(--color-user, #F472B6)';
              e.currentTarget.style.borderColor = 'var(--color-user, #F472B6)';
              e.currentTarget.style.color = '#fff';
            };
            const handleMouseUpFavBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--color-user, #F472B6)';
              e.currentTarget.style.color = 'var(--text-primary)';
            };

            const renderFavoriteBadges = (item: LibraryItem) => {
              const hasEverCompleted = (item.times_completed && item.times_completed > 0) || !!item.completed_at;
              const badges = [];

              if (item.status === 'dropped') {
                badges.push({ text: language === 'es' ? 'Abandonado' : 'Dropped', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' });
              } else if (item.status === 'endless') {
                badges.push({ text: language === 'es' ? 'Infinito' : 'Endless', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' });
              } else if (item.item_type === 'game') {
                if (hasEverCompleted) {
                  const hundredRuns = item.times_completed_hundred ?? (item.is_hundred_percent ? (item.times_completed || 1) : 0);
                  const standardRuns = item.times_completed_standard ?? (item.is_hundred_percent ? 0 : (item.times_completed || 1));
                  if (standardRuns > 0) {
                    badges.push({
                      text: standardRuns > 1 
                        ? `${language === 'es' ? 'Completado' : 'Completed'} x${standardRuns}`
                        : (language === 'es' ? 'Completado' : 'Completed'),
                      color: '#10b981',
                      bg: 'rgba(16, 185, 129, 0.15)'
                    });
                  }
                  if (hundredRuns > 0) {
                    badges.push({
                      text: hundredRuns > 1 ? `100% x${hundredRuns}` : '100%',
                      color: '#f59e0b',
                      bg: 'rgba(245, 158, 11, 0.15)',
                      isTrophy: true
                    });
                  }
                } else if (item.status === 'playing') {
                  badges.push({ text: language === 'es' ? 'Jugando' : 'Playing', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                }
              } else if (item.item_type === 'movie') {
                if (hasEverCompleted) {
                  badges.push({ text: language === 'es' ? 'Visto' : 'Watched', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                } else if (item.status === 'watching') {
                  badges.push({ text: language === 'es' ? 'Pausada' : 'Paused', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                }
              } else if (item.item_type === 'series' || item.item_type === 'anime') {
                const cacheKey = `series_${item.external_id}`;
                const cached = item.external_id ? (getCachedSeries(cacheKey) || getCachedSeries(`${item.external_id}_metadata`)) : null;
                const anyItem = item as any;
                const sStatus = cached?.status || anyItem.series_status;
                const isEnded = sStatus === 'Ended' || sStatus === 'Finished' || sStatus === 'Canceled' || anyItem.is_ended === true || cached?.is_ended === true || (item.external_id ? seriesEndedMap[item.external_id] === true : false);

                if ((hasEverCompleted || item.status === 'completed') && item.status !== 'watching') {
                  if (isEnded) {
                    badges.push({ text: language === 'es' ? 'Terminada' : 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                  } else {
                    badges.push({ text: language === 'es' ? 'Al día' : 'Up to date', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                  }
                } else if (item.status === 'watching') {
                  badges.push({ text: language === 'es' ? 'Viendo' : 'Watching', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                }
              } else if (['book', 'comic', 'manga'].includes(item.item_type)) {
                if ((hasEverCompleted || item.status === 'completed' || item.status === 'read') && item.status !== 'reading') {
                  badges.push({ text: language === 'es' ? 'Leído' : 'Read', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' });
                } else if (item.status === 'reading') {
                  badges.push({ text: language === 'es' ? 'Leyendo' : 'Reading', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' });
                }
              }

              if (item.item_type !== 'game' && item.times_completed && item.times_completed > 1) {
                badges.push({
                  text: `x${item.times_completed}`,
                  color: 'var(--accent-primary)',
                  bg: 'rgba(99, 102, 241, 0.15)'
                });
              }

              if (badges.length === 0) return null;

              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                  {badges.map((badge, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.72rem',
                      background: badge.bg,
                      color: badge.color,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      lineHeight: 1.2
                    }}>
                      {badge.isTrophy && <Trophy size={11} />}
                      <span>{badge.text}</span>
                    </span>
                  ))}
                </div>
              );
            };

            return (
              <>
                {/* Controls row: Counter + Reorder Tooltip on left, View/Expand buttons on right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      background: 'rgba(244, 114, 182, 0.15)',
                      color: 'var(--color-user, #F472B6)',
                      border: '1px solid rgba(244, 114, 182, 0.3)'
                    }}>
                      {displayedFavorites.length} / {profile?.is_pro ? '70' : '7'} {language === 'es' ? 'destacados' : 'featured'}
                    </span>

                    {isOwnProfile && favoritesMediaFilter === 'all' && displayedFavorites.length > 1 && (
                      <div 
                        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={() => setShowReorderTooltip(true)}
                        onMouseLeave={() => setShowReorderTooltip(false)}
                        onFocus={() => setShowReorderTooltip(true)}
                        onBlur={() => setShowReorderTooltip(false)}
                      >
                        <div
                          tabIndex={0}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            color: showReorderTooltip ? 'var(--color-user, #F472B6)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            outline: 'none',
                            background: showReorderTooltip ? 'rgba(244, 114, 182, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            border: showReorderTooltip ? '1px solid rgba(244, 114, 182, 0.4)' : '1px solid var(--border-color)'
                          }}
                        >
                          <HelpCircle size={14} />
                        </div>

                        {showReorderTooltip && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 10px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: 'rgba(15, 18, 28, 0.94)',
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: 'var(--text-primary)',
                              padding: '0.45rem 0.8rem',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4)',
                              zIndex: 40
                            }}
                          >
                            {/* Upward pointer arrow */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-5px',
                                left: '50%',
                                transform: 'translateX(-50%) rotate(45deg)',
                                width: '8px',
                                height: '8px',
                                background: 'rgba(15, 18, 28, 0.94)',
                                borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                                borderTop: '1px solid rgba(255, 255, 255, 0.12)'
                              }}
                            />
                            {language === 'es' ? 'Arrastrá una obra para reordenar tus destacados' : 'Drag an item to reorder your featured favorites'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle Buttons & Expand */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => handleSetFavoritesViewMode('grid')}
                        className={`shelf-view-toggle-btn ${favoritesViewMode === 'grid' ? 'active' : ''}`}
                        title={language === 'es' ? 'Modo Cuadrícula' : 'Grid View'}
                        aria-label={language === 'es' ? 'Modo Cuadrícula' : 'Grid View'}
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFavoritesViewMode('list')}
                        className={`shelf-view-toggle-btn ${favoritesViewMode === 'list' ? 'active' : ''}`}
                        title={language === 'es' ? 'Modo Lista' : 'List View'}
                        aria-label={language === 'es' ? 'Modo Lista' : 'List View'}
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                      >
                        <List size={16} />
                      </button>
                    </div>

                    {/* Expand / Collapse Control */}
                    {canExpandMore && (
                      <button
                        type="button"
                        onClick={handleToggleFavoritesExpanded}
                        className="shelf-view-toggle-btn"
                        title={isFavoritesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        aria-label={isFavoritesExpanded
                          ? (language === 'es' ? 'Contraer' : 'Collapse')
                          : (language === 'es' ? 'Expandir' : 'Expand')
                        }
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '6px' }}
                      >
                        {isFavoritesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {isGrid ? (
                  <div style={{ position: 'relative', width: '100%' }}>
                    {/* Left fade click-blocking zone */}
                    {canFavoritesScrollLeft && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '70px',
                          zIndex: 8,
                          pointerEvents: 'auto',
                          cursor: 'default'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    {/* Left Arrow Button */}
                    <button
                      type="button"
                      onClick={() => favoritesContinuousScroll.handleClick('left', isFavoritesExpanded ? 360 : 300)}
                      onMouseEnter={handleMouseEnterFavBtn}
                      onMouseLeave={(e) => {
                        handleMouseLeaveFavBtn(e);
                        favoritesContinuousScroll.stopScrolling();
                      }}
                      onMouseDown={(e) => {
                        handleMouseDownFavBtn(e);
                        favoritesContinuousScroll.startScrolling('left');
                      }}
                      onMouseUp={(e) => {
                        handleMouseUpFavBtn(e);
                        favoritesContinuousScroll.stopScrolling();
                      }}
                      onTouchStart={() => favoritesContinuousScroll.startScrolling('left')}
                      onTouchEnd={favoritesContinuousScroll.stopScrolling}
                      onTouchCancel={favoritesContinuousScroll.stopScrolling}
                      style={{
                        ...favBtnBaseStyle,
                        left: '0px',
                        opacity: canFavoritesScrollLeft ? 1 : 0,
                        visibility: canFavoritesScrollLeft ? 'visible' : 'hidden',
                        pointerEvents: canFavoritesScrollLeft ? 'auto' : 'none'
                      }}
                      aria-label={language === 'es' ? 'Desplazar a la izquierda' : 'Scroll left'}
                    >
                      <ChevronLeft size={20} color="currentColor" />
                    </button>

                    {/* Cards Scroll Container */}
                    <div
                      ref={favoritesScrollRef}
                      onScroll={updateFavoritesScrollState}
                      style={{
                        display: isTwoRows ? 'grid' : 'flex',
                        gridTemplateColumns: isTwoRowsByRow ? `repeat(${maxVisibleInOneRow}, max-content)` : undefined,
                        gridTemplateRows: isTwoRows ? 'repeat(2, auto)' : undefined,
                        gridAutoFlow: isTwoRows ? (isTwoRowsByColumn ? 'column' : 'row') : undefined,
                        gridAutoColumns: isTwoRowsByColumn ? 'max-content' : undefined,
                        justifyContent: 'start',
                        alignContent: 'start',
                        gap: '1rem',
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        paddingTop: '8px',
                        paddingBottom: '1rem',
                        paddingLeft: '45px',
                        paddingRight: '45px',
                        WebkitMaskImage: getFavoritesMaskImage(),
                        maskImage: getFavoritesMaskImage()
                      }}
                    >
                      {filteredFavorites.map((item, idx) => {
                        const canReorderFavorites = isOwnProfile && favoritesMediaFilter === 'all';
                        const isBeingDragged = favPointerDrag?.isDragging && favPointerDrag.item.id === item.id;
                        const isDropTargetBefore = favPointerDrag?.isDragging && favDragOverIndex === idx && favPointerDrag.sourceIndex !== idx && favPointerDrag.sourceIndex !== idx - 1;
                        const isDropTargetAfterLast = favPointerDrag?.isDragging && idx === filteredFavorites.length - 1 && favDragOverIndex === filteredFavorites.length && favPointerDrag.sourceIndex !== filteredFavorites.length - 1;

                        const dropPlaceholder = (
                          <div
                            key={`fav-drop-placeholder-${idx}`}
                            style={{
                              minWidth: '185px',
                              maxWidth: '185px',
                              height: '320px',
                              borderRadius: '12px',
                              border: '2px dashed var(--color-user, #F472B6)',
                              background: 'rgba(244, 114, 182, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              color: 'var(--color-user, #F472B6)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              flexShrink: 0,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 0 16px rgba(244, 114, 182, 0.2)'
                            }}
                          >
                            <ArrowDownToLine size={24} className="animate-bounce" />
                            <span>{language === 'es' ? 'Soltar aquí' : 'Drop here'}</span>
                          </div>
                        );

                        return (
                          <React.Fragment key={item.id}>
                            {isDropTargetBefore && dropPlaceholder}
                            <div
                              data-fav-card-idx={idx}
                              data-fav-card-id={item.id}
                              className="glass-card"
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              onPointerDown={(e) => {
                                if (e.button !== 0 || !canReorderFavorites) return;
                                const target = e.target as HTMLElement;
                                if (target.closest('button') || target.closest('a')) return;
                                setFavPointerDrag({
                                  item,
                                  sourceIndex: idx,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  currentX: e.clientX,
                                  currentY: e.clientY,
                                  isDragging: false
                                });
                              }}
                              style={{
                                minWidth: '185px',
                                maxWidth: '185px',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                flexShrink: 0,
                                opacity: isBeingDragged ? 0.35 : 1,
                                cursor: canReorderFavorites ? (favPointerDrag?.isDragging ? 'grabbing' : 'grab') : undefined,
                                userSelect: 'none',
                                WebkitUserDrag: 'none',
                                touchAction: canReorderFavorites ? 'none' : 'auto',
                                transition: 'opacity 0.2s ease, transform 0.2s ease'
                              } as React.CSSProperties}
                            >
                              <div
                                draggable={false}
                                onDragStart={(e) => e.preventDefault()}
                                style={{
                                  position: 'relative',
                                  cursor: canReorderFavorites ? (favPointerDrag?.isDragging ? 'grabbing' : 'grab') : 'pointer',
                                  width: '100%',
                                  height: '230px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  userSelect: 'none',
                                  WebkitUserDrag: 'none'
                                } as React.CSSProperties}
                                onClick={() => {
                                  if (favJustDraggedRef.current || favPointerDragRef.current?.isDragging) return;
                                  handleOpenItemDetails(item);
                                }}
                              >
                                <MediaPoster
                                  src={item.image_url}
                                  title={item.title}
                                  itemType={item.item_type}
                                  height="100%"
                                  width="100%"
                                  borderRadius="8px"
                                />

                                {/* Tag / Category Badge */}
                                {(() => {
                                  const isGame = item.item_type === 'game';
                                  const rawBadge = (item.custom_badge || '').toLowerCase();
                                  const getGameBadgeLabel = (b: string) => {
                                    if (b === 'collection' || b === 'pack') return language === 'es' ? 'Colección' : 'Collection';
                                    if (b === 'expansion') return language === 'es' ? 'Expansión' : 'Expansion';
                                    if (b === 'dlc') return 'DLC';
                                    if (b === 'edition') return language === 'es' ? 'Edición' : 'Edition';
                                    if (b === 'remake') return 'Remake';
                                    if (b === 'remaster') return 'Remaster';
                                    return null;
                                  };
                                  const specialGameLabel = isGame ? getGameBadgeLabel(rawBadge) : null;
                                  if (favoritesMediaFilter === 'all') {
                                    const normType = (item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type;
                                    const label = isGame
                                      ? (specialGameLabel || (language === 'es' ? 'Juego' : 'Game'))
                                      : (item.item_type === 'episode' || item.external_id?.startsWith('tvm-ep-'))
                                      ? (language === 'es' ? 'Serie' : 'Show')
                                      : item.item_type === 'season'
                                      ? (language === 'es' ? 'Temporada' : 'Season')
                                      : item.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : item.item_type === 'manga' ? 'Manga' : t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1));
                                    return (
                                      <div
                                        className={getTagClass(normType)}
                                        style={{
                                          position: "absolute",
                                          top: "0.5rem",
                                          left: "0.5rem",
                                          padding: "0.2rem 0.35rem",
                                          borderRadius: "4px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          opacity: 0.95,
                                          backdropFilter: 'blur(4px)',
                                          zIndex: 1
                                        }}
                                        title={label}
                                      >
                                        {getCategoryIcon(normType, { size: 14, color: 'currentColor' })}
                                      </div>
                                    );
                                  }
                                  if (isGame && specialGameLabel) {
                                    return (
                                      <div className="tag-badge tag-game" style={{ position: "absolute", top: "0.5rem", left: "0.5rem", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.9, backdropFilter: 'blur(4px)', zIndex: 1 }}>
                                        {specialGameLabel}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Favorite Heart Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item.id, true);
                                  }}
                                  className="btn-favorite-heart is-favorite"
                                  style={{
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer',
                                    color: 'var(--color-user, #F472B6)'
                                  }}
                                  title={language === 'es' ? 'Quitar Destacado' : 'Remove Featured'}
                                >
                                  <Heart size={16} fill="var(--color-user, #F472B6)" />
                                </button>
                              </div>

                              <div
                                style={{ flex: 1, textAlign: 'left', cursor: canReorderFavorites ? (favPointerDrag?.isDragging ? 'grabbing' : 'grab') : 'pointer' }}
                                onClick={() => {
                                  if (favJustDraggedRef.current || favPointerDragRef.current?.isDragging) return;
                                  handleOpenItemDetails(item);
                                }}
                              >
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
                                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>{series}</h4>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                                        {epName && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                                      </div>
                                    );
                                  }
                                  let displayTitle = item.title;
                                  if (isEpOrSeason && item.last_seen_episode && item.title.toLowerCase().startsWith(item.last_seen_episode.toLowerCase() + ' - ')) {
                                    displayTitle = item.title.slice(item.last_seen_episode.length + 3);
                                  }
                                  return (
                                    <>
                                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
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

                                {/* Unified Badges System */}
                                <div style={{ marginTop: '0.25rem' }}>
                                  {renderFavoriteBadges(item)}
                                </div>

                                {/* Formatted Date */}
                                {(item.completed_at || item.updated_at) && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block', marginTop: '0.3rem' }}>
                                    {formatDate(new Date(item.completed_at || item.updated_at || new Date()))}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isDropTargetAfterLast && dropPlaceholder}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Right Arrow Button */}
                    <button
                      type="button"
                      onClick={() => favoritesContinuousScroll.handleClick('right', isFavoritesExpanded ? 360 : 300)}
                      onMouseEnter={handleMouseEnterFavBtn}
                      onMouseLeave={(e) => {
                        handleMouseLeaveFavBtn(e);
                        favoritesContinuousScroll.stopScrolling();
                      }}
                      onMouseDown={(e) => {
                        handleMouseDownFavBtn(e);
                        favoritesContinuousScroll.startScrolling('right');
                      }}
                      onMouseUp={(e) => {
                        handleMouseUpFavBtn(e);
                        favoritesContinuousScroll.stopScrolling();
                      }}
                      onTouchStart={() => favoritesContinuousScroll.startScrolling('right')}
                      onTouchEnd={favoritesContinuousScroll.stopScrolling}
                      onTouchCancel={favoritesContinuousScroll.stopScrolling}
                      style={{
                        ...favBtnBaseStyle,
                        right: '0px',
                        opacity: canFavoritesScrollRight ? 1 : 0,
                        visibility: canFavoritesScrollRight ? 'visible' : 'hidden',
                        pointerEvents: canFavoritesScrollRight ? 'auto' : 'none'
                      }}
                      aria-label={language === 'es' ? 'Desplazar a la derecha' : 'Scroll right'}
                    >
                      <ChevronRight size={20} color="currentColor" />
                    </button>

                    {/* Right fade click-blocking zone */}
                    {canFavoritesScrollRight && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '70px',
                          zIndex: 8,
                          pointerEvents: 'auto',
                          cursor: 'default'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                ) : (
                  /* List Mode */
                  <div
                    ref={favoritesListScrollRef}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      height: isFavoritesExpanded ? '774px' : '398px',
                      maxHeight: isFavoritesExpanded ? '774px' : '398px',
                      overflowY: 'auto',
                      paddingRight: '0.35rem'
                    }}
                  >
                    {filteredFavorites.map((item, idx) => {
                      const canReorderFavorites = isOwnProfile && favoritesMediaFilter === 'all';
                      const isBeingDragged = favPointerDrag?.isDragging && favPointerDrag.item.id === item.id;
                      const isDropTargetBefore = favPointerDrag?.isDragging && favDragOverIndex === idx && favPointerDrag.sourceIndex !== idx && favPointerDrag.sourceIndex !== idx - 1;
                      const isDropTargetAfterLast = favPointerDrag?.isDragging && idx === filteredFavorites.length - 1 && favDragOverIndex === filteredFavorites.length && favPointerDrag.sourceIndex !== filteredFavorites.length - 1;

                      const dropListPlaceholder = (
                        <div
                          key={`fav-drop-list-placeholder-${idx}`}
                          style={{
                            height: '62px',
                            borderRadius: '8px',
                            border: '2px dashed var(--color-user, #F472B6)',
                            background: 'rgba(244, 114, 182, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: 'var(--color-user, #F472B6)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 0 16px rgba(244, 114, 182, 0.2)'
                          }}
                        >
                          <ArrowDownToLine size={20} className="animate-bounce" />
                          <span>{language === 'es' ? 'Soltar aquí' : 'Drop here'}</span>
                        </div>
                      );

                      const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                      const isEpOrSeason = item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-');
                      let displayTitle = item.title;
                      let episodeSubtext = '';
                      if (isEpOrSeason && match) {
                        displayTitle = match[1].trim();
                        const s = match[2];
                        const e = match[3];
                        const epName = match[4].replace(/^\s*-\s*/, '').trim();
                        const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                        episodeSubtext = epName ? `${formattedSE} - ${epName}` : formattedSE;
                      } else if (isEpOrSeason && item.last_seen_episode && item.title.toLowerCase().startsWith(item.last_seen_episode.toLowerCase() + ' - ')) {
                        displayTitle = item.title.slice(item.last_seen_episode.length + 3);
                      }

                      return (
                        <React.Fragment key={item.id}>
                          {isDropTargetBefore && dropListPlaceholder}
                          <div
                            data-fav-card-idx={idx}
                            data-fav-card-id={item.id}
                            className="shelf-list-item-row"
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            onPointerDown={(e) => {
                              if (e.button !== 0 || !canReorderFavorites) return;
                              const target = e.target as HTMLElement;
                              if (target.closest('button') || target.closest('a')) return;
                              setFavPointerDrag({
                                item,
                                sourceIndex: idx,
                                startX: e.clientX,
                                startY: e.clientY,
                                currentX: e.clientX,
                                currentY: e.clientY,
                                isDragging: false
                              });
                            }}
                            onClick={() => {
                              if (favJustDraggedRef.current || favPointerDragRef.current?.isDragging) return;
                              handleOpenItemDetails(item);
                            }}
                            style={{
                              opacity: isBeingDragged ? 0.35 : 1,
                              cursor: canReorderFavorites ? (favPointerDrag?.isDragging ? 'grabbing' : 'grab') : 'pointer',
                              userSelect: 'none',
                              WebkitUserDrag: 'none',
                              touchAction: canReorderFavorites ? 'none' : 'auto',
                              transition: 'opacity 0.2s ease, transform 0.2s ease'
                            } as React.CSSProperties}
                          >
                            {/* Left: Poster thumbnail */}
                            <div
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              style={{
                                width: '44px',
                                height: '62px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                userSelect: 'none',
                                WebkitUserDrag: 'none'
                              } as React.CSSProperties}
                            >
                              <MediaPoster
                                src={item.image_url}
                                title={item.title}
                                itemType={item.item_type}
                                height="100%"
                                width="100%"
                                borderRadius="6px"
                              />
                            </div>

                            {/* Center: 2 Lines of info */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                                    {displayTitle}
                                  </span>
                                  {favoritesMediaFilter === 'all' && (
                                    <span
                                      className={getTagClass((item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type)}
                                      style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center' }}
                                    >
                                      {getCategoryIcon((item.item_type === 'episode' || item.item_type === 'season' || item.external_id?.startsWith('tvm-ep-')) ? 'series' : item.item_type, { size: 12, color: 'currentColor' })}
                                    </span>
                                  )}
                                </div>
                                <div style={{ flexShrink: 0 }}>
                                  {renderFavoriteBadges(item)}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {episodeSubtext && (
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                                      {episodeSubtext}
                                    </span>
                                  )}
                                </div>
                                {(item.completed_at || item.updated_at) && (
                                  <span style={{ fontSize: '0.72rem', fontStyle: 'italic', flexShrink: 0 }}>
                                    {formatDate(new Date(item.completed_at || item.updated_at || new Date()))}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Favorite Heart button */}
                            <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(item.id, true)}
                                className="btn-favorite-heart is-favorite"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  cursor: 'pointer',
                                  color: 'var(--color-user, #F472B6)'
                                }}
                                title={language === 'es' ? 'Quitar Destacado' : 'Remove Featured'}
                              >
                                <Heart size={16} fill="var(--color-user, #F472B6)" />
                              </button>
                            </div>
                          </div>
                          {isDropTargetAfterLast && dropListPlaceholder}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {/* Floating Drag Preview Follower */}
          {favPointerDrag && favPointerDrag.isDragging && (
            <div
              style={{
                position: 'fixed',
                left: favPointerDrag.currentX + 14,
                top: favPointerDrag.currentY + 14,
                zIndex: 99999,
                pointerEvents: 'none',
                opacity: 0.95,
                transform: 'scale(1.03)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1.5px solid var(--color-user, #F472B6)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.4rem 0.75rem',
                maxWidth: '240px'
              }}
            >
              {favPointerDrag.item.image_url && (
                <img
                  src={favPointerDrag.item.image_url}
                  alt=""
                  style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {favPointerDrag.item.title}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-user, #F472B6)', fontWeight: 600 }}>
                  {language === 'es' ? 'Moviendo destacado' : 'Moving favorite'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}


      {activeTab === 'music' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          {/* Top Row: Content Type Selector (Left) and Period Selector (Right) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
            {/* Type selector: Artistas, Álbumes, Canciones */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'artists', label: language === 'es' ? 'Artistas' : 'Artists', icon: Mic },
                { id: 'albums', label: language === 'es' ? 'Álbumes' : 'Albums', icon: Disc },
                { id: 'tracks', label: language === 'es' ? 'Canciones' : 'Tracks', icon: Headphones }
              ].map(tab => {
                const isSelected = musicType === tab.id;
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMusicType(tab.id as any)}
                    className={`profile-category-tab ${isSelected ? 'selected' : ''}`}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      '--tab-color': 'var(--color-music, #1DB954)',
                      '--tab-text': '#ffffff'
                    } as React.CSSProperties}
                  >
                    <IconComp size={14} color={isSelected ? '#ffffff' : 'var(--color-music, #1DB954)'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Period selector: 7 días, 1 mes, Siempre */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {[
                { id: '7day', label: language === 'es' ? '7 días' : '7 days', icon: Clock },
                { id: '1month', label: language === 'es' ? '1 mes' : '1 month', icon: CalendarDays },
                { id: 'overall', label: language === 'es' ? 'Siempre' : 'All time', icon: InfinityIcon }
              ].map(p => {
                const isSelected = musicPeriod === p.id;
                const PeriodIcon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMusicPeriod(p.id as any)}
                    className={`shelf-view-toggle-btn ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      border: 'none',
                      background: isSelected ? 'var(--color-music, #1DB954)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <PeriodIcon size={13} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isMusicDataLoading ? (
            <div style={{ padding: '3rem 1rem', display: 'flex', justifyContent: 'center' }}>
              <PathdLoader size="medium" message={language === 'es' ? 'Cargando música...' : 'Loading music...'} />
            </div>
          ) : musicItems.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <Music size={32} color="#ef4444" style={{ opacity: 0.8 }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {musicType === 'albums' && (language === 'es' ? 'No hay álbumes escuchados en este período.' : 'No albums played in this period.')}
                {musicType === 'artists' && (language === 'es' ? 'No hay artistas escuchados en este período.' : 'No artists played in this period.')}
                {musicType === 'tracks' && (language === 'es' ? 'No hay canciones escuchadas en este período.' : 'No tracks played in this period.')}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '1.5rem' }}>
              {musicItems.map((item, i) => {
                const itemArtist = musicType === 'artists' ? item.name : item.artist;
                const itemName = musicType === 'artists' ? undefined : item.name;
                const modalItemType = musicType === 'albums' ? 'album' : musicType === 'artists' ? 'artist' : 'track';

                return (
                  <div
                    key={`${item.name}-${i}`}
                    className="glass-card"
                    onClick={() => {
                      setMusicDetailsModal({
                        isOpen: true,
                        type: modalItemType,
                        artist: itemArtist,
                        name: itemName,
                        image: item.image
                      });
                    }}
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'rgba(29, 185, 84, 0.5)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(29, 185, 84, 0.15)';
                      prefetchMusicDetails(modalItemType, itemArtist, itemName);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Position badge */}
                    <span style={{
                      position: 'absolute',
                      top: '0.6rem',
                      left: '0.6rem',
                      zIndex: 2,
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '6px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      #{i + 1}
                    </span>

                    {/* Artwork / Poster / Avatar */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      borderRadius: musicType === 'artists' ? '50%' : '8px',
                      overflow: 'hidden',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: musicType === 'artists' ? '0.5rem auto 0 auto' : '0',
                      maxWidth: musicType === 'artists' ? '140px' : '100%',
                      boxShadow: musicType === 'artists' ? '0 4px 12px rgba(0,0,0,0.3)' : undefined
                    }}>
                      {item.image && !item.image.includes('2a96cbd8b46e442fc41c2b86b821562f') && !item.image.includes('d41d8cd98f00b204e9800998ecf8427e') ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{
                        display: (item.image && !item.image.includes('2a96cbd8b46e442fc41c2b86b821562f') && !item.image.includes('d41d8cd98f00b204e9800998ecf8427e')) ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: 'var(--color-music, #1DB954)',
                        opacity: 0.6
                      }}>
                        {musicType === 'artists' ? <Mic size={36} /> : musicType === 'tracks' ? <Headphones size={36} /> : <Disc size={36} />}
                      </div>
                    </div>

                    {/* Text details */}
                    <div style={{ flex: 1, minWidth: 0, textAlign: musicType === 'artists' ? 'center' : 'left' }}>
                      <h4 style={{
                        margin: '0 0 0.2rem 0',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={item.name}>
                        {item.name}
                      </h4>
                      {item.artist && (
                        <span style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={item.artist}>
                          {item.artist}
                        </span>
                      )}
                    </div>

                    {/* Playcount Badge */}
                    <div style={{ display: 'flex', justifyContent: musicType === 'artists' ? 'center' : 'flex-start' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: 'rgba(29, 185, 84, 0.12)',
                        color: 'var(--color-music, #1DB954)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(29, 185, 84, 0.25)'
                      }}>
                        {item.playcount} {language === 'es' ? 'reproducciones' : 'plays'}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                <span>{language === 'es' ? 'Se creó la cuenta de Pathd.' : 'Pathd account created.'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '1rem' }}>
                  {profile ? formatDate(new Date(profile.created_at)) : formatDate(new Date())}
                </span>
              </div>
            </div>
          ) : (
            (() => {
              // Consolidate legacy dual activities (item_rated + item_reviewed for the same work)
              const consolidated: any[] = [];
              const seenEntity = new Map<string, number>();

              for (const act of activities) {
                const isReview = act.activity_type === 'item_reviewed';
                const isRating = act.activity_type === 'item_rated';
                const key = (isReview || isRating) && (act.external_id || act.item_title)
                  ? `${act.user_id}_${act.external_id || act.item_title}`
                  : null;

                if (key && seenEntity.has(key)) {
                  const idx = seenEntity.get(key)!;
                  const existing = consolidated[idx];
                  if (existing.activity_type === 'item_reviewed' && isRating) {
                    try {
                      const meta = existing.metadata_json ? (typeof existing.metadata_json === 'string' ? JSON.parse(existing.metadata_json) : existing.metadata_json) : {};
                      if (!meta.rating && act.details) {
                        meta.rating = Number(act.details);
                        existing.metadata_json = JSON.stringify(meta);
                      }
                    } catch (_) {}
                    continue;
                  } else if (existing.activity_type === 'item_rated' && isReview) {
                    try {
                      const meta = act.metadata_json ? (typeof act.metadata_json === 'string' ? JSON.parse(act.metadata_json) : act.metadata_json) : {};
                      if (!meta.rating && existing.details) {
                        meta.rating = Number(existing.details);
                        act.metadata_json = JSON.stringify(meta);
                      }
                    } catch (_) {}
                    consolidated[idx] = act;
                    continue;
                  }
                }

                if (key) {
                  seenEntity.set(key, consolidated.length);
                }
                consolidated.push(act);
              }

              return consolidated.map((act) => {
                const parseMeta = () => {
                  if (!act.metadata_json) return {};
                  try {
                    return typeof act.metadata_json === 'string' ? JSON.parse(act.metadata_json) : act.metadata_json;
                  } catch (e) {
                    return {};
                  }
                };
                const meta = parseMeta();
                const count = meta.count || 1;

              const getStatusLabel = (status: string) => {
                const all = [
                  { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
                  { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
                  { value: 'completed', label: language === 'es' ? 'Completado' : 'Completed' },
                  { value: 'endless', label: language === 'es' ? 'Infinito' : 'Endless' },
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
              const title = act.item_title || '';
              const itemType = (act.item_type || meta.item_type || '').toLowerCase();

              switch (act.activity_type) {
                case 'account_created':
                  msg = language === 'es' ? 'Se creó la cuenta de Pathd.' : 'Pathd account created.';
                  break;

                case 'avatar_changed':
                  msg = language === 'es' ? 'Se actualizó la foto de perfil.' : 'Profile avatar updated.';
                  break;

                case 'banner_changed':
                  msg = language === 'es' ? 'Se actualizó la portada de perfil.' : 'Profile banner updated.';
                  break;

                case 'background_changed':
                  msg = language === 'es' ? 'Se actualizó el fondo de perfil.' : 'Profile background updated.';
                  break;

                case 'username_changed':
                  msg = language === 'es' 
                    ? `Se cambió el nombre de usuario a "${act.details || title}".`
                    : `Username changed to "${act.details || title}".`;
                  break;

                case 'lastfm_connected':
                  msg = language === 'es'
                    ? `Se conectó la cuenta de Last.fm (${act.details || 'usuario'}).`
                    : `Connected Last.fm account (${act.details || 'user'}).`;
                  break;

                case 'item_added_to_library':
                case 'shelf_add':
                  msg = language === 'es'
                    ? `Se agregó "${title}" a la biblioteca.`
                    : `Added "${title}" to library.`;
                  break;

                case 'item_status_changed':
                case 'shelf_status':
                case 'item_completed':
                case 'item_progress': {
                  const status = meta.status || act.details || '';
                  const pages = meta.pages_read || 0;
                  const totalPages = meta.total_pages || 0;
                  const lastSeen = meta.last_seen_episode || '';

                  if (meta.is_range && meta.start_unit && meta.end_unit) {
                    const workName = meta.work_title || title.split(' (')[0] || title;
                    const alsoAdded = !!meta.also_added;
                    if (itemType === 'comic') {
                      msg = alsoAdded
                        ? (language === 'es' ? `Se agregó y leyó del ${meta.start_unit} al ${meta.end_unit} de "${workName}".` : `Added and read ${meta.start_unit} to ${meta.end_unit} of "${workName}".`)
                        : (language === 'es' ? `Se leyó del ${meta.start_unit} al ${meta.end_unit} de "${workName}".` : `Read ${meta.start_unit} to ${meta.end_unit} of "${workName}".`);
                    } else {
                      msg = alsoAdded
                        ? (language === 'es' ? `Se agregó y vio del ${meta.start_unit} al ${meta.end_unit} de la serie "${workName}".` : `Added and watched ${meta.start_unit} to ${meta.end_unit} of "${workName}".`)
                        : (language === 'es' ? `Se vio del ${meta.start_unit} al ${meta.end_unit} de la serie "${workName}".` : `Watched ${meta.start_unit} to ${meta.end_unit} of "${workName}".`);
                    }
                  } else if (count > 1) {
                    if (itemType === 'series' || itemType === 'anime') {
                      msg = language === 'es'
                        ? `Se vieron ${count} episodios de "${title}".`
                        : `Watched ${count} episodes of "${title}".`;
                    } else if (itemType === 'book' || itemType === 'manga') {
                      msg = language === 'es'
                        ? `Se avanzaron páginas en "${title}" (${pages}${totalPages ? ` / ${totalPages}` : ''} págs).`
                        : `Progressed pages in "${title}" (${pages}${totalPages ? ` / ${totalPages}` : ''} pages).`;
                    } else {
                      msg = language === 'es'
                        ? `Se registró progreso ${count} veces en "${title}".`
                        : `Logged progress ${count} times on "${title}".`;
                    }
                  } else if (itemType === 'movie') {
                    if (status === 'completed' || status === 'read') {
                      msg = language === 'es' ? `Se marcó "${title}" como Visto.` : `Marked "${title}" as Watched.`;
                    } else if (status === 'dropped') {
                      msg = language === 'es' ? `Se abandonó la película "${title}".` : `Dropped movie "${title}".`;
                    } else if (status === 'watching') {
                      msg = language === 'es' ? `Se comenzó a ver "${title}".` : `Started watching "${title}".`;
                    } else {
                      msg = language === 'es' ? `Se cambió el estado de "${title}" a ${getStatusLabel(status)}.` : `Changed status of "${title}" to ${getStatusLabel(status)}.`;
                    }
                  } else if (itemType === 'series' || itemType === 'anime' || itemType === 'episode') {
                    const isEpisode = meta.is_single_episode || (act.external_id && act.external_id.startsWith('tvm-ep-')) || Boolean(lastSeen && /S\d+E\d+/i.test(lastSeen)) || Boolean(title && /S\d+E\d+/i.test(title));
                    
                    const formatEpisodeString = (rawText: string, showHint?: string) => {
                      // Match patterns like "Show Name - S01E02 - Episode Title" or "S01E02 - Episode Title" or "S01E02"
                      const match = rawText.match(/^(?:(.*?)\s*-\s*)?S(\d+)E(\d+)(?:\s*-\s*(.*))?$/i);
                      if (match) {
                        const extractedShow = (match[1] || showHint || '').trim();
                        const sNum = parseInt(match[2], 10);
                        const eNum = parseInt(match[3], 10);
                        const epName = (match[4] || '').trim();
                        const seasonPrefix = language === 'es' ? 'T' : 'S';
                        const codeStr = `${seasonPrefix}${sNum < 10 ? '0' : ''}${sNum} | E${eNum < 10 ? '0' : ''}${eNum}`;
                        const epPart = epName ? `${codeStr} (${epName})` : codeStr;
                        const finalShow = extractedShow || showHint;
                        if (finalShow) {
                          return language === 'es'
                            ? `el ${epPart} de la serie '${finalShow}'`
                            : `${epPart} from '${finalShow}'`;
                        }
                        return epPart;
                      }
                      return rawText;
                    };

                    if (isEpisode) {
                      const epSource = lastSeen || title;
                      const formattedEp = formatEpisodeString(epSource, meta.show_name);
                      msg = language === 'es'
                        ? `Se vio ${formattedEp.startsWith('el ') ? formattedEp : `el ${formattedEp}`}.`
                        : `Watched ${formattedEp}.`;
                    } else if (status === 'completed') {
                      msg = language === 'es' ? `Se terminó la serie "${title}".` : `Completed series "${title}".`;
                    } else if (status === 'dropped') {
                      msg = language === 'es'
                        ? `Se abandonó la serie "${title}"${lastSeen ? ` (último: ${lastSeen})` : ''}.`
                        : `Dropped series "${title}"${lastSeen ? ` (last: ${lastSeen})` : ''}.`;
                    } else if (lastSeen) {
                      const formattedEp = formatEpisodeString(lastSeen, meta.show_name || title);
                      msg = language === 'es'
                        ? `Se vio ${formattedEp.startsWith('el ') ? formattedEp : `el ${formattedEp}`}.`
                        : `Watched ${formattedEp}.`;
                    } else {
                      msg = language === 'es'
                        ? `Se marcó "${title}" como ${getStatusLabel(status)}.`
                        : `Marked "${title}" as ${getStatusLabel(status)}.`;
                    }
                  } else if (itemType === 'book' || itemType === 'manga') {
                    if (status === 'read' || status === 'completed') {
                      msg = language === 'es'
                        ? `Se leyó "${title}"${totalPages ? ` (${totalPages} págs)` : ''}.`
                        : `Read "${title}"${totalPages ? ` (${totalPages} pages)` : ''}.`;
                    } else if (status === 'dropped') {
                      msg = language === 'es'
                        ? `Se abandonó "${title}"${pages ? ` en la pág. ${pages}` : ''}.`
                        : `Dropped "${title}"${pages ? ` on page ${pages}` : ''}.`;
                    } else if (pages > 0) {
                      msg = language === 'es'
                        ? `Se leyeron páginas de "${title}" (pág. ${pages}${totalPages ? ` de ${totalPages}` : ''}).`
                        : `Reading "${title}" (page ${pages}${totalPages ? ` of ${totalPages}` : ''}).`;
                    } else {
                      msg = language === 'es'
                        ? `Se marcó "${title}" como ${getStatusLabel(status)}.`
                        : `Marked "${title}" as ${getStatusLabel(status)}.`;
                    }
                  } else if (itemType === 'comic') {
                    if (status === 'read' || status === 'completed') {
                      msg = language === 'es' ? `Se leyó "${title}".` : `Read "${title}".`;
                    } else if (status === 'dropped') {
                      msg = language === 'es'
                        ? `Se abandonó el cómic "${title}"${lastSeen ? ` (${lastSeen})` : ''}.`
                        : `Dropped comic "${title}"${lastSeen ? ` (${lastSeen})` : ''}.`;
                    } else if (lastSeen) {
                      msg = language === 'es' ? `Se leyó "${lastSeen}" de "${title}".` : `Read "${lastSeen}" of "${title}".`;
                    } else {
                      msg = language === 'es' ? `Se marcó "${title}" como ${getStatusLabel(status)}.` : `Marked "${title}" as ${getStatusLabel(status)}.`;
                    }
                  } else if (itemType === 'game') {
                    if (meta.is_hundred_percent) {
                      msg = language === 'es' ? `Se completó al 100% "${title}".` : `Completed 100% of "${title}".`;
                    } else if (status === 'completed') {
                      msg = language === 'es' ? `Se completó el juego "${title}".` : `Completed game "${title}".`;
                    } else if (status === 'endless') {
                      msg = language === 'es' ? `Se marcó "${title}" como Infinito.` : `Marked "${title}" as Endless.`;
                    } else if (status === 'dropped') {
                      msg = language === 'es' ? `Se abandonó el juego "${title}".` : `Dropped game "${title}".`;
                    } else if (status === 'playing') {
                      msg = language === 'es' ? `Se comenzó a jugar a "${title}".` : `Started playing "${title}".`;
                    } else {
                      msg = language === 'es' ? `Se cambió el estado de "${title}" a ${getStatusLabel(status)}.` : `Changed status of "${title}" to ${getStatusLabel(status)}.`;
                    }
                  } else {
                    msg = language === 'es'
                      ? `Se marcó "${title}" como ${getStatusLabel(status)}.`
                      : `Marked "${title}" as ${getStatusLabel(status)}.`;
                  }
                  break;
                }

                case 'guide_created':
                  msg = language === 'es'
                    ? `Se creó la guía "${title}".`
                    : `Created guide "${title}".`;
                  break;

                case 'guide_edited':
                  msg = language === 'es'
                    ? `Se editó la guía "${title}".`
                    : `Edited guide "${title}".`;
                  break;

                case 'guide_followed':
                  msg = language === 'es'
                    ? `Se comenzó a seguir la guía "${title}".`
                    : `Started following guide "${title}".`;
                  break;

                case 'item_favorited':
                case 'shelf_favorite':
                  msg = language === 'es'
                    ? `Se destacó "${title}".`
                    : `Featured "${title}".`;
                  break;

                case 'user_followed':
                  msg = language === 'es'
                    ? `Se comenzó a seguir a @${title}.`
                    : `Started following @${title}.`;
                  break;

                case 'item_rated':
                  msg = language === 'es'
                    ? `Calificó "${title}"`
                    : `Rated "${title}"`;
                  break;

                case 'guide_rated':
                  msg = language === 'es'
                    ? `Calificó la guía "${title}"`
                    : `Rated guide "${title}"`;
                  break;

                case 'item_reviewed': {
                  const rVal = meta.rating !== undefined && meta.rating !== null ? meta.rating : null;
                  if (rVal) {
                    msg = language === 'es'
                      ? `Calificó y escribió una reseña de "${title}"`
                      : `Rated and reviewed "${title}"`;
                  } else {
                    msg = language === 'es'
                      ? `Escribió una reseña de "${title}"`
                      : `Reviewed "${title}"`;
                  }
                  break;
                }

                case 'guide_commented':
                  msg = language === 'es'
                    ? `Comentó en la guía "${title}".`
                    : `Commented on guide "${title}".`;
                  break;

                case 'social_commented':
                  msg = language === 'es'
                    ? `Comentó en la Actividad Social.`
                    : `Commented on Social Activity.`;
                  break;

                case 'guide_review_commented':
                  msg = language === 'es'
                    ? `Comentó en la reseña de una guía.`
                    : `Commented on a guide review.`;
                  break;

                default:
                  msg = title ? `${act.activity_type} - ${title}` : act.activity_type;
                  break;
              }

              const isReview = act.activity_type === 'item_reviewed';
              const isRating = act.activity_type === 'item_rated' || act.activity_type === 'guide_rated';
              const ratingNumber = (isRating && act.details && !isNaN(Number(act.details)))
                ? Number(act.details)
                : (meta.rating !== undefined && meta.rating !== null && !isNaN(Number(meta.rating)) ? Number(meta.rating) : null);
              const reviewText = isReview && act.details && act.details.trim() ? act.details.trim() : null;

              // Check if activity points to an item that can be opened in ItemDetailsModal
              const canOpenModal = Boolean(act.external_id || act.list_id || title);
              const targetPoster = act.image_url || meta.image_url;

              return (
                <div
                  key={act.id}
                  className="glass-card"
                  onClick={() => {
                    if (canOpenModal && act.activity_type.startsWith('item_')) {
                      let effectiveItemType = (meta.series_item_type || act.item_type || meta.item_type || 'series').toLowerCase();
                      if (effectiveItemType === 'episode') effectiveItemType = 'series';
                      let effectiveExternalId = meta.series_external_id || meta.parent_external_id || meta.work_ext_id || act.external_id || undefined;
                      const cleanTitle = meta.series_title || meta.work_title || title;

                      setSelectedItem({
                        external_id: effectiveExternalId,
                        id: (!effectiveExternalId && act.list_id) ? act.list_id : undefined,
                        title: cleanTitle || 'Media',
                        image_url: targetPoster || undefined,
                        item_type: effectiveItemType,
                        tracking_list_id: act.list_id || undefined
                      });
                    }
                  }}
                  style={{
                    padding: '0.9rem 1.15rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'flex-start',
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border-color)',
                    cursor: (canOpenModal && act.activity_type.startsWith('item_')) ? 'pointer' : 'default',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (canOpenModal && act.activity_type.startsWith('item_')) {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canOpenModal && act.activity_type.startsWith('item_')) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.03))';
                    }
                  }}
                >
                  {/* Left: Thumbnail poster or Category icon */}
                  {targetPoster ? (
                    <div style={{
                      width: '42px',
                      height: '58px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                    }}>
                      <img
                        src={targetPoster}
                        alt={title || 'Media'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '0.15rem'
                    }}>
                      <CheckCircle size={18} color="#10b981" />
                    </div>
                  )}

                  {/* Middle & Right Content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {msg}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {formatDate(new Date(act.created_at))}
                      </span>
                    </div>

                    {/* Optional Star Rating highlight */}
                    {ratingNumber !== null && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                        <StarRatingDisplay rating={ratingNumber} size={14} gap="2px" />
                        <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>
                          {ratingNumber} / 5
                        </span>
                      </div>
                    )}

                    {/* Optional Review speech snippet */}
                    {reviewText && (
                      <div style={{
                        marginTop: '0.2rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderLeft: '3px solid var(--accent-primary)',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '0 6px 6px 0',
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {reviewText}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()
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
      </>
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

      {/* Music Item Details Modal */}
      <MusicDetailsModal
        isOpen={musicDetailsModal.isOpen}
        onClose={() => setMusicDetailsModal(prev => ({ ...prev, isOpen: false }))}
        type={musicDetailsModal.type}
        artist={musicDetailsModal.artist}
        name={musicDetailsModal.name}
        initialImage={musicDetailsModal.image}
      />
    </div>
  );
};
export default Profile;




