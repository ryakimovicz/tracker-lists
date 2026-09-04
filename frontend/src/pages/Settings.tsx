import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';

import { 
  Settings as SettingsIcon, 
  User, 
  Lock, 
  Eye, 
  ShieldAlert, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Shield, 
  Trash2, 
  X, 
  EyeOff, 
  Star, 
  Globe, 
  Sun, 
  Moon, 
  Monitor, 
  Crown 
} from 'lucide-react';

import { ProModal } from '../components/ProModal';
import { ConfirmModal } from '../components/ConfirmModal';

export const SettingsPage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isEs = language === 'es';

  // Modal states
  const [showProModal, setShowProModal] = useState(false);

  // Subscription management
  const [cancelSubLoading, setCancelSubLoading] = useState(false);
  const [cancelSubMsg, setCancelSubMsg] = useState<string | null>(null);
  const [cancelSubError, setCancelSubError] = useState<string | null>(null);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);

  const executeCancelSubscription = async () => {
    setCancelSubLoading(true);
    setCancelSubMsg(null);
    setCancelSubError(null);
    try {
      const res = await apiClient.post('/payments/cancel-subscription');
      setCancelSubMsg(res.data.message || (isEs ? 'Suscripción cancelada con éxito.' : 'Subscription cancelled successfully.'));
      await refreshProfile();
      setShowCancelSubModal(false);
    } catch (err: any) {
      setCancelSubError(err.response?.data?.detail || 'Error cancelling subscription');
    } finally {
      setCancelSubLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelSubModal(true);
  };

  // Username form state
  const [username, setUsername] = useState(user?.username || '');
  const [usernameMsg, setUsernameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username === user?.username) return;
    setIsUpdatingUsername(true);
    setUsernameMsg(null);
    try {
      await apiClient.put('/users/me/username', { username: username.trim() });
      await refreshProfile();
      setUsernameMsg({
        type: 'success',
        text: isEs ? 'Nombre de usuario actualizado con éxito.' : 'Username updated successfully.',
      });
    } catch (err: any) {
      setUsernameMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Error al actualizar nombre de usuario.' : 'Failed to update username.'),
      });
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: 'error',
        text: isEs ? 'La nueva contraseña debe tener al menos 6 caracteres.' : 'New password must be at least 6 characters long.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: 'error',
        text: isEs ? 'Las contraseñas no coinciden.' : 'Passwords do not match.',
      });
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordMsg(null);
    try {
      await apiClient.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({
        type: 'success',
        text: isEs ? 'Contraseña actualizada correctamente.' : 'Password updated successfully.',
      });
    } catch (err: any) {
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Contraseña actual incorrecta.' : 'Current password is incorrect.'),
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user?.username) {
      setDeleteError(
        isEs
          ? `Debes escribir exactamente "${user?.username}" para confirmar.`
          : `You must type exactly "${user?.username}" to confirm.`
      );
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await apiClient.delete('/users/me');
      await logout();
      navigate('/');
    } catch (err: any) {
      setDeleteError(
        err.response?.data?.detail || (isEs ? 'Error al eliminar la cuenta.' : 'Failed to delete account.')
      );
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <SettingsIcon size={28} color="var(--accent-primary)" />
        <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 700 }}>
          {isEs ? 'Ajustes' : 'Settings'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Section 1: Theme */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Sun size={20} color="var(--accent-primary)" />
            {isEs ? 'Tema' : 'Theme'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {isEs
              ? 'Personaliza el esquema visual de la interfaz según tu preferencia.'
              : 'Customize the visual scheme of the interface to your preference.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { id: 'light', label: isEs ? 'Claro' : 'Light', icon: Sun },
              { id: 'system', label: isEs ? 'Sistema' : 'System', icon: Monitor },
              { id: 'dark', label: isEs ? 'Oscuro' : 'Dark', icon: Moon },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--border-glow)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Language */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Globe size={20} color="var(--accent-primary)" />
            {isEs ? 'Idioma' : 'Language'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {isEs
              ? 'Selecciona el idioma principal para los textos de la plataforma.'
              : 'Select the primary language for the platform interface.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { id: 'es', label: 'Español' },
              { id: 'en', label: 'English' },
            ].map((item) => {
              const isSelected = language === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLanguage(item.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--border-glow)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Username */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <User size={20} color="var(--accent-primary)" />
            {isEs ? 'Nombre de Usuario' : 'Username'}
          </h2>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {isEs
              ? 'Este es tu identificador público en tus guías, comentarios y perfil.'
              : 'This is your public identifier across your guides, comments, and profile.'}
          </p>

          {usernameMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                background: usernameMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: usernameMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${usernameMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {usernameMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{usernameMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateUsername} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              required
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ flex: 1, minWidth: '220px' }}
            />
            <button
              type="submit"
              disabled={isUpdatingUsername || !username.trim() || username === user?.username}
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              {isUpdatingUsername ? (isEs ? 'Guardando...' : 'Saving...') : isEs ? 'Actualizar' : 'Update'}
            </button>
          </form>
        </div>

        {/* Section 4: Password Change */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Lock size={20} color="var(--accent-primary)" />
            {isEs ? 'Cambiar Contraseña' : 'Change Password'}
          </h2>

          {passwordMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                background: passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: passwordMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {passwordMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                {isEs ? 'Contraseña actual' : 'Current password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  required
                  className="input-field"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
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
                  title={showCurrentPass ? t('authHidePassword') : t('authShowPassword')}
                >
                  {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  {isEs ? 'Nueva contraseña' : 'New password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    className="input-field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
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
                    title={showNewPass ? t('authHidePassword') : t('authShowPassword')}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  {isEs ? 'Confirmar nueva contraseña' : 'Confirm new password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    className="input-field"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
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
                    title={showConfirmPass ? t('authHidePassword') : t('authShowPassword')}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword || !currentPassword || !newPassword}
              className="btn-primary"
              style={{ alignSelf: 'flex-start', padding: '0.65rem 1.25rem', marginTop: '0.5rem' }}
            >
              {isUpdatingPassword ? (isEs ? 'Actualizando...' : 'Updating...') : isEs ? 'Cambiar Contraseña' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Section 5: Membership & Subscription Management */}
        {user?.is_pro && !user?.is_admin && !user?.is_vip && (
          <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                    <Star size={20} color="#f59e0b" fill="#f59e0b" />
                    {isEs ? 'Membresía Pathd Premium' : 'Pathd Premium Membership'}
                  </h2>
                  {user?.has_active_subscription ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontWeight: 600
                      }}
                    >
                      {isEs ? 'Activa' : 'Active'}
                    </span>
                  ) : user?.is_pro_cancelled ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        fontWeight: 600
                      }}
                    >
                      {isEs ? 'Renovación Cancelada' : 'Renewal Cancelled'}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontWeight: 600
                      }}
                    >
                      {isEs ? 'Acceso de Regalo' : 'Gifted Access'}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>
                  {user?.has_active_subscription
                    ? (isEs
                      ? 'Tu suscripción recurrente está activa. Puedes cancelar la renovación automática en cualquier momento.'
                      : 'Your recurring subscription is active. You can cancel auto-renewal at any time.')
                    : user?.is_pro_cancelled
                    ? (isEs
                      ? 'La renovación automática está desactivada. Mantienes el acceso Premium hasta el final de tu período y no se te cobrará ningún cargo futuro.'
                      : 'Auto-renewal is turned off. You keep full Premium access until the end of your billing period and will not be charged again.')
                    : (isEs
                      ? `Tienes acceso de regalo activo hasta el ${user?.pro_expires_at ? new Date(user.pro_expires_at).toLocaleDateString() : 'fin del período'}. Puedes activar tu suscripción ahora y el primer cobro se realizará recién al vencer el regalo.`
                      : `You have gifted access active until ${user?.pro_expires_at ? new Date(user.pro_expires_at).toLocaleDateString() : 'end of period'}. You can subscribe now and your first billing will occur only after the gift expires.`)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {user?.has_active_subscription && !user?.is_pro_cancelled && (
                  <button
                    type="button"
                    disabled={cancelSubLoading}
                    onClick={handleCancelSubscription}
                    className="btn-secondary"
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}
                  >
                    {cancelSubLoading ? (isEs ? 'Cancelando...' : 'Cancelling...') : (isEs ? 'Cancelar Suscripción' : 'Cancel Subscription')}
                  </button>
                )}

                {!user?.has_active_subscription && (
                  <button
                    type="button"
                    onClick={() => setShowProModal(true)}
                    className="btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.85rem',
                      padding: '0.55rem 1.1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    <Crown size={15} />
                    {isEs ? 'Mantener suscripción ($2.99/mes)' : 'Keep subscription ($2.99/mo)'}
                  </button>
                )}
              </div>
            </div>

            {cancelSubMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem' }}>
                <CheckCircle size={16} />
                <span>{cancelSubMsg}</span>
              </div>
            )}

            {cancelSubError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{cancelSubError}</span>
              </div>
            )}
          </div>
        )}

        {/* Section 6: Legal & Policies */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <FileText size={20} color="var(--accent-primary)" />
            {isEs ? 'Legal y Términos' : 'Legal & Policies'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {isEs ? 'Información sobre privacidad, términos de uso y APIs externas.' : 'Information regarding privacy, terms of use, and third-party APIs.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              to="/privacy"
              className="btn-secondary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}
            >
              <Shield size={16} /> {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
            </Link>
            <Link
              to="/terms"
              className="btn-secondary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}
            >
              <FileText size={16} /> {isEs ? 'Términos de Servicio y APIs' : 'Terms of Service & APIs'}
            </Link>
          </div>
        </div>

        {/* Section 7: Danger Zone (Delete Account) */}
        <div
          className="glass-card"
          style={{
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '0.5rem' }}>
            <ShieldAlert size={22} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {isEs ? 'Zona de Peligro' : 'Danger Zone'}
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {isEs
              ? 'Una vez eliminada tu cuenta, no hay vuelta atrás. Se borrarán irreversiblemente todas tus listas, progreso, comentarios y reseñas.'
              : 'Once you delete your account, there is no going back. All your lists, progress, comments, and reviews will be permanently deleted.'}
          </p>
          <button
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setDeleteError('');
            }}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.7rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Trash2 size={16} /> {isEs ? 'Eliminar mi cuenta' : 'Delete my account'}
          </button>
        </div>
      </div>

      {/* Version Footer */}
      <div style={{ textAlign: 'center', padding: '2.5rem 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--bg-secondary)',
          padding: '0.35rem 0.85rem',
          borderRadius: '9999px',
          border: '1px solid var(--border-color)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: '0.5rem'
        }}>
          <img src="/logo-transparent.svg" alt="Pathd" style={{ width: 16, height: 16 }} />
          Pathd v0.9.6 Beta
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isEs ? 'Seguimiento Multimedia Todo en Uno y Guías' : 'All-in-One Media Tracker & Guides'}
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '450px',
              padding: '2rem',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Trash2 size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#ef4444' }}>
                {isEs ? '¿Estás absolutamente seguro?' : 'Are you absolutely sure?'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {isEs
                  ? `Esta acción no se puede deshacer. Escribe tu nombre de usuario "`
                  : `This action cannot be undone. Please type your username "`}
                <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong>
                {isEs ? '" para confirmar la eliminación definitiva.' : '" to confirm permanent deletion.'}
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                autoFocus
                className="input-field"
                placeholder={user?.username}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{ width: '100%' }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  {isEs ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== user?.username}
                  style={{
                    flex: 1,
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontWeight: 600,
                    cursor: deleteConfirmText === user?.username ? 'pointer' : 'not-allowed',
                    opacity: deleteConfirmText === user?.username ? 1 : 0.5,
                  }}
                >
                  {isDeleting ? (isEs ? 'Borrando...' : 'Deleting...') : isEs ? 'Eliminar cuenta' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pro / Premium Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}

      {/* Cancel Subscription Modal */}
      <ConfirmModal
        isOpen={showCancelSubModal}
        title={isEs ? '¿Cancelar renovación Premium?' : 'Cancel Premium Renewal?'}
        message={
          isEs
            ? 'No se te volverá a cobrar ningún cargo futuro y mantendrás el acceso completo a todas las funciones Premium hasta que finalice el ciclo que ya pagaste.'
            : 'You will retain full access to all Premium features until the end of your current billing period, and you will not be charged again.'
        }
        confirmText={isEs ? 'Confirmar Cancelación' : 'Confirm Cancellation'}
        cancelText={isEs ? 'Mantener Plan' : 'Keep Plan'}
        type="warning"
        isLoading={cancelSubLoading}
        onConfirm={executeCancelSubscription}
        onClose={() => setShowCancelSubModal(false)}
      />
    </div>
  );
};

export default SettingsPage;
