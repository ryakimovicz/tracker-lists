import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { ShieldCheck, X } from 'lucide-react';

export const CookieBanner: React.FC = () => {
  const { language } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Delay slightly for smooth entrance
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const isEs = language === 'es';

  return (
    <aside
      aria-label={isEs ? "Aviso de cookies y privacidad" : "Cookie and privacy notice"}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        left: '1.5rem',
        maxWidth: '520px',
        margin: '0 auto 0 auto',
        zIndex: 9999,
        background: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(16px)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        animation: 'fadeInUp 0.3s ease-out forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.4rem',
              borderRadius: '8px',
              background: 'rgba(124, 58, 237, 0.15)',
              color: 'var(--accent-primary)',
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {isEs ? 'Cookies y Privacidad' : 'Cookies & Privacy'}
          </span>
        </div>
        <button
          onClick={handleAccept}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isEs ? 'Cerrar' : 'Close'}
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {isEs
          ? 'Utilizamos almacenamiento local y cookies esenciales para mantener tu sesión activa y recordar tus preferencias. No usamos cookies de rastreo publicitario.'
          : 'We use local storage and essential cookies to keep you signed in and remember your preferences. We do not use third-party advertising trackers.'}{' '}
        <Link
          to="/privacy"
          style={{ color: 'var(--accent-primary)', textDecoration: 'underline', fontWeight: 500 }}
        >
          {isEs ? 'Leer política de privacidad' : 'Read privacy policy'}
        </Link>
        .
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
        <button
          onClick={handleAccept}
          className="btn-primary"
          style={{
            padding: '0.45rem 1.15rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            borderRadius: '8px',
          }}
        >
          {isEs ? 'Entendido' : 'Got it'}
        </button>
      </div>
    </aside>
  );
};
export default CookieBanner;
