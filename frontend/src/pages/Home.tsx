import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { MediaCard } from '../components/MediaCard';
import { getCachedTMDB, setCachedTMDB } from '../utils/tmdbCache';
import { useTranslation } from '../context/LanguageContext';
import { ItemDetailsModal } from '../components/ItemDetailsModal';



const ActiveSeriesCard = ({ item, onClick, onUpdate, language }: { item: any, onClick: () => void, onUpdate: () => void, language: string }) => {
  const [nextEp, setNextEp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNextEpisode = async () => {
    if (!item.tracking_list_id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
      const trackedEpisodes = listRes.data.items || [];

      // Parse season/episode numbers from title (e.g. "Show - S01E02 - Title")
      const parseEpInfo = (ep: any): { season: number; episode: number } => {
        const match = (ep.title || '').match(/S(\d+)E(\d+)/i);
        if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
        // fall back to stored fields if they exist
        return { season: ep.season_number || 0, episode: ep.episode_number || 0 };
      };

      let filteredSeasons: any[] = [];
      const cacheKey = `series_${item.external_id}`;
      const cached = getCachedTMDB(cacheKey);
      if (cached) {
        filteredSeasons = cached;
      } else {
        const seriesRes = await apiClient.get(`/search/series/${item.external_id}`);
        filteredSeasons = (seriesRes.data.seasons || []).filter((s: any) => s.season_number > 0);
        setCachedTMDB(cacheKey, filteredSeasons);
      }

      if (filteredSeasons.length === 0) return;

      // Sort tracked completed episodes
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

      const cacheKeyS = `${item.external_id}_s${nextSeasonNum}`;
      const cachedS = getCachedTMDB(cacheKeyS);
      let targetEp = null;
      if (cachedS) {
        targetEp = cachedS.find((e: any) => e.episode_number === nextEpNum);
      } else {
        const res = await apiClient.get(`/search/series/${item.external_id}/season/${nextSeasonNum}`);
        setCachedTMDB(cacheKeyS, res.data);
        targetEp = res.data.find((e: any) => e.episode_number === nextEpNum);
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
        title: nextEp.title || `${item.title} - S${nextEp.season_number < 10 ? '0'+nextEp.season_number : nextEp.season_number}E${nextEp.episode_number < 10 ? '0'+nextEp.episode_number : nextEp.episode_number} - ${nextEp.name || 'Untitled'}`,
        image_url: nextEp.image_url || (nextEp.still_path ? `https://image.tmdb.org/t/p/w185${nextEp.still_path}` : null),
        overview: nextEp.overview,
        season_number: nextEp.season_number,
        episode_number: nextEp.episode_number
      });
      const listRes = await apiClient.get(`/lists/${item.tracking_list_id}`);
      const updatedList = listRes.data.items || [];
      const cacheKey = `series_${item.external_id}`;
      const cached = getCachedTMDB(cacheKey);
      if (cached) {
        const totalEps = cached.reduce((acc: number, s: any) => acc + (s.episode_count || 0), 0);
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
  
  let codeText: string | undefined = undefined; // undefined = don't show progressText
  let titleText = '';
  if (nextEp) {
    codeText = `S${pad(nextEp.season_number)}E${pad(nextEp.episode_number)}`;
    titleText = nextEp.title || nextEp.name || (language === 'es' ? 'Capítulo' : 'Episode');
  }

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'game': language === 'es' ? 'Juego' : 'Game',
      'movie': language === 'es' ? 'Película' : 'Movie',
      'series': language === 'es' ? 'Serie' : 'Series',
      'anime': 'Anime',
      'book': language === 'es' ? 'Libro' : 'Book',
      'comic': 'Cómic',
      'manga': 'Manga'
    };
    return map[type] || type;
  };

  return (
    <MediaCard
      id={item.id}
      title={item.title}
      imageUrl={item.image_url}
      typeLabel={getTypeLabel(item.item_type)}
      progressText={codeText}
      subtitle={titleText || undefined}
      actionLabel={nextEp ? (language === 'es' ? 'Visto' : 'Seen') : undefined}
      isLoading={isLoading}
      onAction={nextEp ? handleMarkSeen : undefined}
      onClick={onClick}
    />
  );
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [upNextGuides, setUpNextGuides] = useState<any[]>([]);
  const [guideUpdates, setGuideUpdates] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const libRes = await apiClient.get('/library/');
      if (libRes.data) {
        const filtered = libRes.data.filter((item: any) => 
          ['watching', 'reading', 'playing'].includes(item.status)
        );
        setActiveItems(filtered);
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
      console.error('Failed to load dashboard', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleMarkDone = async (item: any) => {
    try {
      if (item.is_addition) {
        await apiClient.post(`/additions/items/additions/${item.addition_item_id}/toggle`);
      } else {
        await apiClient.post(`/lists/items/${item.item_id}/toggle`);
      }
      fetchDashboard(true); // silent refresh
    } catch (e) {
      console.error("Failed to mark item done", e);
    }
  };

  const getActionLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'movie': return 'Marcar como visto';
      case 'series': return 'Marcar como visto';
      case 'anime': return 'Marcar como visto';
      case 'book': return 'Marcar como leído';
      case 'game': return 'Marcar como terminado';
      default: return 'Marcar como completado';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Cargando Inicio...
  
      
    </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'watching': return 'Viendo';
      case 'reading': return 'Leyendo';
      case 'playing': return 'Jugando';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'series': return 'Serie';
      case 'movie': return 'Película';
      case 'game': return 'Juego';
      case 'book': return 'Libro';
      case 'anime': return 'Anime';
      default: return type;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      
      {activeItems.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔥</span> Continuar
          </h2>
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            overflowX: 'auto', 
            paddingBottom: '1rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
                        {activeItems.map((item) => {
              const nextGuideItem = item.tracking_list_id 
                ? upNextGuides.find((g: any) => g.list_id === item.tracking_list_id) 
                : null;

              if (nextGuideItem) {
                return (
                  <MediaCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    imageUrl={item.image_url}
                    typeLabel={getTypeLabel(item.item_type)}
                    progressText={nextGuideItem.title}
                    actionLabel={getActionLabel(item.item_type)}
                    onAction={() => handleMarkDone(nextGuideItem)}
                    onClick={() => setSelectedItem(item)}
                  />
                );
              }
              
              if (item.item_type === 'series' || item.item_type === 'anime') {
                return (
                  <ActiveSeriesCard
                    key={item.id}
                    item={item}
                    language={language}
                    onClick={() => setSelectedItem(item)}
                    onUpdate={fetchDashboard}
                  />
                );
              }

              return (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  imageUrl={item.image_url}
                  typeLabel={getTypeLabel(item.item_type)}
                  progressText={getStatusLabel(item.status)}
                  onClick={() => setSelectedItem(item)}
                />
              );
            })}
      
      
    </div>
        </section>
      )}

      {upNextGuides.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⏭️</span> Próximo en tus Guías
          </h2>
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            overflowX: 'auto', 
            paddingBottom: '1rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {upNextGuides.map((item) => (
              <MediaCard
                key={item.item_id}
                id={item.item_id}
                title={item.title}
                imageUrl={item.image_url}
                typeLabel={getTypeLabel(item.item_type)}
                subtitle={item.list_title}
                progressText="Siguiente a consumir"
                actionLabel={getActionLabel(item.item_type)}
                onAction={() => handleMarkDone(item)}
                onClick={() => navigate(`/guide/${item.list_id}`)}
              />
            ))}
      
      
    </div>
        </section>
      )}

      {guideUpdates.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✨</span> Actualizaciones de tus Guías
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {guideUpdates.map((update) => (
              <div 
                key={update.id} 
                className="glass-card" 
                style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                onClick={() => navigate(`/guide/${update.list_id}`)}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {update.username.charAt(0).toUpperCase()}
            
      
    </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{update.username}</span> agregó <span style={{ fontWeight: 600 }}>{update.item_title}</span> a la guía <span style={{ fontStyle: 'italic' }}>{update.list_title}</span>
                  </p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(update.created_at).toLocaleDateString()}
                  </span>
            
      
    </div>
          
      
    </div>
            ))}
      
      
    </div>
        </section>
      )}

      {activeItems.length === 0 && upNextGuides.length === 0 && guideUpdates.length === 0 && (
         <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>¡Bienvenido a tu Inicio! 🚀</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
            Aquí verás tus elementos en progreso, lo próximo que te toca ver en tus guías, y las últimas novedades. Ve a <strong>Explorar</strong> para seguir guías interesantes, o agrega algo a tu <strong>Estantería</strong> para empezar.
          </p>
    
      
    </div>
      )}


      
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
