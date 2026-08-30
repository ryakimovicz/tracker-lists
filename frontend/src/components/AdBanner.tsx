import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Megaphone } from 'lucide-react';

interface AdBannerProps {
  slotId?: string;
  variant?: 'banner' | 'card' | 'skyscraper';
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  style?: React.CSSProperties;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  slotId,
  variant = 'banner',
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
      // Ignore errors
    }
  }, [isLocalDev]);

  // Dimensions based on variant
  if (variant === 'card') {
    return (
      <div
        className={`glass-card ${className}`}
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          minWidth: '160px',
          width: '160px',
          height: '310px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...style
        }}
        ref={adRef}
      >
        {isLocalDev ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              background: 'rgba(255, 255, 255, 0.02)',
              boxSizing: 'border-box'
            }}
          >
            <Megaphone size={20} style={{ opacity: 0.6, marginBottom: '0.25rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Anuncio</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '0.25rem' }}>Tarjeta patrocinada</div>
          </div>
        ) : (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: '100%' }}
            data-ad-client="ca-pub-7081495763188158"
            data-ad-slot={slotId || '7081495763188158'}
            data-ad-format="rectangle"
          />
        )}
      </div>
    );
  }

  if (variant === 'skyscraper') {
    return (
      <div
        className={className}
        style={{
          width: '160px',
          minHeight: '600px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          ...style
        }}
        ref={adRef}
      >
        {isLocalDev ? (
          <div
            style={{
              width: '100%',
              height: '600px',
              border: '1px dashed rgba(255, 255, 255, 0.18)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '1rem',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              background: 'rgba(255, 255, 255, 0.02)',
              boxSizing: 'border-box'
            }}
          >
            <Megaphone size={24} style={{ opacity: 0.6, marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Publicidad Lateral</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '0.25rem' }}>160×600</div>
          </div>
        ) : (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '160px', height: '600px' }}
            data-ad-client="ca-pub-7081495763188158"
            data-ad-slot={slotId || '7081495763188158'}
            data-ad-format="vertical"
          />
        )}
      </div>
    );
  }

  // Default: Banner horizontal
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
