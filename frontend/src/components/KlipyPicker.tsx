import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Sparkles, Image as ImageIcon, Smile, Film, FileQuestion, Volume2, VolumeX, Heart, FolderHeart, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { getKlipyFavorites, isKlipyFavorite, toggleKlipyFavorite } from '../utils/klipyFavorites';
import type { KlipyFavoriteItem } from '../utils/klipyFavorites';


interface KlipyMediaItem {
  id: number | string;
  slug: string;
  title: string;
  type: 'gif' | 'sticker' | 'meme' | 'clip' | 'emoji';
  file?: {
    hd?: { gif?: { url: string }, webp?: { url: string }, mp4?: { url: string }, png?: { url: string }, jpg?: { url: string } };
    md?: { gif?: { url: string }, webp?: { url: string }, mp4?: { url: string }, png?: { url: string }, jpg?: { url: string } };
    sm?: { gif?: { url: string }, webp?: { url: string }, mp4?: { url: string }, png?: { url: string }, jpg?: { url: string } };
    xs?: { gif?: { url: string }, webp?: { url: string }, mp4?: { url: string }, png?: { url: string }, jpg?: { url: string } };
  };
  blur_preview?: string;
}

export interface SelectedKlipyMedia {
  url: string;
  type: 'gif' | 'sticker' | 'meme' | 'clip' | 'emoji';
  slug: string;
  title: string;
  preview_url?: string;
}

const KlipyClipCard: React.FC<{
  item: any;
  mainUrl: string;
  previewUrl?: string;
  isUnmuted: boolean;
  volume: number;
  onToggleSound: (e: React.MouseEvent) => void;
  onVolumeChange: (newVol: number) => void;
  onSelect: () => void;
}> = ({ item, mainUrl, previewUrl, isUnmuted, volume, onToggleSound, onVolumeChange, onSelect }) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isUnmuted;
      videoRef.current.volume = volume;
      if (isUnmuted) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isUnmuted, volume]);

  // When unmuted in KlipyPicker, broadcast to mute any other clip in comments/modals
  useEffect(() => {
    if (isUnmuted) {
      window.dispatchEvent(
        new CustomEvent('app_clip_unmuted', {
          detail: { id: `klipy_picker_${item?.id || mainUrl}` }
        })
      );
    }
  }, [isUnmuted, item?.id, mainUrl]);

  // Auto-mute when clip leaves the viewport (scrolling inside picker) or window loses focus
  useEffect(() => {
    if (!isUnmuted) return;

    const handleVisibilityOrBlur = () => {
      if (document.hidden) {
        onToggleSound({ stopPropagation: () => {} } as any);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);

    let observer: IntersectionObserver | null = null;
    if (containerRef.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
              if (isUnmuted) {
                onToggleSound({ stopPropagation: () => {} } as any);
              }
            }
          });
        },
        { threshold: [0, 0.2] }
      );
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
      if (observer) observer.disconnect();
    };
  }, [isUnmuted, onToggleSound]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVol = parseFloat(e.target.value);
    onVolumeChange(newVol);
  };

  const handleSliderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const [isFavorite, setIsFavorite] = useState<boolean>(() => isKlipyFavorite(mainUrl));

  useEffect(() => {
    setIsFavorite(isKlipyFavorite(mainUrl));
    const handleFavChange = (e: CustomEvent<{ url: string; isFavorite: boolean }>) => {
      if (e.detail?.url === mainUrl) {
        setIsFavorite(e.detail.isFavorite);
      }
    };
    window.addEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    return () => {
      window.removeEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    };
  }, [mainUrl]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nowFav = toggleKlipyFavorite({
      id: item?.id,
      url: mainUrl,
      type: item?.type || 'clip',
      slug: item?.slug,
      title: item?.title,
      preview_url: previewUrl || mainUrl
    });
    setIsFavorite(nowFav);
  };

  return (
    <div
      ref={containerRef}
      onClick={onSelect}
      className="klipy-card-item"
      style={{
        border: isUnmuted ? '1px solid #ec4899' : undefined
      }}
    >
      {/* Top-Left Favorite Button */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        style={{
          position: 'absolute',
          top: '5px',
          left: '5px',
          background: isFavorite ? 'rgba(236, 72, 153, 0.95)' : 'rgba(0, 0, 0, 0.65)',
          color: isFavorite ? '#fff' : '#cbd5e1',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 4,
          backdropFilter: 'blur(4px)',
          transition: 'all 0.15s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.15)';
          if (!isFavorite) e.currentTarget.style.color = '#ec4899';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (!isFavorite) e.currentTarget.style.color = '#cbd5e1';
        }}
      >
        <Heart size={13} fill={isFavorite ? '#fff' : 'none'} />
      </button>

      <video
        ref={videoRef}
        src={mainUrl}
        poster={previewUrl}
        muted={!isUnmuted}
        loop
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
        style={{
          position: 'absolute',
          bottom: '6px',
          right: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: showVolumeSlider ? '3px 8px 3px 4px' : '0px',
          borderRadius: '20px',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 3,
          transition: 'all 0.2s ease'
        }}
      >
        <button
          type="button"
          onClick={onToggleSound}
          title={isUnmuted ? 'Silenciar' : 'Escuchar audio'}
          aria-label={isUnmuted ? 'Silenciar' : 'Escuchar audio'}
          style={{
            background: isUnmuted ? 'rgba(236, 72, 153, 0.9)' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isUnmuted && volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>

        {showVolumeSlider && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleSliderChange}
            onClick={handleSliderClick}
            onMouseDown={handleSliderClick}
            title={`Volumen: ${Math.round(volume * 100)}%`}
            style={{
              width: '55px',
              height: '4px',
              accentColor: '#ec4899',
              cursor: 'pointer'
            }}
          />
        )}
      </div>
    </div>
  );
};

