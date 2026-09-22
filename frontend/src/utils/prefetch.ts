import { apiClient } from '../api/client';
import { getCachedSeries, setCachedSeries } from './seriesCache';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

const prefetchTimers: Record<string, number> = {};
const prefetchedItems = new Set<string>();

/**
 * Prefetches details and episodes/issues in the background for a media item (series, anime, comic, movie).
 * When the user opens the modal, the data is already in cache and opens instantly with 0ms delay.
 */
export const prefetchMediaDetails = (item: any) => {
  if (!item || !item.external_id) return;
  const extId = String(item.external_id);
  const type = (item.item_type || '').toLowerCase();

  if (prefetchedItems.has(extId)) return;
  prefetchedItems.add(extId);

  if (type === 'series' || type === 'anime' || extId.startsWith('tvm_') || extId.startsWith('anime_')) {
    const cacheKeyMeta = `${extId}_metadata`;
    const cacheKeyAll = `${extId}_all_episodes`;

    if (!getCachedSeries(cacheKeyMeta)) {
      apiClient.get(`/search/series/${extId}`).then(res => {
        if (res.data) {
          const seriesData = res.data || {};
          let rawSeasons = seriesData.seasons || [];
          if (rawSeasons.length === 0) {
            rawSeasons = [{ id: 1, season_number: 1, episode_count: item.latest_episode || 12 }];
          }
          const sortedSeasons = [...rawSeasons].sort((a: any, b: any) => {
            if (a.season_number === 0) return 1;
            if (b.season_number === 0) return -1;
            return a.season_number - b.season_number;
          });
          setCachedSeries(cacheKeyMeta, { ...seriesData, seasons: sortedSeasons });
        }
      }).catch(() => {});
    }

    if (!getCachedSeries(cacheKeyAll)) {
      apiClient.get(`/search/series/${extId}/episodes`).then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setCachedSeries(cacheKeyAll, res.data);
        }
      }).catch(() => {});
    }
  } else if (type === 'comic' || extId.startsWith('cv_vol_') || extId.startsWith('cv_issue_')) {
    if (extId.startsWith('cv_issue_') || extId.startsWith('4000-')) {
      const cacheKeyIssue = `issue_${extId}`;
      if (!getCachedSeries(cacheKeyIssue)) {
        apiClient.get(`/search/comic/issue/${extId}`).then(res => {
          if (res.data) setCachedSeries(cacheKeyIssue, res.data);
        }).catch(() => {});
      }
    } else {
      const cacheKeyMeta = `${extId}_metadata`;
      const cacheKeyAll = `${extId}_all_episodes`;

      if (!getCachedSeries(cacheKeyMeta)) {
        apiClient.get(`/search/comic/volume/${extId}`).then(res => {
          if (res.data) {
            const volData = res.data || {};
            const rawSeasons = volData?.seasons || [{ id: 1, season_number: 1, episode_count: volData.count_of_issues || 1 }];
            setCachedSeries(cacheKeyMeta, { ...volData, seasons: rawSeasons });
          }
        }).catch(() => {});
      }

      if (!getCachedSeries(cacheKeyAll)) {
        apiClient.get(`/search/comic/volume/${extId}/issues`).then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setCachedSeries(cacheKeyAll, res.data);
          }
        }).catch(() => {});
      }
    }
  } else if (type === 'game') {
    const cacheKeyRel = `game_rel_${extId}`;
    if (!getCachedSeries(cacheKeyRel)) {
      apiClient.get(`/search/game/${extId}/relations`).then(res => {
        if (res.data) setCachedSeries(cacheKeyRel, res.data);
      }).catch(() => {});
    }
  } else if (type === 'manga') {
    const cacheKeyRel = `manga_rel_${extId}`;
    if (!getCachedSeries(cacheKeyRel)) {
      apiClient.get(`/search/manga/${extId}/relations`).then(res => {
        if (res.data) setCachedSeries(cacheKeyRel, res.data);
      }).catch(() => {});
    }
  } else if (type === 'movie') {
    if (extId.startsWith('omdb_') && (!item.description || !item.image_url)) {
      const cacheKeyMovie = `movie_${extId}`;
      if (!getCachedSeries(cacheKeyMovie)) {
        apiClient.get(`/search/movies/${extId}`).then(res => {
          if (res.data) setCachedSeries(cacheKeyMovie, res.data);
        }).catch(() => {
          // Store empty fallback so it does not retry failed external prefetch
          setCachedSeries(cacheKeyMovie, item || {});
        });
      }
    }
  }

  // Also prefetch reviews for the item in background
  if (type && extId) {
    const cacheKeyRev = `reviews_${type}_${extId}`;
    if (!getCachedSeries(cacheKeyRev)) {
      apiClient.get(`/reviews/${type}/${extId}`).then(res => {
        if (res.data) setCachedSeries(cacheKeyRev, res.data);
      }).catch(() => {});
    }
  }
};

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
      // Prefetch explore recommendations and lightweight shelf items
      Promise.allSettled([
        apiClient.get('/search/explore/tabs'),
        apiClient.get('/library/shelf')
      ]).then(([expRes, shelfRes]) => {
        if (expRes.status === 'fulfilled' && expRes.value.data) {
          sessionStorage.setItem('pathd_explore_cache', JSON.stringify(expRes.value.data));
        }
        if (shelfRes.status === 'fulfilled' && Array.isArray(shelfRes.value.data)) {
          const serialized = JSON.stringify(shelfRes.value.data);
          try {
            localStorage.setItem('pathd_shelf_cache', serialized);
            sessionStorage.setItem('pathd_shelf_cache', serialized);
          } catch (_) {}
        }
      }).catch(() => {});
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
