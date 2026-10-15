import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Shield, Bell, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { NotificationFlyout } from './NotificationFlyout';
import { apiClient } from '../api/client';

export const MobileHeader: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNotifFlyout = searchParams.get('notifications') === 'true' || searchParams.has('notifications');
  const isSettingsActive = location.pathname === '/settings';
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
        {/* Left Slot: Balanced spacer to keep center logo perfectly centered */}
        <div className="mobile-header-left">
          <div className="mobile-header-placeholder" />
        </div>

        {/* Center Slot: Brand Logo */}
        <div className="mobile-header-center">
          <BrandLogo fontSize="1.75rem" disableLink={true} />
        </div>

        {/* Right Slot: Notifications & Settings */}
        <div className="mobile-header-right">
          {isUserLoggedIn && (
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                if (showNotifFlyout) {
                  newParams.delete('notifications');
                  newParams.delete('notif_tab');
                  setSearchParams(newParams);
                } else {
                  newParams.set('notifications', 'true');
                  setSearchParams(newParams);
                }
              }}
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

          <button
            type="button"
            onClick={() => {
              if (isSettingsActive) {
                // Return to exact previous screen
                const fromLocation = (location.state as any)?.from;
                if (fromLocation) {
                  navigate(fromLocation);
                } else if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              } else {
                // Navigate to /settings remembering the current page
                navigate('/settings', {
                  state: { from: location }
                });
              }
            }}
            className={`mobile-header-icon-btn ${isSettingsActive ? 'active' : ''}`}
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings size={22} color={isSettingsActive ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
          </button>
        </div>
      </header>

      {/* Notifications Flyout Modal for Mobile */}
      <NotificationFlyout
        isOpen={showNotifFlyout}
        onClose={() => {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('notifications');
          newParams.delete('notif_tab');
          setSearchParams(newParams);
        }}
        onUnreadCountChange={(cnt) => setUnreadCount(cnt)}
        ignoreRef={notifBtnRef}
      />
    </>
  );
};
