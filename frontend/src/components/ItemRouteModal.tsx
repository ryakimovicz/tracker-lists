import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ItemDetailsModal } from './ItemDetailsModal';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { PathdLoader } from './PathdLoader';
import { Clock, AlertCircle } from 'lucide-react';
import { getCategoryLabel } from '../utils/categoryOrder';

interface ItemRouteModalProps {
  onClose?: () => void;
  onUpdate?: (updatedItem?: any) => void;
}

export const ItemRouteModal: React.FC<ItemRouteModalProps> = ({ onClose, onUpdate }) => {
  const params = useParams<{ type?: string; id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTranslation();

  // If mounted outside of a matched Route, parse from location.pathname (/item/:type/:id)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const routeType = params.type || (pathParts[0] === 'item' ? pathParts[1] : undefined);
  const routeId = params.id || (pathParts[0] === 'item' ? pathParts.slice(2).join('/') : undefined);
  const type = routeType;
  const id = routeId;

  const stateItem = (location.state as any)?.item;
  const isDirectPage = !(location.state as any)?.backgroundLocation;

  // Rate limit tracking for this item route
  const [rateLimitInfo, setRateLimitInfo] = useState<{ category: string; resetAt: number; reason: string } | null>(null);

  const formatResetInfo = (resetAtSecs: number, lang: string) => {
    const isEs = lang === 'es';
    const now = Date.now();
    const resetMs = resetAtSecs * 1000;
    const diffSecs = Math.max(0, Math.round((resetMs - now) / 1000));
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;

    const resetDate = new Date(resetMs);
    const isToday = resetDate.toDateString() === new Date().toDateString();

    const timeStr = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = resetDate.toLocaleDateString([], { day: 'numeric', month: 'short' });

    let fullTimeDisplay = '';
    if (isToday) {
      fullTimeDisplay = isEs ? `Hoy a las ${timeStr} hs` : `Today at ${timeStr}`;
    } else {
      fullTimeDisplay = isEs ? `El ${dateStr} a las ${timeStr} hs` : `${dateStr} at ${timeStr}`;
    }

    let relativeDisplay = '';
    if (diffHours > 0) {
      relativeDisplay = isEs 
        ? `en ~${diffHours} h${remMins > 0 ? ` ${remMins} min` : ''}` 
        : `in ~${diffHours}h${remMins > 0 ? ` ${remMins}m` : ''}`;
    } else if (diffMins > 0) {
      relativeDisplay = isEs ? `en ~${diffMins} min` : `in ~${diffMins} min`;
    } else {
      relativeDisplay = isEs ? 'en unos instantes' : 'in a few moments';
    }

    return { fullTimeDisplay, relativeDisplay };
  };

  // Check if location state provides this item or an item matching this id
  const matchesCurrentId = (candidate: any) => {
    if (!candidate || !id) return false;
    const cleanCand = String(candidate.external_id || candidate.id || '')
      .replace('cv_issue_metron_issue_', '')
      .replace(/^cv_issue_|^metron_issue_|^cv_vol_|^metron_series_|^tvm[-_]ep[-_]|^tvm[-_]/, '');
    const cleanRouteId = String(id)
      .replace('cv_issue_metron_issue_', '')
      .replace(/^cv_issue_|^metron_issue_|^cv_vol_|^metron_series_|^tvm[-_]ep[-_]|^tvm[-_]/, '');
    return (
      candidate.external_id === id ||
      String(candidate.id) === id ||
      (cleanCand && cleanRouteId && cleanCand === cleanRouteId) ||
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
      // For episodes, or items that already have rich description/details,
      // we can stop loading right away.
      const hasFullDetails = Boolean(
        type === 'episode' ||
        navItem.item_type === 'episode' ||
        navItem.still_path ||
        (type === 'comic' && (navItem.issue_number || navItem.parent_series || navItem.title?.includes('#'))) ||
        (navItem.description && String(navItem.description).trim().length > 0)
      );
      if (hasFullDetails) {
        setLoading(false);
        return;
      }
    }

    if (item && matchesCurrentId(item)) {
      // If we already have the matching item and it has rich description, don't re-fetch
      const hasFullDetails = Boolean(
        type === 'episode' ||
        item.item_type === 'episode' ||
        item.still_path ||
        (item.description && String(item.description).trim().length > 0)
      );
      if (hasFullDetails) {
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
          const limCat = res.headers?.['x-category-rate-limited'];
          const rst = Number(res.headers?.['x-category-rate-limit-reset'] || 0);
          const rsn = res.headers?.['x-category-rate-limit-reason'] || 'temporary_limit';
          if (limCat && rst > 0) {
            setRateLimitInfo({ category: limCat, resetAt: rst, reason: rsn });
          }

          setItem((prev: any) => ({ ...(prev || {}), ...(res.data || {}) }));
          setLoading(false);
          // Auto-redirect URL if external_id was resolved or upgraded (e.g. wiki_... -> trakt_...)
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
          const hdrs = err.response?.headers || {};
          const limCat = hdrs['x-category-rate-limited'] || (err.response?.status === 429 ? (type || 'media') : null);
          const rst = Number(hdrs['x-category-rate-limit-reset'] || 0);
          const rsn = hdrs['x-category-rate-limit-reason'] || (err.response?.status === 429 ? 'daily_limit' : 'temporary_limit');
          if (limCat && rst > 0) {
            setRateLimitInfo({ category: limCat, resetAt: rst, reason: rsn });
          }

          // If we had a stateItem or previous item for this ID with details, preserve it!
          const existingItem = matchesCurrentId(navItem) ? navItem : matchesCurrentId(item) ? item : null;
          if (existingItem) {
            setItem(existingItem);
          } else {
            // Fallback to a bare item so the modal can still initialize its internal search/data fetchers
            const cleanFallbackTitle = id
              .replace(/^cv_issue_metron_issue_|^cv_issue_|^metron_issue_|^cv_vol_|^metron_series_|^tvm[-_]ep[-_]|^tvm[-_]/, '')
              .replace(/[-_]/g, ' ')
              .trim();
            setItem({
              external_id: id,
              item_type: type,
              title: cleanFallbackTitle ? (cleanFallbackTitle.charAt(0).toUpperCase() + cleanFallbackTitle.slice(1)) : id
            });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [type, id, location.state]);

  const isFromParent = Boolean((location.state as any)?.fromParent || ((location.state as any)?.modalDepth || 0) > 1);

  const handleBack = () => {
    navigate(-1);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    const currentDepth = (location.state as any)?.modalDepth || 1;
    const bg = (location.state as any)?.backgroundLocation;
    if (bg && currentDepth > 1) {
      navigate(-currentDepth);
    } else if (bg && window.history.length > 1 && !isDirectPage) {
      navigate(-1);
    } else if (bg) {
      let targetUrl = typeof bg === 'string' ? bg : `${bg.pathname || '/'}${bg.search || ''}${bg.hash || ''}`;
      // Clean notifications query params if any were attached
      targetUrl = targetUrl.replace(/[?&]notifications(=[^&]*)?/g, '').replace(/[?&]notif_tab(=[^&]*)?/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
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
    const currentDepth = (location.state as any)?.modalDepth || 1;
    navigate(`/item/${targetType}/${targetId}`, {
      state: {
        backgroundLocation: (location.state as any)?.backgroundLocation || (isDirectPage ? { pathname: '/search' } : location),
        item: newItem,
        modalDepth: currentDepth + 1,
        fromParent: true
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

  const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
    const nextFav = !currentFav;
    setItem((prev: any) => prev ? { ...prev, is_favorite: nextFav } : prev);
    try {
      await apiClient.put(`/library/${itemId}`, { is_favorite: nextFav });
    } catch (e) {
      console.error('Failed to toggle favorite in ItemRouteModal:', e);
      setItem((prev: any) => prev ? { ...prev, is_favorite: currentFav } : prev);
      throw e;
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

  // If rate limit active and no valid full item could be resolved
  if (rateLimitInfo && (!item || (!item.title && !item.name))) {
    const timeInfo = formatResetInfo(rateLimitInfo.resetAt, language);
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
          zIndex: 2000,
          padding: '1rem'
        }}
        onClick={handleClose}
      >
        <div 
          className="glass-card" 
          style={{ 
            padding: '2.5rem 2rem', 
            textAlign: 'center', 
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 28, 0.85) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 12px 32px rgba(245, 158, 11, 0.1)',
            borderRadius: '16px',
            maxWidth: '560px' 
          }} 
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '1.25rem' }}>
            <Clock size={28} color="#f59e0b" />
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            {(language as string) === 'es'
              ? `Límite de consultas alcanzado en ${getCategoryLabel(type || 'comic', true, false)}`
              : `Query limit reached in ${getCategoryLabel(type || 'comic', false, false)}`}
          </h3>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            {rateLimitInfo.reason === 'daily_limit'
              ? (language === 'es'
                  ? 'Se ha alcanzado la cuota diaria de este catálogo para proteger el servicio. Los detalles completos se restablecerán a las:'
                  : 'Daily quota for this catalog has been reached to protect the service. Full details will reset at:')
              : (language === 'es'
                  ? 'Las consultas en esta categoría están pausadas momentáneamente para evitar sobrecargas. Se restablecerán a las:'
                  : 'Queries in this category are temporarily paused to prevent overloading. Resetting at:')
            }
          </p>

          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.6rem', 
            padding: '0.65rem 1.4rem', 
            borderRadius: '30px', 
            background: 'rgba(245, 158, 11, 0.12)', 
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontWeight: 600,
            fontSize: '0.95rem',
            marginBottom: '1.5rem'
          }}>
            <Clock size={16} />
            <span>{timeInfo.fullTimeDisplay} ({timeInfo.relativeDisplay})</span>
          </div>

          <div>
            <button className="btn-primary" onClick={handleClose}>
              {language === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>
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
      onBack={isFromParent ? handleBack : undefined}
      onOpenItem={handleOpenItem}
      onUpdate={handleUpdate}
      isFavorite={Boolean(item?.is_favorite)}
      onToggleFavorite={handleToggleFavorite}
    />
  );
};
