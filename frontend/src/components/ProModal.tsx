import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Star, Check, X, Palette, Lock, Crown, Image as ImageIcon, RotateCcw, EyeOff } from 'lucide-react';
import { apiClient } from '../api/client';


interface ProModalProps {
  onClose: () => void;
}

export const ProModal: React.FC<ProModalProps> = ({ onClose }) => {
  const { language } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Synchronize URL query parameter with modal visibility: ?modal=premium or ?premium=true
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    const hasQuery = currentUrl.searchParams.get('modal') === 'premium' ||
                     currentUrl.searchParams.get('modal') === 'pro' ||
                     currentUrl.searchParams.get('premium') === 'true' ||
                     currentUrl.searchParams.get('pro') === 'true' ||
                     currentUrl.pathname === '/premium' ||
                     currentUrl.pathname === '/pro';

    if (!hasQuery) {
      // Append ?modal=premium to the URL via history.pushState so browser back closes the modal
      currentUrl.searchParams.set('modal', 'premium');
      const newRelative = currentUrl.pathname + (currentUrl.search || '') + (currentUrl.hash || '');
      window.history.pushState(window.history.state, '', newRelative);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const isStillOpen = p.get('modal') === 'premium' ||
                          p.get('modal') === 'pro' ||
                          p.get('premium') === 'true' ||
                          p.get('pro') === 'true' ||
                          window.location.pathname === '/premium' ||
                          window.location.pathname === '/pro';
      if (!isStillOpen) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleModalClose = () => {
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      const isParamModal = currentUrl.searchParams.get('modal') === 'premium' ||
                           currentUrl.searchParams.get('modal') === 'pro' ||
                           currentUrl.searchParams.get('premium') === 'true' ||
                           currentUrl.searchParams.get('pro') === 'true';

      if (isParamModal && (window.location.pathname !== '/premium' && window.location.pathname !== '/pro')) {
        currentUrl.searchParams.delete('modal');
        currentUrl.searchParams.delete('premium');
        currentUrl.searchParams.delete('pro');
        const newRelative = currentUrl.pathname + (currentUrl.search || '') + (currentUrl.hash || '');
        window.history.replaceState(window.history.state, '', newRelative);
      }
    }
    onClose();
  };


  const handleSubscribe = async () => {

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/payments/create-checkout');
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      const msg = err.response?.data?.detail || (language === 'es' ? 'Error al iniciar la pasarela de pago.' : 'Error initiating checkout.');
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  const isEs = language === 'es';


  const modalContent = (
    <div 
      className="pro-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem'
      }} 
      onClick={handleModalClose}
    >
      <div 
        className="glass-card pro-modal-card" 
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem',
          position: 'relative',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={handleModalClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.25rem'
          }}
          title={isEs ? 'Cerrar' : 'Close'}
        >
          <X size={22} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.75rem',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            marginBottom: '0.5rem'
          }}>
            <Crown size={32} color="#f59e0b" />
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Pathd Premium
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.25rem 0 0 0' }}>
            {isEs ? 'Desbloquea el verdadero poder de Pathd.' : 'Unlock the true power of Pathd.'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', marginBottom: '0.75rem', flexShrink: 0 }}>
            {errorMsg}
          </div>
        )}

        {/* Scrollable Benefits List */}
        <div 
          className="pro-modal-benefits-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            overflowY: 'auto',
            paddingRight: '0.4rem',
            marginBottom: '1.25rem'
          }}
        >
          {/* Benefit 0: Profile Banners & Ambient Backgrounds */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <ImageIcon size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Portadas y Fondos de Pantalla de Perfil' : 'Profile Banners & Ambient Wallpapers'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Personaliza tu portada y el fondo completo de tu perfil con imágenes panorámicas en alta resolución de tus obras favoritas.'
                  : 'Customize your profile banner and full-page ambient wallpaper with high-resolution artworks from your favorite titles.'}
              </p>
            </div>
          </div>

          {/* Benefit 1: Anti-Spoilers (Blur unwatched episodes) */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <EyeOff size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Protección Anti-Spoilers' : 'Anti-Spoiler Protection'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Desenfoca automáticamente portadas y miniaturas de episodios no vistos para evitar spoilers mientras exploras tus series y animes. Revela con 1 clic cuando quieras.'
                  : 'Automatically blurs posters and thumbnails of unwatched episodes to prevent spoilers while browsing your shows and anime. Reveal with 1 click anytime.'}
              </p>
            </div>
          </div>

          {/* Benefit 2: 10 Favorites per category */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <Star size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Hasta 10 Destacados por Categoría' : 'Up to 10 Favorites per Category'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Arma tu Top 10 en Películas, Series, Anime, Libros, Manga, Cómics y Juegos (hasta 70 obras en total).'
                  : 'Build your ultimate Top 10 in Movies, TV Shows, Anime, Books, Manga, Comics, and Games (up to 70 total).'}
              </p>
            </div>
          </div>

          {/* Benefit 2: Customization (Color & Category Order) */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <Palette size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Color de la Interfaz y Personalización' : 'Interface Color & Customization'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Elige el color principal de la interfaz en toda la plataforma y reorganiza libremente el orden de las categorías.'
                  : 'Choose your main interface color across the entire platform and freely reorder categories.'}
              </p>
            </div>
          </div>

          {/* Benefit 3: Private Guides */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <Lock size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Guías Privadas y No Listadas' : 'Private & Unlisted Guides'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Crea listas secretas solo para ti o enlaces no listados para compartir con quien elijas.'
                  : 'Create secret lists for yourself, or unlisted links to share with selected friends.'}
              </p>
            </div>
          </div>

          {/* Benefit 4: Unlimited Re-consumption & History */}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.45rem', borderRadius: '8px', color: '#f59e0b', flexShrink: 0 }}>
              <RotateCcw size={18} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 600 }}>
                {isEs ? 'Historial Completo de Re-consumos' : 'Full Re-consumption History'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {isEs
                  ? 'Vuelve a marcar obras completadas cuantas veces quieras y accede a tu lista cronológica detallada con fechas exactas de visualización, lectura y juego.'
                  : 'Re-mark completed titles as many times as you want and access your detailed historical timeline of watches, reads, and plays.'}
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action */}
        <div style={{ flexShrink: 0 }}>
          {errorMsg && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.75rem 0' }}>
              {errorMsg}
            </p>
          )}

          {!user?.is_pro || (!user?.has_active_subscription && !user?.is_admin && !user?.is_vip) ? (
            <div>
              {user?.is_pro && user?.pro_expires_at && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}>
                  <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '0.15rem' }}>
                    {isEs ? 'Tienes acceso de regalo activo' : 'You have gifted access active'}
                  </strong>
                  {isEs
                    ? `Tu regalo vence el ${new Date(user.pro_expires_at).toLocaleDateString()}. Si te suscribes hoy, no se te cobrará nada hasta esa fecha.`
                    : `Your gift expires on ${new Date(user.pro_expires_at).toLocaleDateString()}. If you subscribe now, you will not be charged until then.`}
                </div>
              )}

              <button 
                className="btn-primary" 
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: 'var(--accent-text, #0f172a)',
                  borderRadius: '10px',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleSubscribe}
                disabled={loading}
              >
                <Crown size={18} />
                {loading
                  ? (isEs ? 'Preparando pago...' : 'Preparing checkout...')
                  : user?.is_pro
                  ? (isEs ? 'Mantener Premium al finalizar regalo ($4,99/mes)' : 'Keep Premium after gift ends ($4.99/mo)')
                  : (isEs ? 'Comenzar prueba gratis de 7 días' : 'Start 7-day free trial')}
              </button>

              {!user?.is_pro && (
                <p style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  margin: '0.55rem 0 0 0'
                }}>
                  {isEs 
                    ? 'Luego $4,99/mes (impuestos incluidos). Cancela cuando quieras.'
                    : 'Then $4.99/mo (taxes included). Cancel anytime.'}
                </p>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <p style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
                <Check size={18} /> {isEs ? '¡Ya eres usuario Premium!' : 'You are a Premium user!'}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
export default ProModal;
