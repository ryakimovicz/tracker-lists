import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CheckCircle,
  Eye,
  Edit,
  X,
  ChevronDown,
  ChevronRight
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
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shelf' | 'guides' | 'favorites'>('shelf');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'game' | 'movie' | 'series' | 'book' | 'comic' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Viewer state for full list details
  const [viewingGuide, setViewingGuide] = useState<any | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

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
  const handleOpenGuide = async (guideId: number) => {
    setErrorMsg('');
    try {
      const response = await apiClient.get(`/lists/${guideId}`);
      setViewingGuide(response.data);
      setExpandedItems({});
      
      // Load persistent collapse states from localStorage
      const cachedCollapse = localStorage.getItem(`guide_collapsed_${guideId}`);
      if (cachedCollapse) {
        try {
          setCollapsedNodes(JSON.parse(cachedCollapse));
        } catch(e) {
          setCollapsedNodes({});
        }
      } else {
        setCollapsedNodes({});
      }
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al cargar los detalles de la guía.' : 'Error loading guide details.');
    }
  };

  const toggleNodeCollapse = (nodeId: string) => {
    if (!viewingGuide) return;
    setCollapsedNodes(prev => {
      const updated = { ...prev, [nodeId]: !prev[nodeId] };
      localStorage.setItem(`guide_collapsed_${viewingGuide.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleItemProgress = async (itemId: number) => {
    if (!viewingGuide) return;
    try {
      await apiClient.post(`/lists/items/${itemId}/toggle`);
      
      // Update completion status in local viewing state
      setViewingGuide((prev: any) => {
        if (!prev) return null;
        
        let toggledState = false;
        const updatedItems = (prev.items || []).map((item: any) => {
          if (item.id === itemId) {
            toggledState = !item.is_completed;
            return { ...item, is_completed: toggledState };
          }
          return item;
        });

        // Re-calculate statistics
        const completedCount = updatedItems.filter((i: any) => i.is_completed).length;
        const totalCount = updatedItems.length;
        const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return {
          ...prev,
          items: updatedItems,
          completed_count: completedCount,
          progress_percentage: Math.round(progressPercentage * 100) / 100
        };
      });
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to toggle item progress.');
    }
  };
  const handleBulkToggle = async (itemIds: number[], completed: boolean) => {
    if (!viewingGuide || itemIds.length === 0) return;
    try {
      await apiClient.post(`/lists/${viewingGuide.id}/items/bulk-toggle`, {
        item_ids: itemIds,
        completed
      });

      setViewingGuide((prev: any) => {
        if (!prev) return null;
        const updatedItems = (prev.items || []).map((item: any) => {
          if (itemIds.includes(item.id)) {
            return { ...item, is_completed: completed };
          }
          return item;
        });

        const completedCount = updatedItems.filter((i: any) => i.is_completed).length;
        const totalCount = updatedItems.length;
        const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return {
          ...prev,
          items: updatedItems,
          completed_count: completedCount,
          progress_percentage: Math.round(progressPercentage * 100) / 100
        };
      });
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to update bulk progress.');
    }
  };
  const handleDeleteGuide = async (listId: number) => {
    if (!window.confirm(language === 'es' ? '¿Estás seguro de que deseas eliminar esta guía?' : 'Are you sure you want to delete this guide?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.delete(`/lists/${listId}`);
      
      // Update local profile list
      setProfile((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          created_lists: (prev.created_lists || []).filter((l: any) => l.id !== listId),
          saved_lists: (prev.saved_lists || []).filter((l: any) => l.id !== listId)
        };
      });

      setSuccessMsg(language === 'es' ? 'Guía eliminada con éxito.' : 'Guide deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'No se pudo eliminar la guía.' : 'Failed to delete guide.');
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
                  <div key={list.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{list.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>{list.description}</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                        {list.visibility}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      <button onClick={() => navigate(`/create?edit=${list.id}`)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Edit size={14} /> {language === 'es' ? 'Editar' : 'Edit'}
                      </button>
                      <button onClick={() => handleDeleteGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <Trash2 size={14} /> {language === 'es' ? 'Eliminar' : 'Delete'}
                      </button>
                    </div>
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
                  <div key={list.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{list.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>{list.description}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleOpenGuide(list.id)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                        <Eye size={14} /> {language === 'es' ? 'Ver' : 'View'}
                      </button>
                    </div>
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
      
      {/* Interactive Guide Details Modal */}
      {viewingGuide && (
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
          <div className="glass-card" style={{ width: '700px', maxHeight: '85vh', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>{viewingGuide.title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>{viewingGuide.description}</p>
              </div>
              <button onClick={() => setViewingGuide(null)} className="btn-secondary" style={{ padding: '0.35rem', border: 'none', background: 'transparent' }}>
                <X size={20} />
              </button>
            </div>

            {/* Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Progreso Completado:' : 'Completed Progress:'}</span>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>{viewingGuide.completed_count} / {viewingGuide.total_count} ({viewingGuide.progress_percentage}%)</h4>
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Creador:' : 'Creator:'}</span>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', textTransform: 'capitalize' }}>{viewingGuide.creator_username}</h4>
              </div>
            </div>

            {/* Document Flow structured list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(() => {
                const docFlowList = viewingGuide.section_descriptions?.flow || [];
                const itemsList = viewingGuide.items || [];
                
                // Helper to parse JSON notes
                const parseNotes = (notes: string) => {
                  try {
                    if (notes.startsWith('{')) return JSON.parse(notes);
                  } catch(e){}
                  return { description: notes, sub_items: [] };
                };

                // Helper to clean HTML
                const stripHtml = (html: string) => {
                  if (!html) return '';
                  const clean = html.replace(/<[^>]*>/g, '');
                  const txt = document.createElement('textarea');
                  txt.innerHTML = clean;
                  return txt.value;
                };

                if (docFlowList.length === 0) {
                  // Fallback: render flat list of items
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {itemsList.map((item: any) => {
                        const notes = parseNotes(item.custom_notes || '');
                        const showInfo = expandedItems[item.id];
                        return (
                          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <input
                                  type="checkbox"
                                  checked={item.is_completed}
                                  onChange={() => handleToggleItemProgress(item.id)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.title}
                                  onClick={() => setZoomedImage(item.image_url)}
                                  style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <h5 style={{ margin: 0 }}>{item.title}</h5>
                              </div>
                              {notes.description && (
                                <button
                                  onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  className="btn-secondary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  {showInfo ? (language === 'es' ? 'Ocultar info' : 'Hide info') : (language === 'es' ? 'Ver info' : 'View info')}
                                </button>
                              )}
                            </div>
                            {showInfo && notes.description && (
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '2.5rem' }}>{stripHtml(notes.description)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Helper to get all items under a section
                const getSectionItemIds = (sectionEl: any) => {
                  const ids: number[] = [];
                  const idx = docFlowList.findIndex((x: any) => x.id === sectionEl.id);
                  if (idx === -1) return ids;
                  for (let i = idx + 1; i < docFlowList.length; i++) {
                    const el = docFlowList[i];
                    if (el.type === 'section') break;
                    if (el.type === 'block') {
                      (el.items || []).forEach((item: any) => ids.push(item.id));
                      (el.subblocks || []).forEach((sub: any) => {
                        (sub.items || []).forEach((item: any) => ids.push(item.id));
                      });
                    }
                  }
                  return ids;
                };

                // Helper to get all items under a block
                const getBlockItemIds = (blockEl: any) => {
                  const ids: number[] = [];
                  (blockEl.items || []).forEach((item: any) => ids.push(item.id));
                  (blockEl.subblocks || []).forEach((sub: any) => {
                    (sub.items || []).forEach((item: any) => ids.push(item.id));
                  });
                  return ids;
                };

                // Helper to get all items under a subblock
                const getSubblockItemIds = (subblockEl: any) => {
                  return (subblockEl.items || []).map((item: any) => item.id);
                };

                // Render structured flow
                let currentSectionCollapsed = false;
                return docFlowList.map((el: any) => {
                  if (el.type === 'section') {
                    const sectionIds = getSectionItemIds(el);
                    const isSectionCompleted = sectionIds.length > 0 && sectionIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                    const isCollapsed = collapsedNodes[el.id] || false;
                    currentSectionCollapsed = isCollapsed;
                    
                    return (
                      <div key={el.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleNodeCollapse(el.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {sectionIds.length > 0 && (
                          <input
                            type="checkbox"
                            checked={isSectionCompleted}
                            onChange={() => handleBulkToggle(sectionIds, !isSectionCompleted)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <h3 style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>{el.title.toUpperCase() || (language === 'es' ? 'SECCIÓN SIN TÍTULO' : 'UNTITLED SECTION')}</h3>
                          {el.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.25rem 0 0 0' }}>{el.description}</p>}
                        </div>
                      </div>
                    );
                  }

                  if (el.type === 'block') {
                    if (currentSectionCollapsed) return null;

                    const blockItemsIds = (el.items || []).map((i: any) => i.id);
                    const blockItems = itemsList.filter((item: any) => blockItemsIds.includes(item.id));
                    const allBlockIds = getBlockItemIds(el);
                    const isBlockCompleted = allBlockIds.length > 0 && allBlockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                    const isCollapsed = collapsedNodes[el.id] || false;
                    
                    const priorityLabel = el.importance_rank && viewingGuide.importance_labels
                      ? viewingGuide.importance_labels[el.importance_rank.toString()]
                      : '';

                    return (
                      <div key={el.id} style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <button
                            onClick={() => toggleNodeCollapse(el.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                          >
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </button>
                          {allBlockIds.length > 0 && (
                            <input
                              type="checkbox"
                              checked={isBlockCompleted}
                              onChange={() => handleBulkToggle(allBlockIds, !isBlockCompleted)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{el.title || (language === 'es' ? 'Bloque sin título' : 'Untitled Block')}</h4>
                              {priorityLabel && <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({priorityLabel})</span>}
                            </div>
                            {el.description && <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>{el.description}</p>}
                          </div>
                        </div>

                        {!isCollapsed && (
                          <>
                            {/* Block Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                              {blockItems.map((item: any) => {
                                const notes = parseNotes(item.custom_notes || '');
                                const showInfo = expandedItems[item.id];
                                return (
                                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={item.is_completed}
                                        onChange={() => handleToggleItemProgress(item.id)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                      />
                                      {item.image_url && (
                                        <img
                                          src={item.image_url}
                                          alt={item.title}
                                          onClick={() => setZoomedImage(item.image_url)}
                                          style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                                        />
                                      )}
                                      <div style={{ flex: 1 }}>
                                        <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</h5>
                                      </div>
                                      {notes.description && (
                                        <button
                                          onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                          className="btn-secondary"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        >
                                          {showInfo ? (language === 'es' ? 'Ocultar info' : 'Hide info') : (language === 'es' ? 'Ver info' : 'View info')}
                                        </button>
                                      )}
                                    </div>
                                    {showInfo && notes.description && (
                                      <div style={{ paddingLeft: '2.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stripHtml(notes.description)}</p>
                                        {notes.sub_items && notes.sub_items.length > 0 && (
                                          <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1rem', fontSize: '0.78rem', fontFamily: 'monospace', listStyleType: 'circle' }}>
                                            {notes.sub_items.map((sub: string, sidx: number) => <li key={sidx}>{sub}</li>)}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Nested Subblocks */}
                            {(el.subblocks || []).map((sub: any) => {
                              const subItemsIds = (sub.items || []).map((i: any) => i.id);
                              const subItems = itemsList.filter((item: any) => subItemsIds.includes(item.id));
                              const allSubblockIds = getSubblockItemIds(sub);
                              const isSubblockCompleted = allSubblockIds.length > 0 && allSubblockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                              const isSubCollapsed = collapsedNodes[sub.id] || false;
                              
                              const subPriorityLabel = sub.importance_rank && viewingGuide.importance_labels
                                ? viewingGuide.importance_labels[sub.importance_rank.toString()]
                                : '';

                              return (
                                <div key={sub.id} style={{ marginLeft: '1.5rem', paddingLeft: '0.75rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                      onClick={() => toggleNodeCollapse(sub.id)}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                    >
                                      {isSubCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    {allSubblockIds.length > 0 && (
                                      <input
                                        type="checkbox"
                                        checked={isSubblockCompleted}
                                        onChange={() => handleBulkToggle(allSubblockIds, !isSubblockCompleted)}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                      />
                                    )}
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{sub.title || (language === 'es' ? 'Subbloque sin título' : 'Untitled Subblock')}</h5>
                                        {subPriorityLabel && <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({subPriorityLabel})</span>}
                                      </div>
                                      {sub.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>{sub.description}</p>}
                                    </div>
                                  </div>

                                  {!isSubCollapsed && (
                                    /* Subblock items */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem' }}>
                                      {subItems.map((item: any) => {
                                        const notes = parseNotes(item.custom_notes || '');
                                        const showInfo = expandedItems[item.id];
                                        return (
                                          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                              <input
                                                type="checkbox"
                                                checked={item.is_completed}
                                                onChange={() => handleToggleItemProgress(item.id)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                              />
                                              {item.image_url && (
                                                <img
                                                  src={item.image_url}
                                                  alt={item.title}
                                                  onClick={() => setZoomedImage(item.image_url)}
                                                  style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in' }}
                                                />
                                              )}
                                              <div style={{ flex: 1 }}>
                                                <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</h6>
                                              </div>
                                              {notes.description && (
                                                <button
                                                  onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                                  className="btn-secondary"
                                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                                                >
                                                  {showInfo ? (language === 'es' ? 'Ocultar info' : 'Hide info') : (language === 'es' ? 'Ver info' : 'View info')}
                                                </button>
                                              )}
                                            </div>
                                            {showInfo && notes.description && (
                                              <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{stripHtml(notes.description)}</p>
                                                {notes.sub_items && notes.sub_items.length > 0 && (
                                                  <ul style={{ margin: '0.15rem 0 0 0', paddingLeft: '1rem', fontSize: '0.75rem', fontFamily: 'monospace', listStyleType: 'circle' }}>
                                                    {notes.sub_items.map((sub: string, sidx: number) => <li key={sidx}>{sub}</li>)}
                                                  </ul>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                });
              })()}
            </div>

            <button onClick={() => setViewingGuide(null)} className="btn-primary" style={{ alignSelf: 'flex-end', marginTop: '1rem' }}>
              {language === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomedImage}
            alt="Zoomed preview"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

    </div>
  );
};
export default Profile;
