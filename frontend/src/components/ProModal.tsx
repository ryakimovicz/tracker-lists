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
  const [selectedPlan, setSelectedPlan] = useState<'streaming' | 'reading' | 'premium'>('premium');
  const [premiumBilling, setPremiumBilling] = useState<'monthly' | 'annual'>('monthly');
  const [showPlanChangeConfirm, setShowPlanChangeConfirm] = useState(false);
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false);
  const [previewCharge, setPreviewCharge] = useState<{ total_amount: number | null; currency: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

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


  const executeSubscribe = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/payments/create-checkout', {
        plan: selectedPlan,
        billing_cycle: selectedPlan === 'premium' ? premiumBilling : 'monthly',
        ...(appliedDiscountCode ? { discount_code: appliedDiscountCode } : {})
      });
      if (res.data?.changed_plan) {
        await refreshProfile();
        handleModalClose();
      } else if (res.data?.checkout_url) {
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

  const handleSubscribe = async () => {
    if (user?.has_active_subscription && !showPlanChangeConfirm) {
      setShowPlanChangeConfirm(true);
      setPreviewCharge(null);
      setLoadingPreview(true);
      try {
        const res = await apiClient.post('/payments/preview-change-plan', {
          plan: selectedPlan,
          billing_cycle: selectedPlan === 'premium' ? premiumBilling : 'monthly'
        });
        setPreviewCharge(res.data);
      } catch (err) {
        console.error('Preview plan change error:', err);
      } finally {
        setLoadingPreview(false);
      }
      return;
    }
    await executeSubscribe();
  };

  const handleApplyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setApplyingDiscount(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/payments/preview-change-plan', {
        plan: selectedPlan,
        billing_cycle: selectedPlan === 'premium' ? premiumBilling : 'monthly',
        discount_code: code
      });
      setPreviewCharge(res.data);
      setAppliedDiscountCode(code);
    } catch (err: any) {
      console.error('Discount preview error:', err);
      setAppliedDiscountCode('');
      const msg = err.response?.data?.detail || (language === 'es' ? 'El código de descuento no es válido o no aplica.' : 'Discount code is invalid or not applicable.');
      setErrorMsg(msg);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setUpdatingPaymentMethod(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/payments/update-payment-method');
      if (res.data?.payment_link) {
        window.location.href = res.data.payment_link;
      } else {
        throw new Error('No payment link received');
      }
    } catch (err: any) {
      console.error('Update payment method error:', err);
      const msg = err.response?.data?.detail || (language === 'es' ? 'Error al abrir el portal de método de pago.' : 'Error opening payment method update.');
      setErrorMsg(msg);
      setUpdatingPaymentMethod(false);
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

        {/* Scrollable Plans Selector */}
        <div 
          className="pro-modal-benefits-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            overflowY: 'auto',
            paddingRight: '0.25rem',
            marginBottom: '1rem'
          }}
        >
          {/* Plan 1: Pack de Streaming */}
          <div
            onClick={() => setSelectedPlan('streaming')}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '12px',
              border: `1.5px solid ${selectedPlan === 'streaming' ? 'var(--color-movie)' : 'var(--border-color)'}`,
              background: selectedPlan === 'streaming' ? 'color-mix(in srgb, var(--color-movie) 8%, transparent)' : 'var(--bg-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--color-movie)' }}>
                {isEs ? 'Pack de Streaming' : 'Streaming Pack'}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                $1.99 <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {isEs ? 'mes' : 'mo'}</span>
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.28rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(isEs ? [
                'Categorías: Películas, Series y Anime',
                'Hasta 10 destacados en esas categorías',
                'Reordenar libremente esas categorías',
                'Protección anti-spoilers (desenfoque de episodios)',
                'Historial completo de re-consumo en Streaming',
                'Portadas y fondos de perfil con obras de Streaming'
              ] : [
                'Categories: Movies, TV Shows & Anime',
                'Up to 10 favorites in those categories',
                'Freely reorder those categories',
                'Anti-spoiler protection (unwatched episode blur)',
                'Full re-consumption history in Streaming',
                'Profile banners & wallpapers from Streaming titles'
              ]).map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={13} color="var(--color-movie)" style={{ flexShrink: 0 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan 2: Pack de Lectura */}
          <div
            onClick={() => setSelectedPlan('reading')}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '12px',
              border: `1.5px solid ${selectedPlan === 'reading' ? 'var(--color-manga)' : 'var(--border-color)'}`,
              background: selectedPlan === 'reading' ? 'color-mix(in srgb, var(--color-manga) 8%, transparent)' : 'var(--bg-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--color-manga)' }}>
                {isEs ? 'Pack de Lectura' : 'Reading Pack'}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                $1.99 <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {isEs ? 'mes' : 'mo'}</span>
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.28rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(isEs ? [
                'Categorías: Libros, Cómics y Manga',
                'Hasta 10 destacados en esas categorías',
                'Reordenar libremente esas categorías',
                'Historial completo de re-consumo en Lectura',
                'Portadas y fondos de perfil con obras de Lectura'
              ] : [
                'Categories: Books, Comics & Manga',
                'Up to 10 favorites in those categories',
                'Freely reorder those categories',
                'Full re-consumption history in Reading',
                'Profile banners & wallpapers from Reading titles'
              ]).map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={13} color="var(--color-manga)" style={{ flexShrink: 0 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan 3: Pack Premium (Mensual / Anual) */}
          <div
            onClick={() => setSelectedPlan('premium')}
            style={{
              padding: '0.95rem 1rem',
              borderRadius: '12px',
              border: `1.5px solid ${selectedPlan === 'premium' ? '#f59e0b' : 'var(--border-color)'}`,
              background: selectedPlan === 'premium' ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Star size={15} fill="#f59e0b" color="#f59e0b" /> {isEs ? 'Pack Premium' : 'Premium Pack'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '999px',
                    padding: '0.15rem',
                    gap: '0.15rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { setSelectedPlan('premium'); setPremiumBilling('monthly'); }}
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      border: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: premiumBilling === 'monthly' ? '#f59e0b' : 'transparent',
                      color: premiumBilling === 'monthly' ? '#0f172a' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isEs ? 'Mes' : 'Mo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlan('premium'); setPremiumBilling('annual'); }}
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      border: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: premiumBilling === 'annual' ? '#f59e0b' : 'transparent',
                      color: premiumBilling === 'annual' ? '#0f172a' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isEs ? 'Año -37%' : 'Yr -37%'}
                  </button>
                </div>

                <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                  {premiumBilling === 'monthly' ? '$3.99' : '$29.99'}
                  <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    /{premiumBilling === 'monthly' ? (isEs ? 'mes' : 'mo') : (isEs ? 'año' : 'yr')}
                  </span>
                </span>
              </div>
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.28rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(isEs ? [
                'Todas las categorías (incluye Juegos)',
                'Hasta 10 destacados en todas las categorías',
                'Reordenar libremente todas las categorías',
                'Protección anti-spoilers habilitada',
                'Historial completo de re-consumo en todas las categorías',
                'Portadas y fondos de perfil con cualquier obra',
                'Personalizar el color de la interfaz en toda la app',
                'Guías privadas y no listadas',
                'Insignia Premium en tu perfil y comentarios'
              ] : [
                'All categories (includes Games)',
                'Up to 10 favorites in all categories',
                'Freely reorder all categories',
                'Anti-spoiler protection enabled',
                'Full re-consumption history across all categories',
                'Profile banners & wallpapers from any title',
                'Custom interface theme color across the app',
                'Private & unlisted guides',
                'Premium badge on your profile & comments'
              ]).map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sticky Bottom Action */}
        <div style={{ flexShrink: 0 }}>
          {(!user?.is_admin && !user?.is_vip) ? (() => {
            const hasSub = Boolean(user?.has_active_subscription && !user?.is_pro_cancelled);
            const currentTier = String(user?.plan_tier || (user?.is_pro ? 'premium' : 'free')).toLowerCase();
            const currentCycle = String(user?.billing_cycle || 'monthly').toLowerCase();
            const isSameCurrentPlan = hasSub && currentTier === selectedPlan && (selectedPlan !== 'premium' || currentCycle === premiumBilling);

            return (
            <div>
              {user?.is_pro && !hasSub && user?.pro_expires_at && (
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
                    {user?.is_pro_cancelled
                      ? (isEs ? 'Tu suscripción está cancelada' : 'Your subscription is cancelled')
                      : (isEs ? 'Tienes acceso de regalo activo' : 'You have gifted access active')}
                  </strong>
                  {user?.is_pro_cancelled
                    ? (isEs
                        ? `La renovación automática está desactivada. Tu acceso sigue activo hasta el ${new Date(user.pro_expires_at).toLocaleDateString()}.`
                        : `Auto-renewal is turned off. Your access remains active until ${new Date(user.pro_expires_at).toLocaleDateString()}.`)
                    : (isEs
                        ? `Tu regalo vence el ${new Date(user.pro_expires_at).toLocaleDateString()}. Si te suscribes hoy, no se te cobrará nada hasta esa fecha.`
                        : `Your gift expires on ${new Date(user.pro_expires_at).toLocaleDateString()}. If you subscribe now, you will not be charged until then.`)}
                </div>
              )}

              <button 
                className="btn-primary" 
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: selectedPlan === 'streaming'
                    ? 'var(--color-movie)'
                    : selectedPlan === 'reading'
                      ? 'var(--color-manga)'
                      : '#f59e0b',
                  border: 'none',
                  color: selectedPlan === 'streaming'
                    ? 'var(--color-text-movie, #0f172a)'
                    : selectedPlan === 'reading'
                      ? 'var(--color-text-manga, #0f172a)'
                      : '#0f172a',
                  borderRadius: '10px',
                  boxShadow: selectedPlan === 'streaming'
                    ? '0 4px 15px color-mix(in srgb, var(--color-movie) 35%, transparent)'
                    : selectedPlan === 'reading'
                      ? '0 4px 15px color-mix(in srgb, var(--color-manga) 35%, transparent)'
                      : '0 4px 15px rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: (loading || isSameCurrentPlan) ? 'not-allowed' : 'pointer',
                  opacity: isSameCurrentPlan ? 0.65 : 1,
                  transition: 'background 0.15s ease, box-shadow 0.15s ease'
                }}
                onClick={handleSubscribe}
                disabled={loading || isSameCurrentPlan}
              >
                <Crown size={18} />
                {loading
                  ? (isEs ? 'Procesando...' : 'Processing...')
                  : isSameCurrentPlan
                    ? (isEs ? 'Este es tu plan actual' : 'This is your current plan')
                    : hasSub
                      ? (selectedPlan === 'streaming'
                          ? (isEs ? 'Cambiar a Pack de Streaming ($1.99/mes)' : 'Switch to Streaming Pack ($1.99/mo)')
                          : selectedPlan === 'reading'
                            ? (isEs ? 'Cambiar a Pack de Lectura ($1.99/mes)' : 'Switch to Reading Pack ($1.99/mo)')
                            : (premiumBilling === 'annual'
                                ? (isEs ? 'Cambiar a Premium Anual ($29.99/año)' : 'Switch to Annual Premium ($29.99/yr)')
                                : (isEs ? 'Cambiar a Premium ($3.99/mes)' : 'Switch to Premium ($3.99/mo)')))
                      : selectedPlan === 'streaming'
                        ? (isEs ? 'Suscribirse a Pack de Streaming ($1.99/mes)' : 'Subscribe to Streaming Pack ($1.99/mo)')
                        : selectedPlan === 'reading'
                          ? (isEs ? 'Suscribirse a Pack de Lectura ($1.99/mes)' : 'Subscribe to Reading Pack ($1.99/mo)')
                          : user?.is_pro
                            ? (premiumBilling === 'annual'
                                ? (isEs ? 'Mantener Premium Anual ($29.99/año)' : 'Keep Annual Premium ($29.99/yr)')
                                : (isEs ? 'Mantener Premium ($3.99/mes)' : 'Keep Premium ($3.99/mo)'))
                            : (isEs ? 'Comenzar prueba gratis de 7 días' : 'Start 7-day free trial')}
              </button>

              {!user?.is_pro && (
                <p style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  margin: '0.55rem 0 0 0'
                }}>
                  {selectedPlan === 'premium'
                    ? (premiumBilling === 'annual'
                        ? (isEs
                            ? 'Luego $29.99/año. Pueden aplicarse impuestos locales según tu país. Cancela cuando quieras.'
                            : 'Then $29.99/yr. Local taxes may apply depending on your country. Cancel anytime.')
                        : (isEs
                            ? 'Luego $3.99/mes. Pueden aplicarse impuestos locales según tu país. Cancela cuando quieras.'
                            : 'Then $3.99/mo. Local taxes may apply depending on your country. Cancel anytime.'))
                    : (isEs
                        ? 'Pueden aplicarse impuestos locales según tu país. Cancela cuando quieras.'
                        : 'Local taxes may apply depending on your country. Cancel anytime.')}
                </p>
              )}

              {showPlanChangeConfirm && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f59e0b' }}>
                    {isEs ? 'Confirmar cambio de plan' : 'Confirm Plan Change'}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {isEs
                      ? 'Ya tienes una suscripción activa. Al confirmar este cambio, se cobrará el monto prorrateado en tu método de pago guardado.'
                      : 'You already have an active subscription. Confirming this change will charge the prorated amount to your saved payment method.'}
                  </p>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loadingPreview
                      ? (isEs ? 'Calculando monto exacto...' : 'Calculating exact amount...')
                      : previewCharge && previewCharge.total_amount !== null && previewCharge.total_amount !== undefined
                        ? (() => {
                            const formatted = `${(previewCharge.total_amount / 100).toFixed(2)} ${previewCharge.currency || 'USD'}`;
                            return isEs
                              ? `Monto a cobrar ahora: $${formatted}`
                              : `Amount to be charged now: $${formatted}`;
                          })()
                        : (isEs ? 'No se pudo calcular el monto exacto.' : 'Could not calculate exact amount.')}
                  </div>
                  {!showDiscountInput ? (
                    <button
                      type="button"
                      onClick={() => setShowDiscountInput(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#f59e0b',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {isEs ? 'Tengo un código de descuento' : 'I have a discount code'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          placeholder={isEs ? 'Código de descuento' : 'Discount code'}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyDiscount}
                          disabled={applyingDiscount || !discountInput.trim()}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: applyingDiscount || !discountInput.trim() ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {applyingDiscount ? '...' : (isEs ? 'Aplicar' : 'Apply')}
                        </button>
                      </div>
                      {appliedDiscountCode && (
                        <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                          {isEs ? `Descuento "${appliedDiscountCode}" aplicado` : `Discount "${appliedDiscountCode}" applied`}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={executeSubscribe}
                      disabled={loading || updatingPaymentMethod}
                      style={{
                        flex: 1,
                        minWidth: '140px',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--accent-primary)',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading
                        ? (isEs ? 'Procesando...' : 'Processing...')
                        : (isEs ? 'Confirmar y pagar' : 'Confirm & Pay')}
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePaymentMethod}
                      disabled={loading || updatingPaymentMethod}
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: updatingPaymentMethod ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {updatingPaymentMethod
                        ? (isEs ? 'Abriendo...' : 'Opening...')
                        : (isEs ? 'Cambiar método de pago' : 'Change Payment Method')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPlanChangeConfirm(false)}
                      disabled={loading || updatingPaymentMethod}
                      style={{
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isEs ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })() : (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <p style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
                <Check size={18} /> {isEs ? '¡Ya eres usuario Premium!' : 'You are a Premium user!'}
              </p>
            </div>
          )}
        </div>

      </div>
      {errorMsg && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100001,
            maxWidth: 'min(92vw, 460px)',
            background: 'rgba(127, 29, 29, 0.96)',
            color: '#fecaca',
            border: '1px solid rgba(239, 68, 68, 0.55)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          <span style={{ flex: 1 }}>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fecaca',
              cursor: 'pointer',
              padding: '0.15rem',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
export default ProModal;
