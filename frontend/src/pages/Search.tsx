import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Search as SearchIcon, AlertCircle, CheckCircle, Plus } from 'lucide-react';

interface SearchResultItem {
  external_id: string;
  title: string;
  image_url: string;
  description: string;
  item_type: 'game' | 'movie' | 'series' | 'comic' | 'manga' | 'book';
}

const stripHtml = (html: string) => {
  if (!html) return '';
  const clean = html.replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return txt.value;
};

export const Search: React.FC = () => {
  const { t, language } = useTranslation();

  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<'game' | 'movie' | 'series' | 'comic' | 'manga' | 'book'>('game');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // States for adding to shelf
  const [selectedItemForShelf, setSelectedItemForShelf] = useState<SearchResultItem | null>(null);
  const [shelfStatus, setShelfStatus] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    try {
      const response = await apiClient.get('/search/', {
        params: {
          q: query,
          type: mediaType
        }
      });
      setResults(response.data);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setErrorMsg(t('errRateLimit'));
      } else {
        setErrorMsg(t('errSearchFailed'));
      }
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusesForType = (type: string) => {
    if (type === 'game') {
      return [
        { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
        { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
        { value: 'completed', label: language === 'es' ? 'Terminado' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (type === 'movie') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'completed', label: language === 'es' ? 'Visto' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (type === 'series') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'watching', label: language === 'es' ? 'Viendo' : 'Watching' },
        { value: 'completed', label: language === 'es' ? 'Terminada' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    // comic, manga, book
    return [
      { value: 'plan_to_read', label: language === 'es' ? 'Por Leer' : 'Plan to Read' },
      { value: 'reading', label: language === 'es' ? 'Leyendo' : 'Reading' },
      { value: 'read', label: language === 'es' ? 'Leído' : 'Read' },
      { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
    ];
  };

  const handleOpenAddShelf = (item: SearchResultItem) => {
    const defaultStatuses = getStatusesForType(item.item_type);
    setSelectedItemForShelf(item);
    setShelfStatus(defaultStatuses[0].value);
  };

  const handleAddToShelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForShelf || !shelfStatus) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.post('/library/', {
        item_type: selectedItemForShelf.item_type,
        external_id: selectedItemForShelf.external_id,
        title: selectedItemForShelf.title,
        image_url: selectedItemForShelf.image_url,
        status: shelfStatus
      });
      setSuccessMsg(t('searchItemAdded'));
      setSelectedItemForShelf(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to your library shelf.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header and Search Form */}
      <section className="glass-card" style={{ padding: '2.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2>{t('searchTitle')}</h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <select
            className="input-field"
            value={mediaType}
            onChange={(e: any) => setMediaType(e.target.value)}
            style={{ width: '160px', padding: '0 1rem' }}
          >
            <option value="game">{t('mediaGame')}</option>
            <option value="movie">{t('mediaMovie')}</option>
            <option value="series">{t('mediaSeries')}</option>
            <option value="book">{t('mediaBook')}</option>
            <option value="comic">{t('mediaComic')}</option>
            <option value="manga">{t('mediaManga')}</option>
          </select>

          <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 2rem' }}>
            {isSearching ? '...' : t('searchButton')}
          </button>
        </form>
      </section>

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Results Display */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {results.map((item) => (
            <div key={item.external_id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <img
                src={item.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150'}
                alt={item.title}
                style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px' }}
              />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                  {item.title}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, height: '3.2rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {stripHtml(item.description)}
                </p>
              </div>

              <button onClick={() => handleOpenAddShelf(item)} className="btn-secondary" style={{ width: '100%', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> {t('searchAddShelf')}
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !isSearching && query && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('searchNoResults')}
        </div>
      )}

      {/* Add To Shelf Overlay Modal */}
      {selectedItemForShelf && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="glass-card" style={{ width: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, textAlign: 'left' }}>{t('searchSelectStatus')}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
              {selectedItemForShelf.title}
            </p>

            <form onSubmit={handleAddToShelfSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <select
                className="input-field"
                value={shelfStatus}
                onChange={(e) => setShelfStatus(e.target.value)}
              >
                {getStatusesForType(selectedItemForShelf.item_type).map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedItemForShelf(null)}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" className="btn-primary">
                  {language === 'es' ? 'Agregar' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default Search;
