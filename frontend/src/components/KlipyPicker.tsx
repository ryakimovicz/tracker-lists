import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Sparkles, Image as ImageIcon, Smile, Film, FileQuestion, Volume2, VolumeX, Heart, FolderHeart, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { getKlipyFavorites, isKlipyFavorite, toggleKlipyFavorite } from '../utils/klipyFavorites';
import type { KlipyFavoriteItem } from '../utils/klipyFavorites';

// Official Klipy Ribbon/K Symbol SVG
const KlipyLogo = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      d="M5.5 3.5C4.39543 3.5 3.5 4.39543 3.5 5.5V18.5C3.5 19.6046 4.39543 20.5 5.5 20.5H7.5C8.60457 20.5 9.5 19.6046 9.5 18.5V5.5C9.5 4.39543 8.60457 3.5 7.5 3.5H5.5Z"
      fill="url(#klipy_gradient_1)"
    />
    <path
      d="M10.8 11.2L16.2 4.6C16.9 3.7 18.3 3.7 19 4.6C19.7 5.4 19.6 6.7 18.8 7.4L13.8 12L19.2 18.6C20 19.4 19.9 20.7 19.1 21.4C18.3 22.1 17 22 16.3 21.1L10.8 12.8V11.2Z"
      fill="url(#klipy_gradient_2)"
    />
    <defs>
      <linearGradient id="klipy_gradient_1" x1="3.5" y1="3.5" x2="9.5" y2="20.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF007A" />
        <stop offset="1" stopColor="#7928CA" />
      </linearGradient>
      <linearGradient id="klipy_gradient_2" x1="10.8" y1="3.5" x2="20" y2="21.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF007A" />
        <stop offset="1" stopColor="#7928CA" />
      </linearGradient>
    </defs>
  </svg>
);

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
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.03)',
        border: isUnmuted ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        if (!isUnmuted) e.currentTarget.style.borderColor = 'var(--accent-primary, #6366f1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
        if (!isUnmuted) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
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
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        e.currentTarget.style.borderColor = 'var(--accent-primary, #6366f1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
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

const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY || '2HWcDwQIzsWQZw5KmMgQDlp3acMUswNapO2mT5hQLn4BBChGkV9FOlPsxH9pO5RL';
const BASE_URL = 'https://api.klipy.com/api/v1';

export const KlipyPicker: React.FC<KlipyPickerProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  initialTab = 'gifs'
}) => {
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'gifs' | 'stickers' | 'memes' | 'clips'>(initialTab);
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
      setActiveTab(initialTab);
      setSearchQuery('');
      setSelectedCategory(null);
      setViewFavorites(false);
      setUnmutedClipId(null);
      setFavoritesList(getKlipyFavorites());
    } else {
      setUnmutedClipId(null);
      setViewFavorites(false);
    }
  }, [isOpen, initialTab]);

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

  // Fetch Categories for current tab
  const loadCategories = async (tab: string) => {
    if (!KLIPY_API_KEY) return;
    try {
      const segment = tab === 'memes' ? 'static-memes' : tab;
      const localeParam = language === 'es' ? 'es' : 'en';
      const res = await fetch(`${BASE_URL}/${KLIPY_API_KEY}/${segment}/categories?locale=${localeParam}`);
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
    setLoading(true);
    try {
      const segment = tab === 'memes' ? 'static-memes' : tab;
      const endpoint = query ? 'search' : 'trending';
      const locale = language === 'es' ? 'es' : 'en';
      let url = `${BASE_URL}/${KLIPY_API_KEY}/${segment}/${endpoint}?page=${pageNum}&per_page=24&locale=${locale}&content_filter=medium`;
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
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
    } catch (err) {
      console.error('Failed to fetch media from KLIPY', err);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.3rem 0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <KlipyLogo size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
                KLIPY
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
              onClick={() => setActiveTab('gifs')}
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
              onClick={() => setActiveTab('stickers')}
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
              onClick={() => setActiveTab('memes')}
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
              onClick={() => setActiveTab('clips')}
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
              placeholder="Search KLIPY"
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
              onClick={() => setViewFavorites(false)}
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
              onClick={() => setViewFavorites(true)}
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
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(236, 72, 153, 0.25)';
                e.currentTarget.style.borderColor = '#ec4899';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
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
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {language === 'es' ? 'No se encontraron resultados en KLIPY' : 'No results found on KLIPY'}
              </p>
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
          <span>
            {language === 'es' ? 'Haz clic para insertar' : 'Click to insert'}
          </span>
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
