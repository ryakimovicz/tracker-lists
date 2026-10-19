import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Compass, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { prefetchRoute } from '../utils/prefetch';
import { CreateGuideIcon } from './CreateGuideIcon';

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
      icon: 'create-guide',
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
        const activeClass = item.isActive ? 'active' : '';

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`mobile-bottom-nav-item ${activeClass}`}
            onClick={() => {
              if (item.isActive) {
                if (item.to === '/search') {
                  window.dispatchEvent(new Event('focus-search-input'));
                }
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }
            }}
            aria-label={item.label}
            title={item.label}
          >
            <div className="mobile-bottom-nav-icon-wrap">
              {item.icon === 'create-guide' ? (
                <CreateGuideIcon
                  size={24}
                  strokeWidth={item.isActive ? 2.3 : 1.85}
                  idSuffix={`mobile-${item.isActive ? 'active' : 'idle'}`}
                />
              ) : (
                (() => {
                  const Icon = item.icon as React.ElementType;
                  return <Icon size={24} strokeWidth={item.isActive ? 2.4 : 1.9} />;
                })()
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
};
