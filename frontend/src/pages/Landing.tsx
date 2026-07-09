import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Flame, Star, Compass, Layers } from 'lucide-react';

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', padding: '2rem 0' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.15 }}>
          {t('heroTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', lineHeight: 1.5 }}>
          {t('heroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
              {t('btnGoShelf')} <Flame size={18} />
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary" style={{ textDecoration: 'none' }}>
                {t('btnGetStarted')} <Flame size={18} />
              </Link>
              <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none' }}>
                {t('navLogin')}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Grids */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2.5rem',
        marginTop: '2rem'
      }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Compass size={24} />
          </div>
          <h3>{t('featSearchTitle')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {t('featSearchDesc')}
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Layers size={24} />
          </div>
          <h3>{t('featModsTitle')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {t('featModsDesc')}
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Star size={24} />
          </div>
          <h3>{t('featShelfTitle')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {t('featShelfDesc')}
          </p>
        </div>
      </section>
    </div>
  );
};
