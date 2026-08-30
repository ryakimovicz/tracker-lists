import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getCachedSeries, setCachedSeries } from '../utils/seriesCache';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { AdBanner } from '../components/AdBanner';
import { ChevronLeft, ChevronRight, Check, Play } from 'lucide-react';
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
  isNsfw?: boolean;
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

const ActiveSeriesCard = ({ item, onUpdate, language, onOpenSeries, themeColor, themeTextColor }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void, themeColor?: string, themeTextColor?: string }) => {
  const [nextEp, setNextEp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      
      let isAllDone = false;
      if (cached && cached.seasons) {
        const totalEps = cached.seasons.reduce((acc: number, s: any) => acc + (s.episode_count || 0), 0);
        const completed = updatedList.filter((ep: any) => ep.is_completed).length;
        if (totalEps > 0 && completed >= totalEps) {
          isAllDone = true;
        }
      }

      // Check if next episode air date is in future
      if (!isAllDone) {
        const cacheKeyAll = `${item.external_id}_all_episodes`;
        let allEps = getCachedSeries(cacheKeyAll);
        if (!allEps) {
          try {
            const res = await apiClient.get(`/search/series/${item.external_id}/episodes`);
            allEps = res.data;
            setCachedSeries(cacheKeyAll, allEps);
          } catch (e) {
            allEps = null;
          }
        }
        if (allEps && Array.isArray(allEps) && allEps.length > 0) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;

          const hasUnwatchedAired = allEps.some(ep => {
            const airDate = ep.airdate || ep.air_date;
            const isAired = !airDate || airDate <= todayStr;
            const isWatched = updatedList.some((tracked: any) => 
              (tracked.external_id === `tvm-ep-${ep.id}` || tracked.id === ep.id || (tracked.title && tracked.title.includes(`E${String(ep.episode_number).padStart(2, '0')}`))) && tracked.is_completed
            );
            return isAired && !isWatched;
          });

          if (!hasUnwatchedAired) {
            isAllDone = true;
          }
        }
      }

      if (isAllDone) {
        await apiClient.put(`/library/${item.id}`, { status: 'completed' });
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
          {seasonText ? (
            <>
              <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 700 }}>{seasonText}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: "36px" }}>{epName}</div>
            </>
          ) : (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "auto", marginBottom: "auto" }}>Completado</div>
          )}
        </div>
        
        {nextEp && (
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
        onClick={(e) => { e.stopPropagation(); onOpenSeries(item); }}
        className="card-series-title"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
        <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: "0.25rem", opacity: 0.7 }} />
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
      let currentLib = libRes.data || [];

      // Auto sync series/anime status between 'completed' and 'watching' based on aired episodes
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const trackingSeries = currentLib.filter((i: any) => (i.item_type === 'series' || i.item_type === 'anime') && i.tracking_list_id);

      for (const item of trackingSeries) {
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

        if (allEps && Array.isArray(allEps) && allEps.length > 0) {
          let trackedEps: any[] = [];
          try {
            const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
            trackedEps = listRes.data.items || [];
          } catch (e) {
            trackedEps = [];
          }

          // Check if there is any uncompleted episode whose air date has arrived (aired on or before today)
          const hasUnwatchedAiredEpisode = allEps.some(ep => {
            const airDate = ep.airdate || ep.air_date;
            const isAired = !airDate || airDate <= todayStr;
            const isWatched = trackedEps.some((t: any) => 
              (t.external_id === `tvm-ep-${ep.id}` || t.id === ep.id || (t.title && t.title.includes(`E${String(ep.episode_number).padStart(2, '0')}`))) && t.is_completed
            );
            return isAired && !isWatched;
          });

          // Check if user has watched at least one episode
          const hasWatchedAny = trackedEps.some((t: any) => t.is_completed);

          if (item.status === 'completed' && hasUnwatchedAiredEpisode) {
            // New episode aired -> move back to watching / Continuar
            try {
              await apiClient.put(`/library/${item.id}`, { status: 'watching' });
              item.status = 'watching';
            } catch (e) {
              console.error("Failed to auto-resume series", e);
            }
          } else if (item.status === 'watching' && hasWatchedAny && !hasUnwatchedAiredEpisode) {
            // All currently released episodes watched -> move to completed / Terminado
            try {
              await apiClient.put(`/library/${item.id}`, { status: 'completed' });
              item.status = 'completed';
            } catch (e) {
              console.error("Failed to auto-complete series", e);
            }
          }
        }
      }

      setLibraryItems(currentLib);

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
        if (item.status === 'dropped') {
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
                        actionIcon={item.status === 'dropped' ? 'play' : 'check'}
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
