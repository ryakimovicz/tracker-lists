import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

const ScrollRow = ({ children, title, outlineColor }: { children: React.ReactNode, title?: string, outlineColor?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {title && <div style={{ display: "flex", paddingLeft: "45px", marginBottom: "1rem" }}><h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)", border: `2px solid ${outlineColor || "var(--border-color)"}`, borderRadius: "8px", padding: "0.2rem 0.75rem", background: "var(--bg-secondary)" }}>{title}</h3></div>}
      <button 
        onClick={() => scroll("left")}
        style={{ position: "absolute", left: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}
      ><ChevronLeft size={20} color="var(--text-primary)" /></button>
      
      <div ref={scrollRef} style={{ display: "flex", gap: "1rem", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: "1rem", paddingLeft: "45px", paddingRight: "45px" }}>
        {children}
      </div>

      <button 
        onClick={() => scroll("right")}
        style={{ position: "absolute", right: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}
      ><ChevronRight size={20} color="var(--text-primary)" /></button>
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
  isNsfw,
  language,
  themeColor,
  themeTextColor
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
  isNsfw?: boolean;
  language?: string;
  themeColor?: string;
  themeTextColor?: string;
}) => {
  const { user } = useAuth();
  const [isPeek, setIsPeek] = useState(false);
  const shouldBlur = isNsfw && !user?.show_nsfw;
  const currentlyBlurred = shouldBlur && !isPeek;

  const handleClick = (e: React.MouseEvent) => {
    if (currentlyBlurred) {
      e.stopPropagation();
      setIsPeek(true);
      return;
    }
    if (onClick) onClick();
  };

  return (
    <div 
      onClick={handleClick}
      style={{ 
        minWidth: "180px", maxWidth: "180px", background: "var(--bg-secondary)", 
        border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column",
        boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none"
      }}
      className="activity-card"
    >
      <div 
        onClick={onTitleClick ? (e) => { e.stopPropagation(); onTitleClick(e); } : undefined}
        className={onTitleClick ? "card-series-title" : ""}
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
          <img src={coverUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", filter: currentlyBlurred ? "blur(15px)" : "none" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem", filter: currentlyBlurred ? "blur(15px)" : "none" }}>?</div>
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
                const map: any = { "movie": "Película", "series": "Serie", "anime": "Anime", "game": "Videojuego", "book": "Libro", "comic": "Cómic", "manga": "Manga", "guide": "Guía", "user": "Usuario" };
                return map[coverBottomText.toLowerCase()] || coverBottomText;
              } else {
                const map: any = { "movie": "Movie", "series": "Series", "anime": "Anime", "game": "Game", "book": "Book", "comic": "Comic", "manga": "Manga", "guide": "Guide", "user": "User" };
                return map[coverBottomText.toLowerCase()] || coverBottomText;
              }
            })()}
          </div>
        )}
      </div>
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minHeight: "2.5rem", paddingRight: onCheck && !currentlyBlurred ? "40px" : "0.75rem" }}>
        {preSubtitle && <div style={{ fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: 800, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preSubtitle}</div>}
        {subtitle1 && <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>{subtitle1}</div>}
        {subtitle2 && <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{subtitle2}</div>}
      </div>
      {onCheck && !currentlyBlurred && (
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
          <Check size={16} />
        </button>
      )}
    </div>
  );
};

