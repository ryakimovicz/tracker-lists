import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

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
  const { language } = useTranslation();
  const isEs = language === 'es';
  const adRef = useRef<HTMLDivElement>(null);
  const isAdPushed = useRef<boolean>(false);

  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 1. Pro / VIP users enjoy an entirely ad-free experience (Key monetization incentive!)
  // In localhost, allow preview unless explicitly wanting to test Pro hiding
  if (!isLocalDev && (user?.is_pro || user?.is_vip || user?.is_admin)) {
    return null;
  }

  useEffect(() => {
    if (isLocalDev) return;
    // Only push once per mount to prevent AdSense duplicate push errors in React SPAs
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
      className={`glass-card ${className}`}
      style={{
        margin: '2rem auto',
        padding: '1rem',
        borderRadius: '12px',
        textAlign: 'center',
        overflow: 'hidden',
        maxWidth: '900px',
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        ...style
      }}
      ref={adRef}
    >
      <div
        style={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: '0.5rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 0.5rem'
        }}
      >
        <span>{isEs ? 'Publicidad' : 'Advertisement'}</span>
        {isLocalDev && (
          <span style={{ color: 'var(--accent-primary)', fontSize: '0.6rem', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            {isEs ? 'Vista previa en Localhost' : 'Localhost Preview'}
          </span>
        )}
      </div>

      {isLocalDev ? (
        <div
          style={{
            height: '90px',
            border: '2px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            background: 'rgba(0, 0, 0, 0.2)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            📢 {isEs ? 'Espacio Publicitario Google AdSense' : 'Google AdSense Ad Space'}
          </div>
          <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
            {isEs ? 'Banner responsivo (728x90) • Se oculta automáticamente para usuarios Pro / VIP' : 'Responsive Leaderboard (728x90) • Automatically hidden for Pro / VIP users'}
          </div>
        </div>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight: '90px' }}
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
