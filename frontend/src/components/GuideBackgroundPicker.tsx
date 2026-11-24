import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Monitor, Lock } from 'lucide-react';
import { getUserPlanTier } from '../utils/planPermissions';
import { BackgroundSelectorModal } from './BackgroundSelectorModal';

interface GuideBackgroundPickerProps {
  backgroundUrl: string | null;
  onChange: (url: string | null) => void;
  currentUser: any;
  language: string;
}

export const GuideBackgroundPicker: React.FC<GuideBackgroundPickerProps> = ({
  backgroundUrl,
  onChange,
  currentUser,
  language
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const planTier = getUserPlanTier(currentUser);
  const canUseBackground = planTier !== 'free';
  const [isOpen, setIsOpen] = useState(() => searchParams.get('bg') === '1');

  useEffect(() => {
    const hasBgParam = searchParams.get('bg') === '1';
    if (isOpen && !hasBgParam) {
      const next = new URLSearchParams(searchParams);
      next.set('bg', '1');
      setSearchParams(next);
    } else if (!isOpen && hasBgParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('bg');
      setSearchParams(next, { replace: true });
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchParams.get('bg') !== '1' && isOpen) {
      setIsOpen(false);
    }
  }, [searchParams]);

  if (!canUseBackground) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Lock size={14} /> {language === 'es' ? 'Fondo (Pro o Packs)' : 'Background (Pro or Packs)'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Monitor size={15} /> {language === 'es' ? 'Fondo' : 'Background'}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
        >
          {backgroundUrl
            ? (language === 'es' ? 'Cambiar fondo' : 'Change background')
            : (language === 'es' ? 'Elegir fondo' : 'Choose background')}
        </button>
        {backgroundUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444' }}
          >
            {language === 'es' ? 'Quitar' : 'Remove'}
          </button>
        )}
      </div>

      {createPortal(
        <BackgroundSelectorModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentBackgroundUrl={backgroundUrl}
          onBackgroundUpdated={(newUrl) => onChange(newUrl)}
          mode="guide"
        />,
        document.body
      )}
    </div>
  );
};
