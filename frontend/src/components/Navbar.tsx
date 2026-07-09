import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Search, List, Shield, Bookmark } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
          <span>TrackerLists</span>
        </Link>

        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <Link to="/search" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Search size={18} /> Buscar
            </Link>
            <Link to="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Bookmark size={18} /> Estantería
            </Link>
            {user?.is_admin && (
              <Link to="/admin" style={{ color: '#ef4444', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                <Shield size={18} /> Admin Panel
              </Link>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/login" className="btn-secondary" style={{ padding: '0.4rem 1rem', textDecoration: 'none', fontSize: '0.9rem' }}>
              Iniciar Sesión
            </Link>
            <Link to="/register" className="btn-primary" style={{ padding: '0.4rem 1rem', textDecoration: 'none', fontSize: '0.9rem' }}>
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};
