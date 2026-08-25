import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { User, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { GoogleUsernameModal } from '../components/GoogleUsernameModal';

export const Register: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!username || !email || !password) return;

    if (username.length < 3) {
      setErrorMsg(t('errUsernameLength'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('errPasswordLength'));
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
    <div className="glass-card" style={{ maxWidth: 450, margin: '4rem auto', padding: '2.5rem' }}>
      {isSuccess ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          <CheckCircle size={48} color="#10b981" />
          <h2>Account Created Successfully</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Your account has been registered. You can now log in using your credentials.
          </p>
          <Link to="/login" className="btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
            {t('navLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{t('authRegisterButton')}</h2>

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
                type="password"
                required
                className="input-field"
                placeholder={t('authPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
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
              width="100%"
            />
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
            {t('authHaveAccount')}{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
              {t('navLogin')}
            </Link>
          </p>
        </form>
      )}

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


