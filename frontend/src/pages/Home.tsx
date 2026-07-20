import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getCachedTMDB, setCachedTMDB } from '../utils/tmdbCache';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// --- Helper Components ---

const ScrollRow = ({ children, title }: { children: React.ReactNode, title?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative", marginBottom: "2rem" }}>
      {title && <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", fontWeight: 600 }}>{title}</h3>}
      <button 
        onClick={() => scroll("left")}
        style={{ position: "absolute", left: "-20px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      ><ChevronLeft size={20} color="var(--text-primary)" /></button>
      
      <div ref={scrollRef} style={{ display: "flex", gap: "1rem", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: "1rem" }}>
        {children}
      </div>

      <button 
        onClick={() => scroll("right")}
        style={{ position: "absolute", right: "-20px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      ><ChevronRight size={20} color="var(--text-primary)" /></button>
    </div>
  );
};

const CustomCard = ({ 
  title, 
  coverUrl, 
  subtitle1, 
  subtitle2, 
  coverTopText,
  coverBottomText,
  onCheck, 
  onClick, 
  isNsfw 
}: { 
  title: string; 
  coverUrl?: string; 
  subtitle1?: string; 
  subtitle2?: string; 
  coverTopText?: string;
  coverBottomText?: string;
  onCheck?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  isNsfw?: boolean;
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
        border: "1px solid var(--border-color)", borderRadius: "12px", 
        overflow: "hidden", cursor: "pointer", position: "relative",
        display: "flex", flexDirection: "column"
      }}
      className="activity-card"
    >
      <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title}
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
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.5rem", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", color: "#fff", fontSize: "0.75rem", fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,0.8)", textAlign: "right" }}>
            {coverBottomText}
          </div>
        )}
      </div>
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minHeight: "2.5rem", paddingRight: onCheck && !currentlyBlurred ? "40px" : "0.75rem" }}>
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
            background: "var(--bg-tertiary)", border: "2px solid var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-primary)"
          }}
        >
          <Check size={16} />
        </button>
      )}
    </div>
  );
};

const ActiveSeriesCard = ({ item, onUpdate, language, onOpenSeries }: { item: any, onUpdate: () => void, language: string, onOpenSeries: (item: any) => void }) => {
  const { user } = useAuth();
  const [nextEp, setNextEp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPeek, setIsPeek] = useState(false);
  const [episodeItemForModal, setEpisodeItemForModal] = useState<any>(null);

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
      const cached = getCachedTMDB(cacheKey);
      if (cached && cached.seasons) {
        filteredSeasons = cached.seasons;
      } else {
        const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
        filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
        setCachedTMDB(cacheKey, { ...seriesRes.data, seasons: filteredSeasons });
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
      const cachedAll = getCachedTMDB(cacheKeyAll);
      let targetEp = null;
      if (cachedAll && Array.isArray(cachedAll)) {
        targetEp = cachedAll.find((e: any) => e.season_number === nextSeasonNum && e.episode_number === nextEpNum);
      } else {
        const res = await apiClient.get(`/search/series/${item.external_id}/episodes`);
        setCachedTMDB(cacheKeyAll, res.data);
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
      await apiClient.post(`/lists/${item.tracking_list_id}/toggle-tmdb-episode`, {
        tmdb_episode_id: nextEp.id,
        title: nextEp.title || `${item.title} - S${pad(nextEp.season_number)}E${pad(nextEp.episode_number)} - ${nextEp.name || 'Untitled'}`,
        image_url: nextEp.image_url || (nextEp.still_path ? (nextEp.still_path.startsWith('http') ? nextEp.still_path : `https://image.tmdb.org/t/p/w185${nextEp.still_path}`) : null),
        overview: nextEp.overview,
        season_number: nextEp.season_number,
        episode_number: nextEp.episode_number
      });
      const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
      const updatedList = listRes.data.items || [];
      const cacheKey = `series_${item.external_id}`;
      const cached = getCachedTMDB(cacheKey);
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
      setEpisodeItemForModal({
        id: nextEp.id,
        item_type: 'episode',
        title: nextEp.name || `Episode ${nextEp.episode_number}`,
        external_id: `tmdb-ep-${nextEp.id}`,
        image_url: nextEp.still_path ? (nextEp.still_path.startsWith('http') ? nextEp.still_path : `https://image.tmdb.org/t/p/w500${nextEp.still_path}`) : null,
        custom_notes: nextEp.overview,
        parent_series: item
      });
    } else {
      onOpenSeries(item);
    }
  };

  const getCoverUrl = () => {
    if (nextEp?.still_path) {
      if (nextEp.still_path.startsWith('http')) {
        return nextEp.still_path;
      }
      return `https://image.tmdb.org/t/p/w300${nextEp.still_path}`;
    }
    return item.image_url;
  };
  const coverUrl = getCoverUrl();
  const categoryLabel = item.item_type === 'anime' ? 'Anime' : 'Serie';
  
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
          border: "1px solid var(--border-color)", borderRadius: "12px", 
          overflow: "hidden", cursor: "pointer", position: "relative",
          display: "flex", flexDirection: "column"
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
          
          <div style={{ position: "absolute", bottom: "0.25rem", left: "0.5rem", background: "rgba(0,0,0,0.6)", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, color: "#fff" }}>
            {categoryLabel}
          </div>
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
              background: "var(--bg-tertiary)", border: "2px solid var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isLoading ? "wait" : "pointer", color: "var(--text-primary)",
              opacity: isLoading ? 0.5 : 1
            }}
          >
            <Check size={16} />
          </button>
        )}
      </div>

      {episodeItemForModal && (
        <ItemDetailsModal
          item={episodeItemForModal}
          isOwnProfile={true}
          onClose={() => setEpisodeItemForModal(null)}
          onUpdate={onUpdate}
          onOpenItem={(item) => setEpisodeItemForModal(item)}
        />
      )}
    </>
  );
};

