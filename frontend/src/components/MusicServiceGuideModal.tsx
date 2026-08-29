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
  const [activeTab, setActiveTab] = useState<'spotify' | 'applemusic' | 'ytmusic' | 'deezer_tidal' | 'other'>('spotify');

  if (!isOpen) return null;

  const platforms = [
    { id: 'spotify', name: 'Spotify', icon: '🟢' },
    { id: 'applemusic', name: 'Apple Music', icon: '🍎' },
    { id: 'ytmusic', name: 'YouTube Music', icon: '🔴' },
    { id: 'deezer_tidal', name: 'Deezer / Tidal', icon: '🟣' },
    { id: 'other', name: isEs ? 'Otros Reproductores' : 'Other Players', icon: '🎧' },
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
          maxWidth: '620px',
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

        {/* Platform Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            overflowX: 'auto',
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🟢</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Spotify (Conexión Directa en la Nube)
                </h4>
              </div>
              <p style={{ margin: '0 0 1rem 0' }}>
                {isEs
                  ? 'Spotify es el servicio más fácil de conectar porque se sincroniza directamente desde la nube de Last.fm sin necesidad de instalar extensiones ni aplicaciones adicionales.'
                  : 'Spotify is the easiest service to connect as it syncs directly via Last.fm cloud without installing extensions or extra apps.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>1.</span>
                  <span>
                    {isEs ? 'Entra a ' : 'Go to '}
                    <a
                      href="https://www.last.fm/settings/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      last.fm/settings/applications <ExternalLink size={12} />
                    </a>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>2.</span>
                  <span>
                    {isEs
                      ? 'En la sección "Spotify Scrobbling", haz clic en el botón rojo "Connect" / "Conectar".'
                      : 'Under the "Spotify Scrobbling" section, click the red "Connect" button.'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>3.</span>
                  <span>
                    {isEs
                      ? 'Inicia sesión con tu cuenta de Spotify y autoriza los permisos. ¡Listo! Cualquier canción que escuches en PC, celular o consola se reflejará en Pathd automáticamente.'
                      : 'Log in with your Spotify account and authorize permissions. Done! Everything you play on PC, mobile, or console will sync to Pathd.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Apple Music */}
          {activeTab === 'applemusic' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🍎</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Apple Music
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    📱 {isEs ? 'En iPhone / iPad (iOS)' : 'On iPhone / iPad (iOS)'}
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
                      {isEs ? 'Abre la app de Last.fm ocasionalmente para sincronizar los scrobbles acumulados.' : 'Open the Last.fm app periodically to submit your queued scrobbles.'}
                    </li>
                  </ol>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    💻 {isEs ? 'En PC / Mac o Web' : 'On PC / Mac or Web'}
                  </div>
                  <p style={{ margin: 0 }}>
                    {isEs
                      ? 'Si escuchas Apple Music desde el navegador (music.apple.com), instala la extensión gratuita Web Scrobbler (disponible para Chrome, Brave, Firefox, Edge).'
                      : 'If listening via the browser (music.apple.com), install the free Web Scrobbler extension (Chrome, Brave, Firefox, Edge).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* YouTube Music */}
          {activeTab === 'ytmusic' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🔴</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  YouTube Music / YouTube
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    💻 {isEs ? 'En Computadora (Navegador Web)' : 'On PC / Mac (Web Browser)'}
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <li>
                      {isEs ? 'Instala la extensión ' : 'Install the '}
                      <a
                        href="https://webscrobbler.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
                      >
                        Web Scrobbler <ExternalLink size={11} />
                      </a>
                      {isEs ? ' en tu navegador (Chrome, Firefox, Brave, Edge).' : ' extension in your browser.'}
                    </li>
                    <li>
                      {isEs
                        ? 'Haz clic en el icono de la extensión y conéctala a tu cuenta de Last.fm.'
                        : 'Click the extension icon and link it to your Last.fm account.'}
                    </li>
                    <li>
                      {isEs
                        ? '¡Listo! Detectará automáticamente todo lo que escuches en YouTube Music y YouTube.'
                        : 'Done! It will automatically detect anything you play on YouTube Music and YouTube.'}
                    </li>
                  </ol>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    📱 {isEs ? 'En Teléfonos Android' : 'On Android Phones'}
                  </div>
                  <p style={{ margin: 0 }}>
                    {isEs
                      ? 'Instala la app Pano Scrobbler o la app oficial de Last.fm desde Google Play Store y activa el permiso de notificaciones multimedia.'
                      : 'Install Pano Scrobbler or official Last.fm app from Google Play Store and enable media notification access.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Deezer / Tidal */}
          {activeTab === 'deezer_tidal' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🟣</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Deezer & Tidal (Nativo)
                </h4>
              </div>
              <p style={{ margin: '0 0 1rem 0' }}>
                {isEs
                  ? 'Tanto Deezer como Tidal cuentan con integración directa oficial con Last.fm construida dentro de sus propias aplicaciones.'
                  : 'Both Deezer and Tidal feature built-in native Last.fm integration inside their own settings.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    🎵 Deezer
                  </div>
                  <span>
                    {isEs
                      ? 'Abre la app de Deezer -> Configuración -> Compartir / Cuenta -> Conectar con Last.fm.'
                      : 'Open Deezer app -> Settings -> Sharing / Account -> Connect with Last.fm.'}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    🌊 Tidal
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

          {/* Other */}
          {activeTab === 'other' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🎧</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {isEs ? 'SoundCloud, Bandcamp, Foobar2000, etc.' : 'SoundCloud, Bandcamp, Desktop Players, etc.'}
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ margin: 0 }}>
                  {isEs
                    ? 'Para reproductores web (SoundCloud, Bandcamp, Mixcloud, etc.), la extensión Web Scrobbler funciona con más de 300 plataformas musicales.'
                    : 'For web players (SoundCloud, Bandcamp, Mixcloud, etc.), the Web Scrobbler extension supports over 300 platforms.'}
                </p>
                <p style={{ margin: 0 }}>
                  {isEs
                    ? 'Para reproductores de escritorio como Foobar2000, MusicBee o Winamp, puedes instalar sus complementos oficiales de Last.fm.'
                    : 'For desktop players like Foobar2000, MusicBee, or Winamp, install their official Last.fm plugins.'}
                </p>
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
