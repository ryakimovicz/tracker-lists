import React, { useState } from 'react';
import { X, HelpCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface MusicServiceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicServiceGuideModal: React.FC<MusicServiceGuideModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTranslation();
  const isEs = language === 'es';
  const [activeTab, setActiveTab] = useState<'spotify' | 'applemusic' | 'ytmusic_other' | 'deezer_tidal'>('spotify');

  if (!isOpen) return null;

  const platforms = [
    { id: 'spotify', name: 'Spotify' },
    { id: 'applemusic', name: 'Apple Music' },
    { id: 'ytmusic_other', name: isEs ? 'YT Music / Otros' : 'YT Music / Other' },
    { id: 'deezer_tidal', name: 'Deezer / Tidal' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isEs ? 'Guía de Conexión de Música' : 'Music Connection Guide'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isEs ? 'Cómo vincular tu reproductor con Last.fm y Pathd' : 'How to connect your player with Last.fm and Pathd'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Platform Tabs (4 Columns, No Emojis, Perfect Fit) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.35rem',
            padding: '0.65rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
          }}
        >
          {platforms.map((p) => {
            const isActive = activeTab === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveTab(p.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.55rem 0.35rem',
                  borderRadius: '8px',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            fontSize: '0.88rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          {/* Spotify */}
          {activeTab === 'spotify' && (
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Spotify (Conexión Directa)
              </h4>
              <p style={{ margin: '0 0 1rem 0' }}>
                {isEs
                  ? 'Spotify se sincroniza directamente desde la nube de Last.fm sin necesidad de extensiones ni programas adicionales.'
                  : 'Spotify syncs directly via Last.fm cloud without requiring extensions or extra apps.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>1.</span>
                  <span>
                    {isEs ? 'Accede a la sección de aplicaciones de Last.fm:' : 'Access the Last.fm applications settings:'}
                  </span>
                </div>

                <div style={{ paddingLeft: '1.25rem' }}>
                  <a
                    href="https://www.last.fm/settings/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.85rem',
                      padding: '0.55rem 1.1rem',
                      background: '#d51007',
                      color: '#fff',
                      border: 'none',
                      textDecoration: 'none',
                      borderRadius: '8px'
                    }}
                  >
                    <ExternalLink size={14} />
                    {isEs ? 'Abrir Configuración de Last.fm' : 'Open Last.fm Settings'}
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>2.</span>
                  <span>
                    {isEs
                      ? 'En la opción "Spotify Scrobbling" (Registro de reproducciones), haz clic en el botón "Connect" / "Conectar".'
                      : 'In the "Spotify Scrobbling" option, click the "Connect" button.'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>3.</span>
                  <span>
                    {isEs
                      ? 'Inicia sesión con tu cuenta de Spotify y autoriza los permisos. Toda tu música escuchada en PC, celular o consola se reflejará en Pathd automáticamente.'
                      : 'Log in with your Spotify account and accept permissions. Everything you play on PC, mobile or console will sync to Pathd.'}
                  </span>
                </div>
              </div>

              {/* Distinction note between Scrobbling and Playback */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.82rem', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                  {isEs ? 'Nota importante:' : 'Important note:'}
                </strong>
                {isEs
                  ? 'Debes activar "Spotify Scrobbling" (que registra lo que escuchas). La opción "Spotify Playback" es solo para reproducir audio dentro de la propia web de Last.fm y no es necesaria para Pathd.'
                  : 'Make sure to connect "Spotify Scrobbling" (which tracks your listening). "Spotify Playback" only plays audio on the Last.fm website itself and is not required for Pathd.'}
              </div>
            </div>
          )}

          {/* Apple Music */}
          {activeTab === 'applemusic' && (
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Apple Music
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {isEs ? 'En iPhone / iPad (iOS)' : 'On iPhone / iPad (iOS)'}
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <li>
                      {isEs ? 'Descarga la app oficial ' : 'Download the official '}
                      <strong>Last.fm</strong>
                      {isEs ? ' desde el App Store.' : ' app from the App Store.'}
                    </li>
                    <li>
                      {isEs ? 'Inicia sesión con tu cuenta de Last.fm y dale permiso para acceder a tu biblioteca musical de Apple Music.' : 'Log in with your Last.fm account and grant access to your Apple Music library.'}
                    </li>
                    <li>
                      {isEs ? 'Abre la app de Last.fm periódicamente para sincronizar las canciones escuchadas.' : 'Open the Last.fm app periodically to submit your queued scrobbles.'}
                    </li>
                  </ol>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {isEs ? 'En Navegador Web (music.apple.com)' : 'On Web Browser (music.apple.com)'}
                  </div>
                  <p style={{ margin: 0 }}>
                    {isEs
                      ? 'Si escuchas Apple Music desde el navegador, instala la extensión gratuita Web Scrobbler (disponible para Chrome, Brave, Firefox y Edge) y conéctala a tu cuenta de Last.fm.'
                      : 'If listening via the browser, install the free Web Scrobbler extension (Chrome, Brave, Firefox, Edge) and connect it to your Last.fm account.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* YouTube Music & Web Players */}
          {activeTab === 'ytmusic_other' && (
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                YouTube Music, SoundCloud, Bandcamp y Web
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {isEs ? 'En Computadora (Navegador Web)' : 'On PC / Mac (Web Browser)'}
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <li>
                      {isEs ? 'Instala la extensión oficial gratuita ' : 'Install the free official extension '}
                      <a
                        href="https://webscrobbler.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
                      >
                        Web Scrobbler <ExternalLink size={11} />
                      </a>
                      {isEs ? ' en tu navegador (Chrome, Firefox, Brave, Edge).' : ' in your browser.'}
                    </li>
                    <li>
                      {isEs
                        ? 'Haz clic en el icono de la extensión y vincúlala con tu cuenta de Last.fm.'
                        : 'Click the extension icon and link it to your Last.fm account.'}
                    </li>
                    <li>
                      {isEs
                        ? 'Detectará automáticamente todo lo que reproduzcas en YouTube Music, YouTube, SoundCloud, Bandcamp y más de 300 plataformas web.'
                        : 'It will automatically detect anything you play on YouTube Music, YouTube, SoundCloud, Bandcamp, and 300+ web players.'}
                    </li>
                  </ol>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {isEs ? 'En Celulares Android' : 'On Android Phones'}
                  </div>
                  <p style={{ margin: 0 }}>
                    {isEs
                      ? 'Instala la app Pano Scrobbler o la app oficial de Last.fm desde Google Play Store y activa el acceso a notificaciones multimedia para registrar YouTube Music o cualquier app de música del celular.'
                      : 'Install Pano Scrobbler or the official Last.fm app from Google Play Store and enable media notification access to track YouTube Music or any music app on your phone.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Deezer & Tidal */}
          {activeTab === 'deezer_tidal' && (
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Deezer & Tidal
              </h4>
              <p style={{ margin: '0 0 1rem 0' }}>
                {isEs
                  ? 'Tanto Deezer como Tidal cuentan con integración nativa con Last.fm dentro de sus propias aplicaciones.'
                  : 'Both Deezer and Tidal feature native Last.fm integration inside their own applications.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Deezer
                  </div>
                  <span>
                    {isEs
                      ? 'Abre la app de Deezer -> Configuración -> Compartir / Cuenta -> Conectar con Last.fm.'
                      : 'Open Deezer app -> Settings -> Sharing / Account -> Connect with Last.fm.'}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Tidal
                  </div>
                  <span>
                    {isEs
                      ? 'Abre la app de Tidal -> Configuración -> Cuenta -> Conectar Last.fm.'
                      : 'Open Tidal app -> Settings -> Account -> Connect Last.fm.'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
          >
            {isEs ? 'Entendido' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
