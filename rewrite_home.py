import os

new_code = '''import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getCachedTMDB, setCachedTMDB } from '../utils/tmdbCache';
import { useTranslation } from '../context/LanguageContext';
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
  onCheck, 
  onClick, 
  isNsfw 
}: { 
  title: string; 
  coverUrl?: string; 
  subtitle1?: string; 
  subtitle2?: string; 
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
      </div>
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
        {subtitle1 && <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{subtitle1}</div>}
        {subtitle2 && <div style={{ fontSize: "0.85rem", fontWeight: 500, lineHeight: 1.2 }}>{subtitle2}</div>}
      </div>
      {onCheck && !currentlyBlurred && (
        <button 
          onClick={onCheck}
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
        await apiClient.post(/additions/items/additions//toggle);
      } else if (item.item_id) {
        await apiClient.post(/lists/items//toggle);
      } else {
        await apiClient.put(/library/, { status: 'completed' });
      }
      fetchDashboard(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Cargando Inicio...</div>;
  }

  // Filter Library Items
  let filteredItems = [];
  if (activeTab === "watching") {
    filteredItems = libraryItems.filter(i => ["watching", "reading", "playing"].includes(i.status));
  } else if (activeTab === "plan_to_watch") {
    filteredItems = libraryItems.filter(i => i.status === "plan_to_watch");
  } else if (activeTab === "completed") {
    filteredItems = libraryItems.filter(i => i.status === "completed");
  }

  const getTypeCat = (type: string) => {
    const map: any = { "movie": "Película", "series": "Serie", "anime": "Anime", "game": "Videojuego", "book": "Libro", "comic": "Cómic", "manga": "Manga" };
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
          {filteredItems.map(item => (
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
          ))}
        </ScrollRow>
      ) : (
        <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>No hay elementos en esta categoría.</div>
      )}

      {/* Guides Row */}
      {activeTab === "watching" && upNextGuides.length > 0 && (
        <ScrollRow title="Continuar guías">
          {upNextGuides.map(g => (
            <CustomCard 
              key={g.item_id}
              title={g.list_title}
              coverUrl={g.image_url}
              subtitle1={getTypeCat(g.item_type)}
              subtitle2={g.title}
              onCheck={(e) => handleMarkDone(e, g)}
              onClick={() => navigate(/guide/)}
              isNsfw={g.is_nsfw}
            />
          ))}
        </ScrollRow>
      )}

      {/* Activity Feed */}
      <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 600 }}>Novedades en guías seguidas</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {guideUpdates.length > 0 ? guideUpdates.map(update => {
          let text = "";
          if (update.activity_type === "item_added") text = gregó  a;
          else if (update.activity_type === "item_removed") text = eliminó  de;
          else if (update.activity_type === "item_moved") text = movió  en;
          else if (update.activity_type === "block_edited") text = editó un bloque de;
          
          return (
            <div key={update.id} style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "1rem" }}>
              {update.photo_url ? (
                <img src={update.photo_url} alt={update.username} style={{ width: 40, height: 40, borderRadius: "50%" }} />
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
        />
      )}
    </div>
  );
};

export default Home;
'''

with open('frontend/src/pages/Home.tsx', 'w', encoding='utf-8') as f:
    f.write(new_code)