const KlipyMediaCard: React.FC<{
  item: any;
  mainUrl: string;
  previewUrl?: string;
  mediaType: 'gif' | 'sticker' | 'meme' | 'emoji';
  onSelect: () => void;
}> = ({ item, mainUrl, previewUrl, mediaType, onSelect }) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(() => isKlipyFavorite(mainUrl));

  useEffect(() => {
    setIsFavorite(isKlipyFavorite(mainUrl));
    const handleFavChange = (e: CustomEvent<{ url: string; isFavorite: boolean }>) => {
      if (e.detail?.url === mainUrl) {
        setIsFavorite(e.detail.isFavorite);
      }
    };
    window.addEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    return () => {
      window.removeEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    };
  }, [mainUrl]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nowFav = toggleKlipyFavorite({
      id: item?.id,
      url: mainUrl,
      type: mediaType,
      slug: item?.slug,
      title: item?.title,
      preview_url: previewUrl || mainUrl
    });
    setIsFavorite(nowFav);
  };

  return (
    <div
      onClick={onSelect}
      className="klipy-card-item"
    >
      {/* Top-Left Favorite Button */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        style={{
          position: 'absolute',
          top: '5px',
          left: '5px',
          background: isFavorite ? 'rgba(236, 72, 153, 0.95)' : 'rgba(0, 0, 0, 0.65)',
          color: isFavorite ? '#fff' : '#cbd5e1',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 4,
          backdropFilter: 'blur(4px)',
          transition: 'all 0.15s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.15)';
          if (!isFavorite) e.currentTarget.style.color = '#ec4899';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (!isFavorite) e.currentTarget.style.color = '#cbd5e1';
        }}
      >
        <Heart size={13} fill={isFavorite ? '#fff' : 'none'} />
      </button>

      <img
        src={previewUrl || mainUrl}
        alt={item?.title || 'media'}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: mediaType === 'sticker' ? 'contain' : 'cover',
          display: 'block'
        }}
      />
    </div>
  );
};

export interface KlipyPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (media: SelectedKlipyMedia) => void;
  initialTab?: 'gifs' | 'stickers' | 'memes' | 'clips';
}

const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY || '';
const BASE_URL = 'https://api.klipy.com/api/v1';

