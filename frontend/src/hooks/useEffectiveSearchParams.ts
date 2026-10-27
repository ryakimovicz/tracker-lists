import { useLocation, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Custom hook to safely read search params for main tab pages kept alive in MainTabsKeeper.
 * When a modal overlay route (such as /item/:type/:id or /post/:id) is active,
 * React Router's location.search becomes empty, which would erroneously reset subtabs.
 * This hook automatically falls back to location.state.backgroundLocation.search
 * when the modal was opened over the specified target path.
 */
export function useEffectiveSearchParams(targetPath: string = '/') {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const bgLocation = (location.state as any)?.backgroundLocation;
  const isDirect = targetPath === '/' 
    ? location.pathname === '/' 
    : location.pathname.startsWith(targetPath);

  const isBackground = Boolean(bgLocation && (
    targetPath === '/' 
      ? (bgLocation.pathname === '/' || bgLocation.pathname === '') 
      : bgLocation.pathname.startsWith(targetPath)
  ));

  const effectiveSearchParams = useMemo(() => {
    if (isBackground && bgLocation) {
      return new URLSearchParams(bgLocation.search || '');
    }
    if (isDirect) {
      return searchParams;
    }
    return null;
  }, [isDirect, isBackground, bgLocation, searchParams]);

  return { 
    effectiveSearchParams, 
    searchParams, 
    setSearchParams, 
    isDirect, 
    isBackground,
    location,
    bgLocation 
  };
}

