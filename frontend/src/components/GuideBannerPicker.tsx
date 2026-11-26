import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, Star } from 'lucide-react';
import { BannerSelectorModal } from './BannerSelectorModal';

interface GuideBannerPickerProps {
  bannerUrl: string | null;
  onChange: (url: string | null, itemType?: string | null) => void;
  currentUser: any;
  language: string;
}

export const GuideBannerPicker: React.FC<GuideBannerPickerProps> = ({
  bannerUrl,
  onChange,
  language
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(() => searchParams.get('cover') === '1');

  useEffect(() => {
    const hasCoverParam = searchParams.get('cover') === '1';
    if (isOpen && !hasCoverParam) {
      const next = new URLSearchParams(searchParams);
      next.set('cover', '1');
      setSearchParams(next);
    } else if (!isOpen && hasCoverParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('cover');
      setSearchParams(next, { replace: true });
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchParams.get('cover') !== '1' && isOpen) {
      setIsOpen(false);
    }
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ImageIcon size={15} /> {language === 'es' ? 'Portada' : 'Cover'}
        <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
          <Star size={10} fill="#f59e0b" />
        </span>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
        >
          {bannerUrl
            ? (language === 'es' ? 'Cambiar portada' : 'Change cover')
            : (language === 'es' ? 'Elegir portada' : 'Choose cover')}
        </button>
        {bannerUrl && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444' }}
          >
            {language === 'es' ? 'Quitar' : 'Remove'}
          </button>
        )}
      </div>

      {createPortal(
        <BannerSelectorModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentBannerUrl={bannerUrl}
          onBannerUpdated={(newUrl) => onChange(newUrl, null)}
          mode="guide"
        />,
        document.body
      )}
    </div>
  );
};