const ActiveSeriesCard = ({ item, onUpdate, language, onOpenSeries, themeColor, themeTextColor }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void, themeColor?: string, themeTextColor?: string }) => {
  const { user } = useAuth();
  const [nextEp, setNextEp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPeek, setIsPeek] = useState(false);

  const shouldBlur = item.is_nsfw && !user?.show_nsfw;
  const currentlyBlurred = shouldBlur && !isPeek;

  const fetchNextEpisode = async () => {
    if (!item.tracking_list_id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let trackedEpisodes: any[] = [];
      try {
        const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
        trackedEpisodes = listRes.data.items || [];
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

      if (filteredSeasons.length === 0) return;

      const completed = trackedEpisodes
        .filter((e: any) => e.is_completed)
        .map((e: any) => ({ ...e, ...parseEpInfo(e) }))
        .sort((a: any, b: any) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);

      let nextSeasonNum = filteredSeasons[0].season_number;
      let nextEpNum = 1;

      const lastCompleted = completed[completed.length - 1];
      if (lastCompleted) {
        const { season: lastSeason, episode: lastEpisode } = lastCompleted;
        const currSeason = filteredSeasons.find((s: any) => s.season_number === lastSeason);
        if (currSeason && lastEpisode < currSeason.episode_count) {
          nextSeasonNum = lastSeason;
          nextEpNum = lastEpisode + 1;
        } else {
          const nextSeason = filteredSeasons.find((s: any) => s.season_number > lastSeason);
          if (nextSeason) {
            nextSeasonNum = nextSeason.season_number;
            nextEpNum = 1;
          } else {
            setNextEp(null);
            return;
          }
        }
      }

      const cacheKeyAll = `${item.external_id}_all_episodes`;
      const cachedAll = getCachedSeries(cacheKeyAll);
      let targetEp = null;
      if (cachedAll && Array.isArray(cachedAll)) {
        targetEp = cachedAll.find((e: any) => e.season_number === nextSeasonNum && e.episode_number === nextEpNum);
      } else {
        const res = await apiClient.get(`/search/series/${item.external_id}/episodes`);
        setCachedSeries(cacheKeyAll, res.data);
        targetEp = res.data.find((e: any) => e.season_number === nextSeasonNum && e.episode_number === nextEpNum);
      }

      if (targetEp) {
        setNextEp(targetEp);
      }
    } catch (e) {
      console.error("Failed to load next episode for card", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNextEpisode();
  }, [item]);

  const handleMarkSeen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextEp) return;
    setIsLoading(true);
    try {
      await apiClient.post(`/lists/${item.tracking_list_id}/toggle-series-episode`, {
        episode_id: nextEp.id,
        title: nextEp.title || `${item.title} - S${pad(nextEp.season_number)}E${pad(nextEp.episode_number)} - ${nextEp.name || 'Untitled'}`,
        image_url: nextEp.still_path || null,
        overview: nextEp.overview,
        season_number: nextEp.season_number,
        episode_number: nextEp.episode_number
      });
      const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
      const updatedList = listRes.data.items || [];
      const cacheKey = `series_${item.external_id}`;
      const cached = getCachedSeries(cacheKey);
      if (cached && cached.seasons) {
        const totalEps = cached.seasons.reduce((acc: number, s: any) => acc + (s.episode_count || 0), 0);
        const completed = updatedList.filter((ep: any) => ep.is_completed).length;
        if (totalEps > 0 && completed >= totalEps) {
          await apiClient.put(`/library/${item.id}`, { status: 'completed' });
        }
      }
      onUpdate();
      await fetchNextEpisode();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const pad = (n: number) => n < 10 ? '0' + n : n;
  
  const handleCardClick = (e: React.MouseEvent) => {
    if (currentlyBlurred) {
      e.stopPropagation();
      setIsPeek(true);
      return;
    }
    if (nextEp) {
      onOpenSeries({
        id: nextEp.id,
        item_type: 'episode',
        title: nextEp.name || `Episode ${nextEp.episode_number}`,
        external_id: `tvm-ep-${nextEp.id}`,
        image_url: nextEp.still_path || null,
        custom_notes: JSON.stringify({ description: nextEp.overview || '', release_date: nextEp.air_date || null }),
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

  return (
    <>
      <div 
        onClick={handleCardClick}
        style={{ 
          minWidth: "220px", maxWidth: "220px", background: "var(--bg-secondary)", 
          border: `1px solid ${themeColor || "var(--border-color)"}`, borderRadius: "12px", 
          overflow: "hidden", cursor: "pointer", position: "relative",
          display: "flex", flexDirection: "column",
          boxShadow: themeColor ? `0 0 10px ${themeColor}33` : "none"
        }}
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
            <img src={coverUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", filter: currentlyBlurred ? "blur(15px)" : "none" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem", filter: currentlyBlurred ? "blur(15px)" : "none" }}>?</div>
          )}
          

        </div>
        
        <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
          {seasonText ? (
            <>
              <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>{seasonText}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: "36px" }}>{epName}</div>
            </>
          ) : (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "auto", marginBottom: "auto" }}>Completado</div>
          )}
        </div>
        
        {nextEp && !currentlyBlurred && (
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
        )}
      </div>
    </>
  );
};

