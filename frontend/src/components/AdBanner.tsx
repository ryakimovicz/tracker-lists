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

  // 1. Pro / VIP users enjoy an entirely ad-free experience (Key monetization incentive!)
  if (user?.is_pro || user?.is_vip || user?.is_admin) {
    return null;
  }

  useEffect(() => {
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
  }, []);

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
          fontWeight: 600
        }}
      >
        {isEs ? 'Publicidad' : 'Advertisement'}
      </div>

      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: '90px' }}
        data-ad-client="ca-pub-7081495763188158"
        data-ad-slot={slotId || '7081495763188158'}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdBanner;
