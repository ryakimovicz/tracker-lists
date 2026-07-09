import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  BookOpen,
  Calendar,
  Grid,
  Heart,
  History,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface LibraryItem {
  id: number;
  item_type: 'game' | 'movie' | 'series' | 'comic' | 'manga' | 'book';
  external_id: string;
  title: string;
  image_url: string;
  status: string;
  created_at: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  photo_url: string;
  is_admin: boolean;
  created_at: string;
  created_lists: any[];
  saved_lists: any[];
}

export const Profile: React.FC = () => {
  const { t, language } = useTranslation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'game' | 'movie' | 'series' | 'book' | 'comic' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Favorites state (local highlight mock for UX polish)
  const [favorites, setFavorites] = useState<LibraryItem[]>([]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    fetchProfileAndLibrary();
  }, []);

  const fetchProfileAndLibrary = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const profileRes = await apiClient.get('/users/me');
      setProfile(profileRes.data);

      const libraryRes = await apiClient.get('/library/');
      setLibraryItems(libraryRes.data);

      // Local mockup favorites (e.g. items with 'completed' or 'read' status to showcase layout)
      const finished = libraryRes.data.filter((item: LibraryItem) => 
        ['completed', 'read'].includes(item.status)
      );
      setFavorites(finished.slice(0, 3));
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to fetch library information.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemId: number, newStatus: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.put(`/library/${itemId}`, { status: newStatus });
      setLibraryItems(prev => prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
      setSuccessMsg(language === 'es' ? 'Estado actualizado con éxito.' : 'Status updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update item status.');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm(language === 'es' ? '¿Seguro que deseas eliminar este elemento?' : 'Are you sure you want to delete this item?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.delete(`/library/${itemId}`);
      setLibraryItems(prev => prev.filter(item => item.id !== itemId));
      setSuccessMsg(language === 'es' ? 'Elemento eliminado de la estantería.' : 'Item removed from shelf.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to delete item.');
    }
  };

  // Get allowed statuses based on item type
  const getAllowedStatuses = (type: string) => {
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



  const filteredItems = libraryItems.filter(item => {
    if (mediaFilter === 'all') return true;
    return item.item_type === mediaFilter;
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando información...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px', margin: '0 auto', padding: '2rem 0' }}>
      
      {/* Profile Header Card */}
      {profile && (
        <div className="glass-card" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', padding: '2.5rem' }}>
          <img
            src={profile.photo_url}
            alt={profile.username}
            style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid var(--accent-primary)', boxShadow: 'var(--shadow-md)' }}
          />
          <div style={{ flex: 1, minWidth: 250, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{profile.username}</h1>
              {profile.is_admin && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ADMIN
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} /> {language === 'es' ? 'Miembro desde' : 'Joined'} {formatDate(new Date(profile.created_at))}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
              <span><strong>0</strong> {language === 'es' ? 'Seguidores' : 'Followers'}</span>
              <span><strong>0</strong> {language === 'es' ? 'Seguidos' : 'Following'}</span>
              <span><strong>{libraryItems.length}</strong> {language === 'es' ? 'En Estantería' : 'On Shelf'}</span>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('shelf')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'shelf' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'shelf' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'shelf' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Grid size={18} /> {language === 'es' ? 'Estantería' : 'My Shelf'}
        </button>

        <button
          onClick={() => setActiveTab('guides')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'guides' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'guides' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'guides' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <BookOpen size={18} /> {language === 'es' ? 'Mis Guías' : 'My Guides'}
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className="btn-secondary"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'favorites' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'favorites' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'favorites' ? 600 : 400,
            borderRadius: 0,
            padding: '0.75rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Heart size={18} /> {language === 'es' ? 'Destacados' : 'Favorites'}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'shelf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Media Filter Selectors */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['all', 'game', 'movie', 'series', 'book', 'comic', 'manga'] as const).map(type => (
              <button
                key={type}
                onClick={() => setMediaFilter(type)}
                className={mediaFilter === type ? 'btn-primary' : 'btn-secondary'}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize'
                }}
              >
                {t('media' + type.charAt(0).toUpperCase() + type.slice(1))}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'No hay elementos en esta categoría.' : 'No items found in this category.'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1.5rem'
            }}>
              {filteredItems.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150'}
                    alt={item.title}
                    style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                      {item.title}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                      {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                    </span>
                  </div>

                  {/* Status selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <select
                      className="input-field"
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {getAllowedStatuses(item.item_type).map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="btn-secondary"
                      style={{
                        padding: '0.25rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        color: '#ef4444',
                        background: 'transparent',
                        border: 'none'
                      }}
                    >
                      <Trash2 size={14} /> {language === 'es' ? 'Quitar' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'guides' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
          <div>
            <h3>{language === 'es' ? 'Guías Creadas' : 'Created Guides'}</h3>
            {profile.created_lists.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Aún no has creado ninguna guía.' : 'You have not created any guides yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {profile.created_lists.map((list: any) => (
                  <div key={list.id} className="glass-card" style={{ padding: '1rem' }}>
                    <h4>{list.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{list.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3>{language === 'es' ? 'Guías Guardadas' : 'Saved Guides'}</h3>
            {profile.saved_lists.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Aún no tienes guías guardadas.' : 'You have no saved guides yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {profile.saved_lists.map((list: any) => (
                  <div key={list.id} className="glass-card" style={{ padding: '1rem' }}>
                    <h4>{list.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{list.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          <h3>{language === 'es' ? 'Mis Obras Destacadas' : 'My Featured Favorites'}</h3>
          {favorites.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'Marca obras en tu estantería como "Terminado" para destacarlas aquí.' : 'Mark items on your shelf as "Completed" to highlight them here.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
              {favorites.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(124,58,237,0.9)', padding: '0.3rem', borderRadius: '50%', display: 'flex' }}>
                    <Heart size={16} fill="white" color="white" />
                  </div>
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <h4>{item.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {t('media' + item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History log mockup in footer to meet spec */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem', textAlign: 'left' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <History size={20} /> {language === 'es' ? 'Historial de Actividad' : 'Activity History'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <CheckCircle size={16} color="#10b981" />
            <div>
              <span>{language === 'es' ? 'Creaste tu cuenta de TrackerLists.' : 'Created your TrackerLists account.'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '1rem' }}>
                {profile ? formatDate(new Date(profile.created_at)) : formatDate(new Date())}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
export default Profile;
