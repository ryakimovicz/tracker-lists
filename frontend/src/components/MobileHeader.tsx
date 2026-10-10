import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Bell, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { NotificationFlyout } from './NotificationFlyout';
import { apiClient } from '../api/client';

export const MobileHeader: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showNotifFlyout, setShowNotifFlyout] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const isUserLoggedIn = Boolean(user && isAuthenticated);

  // Poll unread notifications count
  useEffect(() => {
    if (!isUserLoggedIn) return;
    let lastUnreadFetch = Date.now();

    const fetchUnread = async () => {
      try {
        const res = await apiClient.get('/notifications/unread-count');
        if (typeof res.data?.unread === 'number') {
          setUnreadCount(res.data.unread);
        }
        lastUnreadFetch = Date.now();
      } catch {
        // Silent fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 45000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastUnreadFetch > 15000) {
          fetchUnread();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isUserLoggedIn]);

  return (
    <>
      <header className="mobile-header">
        {/* Left Slot: Admin Button or balanced spacer */}
        <div className="mobile-header-left">
          {user?.is_admin ? (
            <Link
              to="/admin"
              className="mobile-header-icon-btn"
              title="Panel de Admin"
              aria-label="Panel de Admin"
            >
              <Shield size={22} color="var(--accent-primary)" />
            </Link>
          ) : (
            <div className="mobile-header-placeholder" />
          )}
        </div>

        {/* Center Slot: Brand Logo */}
        <div className="mobile-header-center">
          <BrandLogo fontSize="1.75rem" />
        </div>

        {/* Right Slot: Notifications & Settings */}
        <div className="mobile-header-right">
          {isUserLoggedIn && (
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => setShowNotifFlyout(prev => !prev)}
              className="mobile-header-icon-btn"
              title="Notificaciones"
              aria-label="Notificaciones"
            >
              <Bell size={22} color={showNotifFlyout ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              {unreadCount > 0 && (
                <span className="mobile-header-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          <Link
            to="/settings"
            className="mobile-header-icon-btn"
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings size={22} color="var(--text-secondary)" />
          </Link>
        </div>
      </header>

      {/* Notifications Flyout Modal for Mobile */}
      <NotificationFlyout
        isOpen={showNotifFlyout}
        onClose={() => setShowNotifFlyout(false)}
        onUnreadCountChange={(cnt) => setUnreadCount(cnt)}
        ignoreRef={notifBtnRef}
      />
    </>
  );
};
