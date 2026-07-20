import React, { useState } from 'react';
import { Search as SearchIcon, Plus } from 'lucide-react';
import { apiClient } from '../api/client';

interface SearchPanelProps {
  id: string;
  onRemove: (id: string) => void;
  canRemove: boolean;
  language: string;
  t: (key: string) => string;
  addedIds: string[];
  onSelectItem: (item: any) => void;
  setZoomedImage: (url: string) => void;
}

const stripHtml = (html: string) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  id, onRemove, canRemove, language, t, addedIds, onSelectItem, setZoomedImage
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [expandedEpisodes, setExpandedEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  const [searchTab, setSearchTab] = useState<'search' | 'manual'>('search');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');

  const triggerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await apiClient.get('/search/all', {
        params: { q: searchQuery }
      });
      setSearchResults(response.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    
    onSelectItem({
      item_type: 'manual',
      title: manualTitle.trim(),
      description: manualDescription.trim() || undefined,
      external_id: `manual-${Date.now()}`
    });
    setManualTitle('');
    setManualDescription('');
  };

  const handleLoadSeriesEpisodes = async (seriesId: string) => {
    if (expandedSeriesId === seriesId) {
      setExpandedSeriesId(null);
      return;
    }
    setExpandedSeriesId(seriesId);
    setIsLoadingEpisodes(true);
    try {
      const res = await apiClient.get(`/search/series/${seriesId}/episodes`);
      setExpandedEpisodes(res.data || []);
      const seasons = Array.from(new Set((res.data || []).map((ep: any) => ep.season_number))).sort((a: any, b: any) => a - b);
      if (seasons.length > 0) setSelectedSeason(seasons[0] as number);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', minWidth: '320px', maxWidth: '400px',
      height: '650px',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1rem',
      position: 'relative',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{language === 'es' ? 'Búsqueda' : 'Search'}</h4>
        {canRemove && (
          <button type="button" onClick={() => onRemove(id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
            &times;
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setSearchTab('search')}
          style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: searchTab === 'search' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: searchTab === 'search' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
        >
          {language === 'es' ? 'Buscar API' : 'Search API'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchTab('manual');
            if (!manualTitle && searchQuery) setManualTitle(searchQuery);
          }}
          style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: searchTab === 'manual' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: searchTab === 'manual' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
        >
          {language === 'es' ? 'Manual' : 'Manual'}
        </button>
      </div>

      {searchTab === 'search' ? (
        <>
          <form onSubmit={triggerSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                required
                className="input-field"
                placeholder={language === 'es' ? 'Ej. Batman...' : 'e.g. Batman...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', width: '100%', boxSizing: 'border-box' }}
              />
              <SearchIcon size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 1rem' }}>
              {isSearching ? '...' : t('searchButton')}
            </button>
          </form>

          {/* Category Tabs */}
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
              {[
                { value: 'all', label: language === 'es' ? 'Todo' : 'All' },
                { value: 'movie', label: language === 'es' ? 'Películas' : 'Movies' },
                { value: 'series', label: language === 'es' ? 'Series' : 'Series' },
                { value: 'anime', label: 'Anime' },
                { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
                { value: 'comic', label: language === 'es' ? 'Cómics' : 'Comics' },
                { value: 'manga', label: 'Mangas' },
                { value: 'game', label: language === 'es' ? 'Juegos' : 'Games' }
              ].map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveSearchTab(tab.value as any)}
                  style={{
                    padding: '0.2rem 0.5rem', borderRadius: '15px', border: '1px solid',
                    borderColor: activeSearchTab === tab.value ? 'var(--accent-primary)' : 'var(--border-color)',
                    background: activeSearchTab === tab.value ? 'var(--accent-primary)' : 'transparent',
                    color: activeSearchTab === tab.value ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: 500, fontSize: '0.7rem', whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
            {searchResults.length === 0 && !isSearching && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0', fontSize: '0.85rem' }}>
                {language === 'es' ? 'Escribe y busca para ver resultados.' : 'Type and search to display results.'}
              </p>
            )}
            {(() => {
              const filtered = activeSearchTab === 'all'
                ? searchResults
                : searchResults.filter(item => {
                    if (activeSearchTab === 'series') return item.item_type === 'series';
                    if (activeSearchTab === 'anime') return item.item_type === 'anime';
                    if (activeSearchTab === 'movie') return item.item_type === 'movie';
                    if (activeSearchTab === 'book') return item.item_type === 'book';
                    if (activeSearchTab === 'comic') return item.item_type === 'comic';
                    if (activeSearchTab === 'manga') return item.item_type === 'manga';
                    if (activeSearchTab === 'game') return item.item_type === 'game';
                    return true;
                  });
              
              if (filtered.length === 0 && searchResults.length > 0) {
                return (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0', fontSize: '0.85rem' }}>
                    {language === 'es' ? 'No se encontraron elementos.' : 'No items found.'}
                  </p>
                );
              }
              
              return filtered.map((media) => {
                const isExpanded = expandedMediaId === media.external_id;
                const isAlreadyAdded = media.external_id && addedIds.includes(media.external_id);
                
                return (
                  <div
                    key={media.external_id}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: '8px', textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <img
                        src={media.image_url}
                        alt={media.title}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onClick={() => setZoomedImage(media.image_url)}
                        style={{ width: '45px', height: '65px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.title}</h5>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', fontWeight: 600 }}>
                          {media.item_type === 'comic' ? (language === 'es' ? 'Cómic' : 'Comic') : media.item_type === 'manga' ? 'Manga' : t('media' + media.item_type.charAt(0).toUpperCase() + media.item_type.slice(1))}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedMediaId(isExpanded ? null : media.external_id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {isExpanded ? (language === 'es' ? 'Ocultar info' : 'Hide info') : (language === 'es' ? 'Ver info' : 'View info')}
                          </button>
                          
                          {(media.item_type === 'series' || media.item_type === 'anime') && (
                            <button
                              type="button"
                              onClick={() => handleLoadSeriesEpisodes(media.external_id)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {expandedSeriesId === media.external_id 
                                ? (language === 'es' ? 'Ocultar caps' : 'Hide eps') 
                                : (language === 'es' ? 'Ver caps' : 'View eps')
                              }
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => onSelectItem(media)}
                        className="btn-primary"
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          borderRadius: '6px',
                          background: isAlreadyAdded ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)',
                          color: isAlreadyAdded ? '#10b981' : '#ffffff',
                          border: isAlreadyAdded ? '1px solid #10b981' : 'none'
                        }}
                      >
                        {isAlreadyAdded ? (language === 'es' ? 'Añadido' : 'Added') : (language === 'es' ? 'Añadir' : 'Add')}
                      </button>
                    </div>
                    
                    {isExpanded && media.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '4px', maxHeight: '120px', overflowY: 'auto', borderLeft: '2px solid var(--accent-primary)', lineHeight: 1.4 }}>
                        {stripHtml(media.description)}
                      </div>
                    )}

                    {expandedSeriesId === media.external_id && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px' }}>
                        {isLoadingEpisodes ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {language === 'es' ? 'Cargando...' : 'Loading...'}
                          </div>
                        ) : expandedEpisodes.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {language === 'es' ? 'No hay capítulos.' : 'No episodes.'}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Temp:</span>
                                <select
                                  value={selectedSeason}
                                  onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                                  style={{ padding: '0.1rem 0.3rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                >
                                  {Array.from(new Set(expandedEpisodes.map(ep => ep.season_number))).sort((a: any, b: any) => a - b).map(season => (
                                    <option key={season as number} value={season as number}>{season as number}</option>
                                  ))}
                                </select>
                              </div>
                              
                              {(() => {
                                const seasonEps = expandedEpisodes.filter(ep => ep.season_number === selectedSeason);
                                const seasonIds = seasonEps.map(ep => `tmdb-ep-${ep.id}`);
                                const seasonExtId = `season-${media.external_id}-${selectedSeason}`;
                                const isSeasonAdded = addedIds.includes(seasonExtId) || (seasonIds.length > 0 && seasonIds.every(id => addedIds.includes(id)));
                                
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectItem({
                                        item_type: media.item_type,
                                        external_id: `season-${media.external_id}-${selectedSeason}`,
                                        title: `${media.title} - ${language === 'es' ? 'Temporada' : 'Season'} ${selectedSeason}`,
                                        image_url: media.image_url,
                                        description: `${language === 'es' ? 'Temporada completa' : 'Full season'}`,
                                        season_episodes: seasonEps,
                                        series_title: media.title,
                                        series_image: media.image_url
                                      });
                                    }}
                                    style={{
                                      padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem',
                                      background: isSeasonAdded ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)',
                                      color: isSeasonAdded ? '#10b981' : '#ffffff',
                                      border: isSeasonAdded ? '1px solid #10b981' : 'none'
                                    }}
                                  >
                                    {!isSeasonAdded && <Plus size={12} />} {isSeasonAdded ? (language === 'es' ? 'Añadida' : 'Added') : (language === 'es' ? 'Añadir Temp.' : 'Add Season')}
                                  </button>
                                );
                              })()}
                            </div>
                            
                            {expandedEpisodes.filter(ep => ep.season_number === selectedSeason).map((ep) => {
                              const ep_num = ep.episode_number;
                              const ep_name = ep.name || "Untitled Episode";
                              const seasonStr = selectedSeason < 10 ? '0' + selectedSeason : selectedSeason;
                              const fullTitle = `${media.title} - S${seasonStr}E${ep_num < 10 ? '0' + ep_num : ep_num} - ${ep_name}`;
                              const still = ep.still_path;
                              const image_url = still ? (still.startsWith('http') ? still : `https://image.tmdb.org/t/p/w185${still}`) : media.image_url;
                              
                              const ext_id = `tmdb-ep-${ep.id}`;
                              const isEpAdded = addedIds.includes(ext_id);
                              
                              return (
                                <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ep_name}>
                                    {ep_num}. {ep_name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onSelectItem({
                                      item_type: media.item_type,
                                      external_id: ext_id,
                                      title: fullTitle,
                                      image_url: image_url,
                                      description: ep.overview
                                    })}
                                    style={{
                                      padding: '0.2rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px',
                                      background: isEpAdded ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)',
                                      color: isEpAdded ? '#10b981' : '#ffffff',
                                      border: isEpAdded ? '1px solid #10b981' : 'none'
                                    }}
                                  >
                                    {isEpAdded ? (language === 'es' ? 'Añadido' : 'Added') : (language === 'es' ? 'Añadir' : 'Add')}
                                  </button>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
        <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <div className="form-group">
            <label className="form-label">{language === 'es' ? 'Título del Elemento' : 'Item Title'} <span style={{ color: 'var(--accent-primary)' }}>*</span></label>
            <input
              type="text"
              required
              className="input-field"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder={language === 'es' ? 'Ej. Mi Serie Favorita' : 'e.g. My Favorite Series'}
            />
          </div>
          <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label className="form-label">{language === 'es' ? 'Descripción (Opcional)' : 'Description (Optional)'}</label>
            <textarea
              className="input-field"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              style={{ flex: 1, resize: 'none' }}
              placeholder={language === 'es' ? 'Detalles sobre este elemento...' : 'Details about this item...'}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            {language === 'es' ? 'Añadir Manualmente' : 'Add Manually'}
          </button>
        </form>
      )}
    </div>
  );
};
