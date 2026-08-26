import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Ban, ShieldAlert, LogOut, Mail, Clock } from 'lucide-react';

export const SuspendedAccountModal: React.FC = () => {
  const { user, logout } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';

  if (!user || !user.is_suspended) {
    return null;
  }

  const isPermanent = !user.suspended_until;
  const suspensionEndDate = user.suspended_until ? new Date(user.suspended_until) : null;

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
            marginBottom: '1.75rem',
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

        {/* Support appeal info */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Mail size={15} />
          <span>
            {isEs ? 'Si consideras que esto es un error, contáctanos en ' : 'If you believe this is a mistake, contact us at '}
            <a href="mailto:support@pathd.net" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
              support@pathd.net
            </a>
          </span>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={logout}
          className="btn-secondary"
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
      </div>
    </div>
  );
};

export default SuspendedAccountModal;
