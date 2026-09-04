import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { AdBanner } from '../components/AdBanner';
import { ReplaceFavoriteModal } from '../components/ReplaceFavoriteModal';
import { ProModal } from '../components/ProModal';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronsDown, Check, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrderedCategories, getCategoryLabel } from '../utils/categoryOrder';

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

// --- Helper Components ---

const getSavedMode = (key?: string): 'one-row' | 'two-rows' | 'collapsed' => {
  if (!key || typeof window === 'undefined') return 'one-row';
  try {
    const saved = localStorage.getItem(`home_scroll_mode_${key}`);
    if (saved === 'one-row' || saved === 'two-rows' || saved === 'collapsed') {
      return saved;
    }
  } catch (e) {
    // ignore
  }
  return 'one-row';
};

const saveMode = (key?: string, mode?: string) => {
  if (!key || !mode || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`home_scroll_mode_${key}`, mode);
  } catch (e) {
    // ignore
  }
};

const ScrollRow = ({ 
  children, 
  title, 
  outlineColor, 
  headerExtra,
  itemCount,
  storageKey
}: { 
  children: React.ReactNode, 
  title?: string, 
  outlineColor?: string, 
  headerExtra?: React.ReactNode,
  itemCount?: number,
  storageKey?: string
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowMode, setRowMode] = useState<'one-row' | 'two-rows' | 'collapsed'>(() => getSavedMode(storageKey));

  useEffect(() => {
    setRowMode(getSavedMode(storageKey));
  }, [storageKey]);

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1200;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  const actualItemCount = itemCount !== undefined ? itemCount : React.Children.count(children);
  // Available width accounting for 45px padding on each side (90px total)
  // Each card is 180px wide with a 16px (1rem) gap
  const availableWidth = Math.max(0, containerWidth - 90);
  const maxVisibleInOneRow = Math.max(1, Math.floor((availableWidth + 16) / 196));
  const canExpandMore = actualItemCount > maxVisibleInOneRow;

  // Use effectiveRowMode so loading states or temporary resize don't destroy user preference
  const effectiveRowMode = (rowMode === 'two-rows' && !canExpandMore) ? 'one-row' : rowMode;

  const isTwoRows = effectiveRowMode === 'two-rows';
  const isTwoRowsByColumn = isTwoRows && actualItemCount > 2 * maxVisibleInOneRow;
  const isTwoRowsByRow = isTwoRows && actualItemCount <= 2 * maxVisibleInOneRow;

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const timer = setTimeout(updateScrollState, 50);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, effectiveRowMode, children]);

  const getMaskImage = () => {
    if (canScrollLeft && canScrollRight) {
      return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
    } else if (canScrollLeft) {
      return 'linear-gradient(to right, transparent 0px, transparent 45px, black 95px, black 100%)';
    } else if (canScrollRight) {
      return 'linear-gradient(to right, black 0px, black calc(100% - 95px), transparent calc(100% - 45px), transparent 100%)';
    }
    return 'none';
  };

  const handleToggle = () => {
    setRowMode(current => {
      let next: 'one-row' | 'two-rows' | 'collapsed';
      if (current === 'one-row') {
        next = canExpandMore ? 'two-rows' : 'collapsed';
      } else if (current === 'two-rows') {
        next = 'collapsed';
      } else {
        next = 'one-row';
      }
      saveMode(storageKey, next);
      return next;
    });
  };

  const getTooltip = () => {
    if (effectiveRowMode === 'one-row') {
      return canExpandMore ? 'Expandir a 2 filas' : 'Ocultar categoría';
    } else if (effectiveRowMode === 'two-rows') {
      return 'Ocultar categoría';
    } else {
      return 'Mostrar categoría';
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = effectiveRowMode === 'two-rows' ? 360 : 300;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const catColor = outlineColor || "var(--accent-primary)";
  const buttonBaseStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    background: "var(--bg-tertiary)",
    border: "1.5px solid var(--border-color)",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    color: "var(--text-primary)",
    transition: "border-color 0.15s ease, background 0.1s ease, color 0.1s ease, transform 0.1s ease, opacity 0.2s ease, visibility 0.2s ease"
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = catColor;
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = "var(--border-color)";
    e.currentTarget.style.background = "var(--bg-tertiary)";
    e.currentTarget.style.color = "var(--text-primary)";
  };
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = catColor;
    e.currentTarget.style.borderColor = catColor;
    e.currentTarget.style.color = "var(--bg-primary)";
  };
  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "var(--bg-tertiary)";
    e.currentTarget.style.borderColor = catColor;
    e.currentTarget.style.color = "var(--text-primary)";
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {title && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "45px", paddingRight: "45px", marginBottom: effectiveRowMode === 'collapsed' ? "0.5rem" : "1rem" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleToggle}
              title={getTooltip()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "1.2rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                border: `2px solid ${outlineColor || "var(--border-color)"}`,
                borderRadius: "8px",
                padding: "0.2rem 0.75rem",
                background: "var(--bg-secondary)",
                margin: 0,
                cursor: "pointer",
                transition: "border-color 0.15s ease, transform 0.15s ease",
                outline: "none"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
              }}
            >
              <span>{title}</span>
              <span style={{ display: "inline-flex", alignItems: "center", color: outlineColor || "var(--accent-primary)" }}>
                {effectiveRowMode === 'collapsed' ? (
                  <ChevronRight size={18} />
                ) : effectiveRowMode === 'two-rows' ? (
                  <ChevronsDown size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </span>
            </button>
          </div>
          {headerExtra && effectiveRowMode !== 'collapsed' && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {headerExtra}
            </div>
          )}
        </div>
      )}
      {effectiveRowMode !== 'collapsed' && (
        <div style={{ position: "relative" }}>
          <button 
            onClick={() => scroll("left")}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            style={{ 
              ...buttonBaseStyle, 
              left: "0px",
              opacity: canScrollLeft ? 1 : 0,
              visibility: canScrollLeft ? "visible" : "hidden",
              pointerEvents: canScrollLeft ? "auto" : "none"
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} color="currentColor" />
          </button>
          
          <div 
            ref={scrollRef} 
            style={{ 
              display: isTwoRows ? "grid" : "flex",
              gridTemplateColumns: isTwoRowsByRow ? `repeat(${maxVisibleInOneRow}, max-content)` : undefined,
              gridTemplateRows: isTwoRows ? "repeat(2, auto)" : undefined,
              gridAutoFlow: isTwoRows ? (isTwoRowsByColumn ? "column" : "row") : undefined,
              gridAutoColumns: isTwoRowsByColumn ? "max-content" : undefined,
              justifyContent: "start",
              alignContent: "start",
              gap: "1rem", 
              overflowX: "auto", 
              scrollbarWidth: "none", 
              msOverflowStyle: "none", 
              paddingTop: "8px", 
              paddingBottom: "1rem", 
              paddingLeft: "45px", 
              paddingRight: "45px",
              WebkitMaskImage: getMaskImage(),
              maskImage: getMaskImage()
            }}
          >
            {children}
          </div>

          <button 
            onClick={() => scroll("right")}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            style={{ 
              ...buttonBaseStyle, 
              right: "0px",
              opacity: canScrollRight ? 1 : 0,
              visibility: canScrollRight ? "visible" : "hidden",
              pointerEvents: canScrollRight ? "auto" : "none"
            }}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  );
};

const CustomCard = ({ 
  title, 
  coverUrl, 
  subtitle1, 
  subtitle2, 
  preSubtitle,
  coverTopText,
  coverBottomText,
  onCheck, 
  onClick, 
  onTitleClick,
  language,
  themeColor,
  themeTextColor,
  actionIcon = 'check'
}: { 
  title: string; 
  coverUrl?: string; 
  subtitle1?: string; 
  subtitle2?: string; 
  preSubtitle?: string;
  coverTopText?: string;
  coverBottomText?: string;
  onCheck?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onTitleClick?: (e: React.MouseEvent) => void;
  language?: string;
  themeColor?: string;
  themeTextColor?: string;
  actionIcon?: 'check' | 'play';
}) => {
  return (
    <div 
      onClick={onClick}
      style={{ 
        minWidth: "180px", maxWidth: "180px", background: "var(--bg-secondary)", 
        border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none",
        "--title-hover-color": themeColor
      } as React.CSSProperties}
      className="activity-card"
    >
      <div 
        onClick={onTitleClick ? (e) => { e.stopPropagation(); onTitleClick(e); } : undefined}
        className={onTitleClick ? "card-series-title" : "card-item-title"}
        style={{ 
          padding: "0.5rem 0.75rem", 
          fontSize: "0.85rem", 
          fontWeight: 600, 
          borderBottom: "1px solid var(--border-color)", 
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          cursor: onTitleClick ? "pointer" : "inherit",
          display: onTitleClick ? "flex" : "block",
          alignItems: "center",
          justifyContent: "space-between"
        }}
        title={title}
      >
        {onTitleClick ? (
          <>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: "0.25rem", opacity: 0.7 }} />
          </>
        ) : (
          title
        )}
      </div>
      <div style={{ width: "100%", height: "240px", background: "var(--bg-tertiary)", position: "relative" }}>
        {coverUrl ? (
          <img src={coverUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>?</div>
        )}
        {coverTopText && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "0.5rem", background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {coverTopText}
          </div>
        )}
        {coverBottomText && (
          <div className={getTagClass(coverBottomText.toLowerCase())} style={{ position: "absolute", bottom: "0.25rem", left: "0.5rem", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.85, backdropFilter: 'blur(4px)' }}>
            {(() => {
              if (language === 'es') {
                const map: any = { "movie": "Película", "series": "Serie", "anime": "Anime", "game": "Juego", "book": "Libro", "comic": "Cómic", "manga": "Manga", "guide": "Guía", "user": "Usuario" };
                return map[coverBottomText.toLowerCase()] || coverBottomText;
              } else {
                const map: any = { "movie": "Movie", "series": "Series", "anime": "Anime", "game": "Game", "book": "Book", "comic": "Comic", "manga": "Manga", "guide": "Guide", "user": "User" };
                return map[coverBottomText.toLowerCase()] || coverBottomText;
              }
            })()}
          </div>
        )}
      </div>
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minHeight: "2.5rem", paddingRight: onCheck ? "40px" : "0.75rem" }}>
        {preSubtitle && <div style={{ fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: 800, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preSubtitle}</div>}
        {subtitle1 && <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>{subtitle1}</div>}
        {subtitle2 && <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{subtitle2}</div>}
      </div>
      {onCheck && (
        <button 
          onClick={onCheck}
          className="btn-check-seen"
          style={{
            position: "absolute", bottom: "0.5rem", right: "0.5rem",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "var(--bg-tertiary)", border: `2px solid ${themeColor || "var(--text-muted)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: themeColor || "var(--text-primary)",
            "--btn-hover-bg": themeColor,
            "--btn-hover-text": themeTextColor
          } as React.CSSProperties}
        >
          {actionIcon === 'play' ? <Play size={15} style={{ marginLeft: '2px' }} /> : <Check size={16} />}
        </button>
      )}
    </div>
  );
};

const ActiveSeriesCard = ({ item, onUpdate, language, onOpenSeries, themeColor, themeTextColor, actionIcon = 'check' }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void, themeColor?: string, themeTextColor?: string, actionIcon?: 'check' | 'play' }) => {
  const [nextEp, setNextEp] = useState<any>(null);
  const [trackedEpisodes, setTrackedEpisodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const pad = (n: number) => n < 10 ? '0' + n : n;

  const fetchNextEpisode = async () => {
    if (!item.tracking_list_id) {
      setIsLoading(false);
      setIsInitialLoad(false);
      return;
    }
    setIsLoading(true);
    try {
      let currentTracked: any[] = [];
      try {
        const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
        currentTracked = listRes.data.items || [];
        setTrackedEpisodes(currentTracked);
        setCachedSeries(`list_${item.tracking_list_id}`, currentTracked);
      } catch (err) {
        console.error("Failed to load tracking list for Home card", err);
      }

      const parseEpInfo = (ep: any): { season: number; episode: number } => {
        const match = (ep.title || '').match(/S(\d+)E(\d+)/i);
        if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
        return { season: ep.season_number || 0, episode: ep.episode_number || 0 };
      };

      let filteredSeasons: any[] = [];
      const cacheKey = `series_${item.external_id}`;
      const cached = getCachedSeries(cacheKey);
      if (cached && cached.seasons) {
        filteredSeasons = cached.seasons;
      } else {
        const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
        filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
        setCachedSeries(cacheKey, { ...seriesRes.data, seasons: filteredSeasons });
      }

      if (filteredSeasons.length === 0) {
        setIsInitialLoad(false);
        return;
      }

      const cacheKeyAll = `${item.external_id}_all_episodes`;
      let allEps = getCachedSeries(cacheKeyAll);
      if (!allEps || !Array.isArray(allEps) || allEps.length === 0) {
        try {
          const res = await apiClient.get(`/search/series/${item.external_id}/episodes`);
          allEps = res.data;
          setCachedSeries(cacheKeyAll, allEps);
        } catch (e) {
          allEps = [];
        }
      }

      // Helper to check if an episode has aired
      const isEpAired = (ep: any) => {
        if (ep.airstamp) {
          return new Date(ep.airstamp).getTime() <= Date.now();
        } else if (ep.airdate || ep.air_date) {
          const ad = ep.airdate || ep.air_date;
          const at = ep.airtime || '00:00';
          return new Date(`${ad}T${at}:00Z`).getTime() <= Date.now();
        }
        return true;
      };

      // Find the target episode to watch next (supports rewatch / repeat consumption)
      let targetEp = null;
      let targetCycle = 1;
      if (allEps && Array.isArray(allEps) && allEps.length > 0) {
        const sortedAllEps = [...allEps].sort((a: any, b: any) => 
          a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
        );

        // Filter only AIRED episodes for active viewing progression
        const airedEps = sortedAllEps.filter(isEpAired);

        // Helper to get tracked item for an episode
        const getTracked = (ep: any) => {
          return currentTracked.find((t: any) => 
            (t.external_id === `tvm-ep-${ep.id}` || t.id === ep.id || (t.title && t.title.includes(`S${pad(ep.season_number)}E${pad(ep.episode_number)}`)) || (t.title && t.title.includes(`E${pad(ep.episode_number)}`) && (t.section === `Season ${ep.season_number}` || t.title.includes(`S${ep.season_number}`))))
          );
        };

        if (airedEps.length > 0) {
          const airedCounts = airedEps.map((ep: any) => {
            const t = getTracked(ep);
            return (t?.consumption_count !== undefined) ? t.consumption_count : (t?.is_completed ? 1 : 0);
          });

          const minAiredSeen = Math.min(...airedCounts);
          const maxAiredSeen = Math.max(...airedCounts);

          if (minAiredSeen === maxAiredSeen && minAiredSeen > 0) {
            // All currently aired episodes are already watched up to minAiredSeen!
            // The user is fully caught up with the series so it shouldn't show in Continuar.
            targetEp = null;
          } else {
            // If the user has started a new viewing run (maxAiredSeen > minAiredSeen and maxAiredSeen > 1),
            // find the last episode watched in this current highest cycle (e.g. S01E03 [x2]),
            // and propose the next aired episode immediately following it (S01E04)!
            if (maxAiredSeen > minAiredSeen && maxAiredSeen > 1) {
              // Find index of the highest episode with count === maxAiredSeen
              let highestIdx = -1;
              for (let idx = airedEps.length - 1; idx >= 0; idx--) {
                if (airedCounts[idx] === maxAiredSeen) {
                  highestIdx = idx;
                  break;
                }
              }
              if (highestIdx !== -1 && highestIdx + 1 < airedEps.length) {
                targetEp = airedEps[highestIdx + 1];
              } else if (highestIdx !== -1 && highestIdx + 1 >= airedEps.length) {
                // Completed the run up to current aired
                targetEp = null;
              }
            }

            if (!targetEp) {
              // Standard progression: find first episode with count < maxAiredSeen (or minAiredSeen + 1)
              targetCycle = minAiredSeen + 1;
              targetEp = airedEps.find((ep: any) => {
                const t = getTracked(ep);
                const count = (t?.consumption_count !== undefined) ? t.consumption_count : (t?.is_completed ? 1 : 0);
                return count < targetCycle;
              });
            }
          }
        }
      }

      // Check if targetEp has actually aired yet
      if (targetEp) {
        let isAired = true;
        if (targetEp.airstamp) {
          isAired = new Date(targetEp.airstamp).getTime() <= Date.now();
        } else if (targetEp.airdate || targetEp.air_date) {
          const ad = targetEp.airdate || targetEp.air_date;
          const at = targetEp.airtime || '00:00';
          const epAirTime = new Date(`${ad}T${at}:00Z`).getTime();
          isAired = epAirTime <= Date.now();
        }

        if (!isAired) {
          // Series is up to date with currently aired episodes (not ended)
          // Keep in watching / continue tab, do not mark as completed
          setNextEp(null);
          return;
        }

        setNextEp(targetEp);
      } else {
        // No uncompleted episodes found in the entire episode list for this cycle.
        // Check if show status is ended/finished before marking completed
        const hasWatchedAny = currentTracked.some((t: any) => t.is_completed);
        const seriesData = getCachedSeries(`series_${item.external_id}`);
        const showStatus = (seriesData?.status || '').toLowerCase();
        const isEnded = showStatus === 'ended' || showStatus === 'finished' || showStatus === 'canceled';

        if (item.status !== 'completed' && hasWatchedAny && (isEnded || !seriesData)) {
          item.status = 'completed';
          await apiClient.put(`/library/${item.id}`, { status: 'completed' });
          onUpdate();
        }
        setNextEp(null);
      }
    } catch (e) {
      console.error("Failed to load next episode for card", e);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchNextEpisode();
  }, [item]);

  const handleMarkSeen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextEp) return;

    const currentEpToMark = nextEp;

    // ⚡ INSTANT OPTIMISTIC UI: Compute and transition to the next episode in 0ms
    const cacheKeyAll = `${item.external_id}_all_episodes`;
    const allEps = getCachedSeries(cacheKeyAll);
    let nextCandidate: any = null;

    if (allEps && Array.isArray(allEps)) {
      const sortedAllEps = [...allEps].sort((a: any, b: any) => 
        a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
      );
      const currentIndex = sortedAllEps.findIndex((ep: any) => ep.id === currentEpToMark.id);
      if (currentIndex !== -1 && currentIndex + 1 < sortedAllEps.length) {
        const candidate = sortedAllEps[currentIndex + 1];
        let isAired = true;
        if (candidate.airstamp) {
          isAired = new Date(candidate.airstamp).getTime() <= Date.now();
        } else if (candidate.airdate || candidate.air_date) {
          const ad = candidate.airdate || candidate.air_date;
          const at = candidate.airtime || '00:00';
          isAired = new Date(`${ad}T${at}:00Z`).getTime() <= Date.now();
        }
        if (isAired) {
          nextCandidate = candidate;
        }
      }
    }

    // Immediately show next episode so user can keep clicking without any delay
    setNextEp(nextCandidate);

    // Check if this episode was already completed before in a previous run (rewatch mode)
    let url = `/lists/${item.tracking_list_id}/toggle-series-episode`;
    try {
      // Determine if action=mark_again is needed
      const isAlreadyCompleted = trackedEpisodes.some((t: any) => 
        (t.external_id === `tvm-ep-${currentEpToMark.id}` || t.id === currentEpToMark.id || (t.title && t.title.includes(`S${pad(currentEpToMark.season_number)}E${pad(currentEpToMark.episode_number)}`))) && t.is_completed
      );
      if (isAlreadyCompleted) {
        url += `?action=mark_again`;
      }
    } catch (err) {}

    // Non-blocking background sync
    apiClient.post(url, {
      episode_id: currentEpToMark.id,
      title: currentEpToMark.title || `${item.title} - S${pad(currentEpToMark.season_number)}E${pad(currentEpToMark.episode_number)} - ${currentEpToMark.name || 'Untitled'}`,
      image_url: currentEpToMark.still_path || null,
      overview: currentEpToMark.overview,
      season_number: currentEpToMark.season_number,
      episode_number: currentEpToMark.episode_number
    }).then(async () => {
      // If the series was in 'plan_to_watch', move it to 'watching'
      if (item.status === 'plan_to_watch') {
        try {
          await apiClient.put(`/library/${item.id}`, { status: 'watching' });
          onUpdate();
        } catch (e) {}
      }

      // If there are no more episodes in this cycle, mark series as completed
      if (!nextCandidate) {
        try {
          await apiClient.put(`/library/${item.id}`, { status: 'completed' });
          onUpdate();
        } catch (e) {}
      }
    }).catch(err => {
      console.error("Failed to mark episode in background", err);
      fetchNextEpisode();
    });
  };

  const handleCardClick = () => {
    if (nextEp) {
      onOpenSeries({
        id: nextEp.id,
        rawEpisodeId: nextEp.id,
        list_id: item.tracking_list_id,
        tracking_list_id: item.tracking_list_id,
        item_type: 'episode',
        title: `${item.title} - S${pad(nextEp.season_number)}E${pad(nextEp.episode_number)} - ${nextEp.name || 'Untitled'}`,
        episode_name: nextEp.name || `Episode ${nextEp.episode_number}`,
        season_number: nextEp.season_number,
        episode_number: nextEp.episode_number,
        external_id: `tvm-ep-${nextEp.id}`,
        image_url: nextEp.still_path || nextEp.image?.original || nextEp.image?.medium || item.image_url,
        custom_notes: JSON.stringify({ description: nextEp.overview || '', release_date: nextEp.air_date || nextEp.airdate || null }),
        release_date: nextEp.air_date || nextEp.airdate || null,
        is_completed: false,
        parent_series: item
      });
    } else {
      onOpenSeries(item);
    }
  };

  const getCoverUrl = () => {
    if (nextEp?.still_path) {
      return nextEp.still_path;
    }
    return item.image_url;
  };
  const coverUrl = getCoverUrl();

  let seasonText = '';
  let epName = '';
  if (nextEp) {
    const sStr = pad(nextEp.season_number);
    const eStr = pad(nextEp.episode_number);
    seasonText = language === 'es' ? `T${sStr} | E${eStr}` : `S${sStr} | E${eStr}`;
    epName = nextEp.name || (language === 'es' ? 'Episodio' : 'Episode');
  }

  if (!isInitialLoad && !nextEp) {
    return null;
  }

  return (
    <>
      <div 
        onClick={handleCardClick}
        style={{ 
          minWidth: "220px", maxWidth: "220px", background: "var(--bg-secondary)", 
          border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
          overflow: "hidden", cursor: "pointer", position: "relative",
          display: "flex", flexDirection: "column",
          boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none",
          "--title-hover-color": themeColor
        } as React.CSSProperties}
        className="activity-card"
      >
        <div 
          onClick={(e) => { e.stopPropagation(); onOpenSeries(item); }}
          className="card-series-title"
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
          <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: "0.25rem", opacity: 0.7 }} />
        </div>
        
        <div style={{ width: "100%", height: "125px", background: "var(--bg-tertiary)", position: "relative" }}>
          {coverUrl ? (
            <img src={coverUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>?</div>
          )}
        </div>
        
        <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
          {isInitialLoad ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "auto", marginBottom: "auto" }}>
              <div style={{ width: "65px", height: "14px", borderRadius: "4px", background: "var(--bg-tertiary)", animation: "pulse 1.5s infinite" }} />
              <div style={{ width: "110px", height: "11px", borderRadius: "4px", background: "var(--bg-tertiary)", opacity: 0.6, animation: "pulse 1.5s infinite" }} />
            </div>
          ) : seasonText ? (
            <>
              <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>{seasonText}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: "36px" }}>{epName}</div>
            </>
          ) : (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "auto", marginBottom: "auto" }}>
              {language === 'es' ? 'Al día' : 'Up to date'}
            </div>
          )}
        </div>
        
        {nextEp && !isInitialLoad && (
          <button 
            onClick={handleMarkSeen}
            disabled={isLoading}
            className="btn-check-seen"
            style={{
              position: "absolute", bottom: "0.5rem", right: "0.5rem",
              width: "32px", height: "32px", borderRadius: "50%",
              background: "var(--bg-tertiary)", border: `2px solid ${themeColor || "var(--text-muted)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isLoading ? "wait" : "pointer", color: themeColor || "var(--text-primary)",
              opacity: isLoading ? 0.6 : 1,
              "--btn-hover-bg": themeColor,
              "--btn-hover-text": themeTextColor
            } as React.CSSProperties}
          >
            {actionIcon === 'play' ? <Play size={15} style={{ marginLeft: '2px' }} /> : <Check size={16} />}
          </button>
        )}
      </div>
    </>
  );
};

