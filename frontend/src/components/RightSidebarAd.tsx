import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AdBanner } from './AdBanner';

export const RightSidebarAd: React.FC = () => {
  const { user } = useAuth();
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Hide completely for Pro/VIP/Admin users in production
  if (!isLocalDev && (user?.is_pro || user?.is_vip || user?.is_admin)) {
    return null;
  }

  return (
    <aside
      className="right-ad-sidebar"
      style={{
        width: '180px',
        flexShrink: 0,
        position: 'sticky',
        top: '5.5rem',
        height: 'fit-content',
        padding: '3rem 0.5rem 1.5rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        boxSizing: 'border-box'
      }}
    >
      <AdBanner variant="skyscraper" style={{ margin: 0 }} />
    </aside>
  );
};

export default RightSidebarAd;
