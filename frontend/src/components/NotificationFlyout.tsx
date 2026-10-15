import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, UserPlus, ThumbsUp, MessageSquare, Reply, UserCheck, X, ExternalLink, AtSign, AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export interface NotificationItem {
  id: number;
  recipient_id: number;
  actor_id: number;
  actor_username: string;
  actor_photo_url?: string | null;
  notification_type: 'activity_like' | 'activity_comment' | 'comment_reply' | 'new_follower' | 'follow_request' | 'mention' | string;
  entity_type?: string | null;
  entity_id?: string | null;
  extra_data_json?: string | null;
  is_read?: string | null;
  created_at: string;
}

interface NotificationFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  ignoreRef?: React.RefObject<HTMLElement | null>;
}

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
  ignoreRef
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const swipeWrapperRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const isUserTouchingRef = useRef(false);
  const swipeTimeoutRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useTranslation();
  const isEs = language === 'es';

  // Read active tab from URL: ?notif_tab=unread vs all (default)
  const filter: 'all' | 'unread' = searchParams.get('notif_tab') === 'unread' ? 'unread' : 'all';

  const handleSelectTab = (tab: 'all' | 'unread') => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'unread') {
      newParams.set('notif_tab', 'unread');
    } else {
      newParams.delete('notif_tab');
    }
    setSearchParams(newParams, { replace: true });

    // Scroll swipe container smoothly on mobile
    if (swipeWrapperRef.current) {
      const el = swipeWrapperRef.current;
      isProgrammaticScrollRef.current = true;
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);

      const maxScroll = el.scrollWidth - el.clientWidth;
      const targetScroll = tab === 'all' ? 0 : (maxScroll > 0 ? maxScroll : el.clientWidth);
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });

      swipeTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }
  };

  // Sync scroll position if tab changes via browser forward/back
  useEffect(() => {
    if (swipeWrapperRef.current && !isUserTouchingRef.current) {
      const el = swipeWrapperRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const targetScroll = filter === 'all' ? 0 : (maxScroll > 0 ? maxScroll : el.clientWidth);
      if (Math.abs(el.scrollLeft - targetScroll) > 10) {
        isProgrammaticScrollRef.current = true;
        el.scrollTo({ left: targetScroll, behavior: 'smooth' });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 500);
      }
    }
  }, [filter]);

  // Check swipe settling on mobile
  const checkSwipeSettled = () => {
    if (!swipeWrapperRef.current) return;
    if (isProgrammaticScrollRef.current) return;
    if (isUserTouchingRef.current) return;
    const el = swipeWrapperRef.current;
    const scrollPos = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    const scrollFraction = scrollPos / maxScroll;
    if (scrollFraction > 0.25 && scrollFraction < 0.75) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        checkSwipeSettled();
      }, 100);
      return;
    }

    const newTab: 'all' | 'unread' = scrollFraction >= 0.5 ? 'unread' : 'all';
    if (newTab !== filter) {
      const newParams = new URLSearchParams(searchParams);
      if (newTab === 'unread') {
        newParams.set('notif_tab', 'unread');
      } else {
        newParams.delete('notif_tab');
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleSwipeScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      checkSwipeSettled();
    }, 80);
  };

  // Fetch all notifications (or unread)
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/notifications/', {
        params: { limit: 60 }
      });
      if (Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Lock body scroll while notification modal is open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Click outside to close (desktop flyout)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ignoreRef?.current && ignoreRef.current.contains(target)) {
        return;
      }
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose, ignoreRef]);

  const handleMarkAsRead = async (notifId: number) => {
    try {
      await apiClient.put(`/notifications/${notifId}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, is_read: new Date().toISOString() } : n))
      );
      if (onUnreadCountChange) {
        setNotifications(latest => {
          const unread = latest.filter(n => !n.is_read).length;
          onUnreadCountChange(unread);
          return latest;
        });
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: new Date().toISOString() }))
      );
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: number) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleAcceptFollowRequest = async (e: React.MouseEvent, notif: NotificationItem) => {
    e.stopPropagation();
    try {
      setProcessingId(notif.id);
      const reqRes = await apiClient.get('/social/follow-requests');
      const reqItem = reqRes.data?.find((r: any) => r.requester_id === notif.actor_id);
      if (reqItem) {
        await apiClient.post(`/social/follow-requests/${reqItem.id}/accept`);
      }
      await handleMarkAsRead(notif.id);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err) {
      console.error('Error accepting follow request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectFollowRequest = async (e: React.MouseEvent, notif: NotificationItem) => {
    e.stopPropagation();
    try {
      setProcessingId(notif.id);
      const reqRes = await apiClient.get('/social/follow-requests');
      const reqItem = reqRes.data?.find((r: any) => r.requester_id === notif.actor_id);
      if (reqItem) {
        await apiClient.post(`/social/follow-requests/${reqItem.id}/reject`);
      }
      await handleDelete(e, notif.id);
    } catch (err) {
      console.error('Error rejecting follow request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleClickItem = (notif: NotificationItem) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }

    // Prepare a clean backgroundLocation without notifications flyout search params
    const cleanParams = new URLSearchParams(location.search);
    cleanParams.delete('notifications');
    cleanParams.delete('notif_tab');
    const cleanSearch = cleanParams.toString();
    const cleanBgLocation = {
      ...location,
      search: cleanSearch ? `?${cleanSearch}` : ''
    };

    onClose();

    if (notif.notification_type === 'admin_warning' || notif.entity_type === 'moderation') {
      navigate('/profile');
    } else if (notif.notification_type === 'new_follower' || notif.notification_type === 'follow_request') {
      navigate(`/user/${encodeURIComponent(notif.actor_username)}`);
    } else if (notif.entity_type === 'item') {
      if (notif.entity_id) {
        navigate(`/item/${notif.entity_id}`, {
          state: { backgroundLocation: cleanBgLocation }
        });
      }
    } else if (notif.entity_type === 'activity' || notif.notification_type.startsWith('activity_') || notif.notification_type === 'mention') {
      if (notif.entity_id) {
        navigate(`/post/${notif.entity_id}`, {
          state: { backgroundLocation: cleanBgLocation }
        });
      } else {
        navigate('/social');
      }
    } else if (notif.entity_type === 'guide') {
      navigate(`/guide/${notif.entity_id}`);
    } else {
      navigate(`/user/${encodeURIComponent(notif.actor_username)}`);
    }
  };

  if (!isOpen) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'admin_warning':
        return <AlertTriangle size={16} color="#ef4444" />;
      case 'activity_like':
        return <ThumbsUp size={16} color="#3b82f6" fill="#3b82f6" />;
      case 'activity_comment':
        return <MessageSquare size={16} color="#3b82f6" />;
      case 'comment_reply':
        return <Reply size={16} color="#8b5cf6" />;
      case 'new_follower':
        return <UserCheck size={16} color="#10b981" />;
      case 'follow_request':
        return <UserPlus size={16} color="#f59e0b" />;
      case 'mention':
        return <AtSign size={16} color="#ec4899" />;
      default:
        return <Bell size={16} color="var(--accent-primary)" />;
    }
  };

  // Helper to format item titles like in social event cards (e.g. S02E15, specials, comics)
  const formatNotificationItemTitle = (rawTitle?: string | null) => {
    if (!rawTitle) return null;
    const rawText = rawTitle.trim();

    // 1. Episode pattern: "Series - S01E02 - Episode Name" or "S01E02 - Episode Name"
    const epMatch = rawText.match(/^(?:(.*?)\s*-\s*)?[sS](\d+)[eE](\d+)(?:\s*-\s*(.*))?$/);
    if (epMatch) {
      const seriesName = (epMatch[1] || '').trim();
      const seasonNum = parseInt(epMatch[2], 10);
      const episodeNum = parseInt(epMatch[3], 10);
      const sPadded = seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`;
      const ePadded = episodeNum < 10 ? `0${episodeNum}` : `${episodeNum}`;
      const epCode = isEs ? `T${sPadded} | E${ePadded}` : `S${sPadded} | E${ePadded}`;
      const episodeName = (epMatch[4] || '').trim();

      return (
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{epCode}</strong>
          {episodeName && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>
              ({episodeName})
            </span>
          )}
          {seriesName && (
            <span>
              {' '}{isEs ? 'de' : 'of'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{seriesName}</strong>
            </span>
          )}
        </span>
      );
    }

    // 2. Special episode pattern: "Series - Especial / Special - Name"
    const specialMatch = rawText.match(/^(.*?)\s*-\s*(?:Especial|Special)\s*-\s*(.*)$/i);
    if (specialMatch) {
      const seriesName = (specialMatch[1] || '').trim();
      const episodeName = (specialMatch[2] || '').trim();
      return (
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{isEs ? 'Especial' : 'Special'}</strong>
          {episodeName && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>
              ({episodeName})
            </span>
          )}
          {seriesName && (
            <span>
              {' '}{isEs ? 'de' : 'of'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{seriesName}</strong>
            </span>
          )}
        </span>
      );
    }

    // 3. Comic issue pattern: "Series #12 - Title" or "Series #12"
    const comicMatch = rawText.match(/^(.*?)\s*#(\d+(?:\.\d+)?)(?:\s*-\s*(.*))?$/);
    if (comicMatch) {
      const seriesName = (comicMatch[1] || '').trim();
      const issueNum = comicMatch[2].trim();
      const issueTitle = comicMatch[3]?.trim();
      return (
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>#{issueNum}</strong>
          {issueTitle && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>
              ({issueTitle})
            </span>
          )}
          {seriesName && (
            <span>
              {' '}{isEs ? 'de' : 'of'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{seriesName}</strong>
            </span>
          )}
        </span>
      );
    }

    return <strong style={{ color: 'var(--text-primary)' }}>{rawText}</strong>;
  };

  const renderDescription = (notif: NotificationItem) => {
    let extra: any = {};
    try {
      if (notif.extra_data_json) extra = JSON.parse(notif.extra_data_json);
    } catch (e) {}

    const formattedTitle = formatNotificationItemTitle(extra.item_title);

    switch (notif.notification_type) {
      case 'admin_warning':
        return (
          <span style={{ color: '#ef4444' }}>
            <strong>{isEs ? 'Aviso de Moderación:' : 'Moderation Notice:'}</strong>{' '}
            {extra.message ? `"${extra.message}"` : (isEs ? 'Has recibido una advertencia administrativa.' : 'You received an administrative warning.')}
          </span>
        );
      case 'activity_like':
        return (
          <span>
            {formattedTitle ? (
              <>
                {isEs ? 'le dio me gusta a tu actividad de' : 'liked your activity on'}{' '}
                {formattedTitle}
              </>
            ) : (
              <span>{isEs ? 'le dio me gusta a tu actividad' : 'liked your activity'}</span>
            )}
          </span>
        );
      case 'activity_comment':
        return (
          <span>
            {formattedTitle ? (
              <>
                {isEs ? 'comentó en tu actividad de' : 'commented on your activity on'}{' '}
                {formattedTitle}
                {extra.snippet ? `: "${extra.snippet}"` : ''}
              </>
            ) : (
              <>
                {isEs ? 'comentó en tu actividad' : 'commented on your activity'}
                {extra.snippet ? `: "${extra.snippet}"` : ''}
              </>
            )}
          </span>
        );
      case 'comment_reply':
        return (
          <span>
            {isEs ? 'respondió a tu comentario' : 'replied to your comment'}
            {extra.snippet ? `: "${extra.snippet}"` : ''}
          </span>
        );
      case 'mention':
        return (
          <span>
            {isEs ? 'te mencionó en un comentario' : 'mentioned you in a comment'}
            {formattedTitle ? <> ({formattedTitle})</> : ''}
            {extra.snippet ? `: "${extra.snippet}"` : ''}
          </span>
        );
      case 'new_follower':
        return <span>{isEs ? 'comenzó a seguirte' : 'started following you'}</span>;
      case 'follow_request':
        return <span>{isEs ? 'solicitó seguirte' : 'requested to follow you'}</span>;
      default:
        return <span>{isEs ? 'interactuó contigo' : 'interacted with you'}</span>;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return isEs ? 'ahora' : 'just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return d.toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const allItems = notifications;
  const unreadItems = notifications.filter(n => !n.is_read);

  const renderNotificationList = (items: NotificationItem[], isUnreadTab: boolean) => {
    if (loading) {
      return (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {isEs ? 'Cargando notificaciones...' : 'Loading notifications...'}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.92rem' }}>
            {isUnreadTab
              ? (isEs ? 'No tienes notificaciones sin leer' : 'No unread notifications')
              : (isEs ? 'No tienes notificaciones aún' : 'No notifications yet')}
          </p>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map(notif => {
          const isUnread = !notif.is_read;
          const isFollowReq = notif.notification_type === 'follow_request';

          return (
            <div
              key={notif.id}
              onClick={() => handleClickItem(notif)}
              style={{
                padding: '0.85rem 1.15rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-color)',
                background: isUnread ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                position: 'relative'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isUnread ? 'rgba(245, 158, 11, 0.14)' : 'rgba(125, 125, 125, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isUnread ? 'rgba(245, 158, 11, 0.08)' : 'transparent';
              }}
            >
              {/* Avatar with type badge */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {notif.actor_photo_url ? (
                  <img
                    src={notif.actor_photo_url}
                    alt={notif.actor_username}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    {(notif.actor_username || 'U')[0].toUpperCase()}
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--bg-secondary, #1e1e24)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {renderIcon(notif.notification_type)}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: '0 0 0.25rem 0',
                    fontSize: '0.86rem',
                    lineHeight: 1.35,
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {notif.actor_username}
                  </span>{' '}
                  {renderDescription(notif)}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {formatTime(notif.created_at)}
                  </span>
                  {isUnread && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--accent-primary)'
                      }}
                    />
                  )}
                </div>

                {/* Actions for follow request */}
                {isFollowReq && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.6rem'
                    }}
                  >
                    <button
                      onClick={e => handleAcceptFollowRequest(e, notif)}
                      disabled={processingId === notif.id}
                      className="btn-primary"
                      style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                        borderRadius: '16px'
                      }}
                    >
                      {isEs ? 'Aceptar' : 'Accept'}
                    </button>
                    <button
                      onClick={e => handleRejectFollowRequest(e, notif)}
                      disabled={processingId === notif.id}
                      className="btn-secondary"
                      style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                        borderRadius: '16px'
                      }}
                    >
                      {isEs ? 'Rechazar' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={e => handleDelete(e, notif.id)}
                title={isEs ? 'Eliminar' : 'Delete'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  opacity: 0.6,
                  flexShrink: 0
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={panelRef}
      className="notification-flyout-panel"
      style={{
        position: 'fixed',
        left: '270px',
        bottom: '20px',
        width: '380px',
        maxHeight: '560px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--card-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.4))',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Bell size={18} color="var(--accent-primary)" className="notification-header-bell" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {isEs ? 'Notificaciones' : 'Notifications'}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={handleMarkAllAsRead}
            title={isEs ? 'Marcar todas como leídas' : 'Mark all as read'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.3rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <CheckCheck size={17} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Desktop Filter Pills */}
      <div
        className="notification-desktop-tabs"
        style={{
          display: 'flex',
          padding: '0.5rem 1rem',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => handleSelectTab('all')}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '20px',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'all' ? 'var(--accent-text, #fff)' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          {isEs ? 'Todas' : 'All'}
        </button>
        <button
          onClick={() => handleSelectTab('unread')}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '20px',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'unread' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'unread' ? 'var(--accent-text, #fff)' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          {isEs ? 'No leídas' : 'Unread'}
        </button>
      </div>

      {/* Mobile Top Tabs (Full Width Tab Bar style like Calendario / Por confirmar) */}
      <div className="notification-mobile-tabs-container">
        <button
          type="button"
          className={`notification-mobile-tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => handleSelectTab('all')}
        >
          <span>{isEs ? 'Todas' : 'All'}</span>
          {filter === 'all' && <div className="notification-tab-indicator" />}
        </button>
        <button
          type="button"
          className={`notification-mobile-tab-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => handleSelectTab('unread')}
        >
          <span>{isEs ? 'No leídas' : 'Unread'}</span>
          {filter === 'unread' && <div className="notification-tab-indicator" />}
        </button>
      </div>

      {/* Desktop List (vertical scrollable) */}
      <div
        className="notification-desktop-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '440px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {renderNotificationList(filter === 'unread' ? unreadItems : allItems, filter === 'unread')}
      </div>

      {/* Mobile Swipe Container between Todas & No leídas */}
      <div
        ref={swipeWrapperRef}
        onTouchStart={() => {
          isUserTouchingRef.current = true;
        }}
        onTouchEnd={() => {
          isUserTouchingRef.current = false;
          setTimeout(() => {
            checkSwipeSettled();
          }, 60);
        }}
        onScroll={handleSwipeScroll}
        className="notification-mobile-swipe-wrapper"
      >
        {/* Slide 1: Todas */}
        <div className="notification-mobile-swipe-slide">
          {renderNotificationList(allItems, false)}
        </div>

        {/* Slide 2: No leídas */}
        <div className="notification-mobile-swipe-slide">
          {renderNotificationList(unreadItems, true)}
        </div>
      </div>
    </div>
  );
};