const CompletedSeriesCard = ({ item, onUpdate, language, onOpenSeries, themeColor, themeTextColor }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void, themeColor?: string, themeTextColor?: string }) => {
  const [seriesTotals, setSeriesTotals] = useState<{ seasons: number; episodes: number } | null>(null);

  const pad = (n: number) => n < 10 ? '0' + n : n;

  useEffect(() => {
    let isMounted = true;
    const fetchSeriesTotals = async () => {
      try {
        const cacheKey = `series_${item.external_id}`;
        let seasonsCount = 0;
        let cached = getCachedSeries(cacheKey);
        if (cached && cached.seasons) {
          seasonsCount = cached.seasons.filter((s: any) => s.season_number > 0).length;
        } else {
          try {
            const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
            const filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
            seasonsCount = filteredSeasons.length;
            setCachedSeries(cacheKey, { ...seriesRes.data, seasons: filteredSeasons });
          } catch (e) {}
        }

        const cacheKeyAll = `${item.external_id}_all_episodes`;
        let allEps = getCachedSeries(cacheKeyAll);
        if (!allEps) {
          try {
            const epRes = await apiClient.get(`/search/series/${item.external_id}/episodes`);
            allEps = epRes.data;
            setCachedSeries(cacheKeyAll, allEps);
          } catch (e) {
            allEps = null;
          }
        }

        const totalEps = Array.isArray(allEps) ? allEps.length : 0;
        if (seasonsCount === 0 && Array.isArray(allEps) && allEps.length > 0) {
          const uniqueSeasons = new Set(allEps.map((ep: any) => ep.season_number).filter((s: any) => s > 0));
          seasonsCount = uniqueSeasons.size || 1;
        }

        if (isMounted) {
          setSeriesTotals({
            seasons: seasonsCount || 1,
            episodes: totalEps
          });
        }
      } catch (e) {
        console.error("Failed to load series totals for completed card", e);
      }
    };
    fetchSeriesTotals();
    return () => { isMounted = false; };
  }, [item, language]);

  const seasonsLabel = seriesTotals 
    ? (language === 'es' 
        ? `${seriesTotals.seasons} ${seriesTotals.seasons === 1 ? 'temporada' : 'temporadas'}` 
        : `${seriesTotals.seasons} ${seriesTotals.seasons === 1 ? 'season' : 'seasons'}`) 
    : '';
  const episodesLabel = seriesTotals 
    ? (language === 'es' 
        ? `${seriesTotals.episodes} ${seriesTotals.episodes === 1 ? 'episodio' : 'episodios'}` 
        : `${seriesTotals.episodes} ${seriesTotals.episodes === 1 ? 'episode' : 'episodes'}`) 
    : '';

  return (
    <div 
      onClick={() => onOpenSeries(item)}
      style={{ 
        minWidth: "180px", maxWidth: "180px", background: "var(--bg-secondary)", 
        border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none",
        "--title-hover-color": themeColor
      } as React.CSSProperties}
      className="activity-card"
    >
      <div 
        className="card-item-title"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={item.title}
      >
        {item.title}
      </div>

      <div style={{ width: "100%", height: "240px", background: "var(--bg-tertiary)", position: "relative" }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>?</div>
        )}
      </div>
      
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1, minHeight: "2.5rem", justifyContent: "center" }}>
        {seriesTotals ? (
          <>
            <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>
              {seasonsLabel}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              {episodesLabel}
            </div>
          </>
        ) : (
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            ...
          </div>
        )}
      </div>
    </div>
  );
};

