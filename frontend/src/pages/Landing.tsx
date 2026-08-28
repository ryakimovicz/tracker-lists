import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Flame, Star, Compass, Layers } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';

export const Landing: React.FC = () => {
  const { t, language } = useTranslation();
  const isEs = language === 'es';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', padding: '2rem 0' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
        <img
          src="/logo-transparent.svg"
          alt="Pathd"
          style={{ width: '64px', height: '64px', filter: 'drop-shadow(0 6px 20px rgba(245, 158, 11, 0.35))', marginBottom: '0.5rem' }}
        />
        <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.15, whiteSpace: 'normal', margin: 0 }}>
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
        {/* Card 1: All-in-One Tracker (Emerald Green) */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={28} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featTrackerTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
            {t('featTrackerDesc')}
          </p>
        </div>

        {/* Card 2: Guides & Universes (Royal Blue) */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Compass size={28} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featSearchTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
            {t('featSearchDesc')}
          </p>
        </div>

        {/* Card 3: Community & Customization (Vibrant Pink) */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Star size={28} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featModsTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
            {t('featModsDesc')}
          </p>
        </div>
      </section>


      {/* AdBanner Sponsor */}
      <AdBanner style={{ margin: '2rem auto 0 auto' }} />

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img src="/logo-transparent.svg" alt="Pathd" style={{ width: 22, height: 22 }} />
          <span>© {new Date().getFullYear()} Pathd (pathd.net). {isEs ? 'Todos los derechos reservados.' : 'All rights reserved.'}</span>
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
