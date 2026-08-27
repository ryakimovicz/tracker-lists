import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const { language, t } = useTranslation();
  const isEs = language === 'es';

  const [email, setEmail] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || 
        (isEs ? 'Error al solicitar el restablecimiento de contraseña.' : 'Failed to request password reset.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: 450, margin: '4rem auto', padding: '2.5rem' }}>
      {isSuccess ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle size={40} color="#10b981" />
          </div>
          <h2 style={{ margin: 0 }}>
            {isEs ? '¡Enlace enviado!' : 'Reset link sent!'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
            {isEs 
              ? `Si el correo ` : `If the email `}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
            {isEs 
              ? ` está registrado en Pathd, recibirás un enlace para restablecer tu contraseña en los próximos minutos.`
              : ` is registered with Pathd, you will receive a reset link shortly.`}
          </p>
          <Link to="/login" className="btn-primary" style={{ width: '100%', textDecoration: 'none', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> {isEs ? 'Volver a Iniciar Sesión' : 'Back to Login'}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 0.25rem 0' }}>{t('authForgotPassword')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', margin: 0, lineHeight: '1.4' }}>
            {isEs 
              ? 'Ingresa tu correo electrónico y te enviaremos un enlace seguro para crear una nueva contraseña.'
              : 'Enter your email address and we will send you a secure link to create a new password.'}
          </p>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authEmail')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="input-field"
                placeholder={t('authEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
            {isSubmitting 
              ? (isEs ? 'Enviando enlace...' : 'Sending link...') 
              : (isEs ? 'Enviar enlace de restablecimiento' : t('authSendResetLink'))}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowLeft size={15} /> {isEs ? 'Volver a Iniciar Sesión' : 'Back to Login'}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
};
export default ForgotPassword;
