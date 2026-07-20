import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { LogOut, Settings, Shield, Globe, Sun, Moon, Monitor, Home, Users, PlusCircle, Compass, User, Star } from 'lucide-react';
import { ProModal } from './ProModal';

export const Sidebar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProModal, setShowProModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'es' : 'en');
  };

  const cycleTheme = () => {
    const sequence: Theme[] = ['system', 'light', 'dark'];
    const nextIndex = (sequence.indexOf(theme) + 1) % sequence.length;
    setTheme(sequence[nextIndex]);
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun size={16} />;
    if (theme === 'dark') return <Moon size={16} />;
    return <Monitor size={16} />;
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          textDecoration: 'none',
          color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
          background: isActive ? 'var(--border-glow)' : 'transparent',
          borderRadius: '8px',
          fontWeight: isActive ? 600 : 500,
          transition: 'all 0.2s',
        }}
      >
        <Icon size={20} />
        <span style={{ fontSize: '1.05rem' }}>{label}</span>
      </Link>
    );
  };

  return (
    <div className="sidebar">
      {/* Title */}
      <div style={{ padding: '0.5rem 0 2rem 0' }}>
        <Link to="/" style={{
          textDecoration: 'none',
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-1px'
        }}>
          Pathd
        </Link>
      </div>

      {/* Main Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <NavItem to="/" icon={Home} label={t('navHome') || 'Inicio'} />
        <NavItem to="/social" icon={Users} label={t('navSocial') || 'Social'} />
        <NavItem to="/create" icon={PlusCircle} label={t('navCreate') || 'Crear'} />
        <NavItem to="/search" icon={Compass} label={t('navExplore') || 'Explorar'} />
        {isAuthenticated && <NavItem to="/profile" icon={User} label={t('navProfile') || 'Perfil'} />}
        {user?.is_admin && (
          <NavItem to="/admin" icon={Shield} label={t('navAdmin') || 'Admin'} />
        )}
      </div>

      {/* Bottom Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
        
        {/* Settings pseudo-link */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          <Settings size={20} />
          <span style={{ fontSize: '1.05rem' }}>Ajustes</span>
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem' }}>
          <button onClick={toggleLanguage} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', flex: 1 }}>
            <Globe size={16} /> {language.toUpperCase()}
          </button>
          <button onClick={cycleTheme} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', flex: 1 }} title="Theme">
            {getThemeIcon()}
          </button>
        </div>

        {isAuthenticated ? (
          <>
            {user && !user.is_pro && (
              <button
                onClick={() => setShowProModal(true)}
                className="btn-primary"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#fff',
                  width: '100%',
                  margin: '0.5rem 0'
                }}
              >
                <Star size={16} fill="#fff" /> Upgrade Pro
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {user && <img src={user.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
                 <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.username}</span>
               </div>
               <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                 <LogOut size={18} />
               </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 1rem' }}>
            <Link to="/login" className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>{t('navLogin') || 'Login'}</Link>
            <Link to="/register" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>{t('navRegister') || 'Register'}</Link>
          </div>
        )}
      </div>

      {showProModal && <ProModal onClose={() => setShowProModal(false)} />}
    </div>
  );
};
