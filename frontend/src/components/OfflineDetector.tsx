import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export const OfflineDetector: React.FC = () => {
  const { language } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let hideTimer: any = null;
    let leaveTimer: any = null;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setIsLeaving(false);
        setShowRestored(true);

        // Start leave animation after 2.8s, then remove at 3.1s
        leaveTimer = setTimeout(() => {
          setIsLeaving(true);
        }, 2800);

        hideTimer = setTimeout(() => {
          setShowRestored(false);
          setIsLeaving(false);
          setWasOffline(false);
        }, 3100);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestored(false);
      setIsLeaving(false);
      if (hideTimer) clearTimeout(hideTimer);
      if (leaveTimer) clearTimeout(leaveTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (hideTimer) clearTimeout(hideTimer);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, [wasOffline]);

  const isEs = language === 'es';

  // If online and not displaying the brief "Restored" toast, render nothing
  if ((isOnline && !showRestored) || !mounted || typeof document === 'undefined') {
    return null;
  }

  const toastContent = (
    <div
      role="status"
      aria-live="polite"
      className={`offline-toast ${isOnline ? 'offline-toast--restored' : 'offline-toast--offline'} ${isLeaving ? 'offline-toast--leaving' : ''}`}
    >
      <div className="offline-toast-icon">
        {isOnline ? <Wifi size={16} strokeWidth={2.4} /> : <WifiOff size={16} strokeWidth={2.4} />}
      </div>
      <span className="offline-toast-text">
        {isOnline
          ? (isEs ? 'Conexión a internet restablecida' : 'Internet connection restored')
          : (isEs ? 'Sin conexión a internet' : 'No internet connection')}
      </span>
    </div>
  );

  return createPortal(toastContent, document.body);
};

export default OfflineDetector;
