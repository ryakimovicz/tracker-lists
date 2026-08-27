import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const { language, t } = useTranslation();
  const isEs = language === 'es';
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg(isEs ? 'Enlace inválido o sin token de restablecimiento.' : 'Missing or invalid reset token.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg(isEs ? 'La contraseña debe tener al menos 6 caracteres.' : 'Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(isEs ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: password
      });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || 
        (isEs ? 'Error al restablecer la contraseña. El enlace puede haber expirado.' : 'Failed to reset password. Token may have expired.')
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
            {isEs ? '¡Contraseña actualizada!' : 'Password reset complete!'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
            {isEs 
              ? 'Tu contraseña ha sido cambiada con éxito. Serás redirigido al inicio de sesión...'
              : 'Your password has been successfully updated. Redirecting to login...'}
          </p>
          <Link to="/login" className="btn-primary" style={{ width: '100%', textDecoration: 'none', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {t('navLogin')} <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 0.25rem 0' }}>{t('authResetPasswordTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', margin: 0 }}>
            {isEs ? 'Ingresa y confirma tu nueva contraseña:' : 'Enter and confirm your new password:'}
          </p>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {!token && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={18} />
              <span>{isEs ? 'No se detectó ningún token en el enlace. Revisa tu correo.' : 'No reset token detected in the URL link. Check your email again.'}</span>
            </div>
          )}

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
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
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
                placeholder={t('authPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
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

          <button type="submit" disabled={isSubmitting || !token} className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
            {isSubmitting 
              ? (isEs ? 'Guardando nueva contraseña...' : 'Resetting...') 
              : (isEs ? 'Guardar nueva contraseña' : t('authResetPasswordTitle'))}
          </button>
        </form>
      )}
    </div>
  );
};
export default ResetPassword;
