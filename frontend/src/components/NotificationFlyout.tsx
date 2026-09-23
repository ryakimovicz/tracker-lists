import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, UserPlus, ThumbsUp, MessageSquare, Reply, UserCheck, X, ExternalLink } from 'lucide-react';
import { apiClient } from '../api/client';
import { useNavigate } from 'react-router-dom';
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
}

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isEs = language === 'es';

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/notifications/', {
        params: { unread_only: filter === 'unread', limit: 40 }
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
  }, [isOpen, filter]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

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
      // Find the request by requester
      const reqRes = await apiClient.get('/social/follow-requests');
      const reqItem = reqRes.data?.find((r: any) => r.requester_id === notif.actor_id);
      if (reqItem) {
        await apiClient.post(`/social/follow-requests/${reqItem.id}/accept`);
      }
      await handleMarkAsRead(notif.id);
      // Remove from list or update
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

    if (notif.notification_type === 'new_follower' || notif.notification_type === 'follow_request') {
      navigate(`/user/${encodeURIComponent(notif.actor_username)}`);
      onClose();
    } else if (notif.entity_type === 'activity' || notif.notification_type.startsWith('activity_')) {
      navigate('/social');
      onClose();
    } else if (notif.entity_type === 'guide') {
      navigate(`/guide/${notif.entity_id}`);
      onClose();
    } else {
      navigate(`/user/${encodeURIComponent(notif.actor_username)}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderIcon = (type: string) => {
    switch (type) {
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
      default:
        return <Bell size={16} color="var(--accent-primary)" />;
    }
  };

  const renderDescription = (notif: NotificationItem) => {
    let extra: any = {};
    try {
      if (notif.extra_data_json) extra = JSON.parse(notif.extra_data_json);
    } catch (e) {}

    switch (notif.notification_type) {
      case 'activity_like':
        return (
          <span>
            {isEs ? 'le dio me gusta a tu actividad' : 'liked your activity'}{' '}
            {extra.item_title ? <strong>{extra.item_title}</strong> : ''}
          </span>
        );
      case 'activity_comment':
        return (
          <span>
            {isEs ? 'comentó en tu actividad' : 'commented on your activity'}
            {extra.snippet ? `: "${extra.snippet}"` : ''}
          </span>
        );
      case 'comment_reply':
        return (
          <span>
            {isEs ? 'respondió a tu comentario' : 'replied to your comment'}
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

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: '270px',
        bottom: '20px',
        width: '380px',
        maxHeight: '560px',
        background: 'var(--bg-secondary, #1e1e24)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.45), 0 0 20px rgba(124, 58, 237, 0.1)',
        backdropFilter: 'blur(16px)',
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
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Bell size={18} color="var(--accent-primary)" />
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

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          padding: '0.5rem 1rem',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          background: 'rgba(0,0,0,0.1)'
        }}
      >
        <button
          onClick={() => setFilter('all')}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '20px',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'all' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          {isEs ? 'Todas' : 'All'}
        </button>
        <button
          onClick={() => setFilter('unread')}
          style={{
            flex: 1,
            padding: '0.35rem 0.6rem',
            borderRadius: '20px',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'unread' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'unread' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          {isEs ? 'No leídas' : 'Unread'}
        </button>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '440px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isEs ? 'Cargando notificaciones...' : 'Loading notifications...'}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              {filter === 'unread'
                ? (isEs ? 'No tienes notificaciones sin leer' : 'No unread notifications')
                : (isEs ? 'No tienes notificaciones aún' : 'No notifications yet')}
            </p>
          </div>
        ) : (
          notifications.map(notif => {
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
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                  background: isUnread ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isUnread ? 'rgba(124, 58, 237, 0.13)' : 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isUnread ? 'rgba(124, 58, 237, 0.08)' : 'transparent';
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
          })
        )}
      </div>
    </div>
  );
};
