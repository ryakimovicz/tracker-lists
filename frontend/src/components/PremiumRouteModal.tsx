import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProModal } from './ProModal';

export const PremiumRouteModal: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isPremiumPath = location.pathname === '/premium' || location.pathname === '/pro';
  const hasPremiumQuery = searchParams.get('premium') === 'true' || searchParams.get('pro') === 'true';

  const shouldOpen = isPremiumPath || hasPremiumQuery;

  const handleClose = () => {
    if (isPremiumPath) {
      const bg = (location.state as any)?.backgroundLocation;
      if (bg) {
        const targetUrl = typeof bg === 'string' ? bg : `${bg.pathname || '/'}${bg.search || ''}${bg.hash || ''}`;
        navigate(targetUrl, { replace: true });
      } else if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    } else if (hasPremiumQuery) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('premium');
      newParams.delete('pro');
      const newSearch = newParams.toString();
      navigate(
        {
          pathname: location.pathname,
          search: newSearch ? `?${newSearch}` : '',
          hash: location.hash
        },
        { replace: true, state: location.state }
      );
    }
  };

  if (!shouldOpen) return null;

  return <ProModal onClose={handleClose} />;
};

export default PremiumRouteModal;
