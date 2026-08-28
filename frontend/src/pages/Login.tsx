import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Mail, Lock, AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { GoogleUsernameModal } from '../components/GoogleUsernameModal';
import { AdBanner } from '../components/AdBanner';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Google modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleSuggestedUser, setGoogleSuggestedUser] = useState('');
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [googleModalError, setGoogleModalError] = useState('');

  const handleResend = async () => {
    if (!usernameOrEmail) return;
    setIsResending(true);
    try {
      await apiClient.post('/auth/resend-verification', {
        email: usernameOrEmail.trim()
      });
      setResendSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setIsUnverified(false);
    setResendSuccess(false);

    try {
      // Backend expects standard OAuth2 request form URLencoded format: username and password
      const formData = new URLSearchParams();
      formData.append('username', usernameOrEmail);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      await login(access_token);
      navigate('/profile');
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.detail === 'EMAIL_NOT_VERIFIED') {
        setIsUnverified(true);
      } else if (err.response?.data?.detail === 'ACCOUNT_USES_GOOGLE') {
        setErrorMsg(t('errAccountUsesGoogle'));
      } else {
        setErrorMsg(t('errLoginFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMsg(t('errLoginFailed'));
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/google', {
        id_token: credentialResponse.credential
      });

      if (response.data.needs_username) {
        // Needs username prompt
        setPendingGoogleToken(credentialResponse.credential);
        setGoogleEmail(response.data.email || '');
        setGoogleSuggestedUser(response.data.suggested_username || '');
        setShowGoogleModal(true);
        return;
      }

      const { access_token } = response.data;
      await login(access_token);
      navigate('/profile');
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorMsg(err.response?.data?.detail || t('errLoginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleUsernameConfirm = async (chosenUsername: string) => {
    setIsSubmitting(true);
    setGoogleModalError('');
    try {
      const response = await apiClient.post('/auth/google', {
        id_token: pendingGoogleToken,
        username: chosenUsername
      });
      const { access_token } = response.data;
      setShowGoogleModal(false);
      await login(access_token);
      navigate('/profile');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === 'Username already registered') {
        setGoogleModalError(t('errUsernameTaken'));
      } else {
        setGoogleModalError(detail || t('errRegistrationFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: 450, margin: '4rem auto', padding: '2.5rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
          <img
            src="/logo-transparent.svg"
            alt="Pathd"
            style={{ width: '48px', height: '48px', filter: 'drop-shadow(0 4px 14px rgba(245, 158, 11, 0.3))' }}
          />
        </div>

        <h2 style={{ textAlign: 'center', margin: 0 }}>{t('authLoginButton')}</h2>

        {isUnverified && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            padding: '1rem',
            borderRadius: 8,
            fontSize: '0.9rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Cuenta pendiente de confirmación</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: '1.4' }}>
              Tu correo electrónico aún no ha sido confirmado. Revisa tu casilla o solicita un nuevo correo de activación.
            </p>
            {resendSuccess ? (
              <div style={{ color: '#10b981', fontWeight: 500, fontSize: '0.85rem' }}>
                ✓ ¡Correo reenviado con éxito! Revisa tu bandeja de entrada.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 6,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                {isResending ? 'Enviando...' : 'Reenviar correo de confirmación'}
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}


        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authEmail')} / {t('authUsername')}</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder={t('authEmailPlaceholder')}
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authPassword')}</label>
            <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {t('authForgotPassword')}
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              className="input-field"
              placeholder={t('authPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            />
            <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
              }}
              title={showPassword ? t('authHidePassword') : t('authShowPassword')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

          </div>

        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
          <LogIn size={18} /> {isSubmitting ? t('authLoggingIn') : t('authLoginButton')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span>{t('authOr')}</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErrorMsg(t('errLoginFailed'))}
            theme="filled_black"
            shape="pill"
            text="signin_with"
            size="large"
            width="360"
          />

        </div>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
          {t('authNoAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
            {t('authRegisterButton')}
          </Link>
        </p>
      </form>

      {/* Non-intrusive bottom sponsor / AdBanner */}
      <AdBanner style={{ maxWidth: '440px', margin: '1.5rem auto 0 auto' }} />

      <GoogleUsernameModal
        isOpen={showGoogleModal}
        email={googleEmail}
        initialUsername={googleSuggestedUser}
        isLoading={isSubmitting}
        errorMessage={googleModalError}
        onConfirm={handleGoogleUsernameConfirm}
        onClose={() => {
          setShowGoogleModal(false);
          setPendingGoogleToken('');
        }}
      />
    </div>
  );
};
export default Login;


