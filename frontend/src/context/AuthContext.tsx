import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  photo_url: string;
  banner_url?: string;
  background_url?: string;
  is_admin: boolean;
  is_pro?: boolean;
  is_pro_cancelled?: boolean;
  is_vip?: boolean;
  has_active_subscription?: boolean;
  pro_expires_at?: string;
  is_suspended?: boolean;
  suspended_until?: string;
  suspension_reason?: string;
  admin_warning?: string;
  profile_color?: string;
  category_order?: string;
  lastfm_username?: string;
  is_private?: boolean;
  blur_unwatched_episodes?: boolean;
}





interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const cached = localStorage.getItem('pathd_user_profile');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const isPro = Boolean(parsed.is_pro || parsed.is_admin || parsed.is_vip);
      return {
        ...parsed,
        is_pro: isPro,
        blur_unwatched_episodes: isPro ? Boolean(parsed.blur_unwatched_episodes) : false
      };
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      const cached = localStorage.getItem('pathd_user_profile');
      // If we have both token and cached profile, we don't block the UI
      return !cached;
    } catch {
      return false;
    }
  });

  const refreshProfile = async () => {
    try {
      const resp = await apiClient.get('/users/me');
      const isPro = Boolean(resp.data.is_pro || resp.data.is_admin || resp.data.is_vip);
      const userData = {
        ...resp.data,
        is_pro: isPro,
        blur_unwatched_episodes: isPro ? Boolean(resp.data.blur_unwatched_episodes) : false
      };
      setUser(userData);
      try {
        localStorage.setItem('pathd_user_profile', JSON.stringify(userData));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('profile-updated', { detail: userData }));
    } catch (err: any) {
      const isSuspended = err?.response?.headers?.['x-user-suspended'] === 'true' || 
                          String(err?.response?.data?.detail || '').toLowerCase().includes('suspendid');
      // Only clear user on definitive 401 Unauthorized / auth failures, NOT if suspended
      if (err?.response?.status === 401 || (err?.response?.status === 403 && !isSuspended)) {
        setUser(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('pathd_user_profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string) => {
    localStorage.setItem('access_token', token);
    await refreshProfile();
  };

  const clearStoredData = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('pathd_user_profile');
    localStorage.removeItem('pathd_lib_cache');
    localStorage.removeItem('pathd_shelf_cache');
    localStorage.removeItem('pathd_upnext_cache');
    localStorage.removeItem('pathd_updates_cache');
    localStorage.removeItem('pathd_upcoming_episodes_cache');
    sessionStorage.removeItem('pathd_lib_cache');
    sessionStorage.removeItem('pathd_shelf_cache');
    sessionStorage.removeItem('pathd_upnext_cache');
    sessionStorage.removeItem('pathd_updates_cache');
    sessionStorage.removeItem('pathd_upcoming_episodes_cache');
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      clearStoredData();
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await refreshProfile();
      } else {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for logout events dispatched by Axios interceptor on refresh failure
    const handleLogoutEvent = () => {
      setUser(null);
      clearStoredData();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    };

    // Listen for real-time suspension events to refresh profile and display modal
    const handleUserSuspended = async () => {
      await refreshProfile();
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    window.addEventListener('user-suspended', handleUserSuspended);
    return () => {
      window.removeEventListener('auth-logout', handleLogoutEvent);
      window.removeEventListener('user-suspended', handleUserSuspended);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user || Boolean(localStorage.getItem('access_token')),
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
