import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Ban, LogOut, Mail, Clock, Trash2, Star, CheckCircle } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const SuspendedAccountModal: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [cancelSubMessage, setCancelSubMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);

  useEffect(() => {
    if (!user || !user.is_suspended) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [user?.is_suspended]);

  if (!user || !user.is_suspended) {
    return null;
  }

  const isPermanent = !user.suspended_until;
  const suspensionEndDate = user.suspended_until ? new Date(user.suspended_until) : null;

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
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 10, 15, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.5rem',
        textAlign: 'center'
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '2.5rem 2rem',
          borderRadius: 24,
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* Ban Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '1.5rem'
          }}
        >
          <Ban size={38} />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#ef4444' }}>
          {isEs ? 'Cuenta Suspendida' : 'Account Suspended'}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          {isEs
            ? 'Tu acceso a la plataforma ha sido restringido por el equipo de moderación debido a una infracción de los Términos de Servicio.'
            : 'Your access to the platform has been restricted by the moderation team due to a violation of our Terms of Service.'}
        </p>

        {/* Details Card */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: '1.25rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ marginBottom: '0.9rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              {isEs ? 'Motivo de la Sanción' : 'Reason for Action'}
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {user.suspension_reason || (isEs ? 'Infracción de las Normas Comunitarias' : 'Community Guidelines Violation')}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              {isEs ? 'Duración de la Suspensión' : 'Suspension Duration'}
            </div>
            <div style={{ fontSize: '0.95rem', color: isPermanent ? '#ef4444' : '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} />
              {isPermanent
                ? (isEs ? 'Permanente (Indefinida)' : 'Permanent (Indefinite)')
                : (isEs ? `Hasta el ${suspensionEndDate?.toLocaleDateString()} a las ${suspensionEndDate?.toLocaleTimeString()}` : `Until ${suspensionEndDate?.toLocaleDateString()} at ${suspensionEndDate?.toLocaleTimeString()}`)}
            </div>
          </div>
        </div>

        {/* Premium Subscription Cancellation Option for Suspended Users */}
        {user.is_pro && (
          <div style={{ width: '100%', marginBottom: '1.25rem' }}>
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
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.55rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
              >
                <Star size={15} />
                {isCancellingSub ? (isEs ? 'Cancelando suscripción...' : 'Cancelling subscription...') : (isEs ? 'Cancelar renovación de suscripción Premium' : 'Cancel Premium subscription renewal')}
              </button>
            )}
          </div>
        )}

        {errorMessage && (
          <div style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Support appeal info */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Mail size={15} />
          <span>
            {isEs ? 'Si consideras que esto es un error, contáctanos en ' : 'If you believe this is a mistake, contact us at '}
            <a href="mailto:support@pathd.net" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
              support@pathd.net
            </a>
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={logout}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 12,
              fontSize: '0.95rem',
              fontWeight: 600
            }}
          >
            <LogOut size={18} /> {isEs ? 'Cerrar Sesión' : 'Log Out'}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setConfirmDeleteModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.4rem',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Trash2 size={13} />
            {isDeleting ? (isEs ? 'Eliminando cuenta...' : 'Deleting account...') : (isEs ? 'Eliminar mi cuenta definitivamente (Derecho al olvido)' : 'Permanently delete my account (Right to be forgotten)')}
          </button>
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

export default SuspendedAccountModal;
