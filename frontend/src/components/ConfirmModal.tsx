import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  type = 'warning',
  isAlert = false,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle size={32} color="#ef4444" />;
      case 'warning':
        return <AlertCircle size={32} color="#f59e0b" />;
      case 'success':
        return <CheckCircle2 size={32} color="#10b981" />;
      case 'info':
      default:
        return <Info size={32} color="#3b82f6" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'danger':
        return 'rgba(239, 68, 68, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.15)';
      case 'success':
        return 'rgba(16, 185, 129, 0.15)';
      case 'info':
      default:
        return 'rgba(59, 130, 246, 0.15)';
    }
  };

  const getConfirmBtnStyle = () => {
    if (type === 'danger') {
      return {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        color: '#fff',
        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)',
      };
    }
    return {
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: '#fff',
      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)',
    };
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={!isLoading ? onClose : undefined}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.25rem',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isLoading && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1.25rem',
              right: '1.25rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isEs ? 'Cerrar' : 'Close'}
          >
            <X size={20} />
          </button>
        )}

        {/* Icon Circle */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: getIconBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          {getIcon()}
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#f8fafc',
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <p
          style={{
            margin: '0 0 1.75rem 0',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            color: 'var(--text-secondary, #94a3b8)',
          }}
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {!isAlert && (
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {cancelText || (isEs ? 'Cancelar' : 'Cancel')}
            </button>
          )}

          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              ...getConfirmBtnStyle(),
            }}
          >
            {isLoading ? (isEs ? 'Procesando...' : 'Processing...') : (confirmText || (isEs ? 'Confirmar' : 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
