import React, { useState } from 'react';
import { User, AlertCircle, CheckCircle, ArrowRight, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface GoogleUsernameModalProps {
  isOpen: boolean;
  email: string;
  initialUsername: string;
  onConfirm: (username: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
  errorMessage?: string;
}

export const GoogleUsernameModal: React.FC<GoogleUsernameModalProps> = ({
  isOpen,
  email,
  initialUsername,
  onConfirm,
  onClose,
  isLoading,
  errorMessage,
}) => {
  const { language } = useTranslation();
  const [username, setUsername] = useState(initialUsername || '');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim();
    if (clean.length < 3) {
      setLocalError(language === 'es' ? 'El nombre de usuario debe tener al menos 3 caracteres' : 'Username must be at least 3 characters');
      return;
    }
    if (clean.length > 30) {
      setLocalError(language === 'es' ? 'El nombre de usuario no puede superar 30 caracteres' : 'Username cannot exceed 30 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setLocalError(language === 'es' ? 'Solo letras, números y guiones bajos (_)' : 'Only letters, numbers and underscores (_)');
      return;
    }
    setLocalError('');
    onConfirm(clean);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        isolation: 'isolate',
        pointerEvents: 'auto',
      }}
    >

      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2rem',
          position: 'relative',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
        }}
      >

        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: 'var(--accent-primary)',
            }}
          >
            <User size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.4rem' }}>
            {language === 'es' ? 'Elige tu nombre de usuario' : 'Choose your username'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            {language === 'es' ? 'Conectado como' : 'Connected as'}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {(errorMessage || localError) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage || localError}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'es' ? 'Nombre de usuario' : 'Username'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                autoFocus
                required
                className="input-field"
                placeholder={language === 'es' ? 'ej. mi_usuario' : 'e.g. my_username'}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setLocalError('');
                }}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                disabled={isLoading}
              />
              <User
                size={16}
                color="var(--text-muted)"
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {language === 'es'
                ? 'De 3 a 30 caracteres. Solo letras, números y _'
                : '3 to 30 characters. Only letters, numbers and _'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              marginTop: '0.5rem',
            }}
          >
            {isLoading ? (
              <span>{language === 'es' ? 'Creando cuenta...' : 'Creating account...'}</span>
            ) : (
              <>
                <span>{language === 'es' ? 'Completar registro' : 'Complete registration'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
            {language === 'es' ? 'Al registrarte, aceptas nuestros ' : 'By registering, you agree to our '}
            <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {language === 'es' ? 'Términos' : 'Terms'}
            </a>
            {language === 'es' ? ' y ' : ' and '}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {language === 'es' ? 'Privacidad' : 'Privacy'}
            </a>.
          </p>
        </form>
      </div>
    </div>
  );
};

