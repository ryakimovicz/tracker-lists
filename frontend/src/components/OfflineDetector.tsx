import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export const OfflineDetector: React.FC = () => {
  const { language } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestored(true);
        const timer = setTimeout(() => {
          setShowRestored(false);
          setWasOffline(false);
        }, 3500);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const isEs = language === 'es';

  // If online and not displaying the brief "Restored" toast, render nothing
  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.6rem 1.1rem',
        borderRadius: '9999px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontSize: '0.85rem',
        fontWeight: 600,
        pointerEvents: 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        background: isOnline
          ? 'rgba(16, 185, 129, 0.92)'
          : 'rgba(239, 68, 68, 0.92)',
        color: '#ffffff',
        border: isOnline
          ? '1px solid rgba(110, 231, 183, 0.5)'
          : '1px solid rgba(252, 165, 165, 0.5)',
        maxWidth: '90vw',
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={16} />
          <span>{isEs ? 'Conexión a internet restablecida' : 'Internet connection restored'}</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span>
            {isEs
              ? 'Sin conexión a internet. Modo sin conexión.'
              : 'No internet connection. Offline mode.'}
          </span>
        </>
      )}
    </div>
  );
};

export default OfflineDetector;
