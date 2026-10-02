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

  const [item, setItem] = useState<any>(() => {
    if (stateItem && (stateItem.external_id === id || String(stateItem.id) === id)) {
      return stateItem;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(!item);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have the matching item from navigation state, don't re-fetch
    if (item && (item.external_id === id || String(item.id) === id)) {
      setLoading(false);
      return;
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
          setItem(res.data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to lookup item for route:', err);
          // Fallback to a bare item so the modal can still initialize its internal search/data fetchers
          setItem({
            external_id: id,
            item_type: type,
            title: id.replace(/[-_]/g, ' ')
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [type, id]);

  const handleClose = () => {
    if (onClose) {
      onClose();
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
