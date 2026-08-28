import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { User, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { GoogleUsernameModal } from '../components/GoogleUsernameModal';
import { AdBanner } from '../components/AdBanner';

export const Register: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { language, t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleSuggestedUser, setGoogleSuggestedUser] = useState('');
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [googleModalError, setGoogleModalError] = useState('');

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMsg(t('errRegistrationFailed'));
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
      console.error('Google register error:', err);
      setErrorMsg(err.response?.data?.detail || t('errRegistrationFailed'));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) return;

    if (username.length < 3) {
      setErrorMsg(t('errUsernameLength'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('errPasswordLength'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('errPasswordsNotMatch'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');


    try {
      await apiClient.post('/auth/register', {
        username,
        email,
        password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const backendDetail = err.response?.data?.detail;
      if (backendDetail === 'Username already registered') {
        setErrorMsg(t('errUsernameTaken'));
      } else if (backendDetail === 'GOOGLE_ACCOUNT_EXISTS') {
        setErrorMsg(t('errGoogleAccountExists'));
      } else if (backendDetail === 'Email already registered') {
        setErrorMsg(t('errEmailTaken'));
      } else {
        setErrorMsg(t('errRegistrationFailed'));
      }
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
            background: 'rgba(124, 58, 237, 0.15)',
            border: '2px solid var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Mail size={38} color="var(--accent-primary)" />
          </div>
          <h2 style={{ margin: 0 }}>
            {language === 'es' ? '¡Revisa tu correo electrónico! 🚀' : 'Check your email! 🚀'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
            {language === 'es' 
              ? `Hemos enviado un enlace de confirmación a ` 
              : `We sent a confirmation link to `}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            <br />
            {language === 'es'
              ? 'Por favor haz clic en el enlace para activar tu cuenta antes de iniciar sesión.'
              : 'Please click the link to activate your account before logging in.'}
          </p>
          <Link to="/login" className="btn-primary" style={{ width: '100%', textDecoration: 'none', marginTop: '0.5rem' }}>
            {t('navLogin')}
          </Link>
        </div>
      ) : (

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
            <img
              src="/logo-transparent.svg"
              alt="Pathd"
              style={{ width: '48px', height: '48px', filter: 'drop-shadow(0 4px 14px rgba(245, 158, 11, 0.3))' }}
            />
          </div>

          <h2 style={{ textAlign: 'center', margin: 0 }}>{t('authRegisterButton')}</h2>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authUsername')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                className="input-field"
                placeholder={t('authUsernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

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
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authPassword')}</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('authConfirmPassword')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className="input-field"
                placeholder={language === 'es' ? 'repite tu contraseña' : 'confirm your password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                title={showConfirmPassword ? t('authHidePassword') : t('authShowPassword')}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>




          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            {isSubmitting ? t('authRegistering') : t('authRegisterButton')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span>{t('authOr')}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMsg(t('errRegistrationFailed'))}
              theme="filled_black"
              shape="pill"
              text="signup_with"
              size="large"
              width="360"
            />
          </div>


          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.4 }}>
            {language === 'es' ? 'Al registrarte, aceptas nuestros ' : 'By creating an account, you agree to our '}
            <Link to="/terms" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {language === 'es' ? 'Términos' : 'Terms'}
            </Link>
            {language === 'es' ? ' y ' : ' and '}
            <Link to="/privacy" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {language === 'es' ? 'Privacidad' : 'Privacy'}
            </Link>.
          </p>

          <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
            {t('authHaveAccount')}{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
              {t('navLogin')}
            </Link>
          </p>
        </form>
      )}

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
export default Register;