// --- Main Component ---

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<"watching" | "plan_to_watch" | "completed">("watching");
  
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
    filteredItems = libraryItems.filter(i => ["watching", "reading", "playing"].includes(i.status));
  } else if (activeTab === "plan_to_watch") {
    filteredItems = libraryItems.filter(i => i.status === "plan_to_watch");
  } else if (activeTab === "completed") {
    filteredItems = libraryItems.filter(i => i.status === "completed");
  }

  const getTypeCat = (type: string) => {
    const map: any = { "movie": "Pelicula", "series": "Serie", "anime": "Anime", "game": "Videojuego", "book": "Libro", "comic": "Comic", "manga": "Manga" };
    return map[type] || type;
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* Tabs */}
      <div style={{ display: "flex", gap: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", position: "relative" }}>
        {["watching", "plan_to_watch", "completed"].map((tab) => {
          const labels: any = { "watching": "Continuar viendo", "plan_to_watch": "No comenzadas", "completed": "Terminadas" };
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
      {filteredItems.length > 0 ? (
        <ScrollRow>
          {filteredItems.map(item => {
            if (activeTab === "watching" && (item.item_type === "series" || item.item_type === "anime")) {
              return (
                <ActiveSeriesCard 
                  key={item.id}
                  item={item}
                  language={language}
                  onUpdate={() => fetchDashboard(true)}
                  onOpenSeries={(seriesItem) => setSelectedItem(seriesItem)}
                />
              );
            }
            return (
              <CustomCard 
                key={item.id}
                title={item.title}
                coverUrl={item.image_url}
                subtitle1={getTypeCat(item.item_type)}
                subtitle2={item.status === "completed" ? "Completado" : "Progreso..."}
                onCheck={item.status !== "completed" ? (e) => handleMarkDone(e, item) : undefined}
                onClick={() => setSelectedItem(item)}
                isNsfw={item.is_nsfw}
              />
            );
          })}
        </ScrollRow>
      ) : (
        <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>No hay elementos en esta categoria.</div>
      )}

        {/* Guides Row */}
        {activeTab === "watching" && upNextGuides.length > 0 && (
          <ScrollRow title="Continuar guias">
            {upNextGuides.map(g => {
              let insideTop = g.title;
              let bottomText1 = '';
              let bottomText2 = '';
              let coverBottom = getTypeCat(g.item_type);

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
                  coverTopText={insideTop}
                  coverBottomText={coverBottom}
                  subtitle1={bottomText1}
                  subtitle2={bottomText2}
                  onCheck={(e) => handleMarkDone(e, g)}
                  onClick={() => navigate(`/guide/${g.list_id}`)}
                  isNsfw={g.is_nsfw}
                />
              );
            })}
          </ScrollRow>
        )}

      {/* Activity Feed */}
      <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 600 }}>Novedades en guias seguidas</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {guideUpdates.length > 0 ? guideUpdates.map(update => {
          let text = "";
          if (update.activity_type === "item_added") text = `agrego ${update.item_title} a`;
          else if (update.activity_type === "item_removed") text = `elimino ${update.item_title} de`;
          else if (update.activity_type === "item_moved") text = `movio ${update.item_title} en`;
          else if (update.activity_type === "block_edited") text = `edito un bloque de`;
          
          return (
            <div key={update.id} style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "1rem" }}>
              {update.photo_url ? (
                <img src={update.photo_url} alt={update.username} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>{update.username.charAt(0).toUpperCase()}</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.95rem" }}>
                  <span style={{ fontWeight: 600 }}>{update.username}</span> {text} <span style={{ fontStyle: "italic" }}>{update.list_title}</span>
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
