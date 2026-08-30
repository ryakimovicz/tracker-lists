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
  lastfm_username?: string;
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const resp = await apiClient.get('/users/me');
      const userData = {
        ...resp.data,
        is_pro: Boolean(resp.data.is_pro || resp.data.is_admin || resp.data.is_vip)
      };
      setUser(userData);

      window.dispatchEvent(new CustomEvent('profile-updated', { detail: userData }));
    } catch (err) {
      setUser(null);
      localStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };



  const login = async (token: string) => {
    localStorage.setItem('access_token', token);
    await refreshProfile();
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      localStorage.removeItem('access_token');
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
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth-logout', handleLogoutEvent);
    };

  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
