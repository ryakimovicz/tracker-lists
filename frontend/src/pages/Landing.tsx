import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Flame, Star, Compass, Layers } from 'lucide-react';

export const Landing: React.FC = () => {
  const { t, language } = useTranslation();
  const isEs = language === 'es';

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
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={28} />
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('featSearchTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('featSearchDesc')}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Star size={28} />
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('featModsTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('featModsDesc')}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={28} />
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('featShelfTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('featShelfDesc')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        marginTop: '2rem',
        paddingTop: '2rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        <div>
          © {new Date().getFullYear()} Pathd (pathd.net). {isEs ? 'Todos los derechos reservados.' : 'All rights reserved.'}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            {isEs ? 'Términos y APIs' : 'Terms & APIs'}
          </Link>
          <Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
