import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { CheckCircle, AlertCircle, Loader2, Mail, ArrowRight } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(isEs ? 'No se proporcionó ningún token de confirmación.' : 'No verification token provided.');
      return;
    }

    const verify = async () => {
      try {
        const response = await apiClient.get('/auth/verify-email', {
          params: { token }
        });

        const { access_token } = response.data;
        setStatus('success');

        if (access_token) {
          await login(access_token);
        }

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          navigate('/profile');
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        const detail = err.response?.data?.detail;
        setErrorMessage(
          detail || (isEs ? 'El enlace de confirmación es inválido o ha expirado.' : 'The verification link is invalid or has expired.')
        );
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    try {
      await apiClient.post('/auth/resend-verification', {
        email: resendEmail.trim()
      });
      setResendSuccess(true);
    } catch (err: any) {
      setErrorMessage(isEs ? 'Error al reenviar el correo de confirmación.' : 'Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: 480, margin: '5rem auto', padding: '2.5rem', textAlign: 'center' }}>
      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <Loader2 size={48} className="spin" color="var(--accent-primary)" />
          <h2 style={{ margin: 0 }}>{isEs ? 'Verificando tu cuenta...' : 'Verifying your account...'}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {isEs ? 'Estamos confirmando tu dirección de correo electrónico.' : 'We are validating your email address.'}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
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
            <CheckCircle size={42} color="#10b981" />
          </div>
          <h2 style={{ margin: 0 }}>{isEs ? '¡Cuenta confirmada con éxito! 🎉' : 'Account verified successfully! 🎉'}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {isEs 
              ? 'Tu correo electrónico ha sido verificado. Serás redirigido a tu perfil en unos segundos...'
              : 'Your email has been verified. Redirecting you to your profile in a few seconds...'}
          </p>
          <button 
            onClick={() => navigate('/profile')}
            className="btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isEs ? 'Ir a mi Perfil' : 'Go to my Profile'} <ArrowRight size={18} />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertCircle size={42} color="#ef4444" />
          </div>
          <h2 style={{ margin: 0 }}>{isEs ? 'Enlace inválido o expirado' : 'Invalid or expired link'}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
            {errorMessage}
          </p>

          {resendSuccess ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: '1rem',
              borderRadius: 8,
              fontSize: '0.9rem',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {isEs ? '¡Correo de confirmación reenviado! Revisa tu bandeja de entrada.' : 'Confirmation email sent! Please check your inbox.'}
            </div>
          ) : (
            <form onSubmit={handleResend} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, textAlign: 'left' }}>
                {isEs ? 'Ingresa tu correo para recibir un nuevo enlace de activación:' : 'Enter your email to receive a new activation link:'}
              </p>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  className="input-field"
                  placeholder="ejemplo@correo.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                />
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <button type="submit" disabled={isResending} className="btn-primary" style={{ width: '100%' }}>
                {isResending 
                  ? (isEs ? 'Enviando...' : 'Sending...') 
                  : (isEs ? 'Reenviar correo de activación' : 'Resend activation email')}
              </button>
            </form>
          )}

          <Link to="/login" style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '0.5rem' }}>
            {isEs ? '← Volver a Iniciar Sesión' : '← Back to Login'}
          </Link>
        </div>
      )}
    </div>
  );
};

export default VerifyEmail;