const DroppedSeriesCard = ({ item, onUpdate, language, onOpenSeries, themeColor, themeTextColor }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void, themeColor?: string, themeTextColor?: string }) => {
  const [lastEpInfo, setLastEpInfo] = useState<{ seasonText: string; epName: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pad = (n: number) => n < 10 ? '0' + n : n;

  useEffect(() => {
    let isMounted = true;
    const fetchLastCompleted = async () => {
      if (!item.tracking_list_id) return;
      try {
        const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
        const trackedEpisodes = listRes.data.items || [];
        const parseEpInfo = (ep: any): { season: number; episode: number } => {
          const match = (ep.title || '').match(/S(\d+)E(\d+)/i);
          if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
          return { season: ep.season_number || 0, episode: ep.episode_number || 0 };
        };

        const completed = trackedEpisodes
          .filter((e: any) => e.is_completed)
          .map((e: any) => ({ ...e, ...parseEpInfo(e) }))
          .sort((a: any, b: any) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);

        if (completed.length > 0) {
          const last = completed[completed.length - 1];
          const sStr = pad(last.season);
          const eStr = pad(last.episode);
          const seasonText = language === 'es' ? `T${sStr} | E${eStr}` : `S${sStr} | E${eStr}`;
          
          let epName = '';
          const match = (last.title || '').match(/^(.*?)\s*-\s*S\d+E\d+\s*-\s*(.*)$/i);
          if (match) {
            epName = match[2].trim();
          } else {
            epName = last.title || (language === 'es' ? 'Episodio' : 'Episode');
          }
          if (isMounted) setLastEpInfo({ seasonText, epName });
        } else if (item.last_seen_episode) {
          const match = item.last_seen_episode.match(/S(\d+)E(\d+)/i);
          if (match) {
            const seasonText = language === 'es' ? `T${match[1]} | E${match[2]}` : `S${match[1]} | E${match[2]}`;
            const nameMatch = item.last_seen_episode.match(/-\s*([^-]+)$/);
            const epName = nameMatch ? nameMatch[1].trim() : '';
            if (isMounted) setLastEpInfo({ seasonText, epName });
          }
        }
      } catch (e) {
        console.error("Failed to load last completed episode for dropped card", e);
      }
    };
    fetchLastCompleted();
    return () => { isMounted = false; };
  }, [item, language]);

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await apiClient.put(`/library/${item.id}`, { status: 'watching' });
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={() => onOpenSeries(item)}
      style={{ 
        minWidth: "180px", maxWidth: "180px", background: "var(--bg-secondary)", 
        border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none",
        "--title-hover-color": themeColor
      } as React.CSSProperties}
      className="activity-card"
    >
      <div 
        className="card-item-title"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={item.title}
      >
        {item.title}
      </div>

      <div style={{ width: "100%", height: "240px", background: "var(--bg-tertiary)", position: "relative" }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>?</div>
        )}
      </div>
      
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minHeight: "2.5rem", paddingRight: "40px" }}>
        {lastEpInfo ? (
          <>
            <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{lastEpInfo.seasonText}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lastEpInfo.epName}</div>
          </>
        ) : (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
            {language === 'es' ? 'Sin capítulos vistos' : 'No watched episodes'}
          </div>
        )}
      </div>
      
      <button 
        onClick={handleResume}
        disabled={isLoading}
        className="btn-check-seen"
        title={language === 'es' ? 'Reanudar en Continuar' : 'Resume in Continue'}
        style={{
          position: "absolute", bottom: "0.5rem", right: "0.5rem",
          width: "32px", height: "32px", borderRadius: "50%",
          background: "var(--bg-tertiary)", border: `2px solid ${themeColor || "var(--text-muted)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isLoading ? "wait" : "pointer", color: themeColor || "var(--text-primary)",
          opacity: isLoading ? 0.5 : 1,
          "--btn-hover-bg": themeColor,
          "--btn-hover-text": themeTextColor
        } as React.CSSProperties}
      >
        <Play size={15} style={{ marginLeft: '2px' }} />
      </button>
    </div>
  );
};

const ActiveItemCard = ({ item, onUpdate, language, onOpenItem, themeColor, themeTextColor }: { item: any, onUpdate: () => void, language: string, onOpenItem: (item: any) => void, themeColor?: string, themeTextColor?: string }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkSeen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await apiClient.put(`/library/${item.id}`, { status: ['book', 'comic', 'manga'].includes(item.item_type) ? 'read' : 'completed' });
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCardClick = () => {
    onOpenItem(item);
  };

  const itemThemeColor = themeColor || (item ? `var(--color-${item.item_type})` : undefined);

  return (
    <div 
      onClick={handleCardClick}
      style={{ 
        minWidth: "220px", maxWidth: "220px", background: "var(--bg-secondary)", 
        border: `1px solid ${itemThemeColor || "var(--border-color)"}`, borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        boxShadow: itemThemeColor ? `0 0 10px ${itemThemeColor}33` : "none",
        "--title-hover-color": itemThemeColor
      } as React.CSSProperties}
      className="activity-card"
    >
      <div 
        onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}
        className="card-item-title"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
        <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: "0.25rem", opacity: 0.7 }} />
      </div>

      <div style={{ width: "100%", height: "125px", background: "var(--bg-tertiary)", position: "relative" }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>?</div>
        )}
        
        <div className={getTagClass(item.item_type)} style={{ position: "absolute", bottom: "0.25rem", left: "0.5rem", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.85, backdropFilter: 'blur(4px)' }}>
          {(() => {
            if (language === 'es') {
              const map: any = { "movie": "Película", "series": "Serie", "anime": "Anime", "game": "Juego", "book": "Libro", "comic": "Cómic", "manga": "Manga", "guide": "Guía", "user": "Usuario" };
              return map[item.item_type.toLowerCase()] || item.item_type;
            } else {
              const map: any = { "movie": "Movie", "series": "Series", "anime": "Anime", "game": "Game", "book": "Book", "comic": "Comic", "manga": "Manga", "guide": "Guide", "user": "User" };
              return map[item.item_type.toLowerCase()] || item.item_type;
            }
          })()}
        </div>
      </div>
      
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "auto", marginBottom: "auto", minHeight: "1.2em", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <span>
          {(() => {
            if (item.status === 'endless') return language === 'es' ? 'Infinito' : 'Endless';
            if (item.status === 'completed' || item.status === 'read') {
                if (['book', 'comic', 'manga'].includes(item.item_type)) return item.total_pages ? `${item.total_pages} ${language === 'es' ? 'páginas' : 'pages'}` : '\u00A0';
                if (item.item_type === 'movie') return item.total_pages ? `${item.total_pages} min` : '\u00A0';
                if (item.item_type === 'game') return item.pages_read > 0 ? `${Math.floor(item.pages_read / 60)}h ${String(item.pages_read % 60).padStart(2, '0')}m` : (language === 'es' ? 'Terminado' : 'Completed');
                return language === 'es' ? 'Visto' : 'Watched';
            }
            if (['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status)) {
                if (['book', 'comic', 'manga'].includes(item.item_type)) return item.total_pages ? `${item.total_pages} ${language === 'es' ? 'páginas' : 'pages'}` : '\u00A0';
                if (item.item_type === 'movie' && item.total_pages) return `${item.total_pages} min`;
                return language === 'es' ? (item.item_type === 'game' ? 'Por jugar' : 'Por ver') : 'Plan to';
            }
            if (item.item_type === 'game') return language === 'es' ? 'Jugando' : 'Playing';
            if (['book', 'comic', 'manga'].includes(item.item_type)) return language === 'es' ? 'Leyendo' : 'Reading';
            return language === 'es' ? 'En pausa' : 'Paused';
          })()}
          </span>
          {(() => {
              if (item.status === 'endless' && item.item_type === 'game' && item.pages_read > 0) {
                  return <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>{Math.floor(item.pages_read / 60)}h {String(item.pages_read % 60).padStart(2, '0')}m</span>;
              }
              if (item.pages_read > 0 && !['completed', 'read', 'endless', 'plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status)) {
                  if (item.item_type === 'game') {
                      return <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>{Math.floor(item.pages_read / 60)}h {String(item.pages_read % 60).padStart(2, '0')}m</span>;
                  }
                  if (['book', 'comic', 'manga'].includes(item.item_type)) {
                      return <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>{item.pages_read} {language === 'es' ? 'páginas' : 'pages'}</span>;
                  }
              }
              return null;
          })()}
        </div>
      </div>
      
      <button 
          onClick={handleMarkSeen}
          disabled={isLoading}
          className="btn-check-seen"
          style={{
            position: "absolute", bottom: "0.5rem", right: "0.5rem",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "var(--bg-tertiary)", border: `2px solid ${themeColor || "var(--text-muted)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: isLoading ? "wait" : "pointer", color: themeColor || "var(--text-primary)",
            opacity: isLoading ? 0.5 : 1,
            "--btn-hover-bg": themeColor,
            "--btn-hover-text": themeTextColor
          } as React.CSSProperties}
        >
          <Check size={16} />
        </button>
    </div>
  );
};

