import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Sparkles, Image as ImageIcon, Smile, Film, FileQuestion } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

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

interface KlipyPickerProps {
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

  // Determine endpoint segment based on active tab
  const getEndpointSegment = (tab: 'gifs' | 'stickers' | 'memes' | 'clips') => {
    switch (tab) {
      case 'gifs': return 'gifs';
      case 'stickers': return 'stickers';
      case 'memes': return 'static-memes';
      case 'clips': return 'clips';
    }
  };

  // Fetch Categories for active tab
  const fetchCategories = async (tab: 'gifs' | 'stickers' | 'memes' | 'clips') => {
    try {
      const segment = getEndpointSegment(tab);
      const localeParam = language === 'es' ? 'es_ES' : 'en_US';
      const res = await fetch(`${BASE_URL}/${KLIPY_API_KEY}/${segment}/categories?locale=${localeParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.result && data.data && Array.isArray(data.data.categories)) {
          setCategories(data.data.categories);
        } else {
          setCategories([]);
        }
      }
    } catch (err) {
      console.error('Failed to load KLIPY categories', err);
      setCategories([]);
    }
  };

  // Fetch items (Trending or Search)
  const fetchMedia = async (tab: 'gifs' | 'stickers' | 'memes' | 'clips', query: string, pageNum: number, append = false) => {
    if (!KLIPY_API_KEY) return;
    setLoading(true);
    try {
      const segment = getEndpointSegment(tab);
      const isSearch = Boolean(query.trim());
      const endpoint = isSearch ? 'search' : 'trending';
      const locale = language === 'es' ? 'es' : 'us';
      
      let url = `${BASE_URL}/${KLIPY_API_KEY}/${segment}/${endpoint}?page=${pageNum}&per_page=24&locale=${locale}&content_filter=medium`;
      if (isSearch) {
        url += `&q=${encodeURIComponent(query.trim())}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.result && data.data) {
          const list = data.data.data || [];
          setItems(prev => append ? [...prev, ...list] : list);
          setHasMore(Boolean(data.data.has_next));
        } else {
          if (!append) setItems([]);
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch media from KLIPY', err);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // When tab changes, reset state and fetch categories + initial items
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedCategory(null);
    setPage(1);
    fetchCategories(activeTab);
    fetchMedia(activeTab, '', 1, false);
  }, [activeTab, isOpen, language]);

  // Handle Search Input Debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedCategory(null);
    setPage(1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchMedia(activeTab, val, 1, false);
    }, 350);
  };

  const handleCategoryClick = (catQuery: string) => {
    if (selectedCategory === catQuery) {
      setSelectedCategory(null);
      setSearchQuery('');
      setPage(1);
      fetchMedia(activeTab, '', 1, false);
    } else {
      setSelectedCategory(catQuery);
      setSearchQuery(catQuery);
      setPage(1);
      fetchMedia(activeTab, catQuery, 1, false);
    }
  };

  // Helper to extract best media URL from KLIPY item
  const extractMediaUrls = (item: KlipyMediaItem) => {
    const file = item.file || {};
    // Priority for display: sm or md webp/gif
    let previewUrl = '';
    let mainUrl = '';

    const sizes = [file.md, file.hd, file.sm, file.xs].filter(Boolean);
    for (const s of sizes) {
      if (s?.gif?.url) { mainUrl = mainUrl || s.gif.url; }
      if (s?.webp?.url) { mainUrl = mainUrl || s.webp.url; }
      if (s?.png?.url) { mainUrl = mainUrl || s.png.url; }
      if (s?.mp4?.url) { mainUrl = mainUrl || s.mp4.url; }
      if (s?.jpg?.url) { mainUrl = mainUrl || s.jpg.url; }
    }

    const smSizes = [file.sm, file.md, file.xs, file.hd].filter(Boolean);
    for (const s of smSizes) {
      if (s?.webp?.url) { previewUrl = previewUrl || s.webp.url; }
      if (s?.gif?.url) { previewUrl = previewUrl || s.gif.url; }
      if (s?.png?.url) { previewUrl = previewUrl || s.png.url; }
      if (s?.jpg?.url) { previewUrl = previewUrl || s.jpg.url; }
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
    if (activeTab === 'stickers') mediaType = 'sticker';
    else if (activeTab === 'memes') mediaType = 'meme';
    else if (activeTab === 'clips') mediaType = 'clip';

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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 100000,
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
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                borderRadius: '8px',
                padding: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}>
                <Sparkles size={16} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
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
                color: 'var(--text-primary, #fff)',
                fontSize: '0.88rem',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setPage(1);
                  fetchMedia(activeTab, '', 1, false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
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

        {/* Grid Content */}
        <div
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1rem 1rem',
            display: 'grid',
            gridTemplateColumns: activeTab === 'clips' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: '0.5rem',
            alignContent: 'start'
          }}
        >
          {items.map((item, idx) => {
            const { mainUrl, previewUrl } = extractMediaUrls(item);
            if (!mainUrl && !previewUrl) return null;

            const isClip = activeTab === 'clips' || (item.file?.hd?.mp4?.url || item.file?.md?.mp4?.url);

            return (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => handleSelect(item)}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  aspectRatio: activeTab === 'stickers' ? '1 / 1' : activeTab === 'clips' ? '16 / 9' : '4 / 3',
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
                {isClip && item.file?.md?.mp4?.url ? (
                  <video
                    src={item.file.md.mp4.url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={previewUrl || mainUrl}
                    alt={item.title || 'media'}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: activeTab === 'stickers' ? 'contain' : 'cover',
                      display: 'block'
                    }}
                  />
                )}
              </div>
            );
          })}

          {items.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {language === 'es' ? 'No se encontraron resultados en KLIPY' : 'No results found on KLIPY'}
              </p>
            </div>
          )}

          {loading && (
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
    </div>
  );
};

export default KlipyPicker;
