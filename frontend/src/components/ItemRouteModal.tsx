import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ItemDetailsModal } from './ItemDetailsModal';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PathdLoader } from './PathdLoader';

interface ItemRouteModalProps {
  onClose?: () => void;
  onUpdate?: (updatedItem?: any) => void;
}

export const ItemRouteModal: React.FC<ItemRouteModalProps> = ({ onClose, onUpdate }) => {
  const params = useParams<{ type?: string; id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // If mounted outside of a matched Route, parse from location.pathname (/item/:type/:id)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const routeType = params.type || (pathParts[0] === 'item' ? pathParts[1] : undefined);
  const routeId = params.id || (pathParts[0] === 'item' ? pathParts.slice(2).join('/') : undefined);
  const type = routeType;
  const id = routeId;

  const stateItem = (location.state as any)?.item;
  const isDirectPage = !(location.state as any)?.backgroundLocation;

  // Check if location state provides this item or an item matching this id
  const matchesCurrentId = (candidate: any) => {
    if (!candidate || !id) return false;
    return (
      candidate.external_id === id ||
      String(candidate.id) === id ||
      (type === 'game' && (String(candidate.external_id) === String(id) || String(candidate.id) === String(id)))
    );
  };

  const [item, setItem] = useState<any>(() => {
    if (matchesCurrentId(stateItem)) {
      return stateItem;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !matchesCurrentId(stateItem));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If navigation state carries the item, sync it immediately
    const navItem = (location.state as any)?.item;
    if (matchesCurrentId(navItem)) {
      setItem(navItem);
      // For episodes, or items that already have rich information (title, images, etc.),
      // we can stop loading right away.
      if (type === 'episode' || navItem.item_type === 'episode' || navItem.still_path || navItem.name || navItem.image_url) {
        setLoading(false);
        return;
      }
    }

    if (item && matchesCurrentId(item)) {
      // If we already have the matching item and it has title/images, don't re-fetch
      if (type === 'episode' || item.title || item.image_url) {
        setLoading(false);
        return;
      }
    }

    if (!type || !id) {
      setError('Invalid item route parameters');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient.get('/search/lookup', {
      params: {
        item_type: type,
        external_id: id
      }
    })
      .then(res => {
        if (isMounted) {
          setItem((prev: any) => ({ ...(prev || {}), ...(res.data || {}) }));
          setLoading(false);
          // Auto-redirect URL if external_id was resolved or upgraded (e.g. wiki_... -> omdb_...)
          if (res.data?.external_id && res.data.external_id !== id) {
            navigate(`/item/${res.data.item_type || type}/${res.data.external_id}`, {
              replace: true,
              state: location.state
            });
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to lookup item for route:', err);
          // If we had a stateItem or previous item for this ID with details, preserve it!
          const existingItem = matchesCurrentId(navItem) ? navItem : matchesCurrentId(item) ? item : null;
          if (existingItem) {
            setItem(existingItem);
          } else {
            // Fallback to a bare item so the modal can still initialize its internal search/data fetchers
            setItem({
              external_id: id,
              item_type: type,
              title: id.replace(/[-_]/g, ' ')
            });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [type, id, location.state]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    const bg = (location.state as any)?.backgroundLocation;
    if (bg) {
      const targetUrl = typeof bg === 'string' ? bg : `${bg.pathname || '/'}${bg.search || ''}${bg.hash || ''}`;
      navigate(targetUrl, { replace: true });
    } else if (isDirectPage) {
      navigate('/search');
    } else {
      navigate(-1);
    }
  };

  const handleOpenItem = (newItem: any) => {
    if (!newItem) return;
    const targetType = newItem.item_type || type || 'movie';
    const targetId = newItem.external_id || newItem.id;
    navigate(`/item/${targetType}/${targetId}`, {
      replace: true,
      state: {
        backgroundLocation: (location.state as any)?.backgroundLocation || (isDirectPage ? { pathname: '/search' } : location),
        item: newItem
      }
    });
  };

  const handleUpdate = (updatedItem?: any) => {
    if (updatedItem) {
      setItem((prev: any) => ({ ...prev, ...updatedItem }));
    }
    if (onUpdate) {
      onUpdate(updatedItem);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}
      >
        <PathdLoader />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}
        onClick={handleClose}
      >
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <h3>No se pudo cargar la obra</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>{error || 'Obra no encontrada'}</p>
          <button className="btn-primary" onClick={handleClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <ItemDetailsModal
      item={item}
      isOwnProfile={true}
      profileId={user?.id}
      onClose={handleClose}
      onOpenItem={handleOpenItem}
      onUpdate={handleUpdate}
      isFavorite={Boolean(item.is_favorite)}
    />
  );
};
