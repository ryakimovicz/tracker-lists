import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Home, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export const NotFound: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();

  const isEs = language === 'es';

  return (
    <div
      style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '540px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          background: 'var(--bg-secondary, #111827)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '20px',
          padding: '3rem 2rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Subtle luminous badge */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-primary, #f59e0b) 0%, transparent 70%)',
              opacity: 0.25,
              filter: 'blur(10px)',
            }}
          />
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1.5px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #f59e0b)',
            }}
          >
            <Compass size={36} />
          </div>
        </div>

        {/* 404 big typography */}
        <div>
          <div
            style={{
              fontSize: '4.5rem',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              color: 'transparent',
              backgroundImage: 'linear-gradient(135deg, #ffffff 30%, var(--accent-primary, #f59e0b) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}
          >
            404
          </div>
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)',
              margin: '0 0 0.5rem 0',
            }}
          >
            {isEs ? 'Página no encontrada' : 'Page not found'}
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary, #9ca3af)',
              margin: 0,
              lineHeight: 1.5,
              maxWidth: '420px',
            }}
          >
            {isEs
              ? 'La ruta o enlace al que intentas acceder no existe, ha cambiado de lugar o fue eliminado.'
              : 'The link or route you are trying to access does not exist, has moved, or was removed.'}
          </p>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            marginTop: '0.5rem',
          }}
        >
          <Link
            to="/"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              fontSize: '0.92rem',
              textDecoration: 'none',
            }}
          >
            <Home size={16} />
            {isEs ? 'Volver al Inicio' : 'Back to Home'}
          </Link>

          <Link
            to="/search"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              fontSize: '0.92rem',
              background: 'var(--bg-tertiary, #1f2937)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              color: 'var(--text-primary, #ffffff)',
              textDecoration: 'none',
              fontWeight: 600,
              transition: 'background 0.2s',
            }}
          >
            <SearchIcon size={16} />
            {isEs ? 'Explorar' : 'Explore'}
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1rem',
              fontSize: '0.92rem',
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text-muted, #6b7280)',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
          >
            <ArrowLeft size={16} />
            {isEs ? 'Regresar' : 'Go back'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
