import { apiClient } from '../api/client';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

const prefetchTimers: Record<string, number> = {};

export const prefetchRoute = (route: string) => {
  const now = Date.now();
  const lastFetch = prefetchTimers[route] || 0;
  if (now - lastFetch < CACHE_TTL_MS) {
    return; // Already freshly cached
  }
  prefetchTimers[route] = now;

  switch (route) {
    case '/search':
    case '/explore': {
      // Prefetch explore recommendations
      apiClient.get('/search/explore/tabs')
        .then(res => {
          if (res.data) {
            sessionStorage.setItem('pathd_explore_cache', JSON.stringify(res.data));
          }
        })
        .catch(() => {});
      break;
    }
    case '/social': {
      // Prefetch social feed
      apiClient.get('/social/users/feed/activity')
        .then(res => {
          if (res.data) {
            sessionStorage.setItem('pathd_social_cache', JSON.stringify(res.data));
          }
        })
        .catch(() => {});
      break;
    }
    case '/profile': {
      // Prefetch profile and library
      Promise.allSettled([
        apiClient.get('/users/me'),
        apiClient.get('/library/'),
        apiClient.get('/users/me/activity')
      ]).then(([meRes, libRes, actRes]) => {
        if (meRes.status === 'fulfilled') sessionStorage.setItem('pathd_me_cache', JSON.stringify(meRes.value.data));
        if (libRes.status === 'fulfilled') sessionStorage.setItem('pathd_lib_cache', JSON.stringify(libRes.value.data));
        if (actRes.status === 'fulfilled') sessionStorage.setItem('pathd_act_cache', JSON.stringify(actRes.value.data));
      }).catch(() => {});
      break;
    }
    case '/': {
      // Prefetch home dashboard data
      Promise.allSettled([
        apiClient.get('/library/'),
        apiClient.get('/users/me/up-next'),
        apiClient.get('/users/me/feed/guides-updates')
      ]).then(([libRes, upNextRes, updatesRes]) => {
        if (libRes.status === 'fulfilled') sessionStorage.setItem('pathd_lib_cache', JSON.stringify(libRes.value.data));
        if (upNextRes.status === 'fulfilled') sessionStorage.setItem('pathd_upnext_cache', JSON.stringify(upNextRes.value.data));
        if (updatesRes.status === 'fulfilled') sessionStorage.setItem('pathd_updates_cache', JSON.stringify(updatesRes.value.data));
      }).catch(() => {});
      break;
    }
    default:
      break;
  }
};

/**
 * Runs idle warm-up 1.5s after app initialization
 */
export const initGlobalPrefetch = () => {
  if (typeof window === 'undefined') return;

  const runWarmup = () => {
    setTimeout(() => {
      prefetchRoute('/search');
      setTimeout(() => prefetchRoute('/social'), 600);
      setTimeout(() => prefetchRoute('/profile'), 1200);
    }, 1500);
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runWarmup);
  } else {
    setTimeout(runWarmup, 1500);
  }
};
