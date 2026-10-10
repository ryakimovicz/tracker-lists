import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, PlusCircle, Compass, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { prefetchRoute } from '../utils/prefetch';

export const MobileBottomNav: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (!isAuthenticated) {
    return null;
  }

  const currentPath = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const userIdParam = searchParams.get('user_id');
  const isOtherUserProfile = currentPath === '/profile' && !!userIdParam && String(userIdParam) !== String(user?.id);

  const navItems = [
    {
      to: '/',
      label: t('navHome') || 'Inicio',
      icon: Home,
      isActive: currentPath === '/'
    },
    {
      to: '/social',
      label: t('navSocial') || 'Social',
      icon: Users,
      isActive: currentPath.startsWith('/social')
    },
    {
      to: '/create',
      label: t('navCreate') || 'Crear',
      icon: PlusCircle,
      isActive: currentPath.startsWith('/create')
    },
    {
      to: '/search',
      label: t('navExplore') || 'Explorar',
      icon: Compass,
      isActive: currentPath.startsWith('/search')
    },
    {
      to: '/profile',
      label: t('navProfile') || 'Perfil',
      icon: User,
      isActive: (currentPath === '/profile' || currentPath.startsWith('/profile')) && !isOtherUserProfile
    }
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const activeClass = item.isActive ? 'active' : '';

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`mobile-bottom-nav-item ${activeClass}`}
            onMouseEnter={() => prefetchRoute(item.to)}
            onTouchStart={() => prefetchRoute(item.to)}
            aria-label={item.label}
          >
            <div className="mobile-bottom-nav-icon-wrap">
              <Icon size={22} strokeWidth={item.isActive ? 2.4 : 1.8} />
            </div>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
