import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

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
  Star,
  Globe,
  Sun,
  Moon,
  Pencil,
  Image as ImageIcon,
  Monitor,
  Palette,
  Music
} from 'lucide-react';


import { PROFILE_THEME_COLORS, getProfileTheme } from '../utils/profileThemes';


import { AvatarSelectorModal } from '../components/AvatarSelectorModal';
import { BannerSelectorModal } from '../components/BannerSelectorModal';
import { BackgroundSelectorModal } from '../components/BackgroundSelectorModal';
import { ProModal } from '../components/ProModal';
import { ConfirmModal } from '../components/ConfirmModal';


export const SettingsPage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenProcessed = useRef(false);
  const isEs = language === 'es';


  // Modal states
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [selectedProfileColor, setSelectedProfileColor] = useState(user?.profile_color || 'amber');
  const [colorMsg, setColorMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingColor, setIsUpdatingColor] = useState(false);

  // Subscription management
  const [cancelSubLoading, setCancelSubLoading] = useState(false);
  const [cancelSubMsg, setCancelSubMsg] = useState<string | null>(null);
  const [cancelSubError, setCancelSubError] = useState<string | null>(null);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [showDisconnectLastFmModal, setShowDisconnectLastFmModal] = useState(false);

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



  useEffect(() => {
    if (user?.profile_color) {
      setSelectedProfileColor(user.profile_color);
    }
  }, [user?.profile_color]);

  const activeProfileTheme = getProfileTheme(selectedProfileColor, theme === 'light');

  const handleSelectProfileColor = async (colorId: string) => {
    if (!user?.is_pro) {
      setShowProModal(true);
      return;
    }
    setSelectedProfileColor(colorId);
    setIsUpdatingColor(true);
    setColorMsg(null);
    try {
      await apiClient.put('/users/me/color', { profile_color: colorId });
      await refreshProfile();
      setColorMsg({
        type: 'success',
        text: isEs ? 'Color de perfil y modales actualizado con éxito.' : 'Profile and modal theme color updated.',
      });
      setTimeout(() => setColorMsg(null), 3000);
    } catch (err: any) {
      setColorMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Error al actualizar color.' : 'Error updating color.'),
      });
    } finally {
      setIsUpdatingColor(false);
    }
  };


  // Last.fm state
  const [lastfmMsg, setLastfmMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDisconnectingLastFm, setIsDisconnectingLastFm] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !tokenProcessed.current) {
      tokenProcessed.current = true;
      connectLastFm(token);
    }
  }, [searchParams]);

  const connectLastFm = async (token: string) => {
    try {
      await apiClient.post(`/users/me/lastfm/connect?token=${token}`);
      await refreshProfile();
      setLastfmMsg({
        type: 'success',
        text: isEs ? 'Cuenta de Last.fm conectada exitosamente.' : 'Last.fm account connected successfully.',
      });
      navigate('/settings', { replace: true });
      setTimeout(() => setLastfmMsg(null), 4000);
    } catch (err: any) {
      setLastfmMsg({
        type: 'error',
        text: err.response?.data?.detail || (isEs ? 'Error al conectar con Last.fm.' : 'Error connecting to Last.fm.'),
      });
    }
  };

  const handleLastFmLogin = () => {
    const currentOrigin = window.location.origin;
    window.location.href = `http://www.last.fm/api/auth/?api_key=de5acce61bdd8b3e4bd181ebce8a69e8&cb=${encodeURIComponent(`${currentOrigin}/settings`)}`;
  };

  const handleLastFmDisconnect = () => {
    setShowDisconnectLastFmModal(true);
  };

  const executeDisconnectLastFm = async () => {
    setIsDisconnectingLastFm(true);
    setLastfmMsg(null);
    try {
      await apiClient.delete('/users/me/lastfm/disconnect');
      await refreshProfile();
      setLastfmMsg({
        type: 'success',
        text: isEs ? 'Cuenta de Last.fm desconectada.' : 'Last.fm account disconnected.',
      });
      setShowDisconnectLastFmModal(false);
      setTimeout(() => setLastfmMsg(null), 3000);
    } catch (err: any) {
      setLastfmMsg({
        type: 'error',
        text: isEs ? 'Error al desconectar la cuenta.' : 'Error disconnecting account.',
      });
      setShowDisconnectLastFmModal(false);
    } finally {
      setIsDisconnectingLastFm(false);
    }
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
          {isEs ? 'Ajustes de la Cuenta' : 'Account Settings'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Section 1: Customize Profile */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <User size={20} color="var(--accent-primary)" />
              {isEs ? 'Personalizar Perfil' : 'Customize Profile'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
              {isEs
                ? 'Modifica las imágenes y el color temático de tu perfil.'
                : 'Customize your profile images and theme color.'}
            </p>
          </div>

          {/* 3 Action Buttons: Avatar, Banner, Background */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {/* 1. Imagen de Perfil (Free) */}
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--border-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}
                >
                  <User size={18} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {isEs ? 'Imagen de perfil' : 'Profile Picture'}
                </span>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>

            {/* 2. Imagen de Portada (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (user?.is_pro) {
                  setShowBannerModal(true);
                } else {
                  setShowProModal(true);
                }
              }}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(139, 92, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8b5cf6',
                    flexShrink: 0,
                  }}
                >
                  <ImageIcon size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {isEs ? 'Imagen de portada' : 'Banner Image'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Star size={10} fill="#f59e0b" />
                    PREMIUM
                  </span>
                </div>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>


            {/* 3. Imagen de Fondo (Premium) */}
            <button
              type="button"
              onClick={() => {
                if (user?.is_pro) {
                  setShowBackgroundModal(true);
                } else {
                  setShowProModal(true);
                }
              }}
              className="glass-card"
              style={{
                padding: '1.15rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                >
                  <Monitor size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {isEs ? 'Imagen de fondo' : 'Background Image'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Star size={10} fill="#f59e0b" />
                    PREMIUM
                  </span>
                </div>
              </div>
              <Pencil size={15} color="var(--text-muted)" />
            </button>
          </div>

          {/* Color de Perfil Subheader */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                <Palette size={18} color="var(--accent-primary)" />
                {isEs ? 'Color de perfil' : 'Profile Color'}
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Star size={10} fill="#f59e0b" />
                  PREMIUM
                </span>
              </h3>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {isEs
                  ? 'Elige el color de acento y resplandor para tu perfil.'
                  : 'Choose the accent and glow color for your profile.'}
              </p>
            </div>
          </div>


          {colorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                background: colorMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: colorMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${colorMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {colorMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{colorMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.85rem' }}>
            {PROFILE_THEME_COLORS.map((col) => {
              const activeColor = theme === 'light' ? col.light.accent : col.dark.accent;
              const isSelected = selectedProfileColor === col.id || selectedProfileColor === col.dark.accent || selectedProfileColor === col.light.accent;

              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleSelectProfileColor(col.id)}
                  disabled={isUpdatingColor}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.9rem 0.75rem',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${activeColor}` : '1px solid var(--border-color)',
                    background: isSelected ? (theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)') : 'var(--bg-secondary)',
                    cursor: user?.is_pro ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 14px ${activeColor}40` : 'none',
                    transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: activeColor,
                      boxShadow: `0 2px 8px ${activeColor}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <CheckCircle size={16} color="#ffffff" />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? activeColor : 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  >
                    {isEs ? col.name.es : col.name.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Last.fm (Mostrar música escuchada) */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Music size={20} color="#ef4444" />
            {isEs ? 'Mostrar música escuchada' : 'Show Currently Playing Music'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {isEs
              ? 'Conecta tu cuenta de Last.fm para mostrar automáticamente la música que estás escuchando en tu perfil.'
              : 'Connect your Last.fm account to automatically display what music you are listening to on your profile.'}
          </p>

          {lastfmMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                background: lastfmMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: lastfmMsg.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${lastfmMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              }}
            >
              {lastfmMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{lastfmMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            {user?.lastfm_username ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {isEs ? 'Conectado como' : 'Connected as'} <strong style={{ color: '#ef4444' }}>{user.lastfm_username}</strong>
                </div>
                <button
                  onClick={handleLastFmDisconnect}
                  disabled={isDisconnectingLastFm}
                  className="btn-secondary"
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem',
                    borderColor: '#ef4444',
                    color: '#ef4444',
                  }}
                >
                  {isDisconnectingLastFm ? (isEs ? 'Desconectando...' : 'Disconnecting...') : isEs ? 'Desconectar' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleLastFmLogin}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.9rem',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                }}
              >
                <Music size={16} />
                {isEs ? 'Conectar con Last.fm' : 'Connect with Last.fm'}
              </button>
            )}
          </div>
        </div>



        {/* Section 4: Theme */}
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

        {/* Section 4: Membership & Subscription Management */}
        {user?.is_pro && !user?.is_admin && !user?.is_vip && (
          <div className="glass-card" style={{ padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                  {isEs ? 'Membresía Pathd Premium' : 'Pathd Premium Membership'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>
                  {isEs
                    ? 'Tu suscripción está activa. Puedes cancelar la renovación automática en cualquier momento.'
                    : 'Your subscription is active. You can cancel auto-renewal at any time.'}
                </p>
              </div>

              <button
                type="button"
                disabled={cancelSubLoading}
                onClick={handleCancelSubscription}
                className="btn-secondary"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}
              >
                {cancelSubLoading ? (isEs ? 'Cancelando...' : 'Cancelling...') : (isEs ? 'Cancelar Suscripción' : 'Cancel Subscription')}
              </button>
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

        {/* Section 5: Legal & Policies */}
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

      {/* Banner Selector Modal (Premium) */}
      <BannerSelectorModal
        isOpen={showBannerModal}
        onClose={() => setShowBannerModal(false)}
        currentBannerUrl={user?.banner_url}
        onBannerUpdated={async () => {
          await refreshProfile();
        }}
      />

      {/* Background Selector Modal (Premium) */}
      <BackgroundSelectorModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
        currentBackgroundUrl={user?.background_url}
        onBackgroundUpdated={async () => {
          await refreshProfile();
        }}
      />

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

      {/* Disconnect Last.fm Modal */}
      <ConfirmModal
        isOpen={showDisconnectLastFmModal}
        title={isEs ? '¿Desconectar Last.fm?' : 'Disconnect Last.fm?'}
        message={
          isEs
            ? 'Tu cuenta de Last.fm se desvinculará de Pathd. Podrás volver a conectarla cuando quieras.'
            : 'Your Last.fm account will be unlinked from Pathd. You can reconnect it anytime.'
        }
        confirmText={isEs ? 'Desconectar' : 'Disconnect'}
        cancelText={isEs ? 'Cancelar' : 'Cancel'}
        type="danger"
        isLoading={isDisconnectingLastFm}
        onConfirm={executeDisconnectLastFm}
        onClose={() => setShowDisconnectLastFmModal(false)}
      />


    </div>
  );
};
export default SettingsPage;