const ActiveItemCard = ({ item, onUpdate, language, onOpenItem }: { item: any, onUpdate: () => void, language: string, onOpenItem: (item: any) => void }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPeek, setIsPeek] = useState(false);

  const shouldBlur = item.is_nsfw && !user?.show_nsfw;
  const currentlyBlurred = shouldBlur && !isPeek;

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
  
  const handleCardClick = (e: React.MouseEvent) => {
    if (currentlyBlurred) {
      e.stopPropagation();
      setIsPeek(true);
      return;
    }
    onOpenItem(item);
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{ 
        minWidth: "220px", maxWidth: "220px", background: "var(--bg-secondary)", 
        border: "1px solid var(--border-color)", borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column"
      }}
      className="activity-card"
    >
      <div 
        onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}
        className="card-series-title"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
        <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: "0.25rem", opacity: 0.7 }} />
      </div>

      <div style={{ width: "100%", height: "125px", background: "var(--bg-tertiary)", position: "relative" }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", filter: currentlyBlurred ? "blur(15px)" : "none" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem", filter: currentlyBlurred ? "blur(15px)" : "none" }}>?</div>
        )}
        
        <div className={getTagClass(item.item_type)} style={{ position: "absolute", bottom: "0.25rem", left: "0.5rem", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, opacity: 0.85, backdropFilter: 'blur(4px)' }}>
          {(() => {
            if (language === 'es') {
              const map: any = { "movie": "Película", "series": "Serie", "anime": "Anime", "game": "Videojuego", "book": "Libro", "comic": "Cómic", "manga": "Manga", "guide": "Guía", "user": "Usuario" };
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
                if (item.item_type === 'game') return item.pages_read > 0 ? `${Math.floor(item.pages_read / 60)}h ${String(item.pages_read % 60).padStart(2, '0')}m` : '\u00A0';
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
              if (item.pages_read > 0 && !['completed', 'read', 'plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(item.status)) {
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
      
      {!currentlyBlurred && (
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
      )}
    </div>
  );
};

// --- Main Component ---

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<"watching" | "guides" | "plan_to_watch" | "completed" | "dropped">("watching");
  
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [upNextGuides, setUpNextGuides] = useState<any[]>([]);
  const [guideUpdates, setGuideUpdates] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const libRes = await apiClient.get('/library/');
      if (libRes.data) {
        setLibraryItems(libRes.data);
      }

      const upNextRes = await apiClient.get('/users/me/up-next');
      if (upNextRes.data && upNextRes.data.guides) {
        setUpNextGuides(upNextRes.data.guides);
      }

      const updatesRes = await apiClient.get('/users/me/feed/guides-updates');
      if (updatesRes.data) {
        setGuideUpdates(updatesRes.data);
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
        await apiClient.put(`/library/${item.id}`, { status: 'completed' });
      }
      fetchDashboard(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Cargando Inicio...</div>;
  }

  let filteredItems: any[] = [];
  if (activeTab === "watching") {
    filteredItems = libraryItems.filter(i => ["watching", "reading", "playing"].includes(i.status) && i.item_type !== "custom");
  } else if (activeTab === "plan_to_watch") {
    filteredItems = libraryItems.filter(i => ["plan_to_watch", "plan_to_play", "plan_to_read"].includes(i.status) && i.item_type !== "custom");
  } else if (activeTab === "completed") {
    filteredItems = libraryItems.filter(i => ["completed", "read", "endless"].includes(i.status) && i.item_type !== "custom");
  } else if (activeTab === "dropped") {
    filteredItems = libraryItems.filter(i => i.status === "dropped" && i.item_type !== "custom");
  }

  const getTypeCat = (type: string) => {
    const map: any = { "movie": "Pelicula", "series": "Serie", "anime": "Anime", "game": "Videojuego", "book": "Libro", "comic": "Comic", "manga": "Manga" };
    return map[type] || type;
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* Tabs */}
      <div style={{ 
        display: "flex", gap: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", 
        position: "sticky", top: 0, zIndex: 10, background: "var(--bg-primary)", paddingTop: "1rem" 
      }}>
        {["watching", "guides", "plan_to_watch", "completed", "dropped"].map((tab) => {
          const labels: any = language === 'es'
            ? { "watching": "Continuar", "guides": "Guías", "plan_to_watch": "No comenzado", "completed": "Terminado", "dropped": "Abandonado" }
            : { "watching": "Continue", "guides": "Guides", "plan_to_watch": "Not started", "completed": "Completed", "dropped": "Dropped" };
          const isActive = activeTab === tab;
          return (
            <div 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                fontSize: "1.1rem", fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer", padding: "0.5rem 0", position: "relative"
              }}
            >
              {labels[tab]}
              {isActive && <div style={{ position: "absolute", bottom: "-0.5rem", left: 0, right: 0, height: "2px", background: "var(--accent-primary)" }} />}
            </div>
          );
        })}
      </div>

      {/* Media Row */}
      {activeTab === "guides" ? (
        upNextGuides.length > 0 ? (
          <ScrollRow>
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
                  isNsfw={g.is_nsfw}
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
            {["movie", "series", "anime", "book", "comic", "manga", "game"].map(category => {
              let catItems = filteredItems.filter(i => i.item_type === category);
              if (catItems.length === 0) return null;
              return (
                <ScrollRow key={category} title={getTypeCat(category)} outlineColor={`var(--color-${category})`}>
                  {catItems.map(item => {
                    if ((activeTab === "watching" || activeTab === "plan_to_watch") && (item.item_type === "series" || item.item_type === "anime")) {
                      return (
                        <ActiveSeriesCard 
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
                        subtitle2={(() => {
                          if (['completed', 'read', 'endless'].includes(item.status)) {
                            if (['book', 'comic', 'manga'].includes(item.item_type)) return item.total_pages ? `${item.total_pages} ${language === 'es' ? 'páginas' : 'pages'}` : '';
                            if (item.item_type === 'movie') return item.total_pages ? `${item.total_pages} min` : '';
                            if (item.item_type === 'game') return item.pages_read > 0 ? `${Math.floor(item.pages_read / 60)}h ${String(item.pages_read % 60).padStart(2, '0')}m` : '';
                            return '';
                          }
                          if (item.status === 'dropped') {
                            if (['book', 'comic', 'manga'].includes(item.item_type)) return item.pages_read > 0 ? `${item.pages_read} ${language === 'es' ? 'páginas' : 'pages'}` : '';
                            if (item.item_type === 'game') return item.pages_read > 0 ? `${Math.floor(item.pages_read / 60)}h ${String(item.pages_read % 60).padStart(2, '0')}m` : '';
                            return '';
                          }
                          if (['watching', 'reading', 'playing', 'endless'].includes(item.status)) {
                            if (item.item_type === 'game' && item.pages_read > 0) return `${Math.floor(item.pages_read / 60)}h ${String(item.pages_read % 60).padStart(2, '0')}m`;
                            if (['book', 'comic', 'manga'].includes(item.item_type) && item.pages_read > 0) return `${item.pages_read} ${language === 'es' ? 'páginas' : 'pages'}`;
                          }
                          return "";
                        })()}
                        onCheck={!['completed', 'read'].includes(item.status) ? (e) => handleMarkDone(e, item) : undefined}
                        onClick={() => setSelectedItem(item)}
                        isNsfw={item.is_nsfw}
                        language={language}
                      />
                    );
                  })}
                </ScrollRow>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>No hay elementos en esta categoria.</div>
        )
      )}

      {/* Activity Feed */}
      <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 600 }}>Novedades en guias seguidas</h3>
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
                const elId = typeMatch[2];
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
                onClick={(e) => { e.stopPropagation(); navigate(`/profile?user_id=${update.user_id}`); }}
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
                    onClick={(e) => { e.stopPropagation(); navigate(`/profile?user_id=${update.user_id}`); }}
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
          <div style={{ color: "var(--text-secondary)" }}>No hay novedades recientes.</div>
        )}
      </div>

      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          isOwnProfile={true}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => fetchDashboard(true)}
          onOpenItem={(item) => setSelectedItem(item)}
        />
      )}
    </div>
  );
};

export default Home;