// --- Main Component ---

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"watching" | "guides" | "plan_to_watch" | "completed" | "dropped" | "upcoming">("watching");
  
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [upNextGuides, setUpNextGuides] = useState<any[]>([]);
  const [guideUpdates, setGuideUpdates] = useState<any[]>([]);
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState<"playing" | "endless">("playing");
  const [upcomingFilter, setUpcomingFilter] = useState<"calendar" | "tba">("calendar");

  // Replace Favorite Modal State & Pro Modal
  const [replaceModalState, setReplaceModalState] = useState<{
    isOpen: boolean;
    newItem: any | null;
    currentFavorites: any[];
  }>({
    isOpen: false,
    newItem: null,
    currentFavorites: []
  });
  const [showProModal, setShowProModal] = useState(false);

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      // 1. Fetch library items and secondary feeds in parallel for maximum speed
      const [libRes, upNextRes, updatesRes] = await Promise.allSettled([
        apiClient.get('/library/'),
        apiClient.get('/users/me/up-next'),
        apiClient.get('/users/me/feed/guides-updates')
      ]);

      let currentLib = libRes.status === 'fulfilled' ? (libRes.value.data || []) : [];
      
      // Render the dashboard immediately (under 100ms)
      setLibraryItems(currentLib);

      if (upNextRes.status === 'fulfilled' && upNextRes.value.data?.guides) {
        setUpNextGuides(upNextRes.value.data.guides);
      }

      if (updatesRes.status === 'fulfilled' && updatesRes.value.data) {
        setGuideUpdates(updatesRes.value.data);
      }

      if (!silent) setLoading(false);

      // 2. Non-blocking background auto-sync of series/anime & metadata enrichment for standalone works
      const nowMs = Date.now();
      const trackingSeries = currentLib.filter((i: any) => (i.item_type === 'series' || i.item_type === 'anime') && i.tracking_list_id);
      const standaloneItems = currentLib.filter((i: any) => i.item_type !== 'series' && i.item_type !== 'anime');

      // Fetch release dates / metadata for standalone works with missing dates (cached or throttled)
      (async () => {
        let hasUpdatedStandalone = false;
        const missingItems = standaloneItems.filter((i: any) => !i.release_date).slice(0, 5); // Limit max 5 per load
        for (const item of missingItems) {
          const descCacheKey = `desc_${item.item_type}_${item.external_id}`;
          const cachedDesc = getCachedSeries(descCacheKey);
          if (cachedDesc && cachedDesc.release_date) {
            item.release_date = cachedDesc.release_date;
            hasUpdatedStandalone = true;
          } else {
            try {
              if (item.item_type === 'movie' && item.external_id && item.external_id.startsWith('omdb_')) {
                const mRes = await apiClient.get(`/search/movies/${item.external_id}`);
                if (mRes.data && mRes.data.release_date) {
                  item.release_date = mRes.data.release_date;
                  setCachedSeries(descCacheKey, { description: mRes.data.description, release_date: mRes.data.release_date });
                  hasUpdatedStandalone = true;
                }
              } else if (item.external_id) {
                const sRes = await apiClient.get('/search/', { params: { q: item.title, type: item.item_type } });
                const match = (sRes.data || []).find((x: any) => x.external_id === item.external_id) || (sRes.data || [])[0];
                if (match && match.release_date) {
                  item.release_date = match.release_date;
                  setCachedSeries(descCacheKey, { description: match.description, release_date: match.release_date });
                  hasUpdatedStandalone = true;
                }
              }
            } catch (e) {}
          }
        }
        if (hasUpdatedStandalone) {
          setLibraryItems([...currentLib]);
        }
      })();

      if (trackingSeries.length > 0) {
        Promise.allSettled(
          trackingSeries.map(async (item: any) => {
            const cacheKeyAll = `${item.external_id}_all_episodes`;
            let allEps = getCachedSeries(cacheKeyAll);
            if (!allEps) {
              try {
                const epRes = await apiClient.get(`/search/series/${item.external_id}/episodes`);
                allEps = epRes.data;
                setCachedSeries(cacheKeyAll, allEps);
              } catch (e) {
                allEps = null;
              }
            }

            let futureEps: any[] = [];
            if (allEps && Array.isArray(allEps) && allEps.length > 0) {
              let trackedEps: any[] = [];
              try {
                const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
                trackedEps = listRes.data.items || [];
                setCachedSeries(`list_${item.tracking_list_id}`, trackedEps);
              } catch (e) {
                trackedEps = [];
              }
                    const isAiredFn = (ep: any) => {
                if (ep.airstamp) return new Date(ep.airstamp).getTime() <= nowMs;
                if (ep.airdate || ep.air_date) {
                  const ad = ep.airdate || ep.air_date;
                  const at = ep.airtime || '00:00';
                  return new Date(`${ad}T${at}:00Z`).getTime() <= nowMs;
                }
                return true;
              };

              const airedEpisodes = allEps.filter(isAiredFn);
              const pad = (n: number) => String(n).padStart(2, '0');
              const getEpTracked = (ep: any) => {
                return trackedEps.find((t: any) => 
                  (t.external_id === `tvm-ep-${ep.id}` || 
                   t.id === ep.id || 
                   (t.title && t.title.includes(`S${pad(ep.season_number)}E${pad(ep.episode_number)}`)) ||
                   (t.title && t.title.includes(`E${pad(ep.episode_number)}`) && (t.section === `Season ${ep.season_number}` || t.title.includes(`S${ep.season_number}`)))
                  )
                );
              };

              const airedCounts = airedEpisodes.map((ep: any) => {
                const t = getEpTracked(ep);
                return (t?.consumption_count !== undefined) ? t.consumption_count : (t?.is_completed ? 1 : 0);
              });
              const minAiredCount = airedCounts.length > 0 ? Math.min(...airedCounts) : 0;
              const maxAiredCount = airedCounts.length > 0 ? Math.max(...airedCounts) : 0;
              // True only if there are aired episodes waiting to be watched in the current cycle
              const hasUnwatchedAiredEpisode = airedCounts.length > 0 && (minAiredCount < maxAiredCount || minAiredCount === 0);

              // Extract future unwatched episodes for Upcoming tab
              allEps.forEach(ep => {
                let epTimestamp = 0;
                if (ep.airstamp) {
                  epTimestamp = new Date(ep.airstamp).getTime();
                } else if (ep.airdate || ep.air_date) {
                  const ad = ep.airdate || ep.air_date;
                  const at = ep.airtime || '00:00';
                  epTimestamp = new Date(`${ad}T${at}:00Z`).getTime();
                }
                const isFuture = epTimestamp > nowMs;
                if (isFuture) {
                  const t = getEpTracked(ep);
                  const isWatched = t && t.is_completed;
                  if (!isWatched) {
                    futureEps.push({
                      id: `ep-${ep.id || ep.external_id}-${ep.season_number}-${ep.episode_number}`,
                      title: item.title,
                      coverUrl: ep.image_url || ep.still_path || ep.image?.medium || ep.image?.original || item.image_url,
                      themeColor: `var(--color-${item.item_type})`,
                      themeTextColor: `var(--color-text-${item.item_type})`,
                      season_number: ep.season_number,
                      episode_number: ep.episode_number,
                      airdate: ep.airdate || ep.air_date,
                      airstamp: ep.airstamp,
                      timestamp: epTimestamp,
                      name: ep.name,
                      item_type: item.item_type,
                      parent_series: item,
                      rawEpisode: ep
                    });
                  }
                }
              });

              const hasWatchedAny = trackedEps.some((t: any) => t.is_completed);

              // Check if show has ended / finished
              const seriesData = getCachedSeries(`series_${item.external_id}`);
              const showStatus = (seriesData?.status || '').toLowerCase();
              const isEnded = showStatus === 'ended' || showStatus === 'finished' || showStatus === 'canceled';

              // Check if all episodes of the entire series (not just aired) have been watched for the current cycle
              const allEpCycles = allEps.map((ep: any) => {
                const t = getEpTracked(ep);
                return (t?.consumption_count !== undefined) ? t.consumption_count : (t?.is_completed ? 1 : 0);
              });
              const minAllCycle = allEpCycles.length > 0 ? Math.min(...allEpCycles) : 0;
              const hasUnwatchedInCurrentCycle = allEpCycles.some((c: number) => c === minAllCycle);

              if (item.status === 'completed' && hasUnwatchedAiredEpisode) {
                try {
                  await apiClient.put(`/library/${item.id}`, { status: 'watching' });
                  item.status = 'watching';
                  return { id: item.id, status: 'watching', futureEps };
                } catch (e) {}
              } else if (item.status === 'watching' && hasWatchedAny && !hasUnwatchedInCurrentCycle && minAllCycle > 0 && isEnded) {
                try {
                  await apiClient.put(`/library/${item.id}`, { status: 'completed' });
                  item.status = 'completed';
                  return { id: item.id, status: 'completed', futureEps };
                } catch (e) {}
              }
            }
            return { id: item.id, status: null, futureEps };
          })
        ).then(results => {
          let allCollectedFutureEps: any[] = [];
          const changed = results.filter(r => {
            if (r.status === 'fulfilled' && r.value) {
              if (r.value.futureEps && r.value.futureEps.length > 0) {
                allCollectedFutureEps.push(...r.value.futureEps);
              }
              return r.value.status !== null;
            }
            return false;
          });
          setUpcomingEpisodes(allCollectedFutureEps);
          if (changed.length > 0) {
            setLibraryItems([...currentLib]);
          }
        });
      }

    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleMarkDone = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    try {
      if (item.is_addition) {
        await apiClient.post(`/additions/items/additions/${item.addition_item_id}/toggle`);
      } else if (item.item_id) {
        await apiClient.post(`/lists/items/${item.item_id}/toggle`);
      } else {
        if (["plan_to_watch", "plan_to_play", "plan_to_read", "dropped"].includes(item.status)) {
          let targetStatus = 'watching';
          if (item.item_type === 'game') targetStatus = 'playing';
          else if (['book', 'comic', 'manga'].includes(item.item_type)) targetStatus = 'reading';
          else targetStatus = 'watching';
          await apiClient.put(`/library/${item.id}`, { status: targetStatus });
        } else {
          await apiClient.put(`/library/${item.id}`, { status: ['book', 'comic', 'manga'].includes(item.item_type) ? 'read' : 'completed' });
        }
      }
      fetchDashboard(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Cargando Inicio...</div>;
  }

  const startOfTodayMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const nowMs = Date.now();
  let filteredItems: any[] = [];
  if (activeTab === "watching") {
    filteredItems = libraryItems.filter(i => {
      if (i.item_type === "custom") return false;
      if (i.item_type === "game") {
        if (gameFilter === "endless") {
          return i.status === "endless";
        }
        return i.status === "playing";
      }

      if (!["watching", "reading", "playing"].includes(i.status)) return false;

      // For series and anime in 'watching', only show if there is at least one aired episode waiting to be watched
      if (i.item_type === "series" || i.item_type === "anime") {
        const cacheKeyAll = `${i.external_id}_all_episodes`;
        const allEps = getCachedSeries(cacheKeyAll);
        if (allEps && Array.isArray(allEps) && allEps.length > 0) {
          if (i.tracking_list_id) {
            const isAiredCheck = (ep: any) => {
              if (ep.airstamp) return new Date(ep.airstamp).getTime() <= nowMs;
              if (ep.airdate || ep.air_date) {
                const ad = ep.airdate || ep.air_date;
                const at = ep.airtime || '00:00';
                return new Date(`${ad}T${at}:00Z`).getTime() <= nowMs;
              }
              return true;
            };

            const airedEps = allEps.filter(isAiredCheck);
            if (airedEps.length === 0) return false;

            // Check if tracked list items are cached or we need to consider if all aired are watched
            const pad = (n: number) => String(n).padStart(2, '0');
            const cachedList = getCachedSeries(`list_${i.tracking_list_id}`);
            if (cachedList && Array.isArray(cachedList)) {
              const getEpTracked = (ep: any) => cachedList.find((t: any) => 
                (t.external_id === `tvm-ep-${ep.id}` || 
                 t.id === ep.id || 
                 (t.title && t.title.includes(`S${pad(ep.season_number)}E${pad(ep.episode_number)}`)) ||
                 (t.title && t.title.includes(`E${pad(ep.episode_number)}`) && (t.section === `Season ${ep.season_number}` || t.title.includes(`S${ep.season_number}`)))
                )
              );
              const airedCounts = airedEps.map(ep => {
                const t = getEpTracked(ep);
                return (t?.consumption_count !== undefined) ? t.consumption_count : (t?.is_completed ? 1 : 0);
              });
              const minAired = Math.min(...airedCounts);
              const hasUnwatchedAiredInCycle = airedCounts.some(c => c === minAired && c < (i.times_completed ? i.times_completed + 1 : 1));
              if (!hasUnwatchedAiredInCycle && airedCounts.every(c => c > 0 && c === airedCounts[0])) {
                return false;
              }
            }
          }
        }
      }

      return true;
    });
  } else if (activeTab === "plan_to_watch") {
    filteredItems = libraryItems.filter(i => {
      if (!["plan_to_watch", "plan_to_play", "plan_to_read"].includes(i.status)) return false;
      if (i.item_type === "custom") return false;
      if (i.badge === "dlc" || i.custom_badge === "dlc" || i.badge === "expansion" || i.custom_badge === "expansion") return false;
      
      // 1. Standalone items (movies, games, books, comics, manga)
      if (i.item_type !== 'series' && i.item_type !== 'anime') {
        // If it has no release date at all (unreleased/announced without date like Half-Life 3), do not show in No comenzado
        if (!i.release_date) return false;

        const parts = i.release_date.split('-');
        let rTime = 0;
        if (parts.length === 3) {
          rTime = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        } else {
          rTime = new Date(i.release_date).getTime();
        }
        // If future release date, belongs only in Upcoming, not No comenzado
        if (rTime >= startOfTodayMs && rTime > nowMs) return false;
      }

      // 2. Series / anime that haven't aired any episode yet belong only in Upcoming
      if (i.item_type === 'series' || i.item_type === 'anime') {
        const cacheKeyAll = `${i.external_id}_all_episodes`;
        const allEps = getCachedSeries(cacheKeyAll);
        if (allEps && Array.isArray(allEps) && allEps.length > 0) {
          const hasAnyAired = allEps.some((ep: any) => {
            if (ep.airstamp) return new Date(ep.airstamp).getTime() <= nowMs;
            if (ep.airdate || ep.air_date) {
              const ad = ep.airdate || ep.air_date;
              const at = ep.airtime || '00:00';
              return new Date(`${ad}T${at}:00Z`).getTime() <= nowMs;
            }
            return false;
          });
          // If no episode has aired yet, do not show in plan_to_watch
          if (!hasAnyAired) return false;
        } else if (!allEps) {
          // If episodes not loaded yet, check if release_date is missing or future
          if (!i.release_date) {
            // Series without any release date info yet
          }
        }
      }

      return true;
    });
  } else if (activeTab === "completed") {
    filteredItems = libraryItems.filter(i => {
      // Exclude endless games from completed
      if (i.status === "endless") return false;
      if (!["completed", "read"].includes(i.status)) return false;
      if (i.item_type === "custom") return false;

      // For series and anime in 'completed', ensure the series is actually ended
      if (i.item_type === "series" || i.item_type === "anime") {
        const seriesData = getCachedSeries(`series_${i.external_id}`);
        if (seriesData && seriesData.status) {
          const showStatus = seriesData.status.toLowerCase();
          const isEnded = showStatus === 'ended' || showStatus === 'finished' || showStatus === 'canceled';
          if (!isEnded) return false;
        }
      }

      return true;
    });
  } else if (activeTab === "dropped") {
    filteredItems = libraryItems.filter(i => i.status === "dropped" && i.item_type !== "custom");
  }

  // Aggregate all upcoming items (calendar vs TBA)
  let upcomingAllItems: any[] = [];
  let tbaAllItems: any[] = [];
  if (activeTab === "upcoming") {
    // 1. Standalone library works (movies, games, books, comics, manga)
    libraryItems.forEach(item => {
      if (item.item_type !== 'series' && item.item_type !== 'anime') {
        if (item.release_date) {
          const parts = item.release_date.split('-');
          let releaseTime = 0;
          if (parts.length === 3) {
            releaseTime = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
          } else {
            releaseTime = new Date(item.release_date).getTime();
          }
          if (releaseTime >= startOfTodayMs) {
            upcomingAllItems.push({
              id: `lib-${item.id}`,
              title: item.title,
              coverUrl: item.image_url,
              themeColor: `var(--color-${item.item_type})`,
              themeTextColor: `var(--color-text-${item.item_type})`,
              timestamp: releaseTime,
              release_date: item.release_date,
              item_type: item.item_type,
              rawItem: item
            });
          }
        } else {
          // Without release date (TBA / Por confirmar)
          tbaAllItems.push({
            id: `lib-${item.id}`,
            title: item.title,
            coverUrl: item.image_url,
            themeColor: `var(--color-${item.item_type})`,
            themeTextColor: `var(--color-text-${item.item_type})`,
            timestamp: 0,
            item_type: item.item_type,
            rawItem: item
          });
        }
      }
    });

    // 2. Future episodes from series/anime (or releasing today)
    upcomingEpisodes.forEach(ep => {
      if ((ep.timestamp || 0) >= startOfTodayMs) {
        upcomingAllItems.push(ep);
      }
    });

    // Sort chronologically ascending (closest release first)
    upcomingAllItems.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    // Sort TBA alphabetically
    tbaAllItems.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  const getTypeCat = (type: string, plural: boolean = false) => {
    return getCategoryLabel(type, language === 'es', plural);
  };

  const formatUpcomingDate = (dateStr: string | null | undefined, airstamp?: string) => {
    if (airstamp) {
      const d = new Date(airstamp);
      return d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) {
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return dateObj.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* Tabs */}
      <div style={{ 
        display: "flex", 
        gap: "1.75rem", 
        borderBottom: "1px solid var(--border-color)", 
        paddingBottom: "0.5rem", 
        position: "sticky", 
        top: 0, 
        zIndex: 20, 
        background: "var(--bg-primary)", 
        marginTop: "-2rem",
        paddingTop: "0.85rem" 
      }}>
        {["watching", "guides", "plan_to_watch", "completed", "dropped", "upcoming"].map((tab) => {
          const labels: any = language === 'es'
            ? { "watching": "Continuar", "guides": "Guías", "plan_to_watch": "No comenzado", "completed": "Terminado", "dropped": "Abandonado", "upcoming": "Próximos" }
            : { "watching": "Continue", "guides": "Guides", "plan_to_watch": "Not started", "completed": "Completed", "dropped": "Dropped", "upcoming": "Upcoming" };
          const isActive = activeTab === tab;
          return (
            <div 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                fontSize: "1.05rem", fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer", padding: "0.25rem 0", position: "relative"
              }}
            >
              {labels[tab]}
              {isActive && <div style={{ position: "absolute", bottom: "-0.5rem", left: 0, right: 0, height: "2px", background: "var(--accent-primary)" }} />}
            </div>
          );
        })}
      </div>

      {/* Media Row */}
      {activeTab === "upcoming" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Sub-tabs: Calendario / Por confirmar */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: "3px", borderRadius: "8px", gap: "4px", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setUpcomingFilter("calendar")}
                style={{
                  border: "none",
                  background: upcomingFilter === "calendar" ? "var(--accent-primary, #6366f1)" : "transparent",
                  color: upcomingFilter === "calendar" ? "#ffffff" : "var(--text-secondary)",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {language === "es" ? "Calendario" : "Calendar"}
              </button>
              <button
                type="button"
                onClick={() => setUpcomingFilter("tba")}
                style={{
                  border: "none",
                  background: upcomingFilter === "tba" ? "var(--accent-primary, #6366f1)" : "transparent",
                  color: upcomingFilter === "tba" ? "#ffffff" : "var(--text-secondary)",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {language === "es" ? "Por confirmar" : "TBA"}
              </button>
            </div>
          </div>

          {upcomingFilter === "calendar" ? (
            upcomingAllItems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {(() => {
                  // Group upcoming items by month key (e.g. "2026-09" or "2027-01")
                  const currentYear = new Date().getFullYear();
                  const groups: { [key: string]: { label: string; items: any[] } } = {};

                  upcomingAllItems.forEach(uItem => {
                    let dateObj: Date | null = null;
                    if (uItem.airstamp) {
                      dateObj = new Date(uItem.airstamp);
                    } else if (uItem.airdate) {
                      const parts = uItem.airdate.split('-');
                      if (parts.length === 3) dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    } else if (uItem.release_date) {
                      const parts = uItem.release_date.split('-');
                      if (parts.length === 3) dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      else if (parts.length === 1) dateObj = new Date(parseInt(parts[0]), 0, 1);
                    } else if (uItem.timestamp) {
                      dateObj = new Date(uItem.timestamp);
                    }

                    let groupKey = 'unknown';
                    let groupLabel = language === 'es' ? 'Próximamente' : 'Coming Soon';

                    if (dateObj && !isNaN(dateObj.getTime())) {
                      const itemYear = dateObj.getFullYear();
                      const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
                      groupKey = `${itemYear}-${monthNum}`;

                      const monthName = dateObj.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long' });
                      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                      
                      if (itemYear !== currentYear) {
                        groupLabel = `${capitalizedMonth} ${itemYear}`;
                      } else {
                        groupLabel = capitalizedMonth;
                      }
                    }

                    if (!groups[groupKey]) {
                      groups[groupKey] = { label: groupLabel, items: [] };
                    }
                    groups[groupKey].items.push(uItem);
                  });

                  return Object.keys(groups).map(gKey => {
                    const group = groups[gKey];
                    return (
                      <div key={gKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Month Header / Separator */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          paddingBottom: '0.35rem',
                          borderBottom: '1px solid var(--border-color)',
                          marginTop: '0.5rem'
                        }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {group.label}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            ({group.items.length} {group.items.length === 1 ? (language === 'es' ? 'estreno' : 'release') : (language === 'es' ? 'estrenos' : 'releases')})
                          </span>
                        </div>

                        {/* Vertical List of Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {group.items.map(uItem => {
                            const isEpisodeItem = uItem.season_number !== undefined && uItem.episode_number !== undefined;
                            const sStr = isEpisodeItem ? String(uItem.season_number).padStart(2, '0') : '';
                            const eStr = isEpisodeItem ? String(uItem.episode_number).padStart(2, '0') : '';
                            const epLabel = isEpisodeItem ? (language === 'es' ? `T${sStr} | E${eStr}` : `S${sStr} | E${eStr}`) : '';
                            const formattedDate = formatUpcomingDate(uItem.airdate || uItem.release_date, uItem.airstamp);
                            const catLabel = getTypeCat(uItem.item_type);

                            return (
                              <div
                                key={uItem.id}
                                onClick={() => {
                                  if (uItem.parent_series) {
                                    setSelectedItem(uItem.parent_series);
                                  } else if (uItem.rawItem) {
                                    setSelectedItem(uItem.rawItem);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  padding: '0.6rem 0.85rem',
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = uItem.themeColor || 'var(--accent-primary)';
                                  e.currentTarget.style.transform = 'translateX(3px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border-color)';
                                  e.currentTarget.style.transform = 'none';
                                }}
                              >
                                {/* Small Poster Thumbnail */}
                                <img
                                  src={uItem.coverUrl}
                                  alt={uItem.title}
                                  style={{
                                    width: '42px',
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    background: 'var(--bg-tertiary)'
                                  }}
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />

                                {/* Info Columns */}
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  {/* Row 1: Title + Season/Episode if series */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {uItem.title}
                                    </span>
                                    {isEpisodeItem && (
                                      <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: uItem.themeTextColor || '#ffffff',
                                        background: uItem.themeColor || 'var(--accent-primary)',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '4px'
                                      }}>
                                        {epLabel}
                                      </span>
                                    )}
                                    {isEpisodeItem && uItem.name && (
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        - {uItem.name}
                                      </span>
                                    )}
                                  </div>

                                  {/* Row 2: Release Date */}
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span>{language === 'es' ? 'Estreno:' : 'Airs:'}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formattedDate}</span>
                                  </div>
                                </div>

                                {/* Category Badge */}
                                <div style={{
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: uItem.themeColor ? `color-mix(in srgb, ${uItem.themeColor} 18%, transparent)` : 'var(--bg-tertiary)',
                                  color: uItem.themeColor || 'var(--text-secondary)',
                                  border: `1px solid ${uItem.themeColor ? `color-mix(in srgb, ${uItem.themeColor} 40%, transparent)` : 'var(--border-color)'}`,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}>
                                  {catLabel}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>
                {language === 'es' ? 'No hay estrenos o episodios próximos en el calendario.' : 'No upcoming releases or episodes in the calendar.'}
              </div>
            )
          ) : (
            /* TBA (Por confirmar) View */
            tbaAllItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tbaAllItems.map(uItem => {
                  const catLabel = getTypeCat(uItem.item_type);
                  return (
                    <div
                      key={uItem.id}
                      onClick={() => {
                        if (uItem.rawItem) setSelectedItem(uItem.rawItem);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.6rem 0.85rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = uItem.themeColor || 'var(--accent-primary)';
                        e.currentTarget.style.transform = 'translateX(3px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {/* Small Poster Thumbnail */}
                      <img
                        src={uItem.coverUrl}
                        alt={uItem.title}
                        style={{
                          width: '42px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                          background: 'var(--bg-tertiary)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      {/* Info Columns */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {uItem.title}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {language === 'es' ? 'Fecha por confirmar (TBA)' : 'Release date to be announced (TBA)'}
                        </div>
                      </div>

                      {/* Category Badge */}
                      <div style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: uItem.themeColor ? `color-mix(in srgb, ${uItem.themeColor} 18%, transparent)` : 'var(--bg-tertiary)',
                        color: uItem.themeColor || 'var(--text-secondary)',
                        border: `1px solid ${uItem.themeColor ? `color-mix(in srgb, ${uItem.themeColor} 40%, transparent)` : 'var(--border-color)'}`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        {catLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>
                {language === 'es' ? 'No hay obras agregadas con fecha por confirmar.' : 'No works added with release date to be announced.'}
              </div>
            )
          )}
        </div>
      ) : activeTab === "guides" ? (
        upNextGuides.length > 0 ? (
          <ScrollRow 
            key="guides_row"
            title={language === 'es' ? "Guías" : "Guides"} 
            outlineColor="var(--color-guide)"
            itemCount={upNextGuides.length}
            storageKey="guides_guides"
          >
            {upNextGuides.map(g => {
              let insideTop = g.title;
              let bottomText1 = '';
              let bottomText2 = '';
              

              const match = g.title.match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
              if (match) {
                insideTop = match[1].trim();
                const s = match[2];
                const e = match[3];
                bottomText1 = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                bottomText2 = match[4].replace(/^\s*-\s*/, '').trim();
              } else {
                const sMatch = g.title.match(/S(\d+)E(\d+)/i);
                if (sMatch) {
                  const s = sMatch[1];
                  const e = sMatch[2];
                  bottomText1 = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                  insideTop = g.title.replace(sMatch[0], '').replace(/-\s*-/, '-').trim();
                }
              }

              return (
                <CustomCard 
                  key={g.item_id}
                  title={g.list_title}
                  coverUrl={g.image_url}
                  preSubtitle={insideTop}
                  themeColor="var(--color-guide)"
                  themeTextColor="var(--color-text-guide)"
                  coverBottomText={undefined}
                  subtitle1={bottomText1}
                  subtitle2={bottomText2}
                  onCheck={(e) => handleMarkDone(e, g)}
                  onClick={() => setSelectedItem({ ...g, id: g.item_id })}
                  onTitleClick={(e) => { e.stopPropagation(); navigate(`/guide/${g.list_id}`); }}
                  language={language}
                />
              );
            })}
          </ScrollRow>
        ) : (
          <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>No hay guías seguidas.</div>
        )
      ) : (
        filteredItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {getOrderedCategories(currentUser?.category_order).map(category => {
              let catItems = filteredItems.filter(i => i.item_type === category);
              if (catItems.length === 0 && (category !== "game" || activeTab !== "watching")) return null;

              const headerExtra = (category === "game" && activeTab === "watching") ? (
                <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: "3px", borderRadius: "8px", gap: "4px", border: "1px solid var(--border-color)" }}>
                  <button
                    type="button"
                    onClick={() => setGameFilter("playing")}
                    style={{
                      border: "none",
                      background: gameFilter === "playing" ? "var(--color-game, #10b981)" : "transparent",
                      color: gameFilter === "playing" ? "var(--color-text-game, #ffffff)" : "var(--text-secondary)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {language === "es" ? "Jugando" : "Playing"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameFilter("endless")}
                    style={{
                      border: "none",
                      background: gameFilter === "endless" ? "var(--color-game, #10b981)" : "transparent",
                      color: gameFilter === "endless" ? "var(--color-text-game, #ffffff)" : "var(--text-secondary)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {language === "es" ? "Infinito" : "Endless"}
                  </button>
                </div>
              ) : undefined;

              return (
                <ScrollRow 
                  key={`${activeTab}_${category}`} 
                  title={getTypeCat(category, true)} 
                  outlineColor={`var(--color-${category})`} 
                  headerExtra={headerExtra} 
                  itemCount={catItems.length}
                  storageKey={`${activeTab}_${category}`}
                >
                  {catItems.length === 0 ? (
                    <div style={{ padding: "1rem 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                      {language === "es" 
                        ? (gameFilter === "endless" ? "No hay juegos infinitos." : "No hay juegos en curso.") 
                        : (gameFilter === "endless" ? "No endless games." : "No games in progress.")}
                    </div>
                  ) : (
                    catItems.map(item => {
                      if ((activeTab === "watching" || activeTab === "plan_to_watch") && (item.item_type === "series" || item.item_type === "anime")) {
                        return (
                          <ActiveSeriesCard 
                            key={item.id}
                            item={item}
                            language={language}
                            actionIcon={activeTab === "plan_to_watch" ? "play" : "check"}
                            onUpdate={() => fetchDashboard(true)}
                            onOpenSeries={(seriesItem) => setSelectedItem(seriesItem)}
                            themeColor={`var(--color-${item.item_type})`}
                            themeTextColor={`var(--color-text-${item.item_type})`}
                          />
                        );
                      }

                      if (activeTab === "completed" && (item.item_type === "series" || item.item_type === "anime")) {
                        return (
                          <CompletedSeriesCard 
                            key={item.id}
                            item={item}
                            language={language}
                            onUpdate={() => fetchDashboard(true)}
                            onOpenSeries={(seriesItem) => setSelectedItem(seriesItem)}
                            themeColor={`var(--color-${item.item_type})`}
                            themeTextColor={`var(--color-text-${item.item_type})`}
                          />
                        );
                      }

                      if (activeTab === "dropped" && (item.item_type === "series" || item.item_type === "anime")) {
                        return (
                          <DroppedSeriesCard 
                            key={item.id}
                            item={item}
                            language={language}
                            onUpdate={() => fetchDashboard(true)}
                            onOpenSeries={(seriesItem) => setSelectedItem(seriesItem)}
                            themeColor={`var(--color-${item.item_type})`}
                            themeTextColor={`var(--color-text-${item.item_type})`}
                          />
                        );
                      }
                      
                      return (
                        <CustomCard 
                          key={item.id}
                          title={item.title}
                          coverUrl={item.image_url}
                          themeColor={`var(--color-${item.item_type})`}
                          themeTextColor={`var(--color-text-${item.item_type})`}
                          coverBottomText={undefined}
                          actionIcon={activeTab === 'plan_to_watch' || item.status === 'dropped' ? 'play' : 'check'}
                          subtitle1={undefined}
                          subtitle2={(() => {
                            const formatTime = (mins: number) => {
                              if (!mins) return '';
                              const h = Math.floor(mins / 60);
                              const m = mins % 60;
                              return h > 0 ? `${h}h ${m > 0 ? `${String(m).padStart(2, '0')}m` : '00m'}` : `${m}m`;
                            };

                            if (item.status === 'plan_to_watch') {
                              if (item.item_type === 'movie') return formatTime(item.total_pages);
                              return '';
                            }
                            if (['completed', 'read', 'endless'].includes(item.status)) {
                              if (['book', 'comic', 'manga'].includes(item.item_type)) return item.total_pages ? `${item.total_pages} ${language === 'es' ? 'páginas' : 'pages'}` : '';
                              if (item.item_type === 'movie') return formatTime(item.total_pages);
                              if (item.item_type === 'game') return formatTime(item.pages_read);
                              return '';
                            }
                            if (item.status === 'dropped') {
                              if (['book', 'comic', 'manga'].includes(item.item_type)) return item.pages_read > 0 ? `${item.pages_read} ${language === 'es' ? 'páginas' : 'pages'}` : '';
                              if (['game', 'movie'].includes(item.item_type)) return formatTime(item.pages_read);
                              return '';
                            }
                            if (['watching', 'reading', 'playing'].includes(item.status)) {
                              if (['game', 'movie'].includes(item.item_type)) return formatTime(item.pages_read);
                              if (['book', 'comic', 'manga'].includes(item.item_type)) return item.pages_read > 0 ? `${item.pages_read} ${language === 'es' ? 'páginas' : 'pages'}` : '';
                            }
                            return "";
                          })()}
                          onCheck={!['completed', 'read', 'endless'].includes(item.status) ? (e) => handleMarkDone(e, item) : undefined}
                          onClick={() => setSelectedItem(item)}
                          language={language}
                        />
                      );
                    })
                  )}
                </ScrollRow>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>No hay elementos en esta categoria.</div>
        )
      )}

      {/* Activity Feed (Only visible on 'Guías' tab) */}
      {activeTab === "guides" && (
        <>
          {/* AdBanner before updates in followed guides */}
          <AdBanner style={{ margin: "1rem auto 2rem auto" }} />

          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 600 }}>{language === 'es' ? 'Novedades en guías seguidas' : 'Updates in followed guides'}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {guideUpdates.length > 0 ? guideUpdates.map(update => {
              let text = "";
              if (update.activity_type === "item_added") text = `agrego ${update.item_title} a`;
              else if (update.activity_type === "item_removed") text = `elimino ${update.item_title} de`;
              else if (update.activity_type === "item_moved") text = `movio ${update.item_title} en`;
              else if (update.activity_type === "block_edited") {
                if (update.item_title === update.list_title || update.item_title === "un bloque") {
                  text = language === 'es' ? `edito un bloque de` : `edited a block in`;
                } else if (update.item_title.startsWith("type:")) {
                  const typeMatch = update.item_title.match(/type:([^|]*)(?:\|id:([^|]*))?\|title:(.*)/);
                  if (typeMatch) {
                    const elType = typeMatch[1];
                    const elTitle = typeMatch[3];
                    
                    let typeName = language === 'es' ? 'un bloque' : 'a block';
                    if (elType === 'section') typeName = language === 'es' ? 'una sección' : 'a section';
                    else if (elType === 'subblock') typeName = language === 'es' ? 'un sub-bloque' : 'a sub-block';
                    
                    if (elTitle) {
                      text = language === 'es' ? `edito ${typeName === 'una sección' ? 'la sección' : typeName === 'un sub-bloque' ? 'el sub-bloque' : 'el bloque'} '${elTitle}' de` : `edited the ${elType} '${elTitle}' in`;
                    } else {
                      text = language === 'es' ? `edito ${typeName} sin título en` : `edited an untitled ${elType} in`;
                    }
                  } else {
                    text = language === 'es' ? `edito un bloque de` : `edited a block in`;
                  }
                } else {
                  text = language === 'es' ? `edito el bloque '${update.item_title}' de` : `edited the block '${update.item_title}' in`;
                }
              }
              
              return (
                <div 
                  key={update.id} 
                  className="feed-update-card"
                  onClick={() => {
                    let hash = "";
                    if (update.activity_type === "block_edited" && update.item_title.startsWith("type:")) {
                      const m = update.item_title.match(/type:([^|]*)(?:\|id:([^|]*))?\|title:(.*)/);
                      if (m && m[2]) hash = `#${m[2]}`;
                    }
                    navigate(`/guide/${update.list_id}${hash}`);
                  }}
                  style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); navigate(`/user/${encodeURIComponent(update.username)}`); }}
                    style={{ cursor: "pointer" }}
                    className="feed-update-user-link"
                  >
                    {update.photo_url ? (
                      <img src={update.photo_url} alt={update.username} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>{update.username.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.95rem" }}>
                      <span 
                        className="feed-update-user-link"
                        onClick={(e) => { e.stopPropagation(); navigate(`/user/${encodeURIComponent(update.username)}`); }}
                        style={{ fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease" }}
                      >{update.username}</span> {text} <span className="feed-update-guide" style={{ fontStyle: "italic", transition: "color 0.2s ease" }}>{update.list_title}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      {new Date(update.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ color: "var(--text-secondary)" }}>{language === 'es' ? 'No hay novedades recientes.' : 'No recent updates.'}</div>
            )}
          </div>
        </>
      )}

      {/* Non-intrusive bottom sponsor / AdBanner */}
      <AdBanner />

      {selectedItem && (() => {
        const currentLibItem = libraryItems.find(x => x.external_id === selectedItem.external_id && x.item_type === selectedItem.item_type) || selectedItem;
        const isFav = Boolean(currentLibItem?.is_favorite);

        const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
          const targetItem = libraryItems.find(li => li.id === itemId) || currentLibItem;
          if (!currentFav && targetItem) {
            const isDlcOrExpansion = targetItem.item_type === 'game' && ['dlc', 'expansion'].includes(targetItem.badge || targetItem.custom_badge || '');
            const isUnconsumed = !isDlcOrExpansion && ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(targetItem.status);
            if (isUnconsumed) {
              return;
            }

            const isPro = Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip);
            const sameCategoryFavs = libraryItems.filter(f => f.item_type === targetItem.item_type && f.is_favorite);
            const maxAllowed = isPro ? 10 : 1;

            if (sameCategoryFavs.length >= maxAllowed) {
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
            if (selectedItem && selectedItem.id === itemId) {
              setSelectedItem((prev: any) => prev ? { ...prev, is_favorite: !currentFav } : null);
            }
          } catch (err) {
            console.error("Failed to toggle favorite in Home", err);
          }
        };

        return (
          <ItemDetailsModal
            item={currentLibItem}
            isOwnProfile={true}
            onClose={() => setSelectedItem(null)}
            onUpdate={() => fetchDashboard(true)}
            onOpenItem={(item) => setSelectedItem(item)}
            isFavorite={isFav}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      })()}

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
        isPro={Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip)}
        onConfirmReplace={async (itemToReplaceId: number, newItemId: number) => {
          try {
            await apiClient.put(`/library/${itemToReplaceId}`, { is_favorite: false });
            await apiClient.put(`/library/${newItemId}`, { is_favorite: true });
            setLibraryItems(prev => prev.map(item => {
              if (item.id === itemToReplaceId) return { ...item, is_favorite: false };
              if (item.id === newItemId) return { ...item, is_favorite: true };
              return item;
            }));
          } catch (err) {
            console.error("Failed to replace favorite", err);
          }
        }}
        onOpenProModal={() => setShowProModal(true)}
      />
    </div>
  );
};

export default Home;
