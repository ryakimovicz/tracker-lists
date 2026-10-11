import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, BookOpen, Plus, Compass, User } from 'lucide-react';
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
            onMouseEnter={() => prefetchRoute(item.to)}
            onTouchStart={() => prefetchRoute(item.to)}
            aria-label={item.label}
            title={item.label}
          >
            <div className="mobile-bottom-nav-icon-wrap">
              {item.icon === 'create-guide' ? (
                <svg
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={item.isActive ? 2.3 : 1.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ overflow: 'visible' }}
                >
                  <mask id={`book-plus-cutout-${item.isActive ? 'active' : 'idle'}`}>
                    <rect x="-5" y="-5" width="34" height="34" fill="#ffffff" />
                    {/* Cut out a clearing around the plus symbol */}
                    <circle cx="20.5" cy="4" r="5.5" fill="#000000" />
                  </mask>
                  {/* Left book page */}
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  {/* Right book page with cutout mask */}
                  <path
                    d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
                    mask={`url(#book-plus-cutout-${item.isActive ? 'active' : 'idle'})`}
                  />
                  {/* Plus symbol in the top right corner */}
                  <path d="M20.5 1.5v5" strokeWidth={item.isActive ? 2.7 : 2.2} />
                  <path d="M18 4h5" strokeWidth={item.isActive ? 2.7 : 2.2} />
                </svg>
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
