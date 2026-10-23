import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import {
  Star,
  Compass,
  Layers,
  Music,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Book,
  MessageSquare,
  MessageCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AdBanner } from '../components/AdBanner';

export const Landing: React.FC = () => {
  const { t, language } = useTranslation();
  const isEs = language === 'es';

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(prev => (prev === idx ? null : idx));
  };

  const categories = [
    { key: 'movie', label: isEs ? 'Películas' : 'Movies', icon: <Film size={15} />, color: 'var(--color-movie, #10b981)' },
    { key: 'series', label: isEs ? 'Series' : 'TV Shows', icon: <Tv size={15} />, color: 'var(--color-series, #3b82f6)' },
    { key: 'anime', label: isEs ? 'Anime' : 'Anime', icon: <Star size={15} />, color: 'var(--color-anime, #f59e0b)' },
    { key: 'manga', label: isEs ? 'Manga' : 'Manga', icon: <Book size={15} />, color: 'var(--color-manga, #ec4899)' },
    { key: 'game', label: isEs ? 'Juegos' : 'Games', icon: <Gamepad2 size={15} />, color: 'var(--color-game, #8b5cf6)' },
    { key: 'music', label: isEs ? 'Música' : 'Music', icon: <Music size={15} />, color: 'var(--color-music, #a855f7)' }
  ];

  const planComparison = [
    {
      feature: isEs ? '6 Categorías completas (Películas, Series, Anime, Manga, Juegos, Música)' : '6 Full Categories (Movies, TV Shows, Anime, Manga, Games, Music)',
      free: isEs ? 'Ilimitadas' : 'Unlimited',
      premium: isEs ? 'Ilimitadas' : 'Unlimited'
    },
    {
      feature: isEs ? 'Estantería personal y registro de progreso' : 'Personal shelf & progress tracking',
      free: isEs ? 'Completo' : 'Full',
      premium: isEs ? 'Completo' : 'Full'
    },
    {
      feature: isEs ? 'Calificaciones con estrellas, reseñas y comentarios (con GIFs, stickers y clips)' : 'Star ratings, reviews, and comments (with GIFs, stickers, and clips)',
      free: isEs ? 'Sí' : 'Yes',
      premium: isEs ? 'Sí' : 'Yes'
    },
    {
      feature: isEs ? 'Guías comunitarias y universos cronológicos' : 'Community guides & chronological universes',
      free: isEs ? 'Públicas' : 'Public',
      premium: isEs ? 'Públicas, Privadas y No Listadas' : 'Public, Private & Unlisted'
    },
    {
      feature: isEs ? 'Obras destacadas en tu perfil' : 'Featured works on your profile',
      free: isEs ? '1 obra por categoría' : '1 item per category',
      premium: isEs ? 'Hasta 10 por categoría (Top 10)' : 'Up to 10 per category (Top 10)'
    },
    {
      feature: isEs ? 'Re-consumo de obras e historial' : 'Re-consumption & history',
      free: isEs ? 'Contador de re-consumos' : 'Re-consumption counter',
      premium: isEs ? 'Historial cronológico completo de re-consumos' : 'Full chronological re-consumption history'
    },
    {
      feature: isEs ? 'Protección anti-spoilers' : 'Anti-spoiler protection',
      free: isEs ? 'Estándar' : 'Standard',
      premium: isEs ? 'Desenfoque automático de carátulas y episodios no vistos' : 'Auto-blur for unwatched episodes and covers'
    },
    {
      feature: isEs ? 'Portadas panorámicas y fondos de pantalla de perfil' : 'Panoramic profile banners & wallpapers',
      free: isEs ? 'Fondo liso predeterminado' : 'Default solid background',
      premium: isEs ? 'Portadas y fondos de pantalla en alta resolución (HD)' : 'High-resolution (HD) banners & wallpapers'
    },
    {
      feature: isEs ? 'Color de la interfaz en toda la app' : 'Interface theme color across the app',
      free: isEs ? 'Color predeterminado' : 'Default color',
      premium: isEs ? 'Personalización completa de color' : 'Full interface color customization'
    },
    {
      feature: isEs ? 'Reorganización del orden de categorías en toda la app' : 'Custom category order across the entire app',
      free: isEs ? 'Orden estándar' : 'Standard order',
      premium: isEs ? 'Reorganización libre' : 'Fully customizable'
    },
    {
      feature: isEs ? 'Insignia en perfil y comentarios' : 'Badge on profile & comments',
      free: isEs ? 'Estándar' : 'Standard',
      premium: isEs ? 'Insignia Premium (estrella dorada)' : 'Premium badge (golden star)'
    },
    {
      feature: isEs ? 'Apoyo al proyecto' : 'Support the project',
      free: isEs ? 'Miembro de la comunidad' : 'Community member',
      premium: isEs ? 'Apoyo directo al desarrollo independiente' : 'Direct support for independent development'
    }
  ];

  const faqs = [
    {
      q: isEs ? '¿Pathd es completamente gratis?' : 'Is Pathd completely free?',
      a: isEs
        ? 'Sí. Puedes registrarte y realizar el seguimiento ilimitado de todas tus películas, series, animes, libros, mangas, cómics, juegos y música sin necesidad de ingresar una tarjeta de crédito ni pagar nada.'
        : 'Yes. You can sign up and track unlimited movies, TV shows, anime, books, manga, comics, games, and music without entering a credit card or paying anything.'
    },
    {
      q: isEs ? '¿Qué son las Guías y en qué se diferencian de una lista normal?' : 'What are Guides and how do they differ from a normal list?',
      a: isEs
        ? 'A diferencia de una simple lista de reproducción, las guías de Pathd te permiten combinar múltiples formatos (por ejemplo: un libro, luego una película, después una serie y un juego) para organizar sagas y universos completos en su orden cronológico o narrativo real.'
        : 'Unlike a simple watchlist, Pathd guides let you combine multiple formats (for instance: a book, followed by a movie, then a TV show and a game) to organize entire sagas and universes in their true chronological or narrative order.'
    },
    {
      q: isEs ? '¿Puedo mantener mi perfil y estantería en privado?' : 'Can I keep my profile and shelf private?',
      a: isEs
        ? 'Por supuesto. Desde Ajustes puedes configurar tu cuenta como Privada en cualquier momento. De este modo, únicamente los seguidores que apruebes previamente podrán ver tu estantería y progreso.'
        : 'Absolutely. From Settings you can toggle your account to Private at any time. Only followers you personally approve will be able to see your shelf and progress.'
    },
    {
      q: isEs ? '¿De dónde provienen las carátulas, sinopsis y fechas?' : 'Where do posters, synopses, and dates come from?',
      a: isEs
        ? 'Pathd se conecta dinámicamente con las mejores bases de datos públicas y comunitarias del mundo: OMDb para cine, TVMaze para series y anime, Google Books y Open Library para libros, Comic Vine para cómics, AniList para manga, IGDB/Twitch para juegos, y Last.fm, Deezer, Apple (iTunes) y MusicBrainz para música.'
        : 'Pathd connects dynamically to industry-leading open and community databases: OMDb for movies, TVMaze for TV shows and anime, Google Books and Open Library for books, Comic Vine for comics, AniList for manga, IGDB/Twitch for games, and Last.fm, Deezer, Apple (iTunes), and MusicBrainz for music.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4.5rem', padding: '2rem 0', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
      {/* 1. Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '920px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
        <img
          src="/logo-transparent.svg"
          alt="Pathd"
          style={{ width: '68px', height: '68px', filter: 'drop-shadow(0 6px 20px rgba(245, 158, 11, 0.35))', marginBottom: '0.25rem' }}
        />
        <h1 className="gradient-text" style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 800, lineHeight: 1.15, margin: 0 }}>
          {t('heroTitleLine1')}
          <br />
          {t('heroTitleLine2')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', lineHeight: 1.55, maxWidth: '780px', margin: '0 auto' }}>
          {t('heroSubtitle')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
          <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.6rem', fontSize: '1rem' }}>
            {t('btnStartCollection')} <ArrowRight size={18} />
          </Link>
          <Link to="/recommended" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.4rem', fontSize: '1rem' }}>
            <Compass size={18} /> {t('btnExploreGuides')}
          </Link>
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {isEs ? '100% gratuito · Sin tarjeta de crédito · Registro en 30 segundos' : '100% Free · No credit card required · 30-second signup'}
        </span>
      </section>

      {/* 2. Category Chips Ribbon */}
      <section style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {categories.map(cat => (
          <div
            key={cat.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.42rem',
              padding: '0.42rem 0.82rem',
              borderRadius: '999px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <span style={{ color: cat.color, display: 'inline-flex' }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </div>
        ))}
      </section>

      {/* 3. Feature Highlights (4 Responsive Cards) */}
      <section className="landing-features-grid">
        {/* Card 1: Tracker todo en uno */}
        <div className="glass-card" style={{ padding: '1.8rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={26} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featTrackerTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>
            {t('featTrackerDesc')}
          </p>
        </div>

        {/* Card 2: Guías y Universos */}
        <div className="glass-card" style={{ padding: '1.8rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Compass size={26} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featSearchTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>
            {t('featSearchDesc')}
          </p>
        </div>

        {/* Card 3: Comunidad y Reseñas */}
        <div className="glass-card" style={{ padding: '1.8rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <MessageCircle size={26} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featModsTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>
            {t('featModsDesc')}
          </p>
        </div>

        {/* Card 4: Música y Estadísticas */}
        <div className="glass-card" style={{ padding: '1.8rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Music size={26} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('featMusicStatsTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>
            {t('featMusicStatsDesc')}
          </p>
        </div>
      </section>

      {/* 4. Free vs. Premium Transparent Comparison */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            {isEs ? 'Elige tu experiencia en Pathd' : 'Choose your Pathd experience'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
            {isEs
              ? 'Todo lo esencial para organizar tu entretenimiento es gratis para siempre. Desbloquea personalización avanzada y apoya el proyecto con Pathd Premium.'
              : 'Everything essential to organize your entertainment is free forever. Unlock advanced customization and support the project with Pathd Premium.'}
          </p>
        </div>

        {/* Desktop Comparison Table */}
        <div className="glass-card plan-comparison-desktop" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700, width: '50%' }}>
                    {isEs ? 'Característica' : 'Feature'}
                  </th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700, width: '25%', textAlign: 'center' }}>
                    <div>{isEs ? 'Plan Gratuito' : 'Free Plan'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.2rem' }}>
                      $0 · {isEs ? 'Gratis para siempre' : 'Free forever'}
                    </div>
                  </th>
                  <th style={{ padding: '1rem 1.25rem', color: '#f59e0b', fontSize: '0.95rem', fontWeight: 800, width: '25%', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Star size={16} fill="#f59e0b" color="#f59e0b" /> Pathd Premium
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: 700, marginTop: '0.2rem' }}>
                      $4.99 USD / {isEs ? 'mes' : 'mo'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.1rem' }}>
                      {isEs ? 'Prueba gratis de 7 días · Cancela cuando quieras' : '7-day free trial · Cancel anytime'}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {planComparison.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === planComparison.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                      {row.feature}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.88rem', textAlign: 'center', fontWeight: 600 }}>
                      {row.free}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.88rem', textAlign: 'center', fontWeight: 700, background: 'rgba(245, 158, 11, 0.04)' }}>
                      {row.premium}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Comparison Feature-by-Feature Cards */}
        <div className="plan-comparison-mobile">
          <div className="plan-mobile-summary-header">
            <div className="plan-mobile-summary-card free">
              <span className="plan-mobile-summary-name">{isEs ? 'Plan Gratuito' : 'Free Plan'}</span>
              <span className="plan-mobile-summary-price">$0</span>
              <span className="plan-mobile-summary-sub">{isEs ? 'Gratis para siempre' : 'Free forever'}</span>
            </div>
            <div className="plan-mobile-summary-card premium">
              <span className="plan-mobile-summary-name">
                <Star size={14} fill="#f59e0b" color="#f59e0b" /> Pathd Premium
              </span>
              <span className="plan-mobile-summary-price">
                $4.99 USD <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>/ {isEs ? 'mes' : 'mo'}</span>
              </span>
              <span className="plan-mobile-summary-sub">{isEs ? 'Prueba gratis de 7 días' : '7-day free trial'}</span>
            </div>
          </div>

          {planComparison.map((row, idx) => (
            <div key={idx} className="plan-mobile-feature-card">
              <div className="plan-mobile-feature-title">{row.feature}</div>
              <div className="plan-mobile-comparison-grid">
                <div className="plan-mobile-col free">
                  <span className="plan-mobile-badge free">{isEs ? 'Gratis' : 'Free'}</span>
                  <span className="plan-mobile-value free">{row.free}</span>
                </div>
                <div className="plan-mobile-col premium">
                  <span className="plan-mobile-badge premium">
                    <Star size={11} fill="#f59e0b" color="#f59e0b" /> Premium
                  </span>
                  <span className="plan-mobile-value premium">{row.premium}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Frequently Asked Questions (FAQ) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            {isEs ? 'Preguntas Frecuentes' : 'Frequently Asked Questions'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
            {isEs ? 'Todo lo que necesitas saber antes de empezar' : 'Everything you need to know before getting started'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="glass-card"
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 1.25rem 1.1rem 1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.92rem' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Final Call to Action Banner */}
      <section
        className="glass-card"
        style={{
          borderRadius: '20px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          {isEs ? 'Todo tu entretenimiento esperando ser organizado' : 'All your entertainment waiting to be organized'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '640px', margin: 0, lineHeight: 1.5 }}>
          {isEs
            ? 'Únete a la comunidad de Pathd y lleva el control unificado de todo lo que ves, lees, juegas y escuchas desde un solo lugar.'
            : 'Join the Pathd community and keep unified track of everything you watch, read, play, and listen to from a single place.'}
        </p>
        <Link
          to="/register"
          className="btn-primary"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.8rem', fontSize: '1.05rem', fontWeight: 700 }}
        >
          {isEs ? 'Crear mi cuenta gratis' : 'Create My Free Account'} <ArrowRight size={18} />
        </Link>
      </section>

      {/* 7. AdBanner Sponsor */}
      <AdBanner style={{ margin: '0 auto' }} />

      {/* 8. Footer */}
      <footer
        style={{
          paddingTop: '2rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}
      >
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
