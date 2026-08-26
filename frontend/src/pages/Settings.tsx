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
  ExternalLink,
  Trash2,
  X,
  EyeOff,
  Sparkles,
  Star,
  Globe,
  Sun,
  Moon,
  Monitor,
  Languages
} from 'lucide-react';

import { AvatarSelectorModal } from '../components/AvatarSelectorModal';
import { ProModal } from '../components/ProModal';

export const SettingsPage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isEs = language === 'es';


  // Modal states
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);


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


  // NSFW state
  const [showNsfw, setShowNsfw] = useState(user?.show_nsfw || false);
  const [isUpdatingNsfw, setIsUpdatingNsfw] = useState(false);

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

  const handleToggleNsfw = async () => {
    const nextVal = !showNsfw;
    setShowNsfw(nextVal);
    setIsUpdatingNsfw(true);
    try {
      await apiClient.put('/users/me', { show_nsfw: nextVal });
      await refreshProfile();
    } catch (err) {
      setShowNsfw(!nextVal); // Revert on fail
    } finally {
      setIsUpdatingNsfw(false);
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
          {isEs ? 'Ajustes de la Cuenta' : 'Account Settings'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Section 1: Avatar */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--bg-secondary)',
                  border: '2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                }}
              >
                {user?.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Sparkles size={20} color="var(--accent-primary)" />
                  {isEs ? 'Avatar de Personaje' : 'Character Avatar'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
                  {user?.is_pro
                    ? isEs
                      ? '⭐ Como usuario Premium, puedes buscar tu personaje favorito y usarlo de avatar.'
                      : '⭐ As a Premium user, you can search and choose any favorite character as your avatar.'
                    : isEs
                    ? 'Función exclusiva de Pathd Premium. Los usuarios gratuitos usan el avatar por defecto.'
                    : 'Exclusive to Pathd Premium. Free users have default initial avatars.'}
                </p>

              </div>
            </div>

            {user?.is_pro ? (
              <button
                onClick={() => setShowAvatarModal(true)}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.9rem',
                }}
              >
                <Sparkles size={16} />
                {isEs ? 'Cambiar Avatar' : 'Change Avatar'}
              </button>
            ) : (
              <button
                onClick={() => setShowProModal(true)}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.9rem',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Star size={16} fill="#fff" />
                {isEs ? 'Desbloquear con Premium' : 'Unlock with Premium'}
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Preferences & NSFW */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Eye size={20} color="var(--accent-primary)" />
            {isEs ? 'Preferencias de Contenido' : 'Content Preferences'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                {isEs ? 'Mostrar contenido para adultos (NSFW / +18)' : 'Show mature content (NSFW / 18+)'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isEs
                  ? 'Desenfoca o muestra portadas de contenido explícito o gore.'
                  : 'Blurs or unblurs explicit or gore cover art.'}
              </div>
            </div>
            <button
              onClick={handleToggleNsfw}
              disabled={isUpdatingNsfw}
              className={showNsfw ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              {showNsfw ? (isEs ? 'Habilitado' : 'Enabled') : isEs ? 'Deshabilitado' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Section 3: Appearance / Theme */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Sun size={20} color="var(--accent-primary)" />
            {isEs ? 'Tema y Apariencia' : 'Theme & Appearance'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {isEs
              ? 'Personaliza el esquema visual de la interfaz según tu preferencia.'
              : 'Customize the visual scheme of the interface to your preference.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { id: 'dark', label: isEs ? 'Oscuro' : 'Dark', icon: Moon },
              { id: 'light', label: isEs ? 'Claro' : 'Light', icon: Sun },
              { id: 'system', label: isEs ? 'Sistema' : 'System', icon: Monitor },
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

        {/* Section 4: Language */}
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
                  <Languages size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>


        {/* Section 5: Username */}
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

        {/* Section 4: Legal & Policies */}
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

        {/* Section 5: Danger Zone (Delete Account) */}
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

      {/* Avatar Selector Modal */}
      <AvatarSelectorModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentPhotoUrl={user?.photo_url}
        isPro={user?.is_pro}
        onAvatarUpdated={async () => {
          await refreshProfile();
        }}
      />

      {/* Pro / Premium Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}
    </div>
  );
};
export default SettingsPage;



