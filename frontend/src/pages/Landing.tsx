import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Flame, Star, Compass, Layers } from 'lucide-react';

export const Landing: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', padding: '2rem 0' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.15, whiteSpace: 'normal' }}>
          {t('heroTitleLine1')}
          <br />
          {t('heroTitleLine2')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', lineHeight: 1.5, maxWidth: '800px', margin: '0 auto' }}>
          {t('heroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
            {t('btnStartCollection')} <Flame size={18} />
          </Link>
          <Link to="/recommended" className="btn-secondary" style={{ textDecoration: 'none' }}>
            {t('btnExploreGuides')}
          </Link>
        </div>
      </section>

      {/* Feature Grids */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2.5rem',
        marginTop: '2rem'
      }}>
        {/* Feature 1: Universos Sin Fronteras */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.6rem', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)' }}>
              <Compass size={20} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('featSearchTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {t('featSearchDesc')}
          </p>
        </div>

        {/* Feature 2: Tu Progreso, Tus Reglas */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.6rem', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)' }}>
              <Star size={20} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('featShelfTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {t('featShelfDesc')}
          </p>
        </div>

        {/* Feature 3: Hazlo Tuyo (Mods de la Comunidad) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.6rem', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)' }}>
              <Layers size={20} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('featModsTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {t('featModsDesc')}
          </p>
        </div>
      </section>
    </div>
  );
};
