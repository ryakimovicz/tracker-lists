import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Shield, Bell, Settings, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { BrandLogo } from './BrandLogo';
import { NotificationFlyout } from './NotificationFlyout';
import { apiClient } from '../api/client';

export const MobileHeader: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { language, t } = useTranslation();
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
        {/* Left Slot: Brand Logo */}
        <div className="mobile-header-left">
          <BrandLogo fontSize="1.65rem" disableLink={true} />
        </div>

        {/* Right Slot: Premium, Notifications & Settings */}
        <div className="mobile-header-right">
          {isUserLoggedIn && !user?.is_pro && (
            <button
              type="button"
              onClick={() => {
                const currentParams = new URLSearchParams(location.search);
                currentParams.set('modal', 'premium');
                const targetSearch = currentParams.toString();
                navigate({
                  pathname: location.pathname,
                  search: targetSearch ? `?${targetSearch}` : ''
                });
              }}
              className="mobile-header-icon-btn"
              title={t('navUpgradePro') || (language === 'es' ? 'Hacerse Premium' : 'Get Premium')}
              aria-label={t('navUpgradePro') || (language === 'es' ? 'Hacerse Premium' : 'Get Premium')}
              style={{ color: 'var(--accent-primary)' }}
            >
              <Crown size={22} color="var(--accent-primary)" />
            </button>
          )}

          {isUserLoggedIn && (
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => {
                if (showNotifFlyout) {
                  // If notifications are open, closing them returns to the underlying screen (or removes params)
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('notifications');
                  newParams.delete('notif_tab');
                  setSearchParams(newParams, { replace: true, state: location.state });
                } else {
                  // Opening notifications:
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('notifications', 'true');
                  setSearchParams(newParams, { replace: true, state: location.state });
                }
              }}
              className={`mobile-header-icon-btn ${showNotifFlyout ? 'active' : ''}`}
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
              if (showNotifFlyout) {
                // Notifications are open!
                if (isSettingsActive) {
                  // We are already on /settings, so just close notifications to reveal settings!
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('notifications');
                  newParams.delete('notif_tab');
                  setSearchParams(newParams, { replace: true, state: location.state });
                } else {
                  // We were somewhere else, close notifications and navigate to settings!
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('notifications');
                  newParams.delete('notif_tab');
                  const cleanSearch = newParams.toString();
                  const cleanCurrentLoc = {
                    ...location,
                    search: cleanSearch ? `?${cleanSearch}` : ''
                  };
                  navigate('/settings', {
                    state: { from: cleanCurrentLoc }
                  });
                }
              } else if (isSettingsActive) {
                // Settings is open and notifications are NOT open: return to previous screen
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
            className={`mobile-header-icon-btn ${isSettingsActive && !showNotifFlyout ? 'active' : ''}`}
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings size={22} color={isSettingsActive && !showNotifFlyout ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
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
          setSearchParams(newParams, { replace: true, state: location.state });
        }}
        onUnreadCountChange={(cnt) => setUnreadCount(cnt)}
        ignoreRef={notifBtnRef}
      />
    </>
  );
};
