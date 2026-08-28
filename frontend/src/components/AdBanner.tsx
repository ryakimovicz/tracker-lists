import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface AdBannerProps {
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  style?: React.CSSProperties;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  slotId,
  format = 'auto',
  style = {},
  className = ''
}) => {
  const { user } = useAuth();
  const adRef = useRef<HTMLDivElement>(null);
  const isAdPushed = useRef<boolean>(false);

  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Pro / VIP users enjoy an entirely ad-free experience
  if (!isLocalDev && (user?.is_pro || user?.is_vip || user?.is_admin)) {
    return null;
  }

  useEffect(() => {
    if (isLocalDev) return;
    if (isAdPushed.current) return;

    try {
      if (typeof window !== 'undefined') {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
        isAdPushed.current = true;
      }
    } catch (err) {
      // Ignore initial render or ad-blocker errors gracefully
    }
  }, [isLocalDev]);

  return (
    <div
      className={className}
      style={{
        margin: '1.5rem auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '728px',
        minHeight: '90px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style
      }}
      ref={adRef}
    >
      {isLocalDev ? (
        <div
          style={{
            width: '100%',
            height: '90px',
            border: '1px dashed rgba(255, 255, 255, 0.18)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <span>Espacio de Anuncio (728×90)</span>
        </div>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '90px' }}
          data-ad-client="ca-pub-7081495763188158"
          data-ad-slot={slotId || '7081495763188158'}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
};

export default AdBanner;
