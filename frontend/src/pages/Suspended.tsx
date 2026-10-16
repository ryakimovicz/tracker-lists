import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Ban, LogOut, Mail, Clock, Trash2, Star, CheckCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { CopyEmailButton } from '../components/CopyEmailButton';

export const Suspended: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [cancelSubMessage, setCancelSubMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmCancelModal, setConfirmCancelModal] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);

  // Trap back navigation: prevent leaving /suspended via browser back
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const parseUtcDate = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
      s = `${s.replace(' ', 'T')}Z`;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const isPermanent = !user?.suspended_until;
  const suspensionEndDate = parseUtcDate(user?.suspended_until);

  const executeCancelSubscription = async () => {
    setIsCancellingSub(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post('/payments/cancel-subscription');
      setCancelSubMessage(res.data.message || (isEs ? 'Renovación de suscripción cancelada.' : 'Subscription renewal cancelled.'));
      await refreshProfile();
      setConfirmCancelModal(false);
    } catch (err) {
      setErrorMessage(isEs ? 'Error al cancelar la suscripción. Contáctanos a support@pathd.net' : 'Error cancelling subscription. Please contact support@pathd.net');
      setConfirmCancelModal(false);
    } finally {
      setIsCancellingSub(false);
    }
  };

  const executeDeleteMyAccount = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await apiClient.delete('/users/me');
      await logout();
    } catch (err) {
      setErrorMessage(isEs ? 'Error al eliminar la cuenta. Por favor contáctanos a support@pathd.net' : 'Error deleting account. Please contact support@pathd.net');
      setConfirmDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at top, rgba(239, 68, 68, 0.12) 0%, rgba(10, 10, 15, 0.98) 75%)'
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 2.5rem)',
          overflowY: 'auto',
          padding: '2rem 1.75rem',
          borderRadius: 24,
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(239, 68, 68, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
          textAlign: 'center'
        }}
      >
        {/* Ban Icon */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '0.85rem'
          }}
        >
          <Ban size={30} />
        </div>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.35rem', color: '#ef4444' }}>
          {isEs ? 'Cuenta Suspendida' : 'Account Suspended'}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          {isEs
            ? 'Tu acceso a la plataforma ha sido restringido por el equipo de moderación.'
            : 'Your access to the platform has been restricted by the moderation team.'}
        </p>

        {/* Details Card */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '1rem',
            textAlign: 'left',
            marginBottom: '1.1rem',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              {isEs ? 'Motivo de la Sanción' : 'Reason for Action'}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {user?.suspension_reason || (isEs ? 'Infracción de las Normas Comunitarias' : 'Community Guidelines Violation')}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              {isEs ? 'Duración de la Suspensión' : 'Suspension Duration'}
            </div>
            <div style={{ fontSize: '0.9rem', color: isPermanent ? '#ef4444' : '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={15} />
              {isPermanent
                ? (isEs ? 'Permanente (Indefinida)' : 'Permanent (Indefinite)')
                : (isEs
                    ? `Hasta el ${suspensionEndDate?.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} a las ${suspensionEndDate?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })} hs`
                    : `Until ${suspensionEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${suspensionEndDate?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`)}
            </div>
          </div>
        </div>

        {/* Premium Subscription Cancellation Option for Suspended Users */}
        {user?.is_pro && (
          <div style={{ width: '100%', marginBottom: '1.1rem' }}>
            {cancelSubMessage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.6rem 0.9rem', borderRadius: 8, fontSize: '0.85rem' }}>
                <CheckCircle size={15} />
                <span>{cancelSubMessage}</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isCancellingSub}
                onClick={() => setConfirmCancelModal(true)}
                className="btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.55rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
              >
                <Star size={14} />
                {isCancellingSub ? (isEs ? 'Cancelando suscripción...' : 'Cancelling subscription...') : (isEs ? 'Cancelar renovación de suscripción Premium' : 'Cancel Premium subscription renewal')}
              </button>
            )}
          </div>
        )}

        {errorMessage && (
          <div style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.85rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Support appeal info */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0', textAlign: 'center', lineHeight: 1.5 }}>
          <Mail size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--text-muted)' }} />
          {isEs ? 'Si consideras que esto es un error, contáctanos en ' : 'If you believe this is a mistake, contact us at '}
          <a href="mailto:support@pathd.net" style={{ color: 'var(--accent-primary, #f59e0b)', fontWeight: 600, textDecoration: 'none' }}>
            support@pathd.net
          </a>
          <CopyEmailButton email="support@pathd.net" />
        </p>

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={logout}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 12,
              fontSize: '0.92rem',
              fontWeight: 600
            }}
          >
            <LogOut size={16} /> {isEs ? 'Cerrar Sesión' : 'Log Out'}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setConfirmDeleteModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.35rem',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Trash2 size={13} />
            {isDeleting ? (isEs ? 'Eliminando cuenta...' : 'Deleting account...') : (isEs ? 'Eliminar mi cuenta definitivamente' : 'Permanently delete my account')}
          </button>
        </div>

        {/* Legal Links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Link
            to="/privacy"
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline', transition: 'color 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
          </Link>
          <span>•</span>
          <Link
            to="/terms"
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline', transition: 'color 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {isEs ? 'Términos del Servicio' : 'Terms of Service'}
          </Link>
        </div>

        {/* Confirm Modals */}
        <ConfirmModal
          isOpen={confirmCancelModal}
          title={isEs ? '¿Cancelar renovación Premium?' : 'Cancel Premium Renewal?'}
          message={
            isEs
              ? 'No se te volverá a cobrar ningún cargo futuro y mantendrás el acceso a todas las funciones Premium hasta que finalice el ciclo que ya pagaste.'
              : 'You will retain full access until the end of your current billing period, and you will not be charged again.'
          }
          confirmText={isEs ? 'Confirmar Cancelación' : 'Confirm Cancellation'}
          cancelText={isEs ? 'Volver' : 'Back'}
          type="warning"
          isLoading={isCancellingSub}
          onConfirm={executeCancelSubscription}
          onClose={() => setConfirmCancelModal(false)}
        />

        <ConfirmModal
          isOpen={confirmDeleteModal}
          title={isEs ? '¿Eliminar cuenta definitivamente?' : 'Permanently delete account?'}
          message={
            isEs
              ? 'Conforme a las leyes de privacidad, se cancelarán de inmediato todas tus suscripciones activas y se borrarán tus datos personales de forma irreversible.'
              : 'Under privacy laws, all active subscriptions will be cancelled and your personal data permanently wiped.'
          }
          confirmText={isEs ? 'Eliminar Cuenta' : 'Delete Account'}
          cancelText={isEs ? 'Cancelar' : 'Cancel'}
          type="danger"
          isLoading={isDeleting}
          onConfirm={executeDeleteMyAccount}
          onClose={() => setConfirmDeleteModal(false)}
        />
      </div>
    </div>
  );
};

export default Suspended;
