import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Mail, Lock, AlertCircle, LogIn } from 'lucide-react';

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
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) return;

    setIsSubmitting(true);
    setErrorMsg('');

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
      setErrorMsg(t('errLoginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMockGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // Mock Google OAuth login bypass on the backend
      const response = await apiClient.post('/auth/google', {
        id_token: 'mock-google-email-username'
      });
      const { access_token } = response.data;
      await login(access_token);
      navigate('/profile');
    } catch (err: any) {
      setErrorMsg(t('errLoginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: 450, margin: '4rem auto', padding: '2.5rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{t('authLoginButton')}</h2>

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
          <LogIn size={18} /> {isSubmitting ? t('authLoggingIn') : t('authLoginButton')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span>{t('authOr')}</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        <button type="button" onClick={handleMockGoogleLogin} className="btn-secondary" style={{ width: '100%' }}>
          {t('authGoogleLogin')}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
          {t('authNoAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
            {t('authRegisterButton')}
          </Link>
        </p>
      </form>
    </div>
  );
};
export default Login;