export const KlipyPicker: React.FC<KlipyPickerProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  initialTab = 'gifs'
}) => {
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'gifs' | 'stickers' | 'memes' | 'clips'>(() => {
    try {
      const saved = localStorage.getItem('klipy_last_active_tab');
      if (saved && ['gifs', 'stickers', 'memes', 'clips'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return initialTab;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<KlipyMediaItem[]>([]);
  const [categories, setCategories] = useState<{ category: string; query: string; preview_url?: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unmutedClipId, setUnmutedClipId] = useState<string | number | null>(null);
  const [clipVolume, setClipVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('klipy_clip_volume');
      return saved ? parseFloat(saved) : 0.8;
    } catch (e) {
      return 0.8;
    }
  });

  const [viewFavorites, setViewFavorites] = useState(false);
  const [favoritesList, setFavoritesList] = useState<KlipyFavoriteItem[]>(() => getKlipyFavorites());

  // Listen to favorite additions/removals
  useEffect(() => {
    const handleFavChange = () => {
      setFavoritesList(getKlipyFavorites());
    };
    window.addEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    return () => {
      window.removeEventListener('klipy_favorites_changed' as any, handleFavChange as EventListener);
    };
  }, []);

  const handleClipVolumeChange = (itemKey: string, newVol: number) => {
    setClipVolume(newVol);
    try {
      localStorage.setItem('klipy_clip_volume', String(newVol));
    } catch (e) {}
    if (newVol > 0) {
      setUnmutedClipId(itemKey);
    } else {
      setUnmutedClipId(null);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<any>(null);
  const isClosingViaBackRef = useRef(false);
  const hasPushedModalHistoryRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const sessionPushedCountRef = useRef(0);

  // Sync with URL query parameters: ?modal=media&media_tab=gifs|stickers|memes|clips&folder=favorites
  const updateKlipyUrlParams = useCallback((isOpenState: boolean, tab: 'gifs' | 'stickers' | 'memes' | 'clips', isFavs: boolean, usePush: boolean = false) => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    if (isOpenState) {
      currentUrl.searchParams.set('modal', 'media');
      if (tab === 'gifs') {
        currentUrl.searchParams.delete('media_tab');
      } else {
        currentUrl.searchParams.set('media_tab', tab);
      }
      if (isFavs) {
        currentUrl.searchParams.set('folder', 'favorites');
      } else {
        currentUrl.searchParams.delete('folder');
      }
    } else {
      currentUrl.searchParams.delete('modal');
      currentUrl.searchParams.delete('media_tab');
      currentUrl.searchParams.delete('folder');
    }
    const newRelative = currentUrl.pathname + (currentUrl.search || '') + (currentUrl.hash || '');
    const currentRelative = window.location.pathname + (window.location.search || '') + (window.location.hash || '');
    if (newRelative !== currentRelative) {
      if (usePush) {
        window.history.pushState(window.history.state, '', newRelative);
      } else {
        window.history.replaceState(window.history.state, '', newRelative);
      }
    }
  }, []);

  // Handle URL change or back button to close or restore modal state
  useEffect(() => {
    if (!isOpen) {
      hasPushedModalHistoryRef.current = false;
      sessionPushedCountRef.current = 0;
      return;
    }

    // Determine the tab to use when opening fresh:
    // Priority: URL param (if already in URL) -> saved last active tab -> initialTab
    const params = new URLSearchParams(window.location.search);
    const mediaTabParam = params.get('media_tab');
    const folderParam = params.get('folder');

    let effectiveTab: 'gifs' | 'stickers' | 'memes' | 'clips' = initialTab;
    let savedTab: string | null = null;
    try {
      savedTab = localStorage.getItem('klipy_last_active_tab');
    } catch (e) {}

    if (mediaTabParam && ['gifs', 'stickers', 'memes', 'clips'].includes(mediaTabParam)) {
      effectiveTab = mediaTabParam as any;
    } else if (savedTab && ['gifs', 'stickers', 'memes', 'clips'].includes(savedTab)) {
      effectiveTab = savedTab as any;
    }

    const effectiveFavs = folderParam === 'favorites';

    setActiveTab(effectiveTab);
    setViewFavorites(effectiveFavs);
    sessionPushedCountRef.current = 0;

    // Push the initial history entry for opening the modal (if not already opened with modal=media)
    const alreadyHadModal = params.get('modal') === 'media';
    if (!hasPushedModalHistoryRef.current) {
      hasPushedModalHistoryRef.current = true;
      updateKlipyUrlParams(true, effectiveTab, effectiveFavs, !alreadyHadModal);
    }

    const handlePopState = () => {
      // If user was navigating internally back within session
      if (sessionPushedCountRef.current > 0) {
        sessionPushedCountRef.current -= 1;
        const p = new URLSearchParams(window.location.search);
        const mt = p.get('media_tab');
        let newTab: 'gifs' | 'stickers' | 'memes' | 'clips' = 'gifs';
        if (mt && ['gifs', 'stickers', 'memes', 'clips'].includes(mt)) {
          newTab = mt as any;
        }
        setActiveTab(newTab);
        try { localStorage.setItem('klipy_last_active_tab', newTab); } catch (e) {}
        setViewFavorites(p.get('folder') === 'favorites');
      } else {
        // We reached the initial route of THIS session! Close the modal immediately.
        isClosingViaBackRef.current = true;
        // Clean URL params via replaceState so no media_tab is left behind on the host route
        updateKlipyUrlParams(false, 'gifs', false, false);
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, initialTab, updateKlipyUrlParams]);

  // Clean URL when picker is closed
  useEffect(() => {
    if (!isOpen) {
      if (isClosingViaBackRef.current) {
        // Popped by the back button that triggered closing, clean params and reset ref
        isClosingViaBackRef.current = false;
        updateKlipyUrlParams(false, 'gifs', false, false);
      } else {
        // Closed via X, click outside, or item selection:
        // Pop all history entries created during THIS session so we don't leave previous tabs in browser history!
        const entriesToPop = sessionPushedCountRef.current + 1; // +1 for the modal opening entry
        sessionPushedCountRef.current = 0;

        if (typeof window !== 'undefined') {
          const p = new URLSearchParams(window.location.search);
          if (p.get('modal') === 'media') {
            window.history.go(-entriesToPop);
          } else {
            updateKlipyUrlParams(false, 'gifs', false, false);
          }
        }
      }
    }
  }, [isOpen, updateKlipyUrlParams]);

  const TABS: ('gifs' | 'stickers' | 'memes' | 'clips')[] = ['gifs', 'stickers', 'memes', 'clips'];

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (viewFavorites) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (viewFavorites || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    const elapsedTime = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Minimum swipe distance: 50px, predominantly horizontal, within 800ms
    if (elapsedTime <= 800 && Math.abs(diffX) >= 50 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
      const currentIndex = TABS.indexOf(activeTab);
      if (diffX < 0) {
        // Swipe Left -> next tab
        if (currentIndex < TABS.length - 1) {
          handleTabSelect(TABS[currentIndex + 1]);
        }
      } else {
        // Swipe Right -> previous tab
        if (currentIndex > 0) {
          handleTabSelect(TABS[currentIndex - 1]);
        }
      }
    }
  };

  const handleTabSelect = (tab: 'gifs' | 'stickers' | 'memes' | 'clips') => {
    if (tab === activeTab && !viewFavorites) return;
    setActiveTab(tab);
    try { localStorage.setItem('klipy_last_active_tab', tab); } catch (e) {}
    setViewFavorites(false);
    sessionPushedCountRef.current += 1;
    updateKlipyUrlParams(true, tab, false, true);
  };

  const handleToggleFavoritesView = (showFavs: boolean) => {
    if (showFavs === viewFavorites) return;
    setViewFavorites(showFavs);
    sessionPushedCountRef.current += 1;
    updateKlipyUrlParams(true, activeTab, showFavs, true);
  };

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
      setUnmutedClipId(null);
      setFavoritesList(getKlipyFavorites());
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setUnmutedClipId(null);
      setViewFavorites(false);
    }
  }, [isOpen]);

  // Load Categories & Media when Tab Changes or Modal Opens
  useEffect(() => {
    if (!isOpen) return;

    setItems([]);
    setPage(1);
    setHasMore(true);
    setSelectedCategory(null);
    setViewFavorites(false);
    setUnmutedClipId(null);
    loadCategories(activeTab);
    fetchMedia(activeTab, searchQuery, 1, false);
  }, [activeTab, isOpen]);

  const categoriesCacheRef = useRef<{ [key: string]: { data: any[]; timestamp: number } }>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0);
  const blockedUntilRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to trigger rate-limiting cooldown circuit breaker
  const handleRateLimit = (res?: Response) => {
    let waitSeconds = 45; // Default 45s cooldown
    try {
      if (res) {
        const retryHeader = res.headers.get('Retry-After');
        if (retryHeader) {
          const parsed = parseInt(retryHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            waitSeconds = Math.min(Math.max(parsed, 10), 300);
          }
        }
      }
    } catch (_) {}

    blockedUntilRef.current = Date.now() + waitSeconds * 1000;
    setRateLimited(true);
    setRateLimitCooldown(waitSeconds);
  };

  // Cooldown countdown effect
  useEffect(() => {
    if (!rateLimited || rateLimitCooldown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          blockedUntilRef.current = 0;
          setRateLimited(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimited, rateLimitCooldown]);

  // Fetch Categories for current tab (cached in memory for 10 minutes to avoid redundant API hits)
  const loadCategories = async (tab: string) => {
    if (!KLIPY_API_KEY) return;
    if (Date.now() < blockedUntilRef.current) {
      setRateLimited(true);
      return;
    }

    const segment = tab === 'memes' ? 'static-memes' : tab;
    const localeParam = language === 'es' ? 'es' : 'en';
    const cacheKey = `${segment}-${localeParam}`;

    const cached = categoriesCacheRef.current[cacheKey];
    const TEN_MINUTES = 10 * 60 * 1000;
    if (cached && Date.now() - cached.timestamp < TEN_MINUTES) {
      setCategories(cached.data);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/${KLIPY_API_KEY}/${segment}/categories?locale=${localeParam}`);
      if (res.status === 429) {
        handleRateLimit(res);
        setCategories([]);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        let cats: any[] = [];
        if (Array.isArray(data.categories)) {
          cats = data.categories;
        } else if (Array.isArray(data.data?.categories)) {
          cats = data.data.categories;
        } else if (Array.isArray(data.data)) {
          cats = data.data;
        }
        categoriesCacheRef.current[cacheKey] = { data: cats, timestamp: Date.now() };
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load KLIPY categories', err);
      setCategories([]);
    }
  };

  // Fetch Media Items
  const fetchMedia = async (tab: string, query: string, pageNum: number, append: boolean = false) => {
    if (!KLIPY_API_KEY) return;
    if (Date.now() < blockedUntilRef.current) {
      setRateLimited(true);
      if (!append) setItems([]);
      return;
    }

    // Cancel any previous in-flight request to save KLIPY quota & prevent race conditions
    if (!append && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    if (!append) {
      abortControllerRef.current = controller;
    }

    setLoading(true);
    try {
      const segment = tab === 'memes' ? 'static-memes' : tab;
      const endpoint = query ? 'search' : 'trending';
      const locale = language === 'es' ? 'es' : 'en';
      let url = `${BASE_URL}/${KLIPY_API_KEY}/${segment}/${endpoint}?page=${pageNum}&per_page=24&locale=${locale}&content_filter=medium`;
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }

      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429) {
        handleRateLimit(res);
        if (!append) setItems([]);
        return;
      }
      if (res.ok) {
        setRateLimited(false);
        const json = await res.json();
        let newItems: KlipyMediaItem[] = [];
        let hasNext = false;

        if (Array.isArray(json.data?.data)) {
          newItems = json.data.data;
          hasNext = Boolean(json.data.has_next);
        } else if (Array.isArray(json.data)) {
          newItems = json.data;
          hasNext = newItems.length >= 24;
        } else if (Array.isArray(json.results)) {
          newItems = json.results;
          hasNext = newItems.length >= 24;
        }

        if (append) {
          setItems((prev) => [...(Array.isArray(prev) ? prev : []), ...newItems]);
        } else {
          setItems(newItems);
        }
        setHasMore(hasNext);
      } else {
        if (!append) setItems([]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch media from KLIPY', err);
      if (!append) setItems([]);
    } finally {
      if (!abortControllerRef.current || abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  // Handle Search Input Debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedCategory(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchMedia(activeTab, query, 1, false);
    }, 400);
  };

  const handleCategoryClick = (categoryQuery: string) => {
    if (selectedCategory === categoryQuery) {
      setSelectedCategory(null);
      setSearchQuery('');
      setPage(1);
      fetchMedia(activeTab, '', 1, false);
    } else {
      setSelectedCategory(categoryQuery);
      setSearchQuery(categoryQuery);
      setPage(1);
      fetchMedia(activeTab, categoryQuery, 1, false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setPage(1);
    fetchMedia(activeTab, '', 1, false);
  };

  // Helper to extract best media URL from KLIPY item
  const extractMediaUrls = (item: KlipyMediaItem) => {
    const file: any = item.file;
    if (!file) {
      return { mainUrl: '', previewUrl: '' };
    }

    // Direct string structure for Clips: file: { mp4: "...", gif: "...", webp: "..." }
    if (typeof file.mp4 === 'string') {
      return {
        mainUrl: file.mp4,
        previewUrl: file.gif || file.webp || file.mp4
      };
    }

    // Nested resolution objects (hd, md, sm, xs) for GIFs, Stickers, Memes
    const hd = file.hd;
    const md = file.md;
    const sm = file.sm;

    let mainUrl = '';
    let previewUrl = '';

    if (item.type === 'clip') {
      mainUrl = hd?.mp4?.url || md?.mp4?.url || sm?.mp4?.url || '';
      previewUrl = md?.gif?.url || sm?.gif?.url || md?.webp?.url || '';
    } else if (item.type === 'sticker') {
      mainUrl = hd?.gif?.url || hd?.png?.url || md?.gif?.url || md?.png?.url || sm?.gif?.url || '';
      previewUrl = sm?.gif?.url || sm?.png?.url || md?.png?.url || '';
    } else if (item.type === 'meme') {
      mainUrl = hd?.jpg?.url || hd?.png?.url || md?.jpg?.url || md?.png?.url || sm?.jpg?.url || '';
      previewUrl = sm?.jpg?.url || sm?.png?.url || md?.jpg?.url || '';
    } else {
      // Default / GIF
      mainUrl = hd?.gif?.url || md?.gif?.url || sm?.gif?.url || hd?.webp?.url || '';
      previewUrl = sm?.gif?.url || sm?.webp?.url || md?.gif?.url || '';
    }

    return {
      mainUrl: mainUrl || previewUrl,
      previewUrl: previewUrl || mainUrl
    };
  };

  const handleSelect = (item: KlipyMediaItem) => {
    const { mainUrl, previewUrl } = extractMediaUrls(item);
    if (!mainUrl) return;

    let mediaType: SelectedKlipyMedia['type'] = 'gif';
    if (activeTab === 'clips' || item.type === 'clip') {
      mediaType = 'clip';
    } else if (activeTab === 'stickers' || item.type === 'sticker') {
      mediaType = 'sticker';
    } else if (activeTab === 'memes' || item.type === 'meme') {
      mediaType = 'meme';
    } else if (item.type) {
      mediaType = item.type;
    }

    onSelectMedia({
      url: mainUrl,
      preview_url: previewUrl,
      type: mediaType,
      slug: item.slug || String(item.id),
      title: item.title || 'KLIPY Media'
    });
    onClose();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (!loading && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchMedia(activeTab, searchQuery, nextPage, true);
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="klipy-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="klipy-modal-card"
        style={{
          width: '100%',
          maxWidth: '540px',
          height: '560px',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-primary, #12151d)',
          borderRadius: '16px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header & Tabs */}
        <div style={{ padding: '0.9rem 1rem 0.5rem', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.01em', color: 'var(--text-primary)' }}>
                {viewFavorites 
                  ? (language === 'es' 
                      ? (activeTab === 'stickers' ? 'Stickers favoritos' : activeTab === 'memes' ? 'Memes favoritos' : activeTab === 'clips' ? 'Clips favoritos' : 'GIFs favoritos')
                      : (activeTab === 'stickers' ? 'Favorite Stickers' : activeTab === 'memes' ? 'Favorite Memes' : activeTab === 'clips' ? 'Favorite Clips' : 'Favorite GIFs'))
                  : (language === 'es' 
                      ? (activeTab === 'stickers' ? 'Seleccionar Sticker' : activeTab === 'memes' ? 'Seleccionar Meme' : activeTab === 'clips' ? 'Seleccionar Clip' : 'Seleccionar GIF')
                      : (activeTab === 'stickers' ? 'Select Sticker' : activeTab === 'memes' ? 'Select Meme' : activeTab === 'clips' ? 'Select Clip' : 'Select GIF'))}
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '0.3rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-secondary, rgba(255,255,255,0.04))', padding: '0.25rem', borderRadius: '10px' }}>
            <button
              onClick={() => handleTabSelect('gifs')}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'gifs' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                color: activeTab === 'gifs' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                fontWeight: activeTab === 'gifs' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <ImageIcon size={14} />
              GIFs
            </button>
            <button
              onClick={() => handleTabSelect('stickers')}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'stickers' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                color: activeTab === 'stickers' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                fontWeight: activeTab === 'stickers' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Smile size={14} />
              Stickers
            </button>
            <button
              onClick={() => handleTabSelect('memes')}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'memes' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                color: activeTab === 'memes' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                fontWeight: activeTab === 'memes' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <FileQuestion size={14} />
              Memes
            </button>
            <button
              onClick={() => handleTabSelect('clips')}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'clips' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                color: activeTab === 'clips' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                fontWeight: activeTab === 'clips' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Film size={14} />
              Clips
            </button>
          </div>
        </div>

        {/* Search Input (Klipy guidelines: "Search KLIPY" placeholder) */}
        <div style={{ padding: '0.65rem 1rem 0.4rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary, rgba(255,255,255,0.06))',
            borderRadius: '10px',
            padding: '0.45rem 0.75rem',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            gap: '0.5rem'
          }}>
            <Search size={16} color="var(--text-muted, #94a3b8)" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={language === 'es' ? 'Buscar en KLIPY' : 'Search KLIPY'}
              autoFocus
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', padding: 0 }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Chips */}
        {categories.length > 0 && !searchQuery && (
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            padding: '0.3rem 1rem 0.5rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0
          }}>
            {categories.map((cat, idx) => {
              const isSelected = selectedCategory === cat.query;
              return (
                <button
                  key={idx}
                  onClick={() => handleCategoryClick(cat.query)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: '16px',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.07)',
                    border: isSelected ? '1px solid var(--accent-primary, #6366f1)' : '1px solid rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#fff' : 'var(--text-secondary, #cbd5e1)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.category}
                </button>
              );
            })}
          </div>
        )}

        {/* Grid Content Header / Folder Banner when viewing favorites */}
        {viewFavorites && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 1rem 0.2rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <button
              onClick={() => handleToggleFavoritesView(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary, #6366f1)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
            >
              <ArrowLeft size={14} />
              <span>{language === 'es' ? 'Volver a explorar' : 'Back to explore'}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ec4899', fontSize: '0.82rem', fontWeight: 600 }}>
              <Heart size={14} fill="#ec4899" />
              <span>{language === 'es' ? 'Favoritos guardados' : 'Saved Favorites'}</span>
            </div>
          </div>
        )}

        {/* Grid Content */}
        <div
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1rem 1rem',
            display: 'grid',
            gridTemplateColumns: activeTab === 'clips' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
            gridAutoRows: activeTab === 'stickers' ? '120px' : activeTab === 'clips' ? '130px' : '110px',
            gap: '0.5rem',
            alignContent: 'start'
          }}
        >
          {/* Favorites Folder as the very first item when not searching and not inside folder */}
          {!searchQuery && !viewFavorites && (
            <div
              onClick={() => handleToggleFavoritesView(true)}
              className="klipy-folder-card"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                border: '1px dashed rgba(236, 72, 153, 0.5)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                outline: 'none'
              }}
            >
              <div style={{
                background: 'rgba(236, 72, 153, 0.2)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ec4899'
              }}>
                <FolderHeart size={20} />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                {language === 'es' ? 'Favoritos' : 'Favorites'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#ec4899', fontWeight: 600 }}>
                {favoritesList.filter(f => activeTab === 'clips' ? f.type === 'clip' : activeTab === 'stickers' ? f.type === 'sticker' : activeTab === 'memes' ? f.type === 'meme' : (f.type === 'gif' || !f.type)).length}{' '}
                {language === 'es' ? 'guardados' : 'saved'}
              </span>
            </div>
          )}

          {/* VIEW: Favorites Mode */}
          {viewFavorites && (() => {
            const currentTabFavs = favoritesList.filter((f) => {
              if (activeTab === 'clips') return f.type === 'clip' || f.url?.endsWith('.mp4');
              if (activeTab === 'stickers') return f.type === 'sticker';
              if (activeTab === 'memes') return f.type === 'meme';
              return f.type === 'gif' || (!f.type && !f.url?.endsWith('.mp4'));
            });

            if (currentTabFavs.length === 0) {
              return (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <FolderHeart size={36} color="#ec4899" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {language === 'es' ? 'No tienes favoritos en esta categoría' : 'No favorites in this category yet'}
                  </p>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
                    {language === 'es'
                      ? 'Haz clic en el corazón de cualquier elemento para guardarlo aquí.'
                      : 'Click the heart icon on any media item to save it here.'}
                  </p>
                </div>
              );
            }

            return currentTabFavs.map((fav, idx) => {
              const itemKey = `fav-${fav.id || fav.url}-${idx}`;
              const isClip = activeTab === 'clips' || fav.type === 'clip' || fav.url?.endsWith('.mp4');

              if (isClip) {
                return (
                  <KlipyClipCard
                    key={itemKey}
                    item={fav}
                    mainUrl={fav.url}
                    previewUrl={fav.preview_url || fav.url}
                    isUnmuted={unmutedClipId === itemKey}
                    volume={clipVolume}
                    onVolumeChange={(newVol) => handleClipVolumeChange(itemKey, newVol)}
                    onToggleSound={(e) => {
                      e.stopPropagation();
                      if (unmutedClipId === itemKey) {
                        setUnmutedClipId(null);
                      } else {
                        if (clipVolume === 0) {
                          setClipVolume(0.8);
                          try { localStorage.setItem('klipy_clip_volume', '0.8'); } catch (err) {}
                        }
                        setUnmutedClipId(itemKey);
                      }
                    }}
                    onSelect={() => {
                      onSelectMedia({
                        url: fav.url,
                        preview_url: fav.preview_url || fav.url,
                        type: 'clip',
                        slug: fav.slug || String(fav.id || 'fav-clip'),
                        title: fav.title || 'Clip'
                      });
                      onClose();
                    }}
                  />
                );
              }

              return (
                <KlipyMediaCard
                  key={itemKey}
                  item={fav}
                  mainUrl={fav.url}
                  previewUrl={fav.preview_url || fav.url}
                  mediaType={(fav.type as any) || (activeTab === 'stickers' ? 'sticker' : activeTab === 'memes' ? 'meme' : 'gif')}
                  onSelect={() => {
                    let mediaType: SelectedKlipyMedia['type'] = 'gif';
                    if (activeTab === 'stickers' || fav.type === 'sticker') mediaType = 'sticker';
                    else if (activeTab === 'memes' || fav.type === 'meme') mediaType = 'meme';
                    else mediaType = 'gif';

                    onSelectMedia({
                      url: fav.url,
                      preview_url: fav.preview_url || fav.url,
                      type: mediaType,
                      slug: fav.slug || String(fav.id || 'fav-media'),
                      title: fav.title || 'Media'
                    });
                    onClose();
                  }}
                />
              );
            });
          })()}

          {/* VIEW: Regular Klipy Explorer Items */}
          {!viewFavorites && Array.isArray(items) && items.map((item, idx) => {
            const { mainUrl, previewUrl } = extractMediaUrls(item);
            if (!mainUrl && !previewUrl) return null;

            const isClip = activeTab === 'clips' || item.type === 'clip' || mainUrl.endsWith('.mp4');
            const itemKey = `${item.id}-${idx}`;

            if (isClip) {
              return (
                <KlipyClipCard
                  key={itemKey}
                  item={item}
                  mainUrl={mainUrl}
                  previewUrl={previewUrl}
                  isUnmuted={unmutedClipId === itemKey}
                  volume={clipVolume}
                  onVolumeChange={(newVol) => handleClipVolumeChange(itemKey, newVol)}
                  onToggleSound={(e) => {
                    e.stopPropagation();
                    if (unmutedClipId === itemKey) {
                      setUnmutedClipId(null);
                    } else {
                      if (clipVolume === 0) {
                        setClipVolume(0.8);
                        try { localStorage.setItem('klipy_clip_volume', '0.8'); } catch (err) {}
                      }
                      setUnmutedClipId(itemKey);
                    }
                  }}
                  onSelect={() => handleSelect(item)}
                />
              );
            }

            return (
              <KlipyMediaCard
                key={itemKey}
                item={item}
                mainUrl={mainUrl}
                previewUrl={previewUrl}
                mediaType={activeTab === 'stickers' ? 'sticker' : activeTab === 'memes' ? 'meme' : 'gif'}
                onSelect={() => handleSelect(item)}
              />
            );
          })}

          {!viewFavorites && (!Array.isArray(items) || items.length === 0) && !loading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              {rateLimited ? (
                <div>
                  <p style={{ margin: '0 0 0.35rem', fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {language === 'es' ? 'Límite de solicitudes de KLIPY alcanzado' : 'KLIPY request limit reached'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {language === 'es'
                      ? (rateLimitCooldown > 0 ? `Por favor espera ${rateLimitCooldown}s antes de reintentar.` : 'Por favor intenta de nuevo en unos minutos.')
                      : (rateLimitCooldown > 0 ? `Please wait ${rateLimitCooldown}s before trying again.` : 'Please try again in a few minutes.')}
                  </p>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {language === 'es' ? 'No se encontraron resultados en KLIPY' : 'No results found on KLIPY'}
                </p>
              )}
            </div>
          )}

          {!viewFavorites && loading && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <Loader2 className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          )}
        </div>

        {/* Footer with Klipy Attribution */}
        <div style={{
          padding: '0.45rem 1rem',
          borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--text-muted, #94a3b8)',
          background: 'var(--bg-secondary, rgba(0,0,0,0.2))'
        }}>
          <div>
            <span className="home-desktop-only">
              {language === 'es' ? 'Haz clic para insertar' : 'Click to insert'}
            </span>
            <span className="home-mobile-only">
              {language === 'es' ? 'Toca para insertar' : 'Tap to insert'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>Powered by</span>
            <strong style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>KLIPY</strong>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default KlipyPicker;
