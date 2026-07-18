import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { LogOut, List, Shield, Globe, Sun, Moon, Monitor, Home, Users, PlusCircle, Compass, User, Star } from 'lucide-react';
import { useState } from 'react';
import { ProModal } from './ProModal';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
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

  return (
    <nav style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '1rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/" style={{
          textDecoration: 'none',
          fontSize: '1.5rem',
          fontWeight: 700,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <List size={24} color="#7c3aed" style={{ WebkitTextFillColor: 'initial' }} />
          <span>Pathd</span>
        </Link>

        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Home size={18} /> {t('navHome')}
            </Link>
            <Link to="/social" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={18} /> {t('navSocial')}
            </Link>
            <Link to="/create" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PlusCircle size={18} /> {t('navCreate')}
            </Link>
            <Link to="/search" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Compass size={18} /> {t('navExplore')}
            </Link>
            <Link to="/profile" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={18} /> {t('navProfile')}
            </Link>
            {user?.is_admin && (
              <Link to="/admin" style={{ color: '#ef4444', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                <Shield size={18} /> {t('navAdmin')}
              </Link>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Language Toggle Button */}
        <button
          onClick={toggleLanguage}
          className="btn-secondary"
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'transparent'
          }}
        >
          <Globe size={16} />
          <span>{language.toUpperCase()}</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={cycleTheme}
          className="btn-secondary"
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'transparent'
          }}
          title={t('theme' + theme.charAt(0).toUpperCase() + theme.slice(1))}
        >
          {getThemeIcon()}
          <span>{t('theme' + theme.charAt(0).toUpperCase() + theme.slice(1))}</span>
        </button>

        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img
                src={user.photo_url}
                alt={user.username}
                style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)' }}
              />
              <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{user.username}</span>
            </div>
            
            {!user.is_pro && (
              <button
                onClick={() => setShowProModal(true)}
                className="btn-primary"
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Star size={14} fill="#fff" /> Upgrade
              </button>
            )}

            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              <LogOut size={16} /> {t('navLogout')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/login" className="btn-secondary" style={{ padding: '0.4rem 1rem', textDecoration: 'none', fontSize: '0.9rem' }}>
              {t('navLogin')}
            </Link>
            <Link to="/register" className="btn-primary" style={{ padding: '0.4rem 1rem', textDecoration: 'none', fontSize: '0.9rem' }}>
              {t('navRegister')}
            </Link>
          </div>
        )}
      </div>

      {showProModal && <ProModal onClose={() => setShowProModal(false)} />}
    </nav>
  );
};
