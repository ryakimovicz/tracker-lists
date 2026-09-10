// In-memory L1 cache: guarantees instant synchronous access without quota limits
const memoryCache = new Map<string, { timestamp: number; data: any }>();

export const getCachedSeries = (key: string) => {
  // 1. Check in-memory cache first
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp < 24 * 60 * 60 * 1000) {
      return mem.data;
    } else {
      memoryCache.delete(key);
    }
  }

  // 2. Fallback to localStorage
  try {
    const item = localStorage.getItem(`series_cache_v2_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      // Cache expires after 24h
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        memoryCache.set(key, parsed);
        return parsed.data;
      } else {
        localStorage.removeItem(`series_cache_v2_${key}`);
      }
    }
  } catch (e) {
    // ignore read errors
  }
  return null;
};

// Helper to free up space in localStorage when quota is reached
const pruneLocalStorage = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('series_cache_v2_desc_') || k.startsWith('series_cache_v2_') || k.startsWith('series_cache_'))) {
        keysToRemove.push(k);
      }
    }
    // Remove description caches first, then older cache keys
    const descKeys = keysToRemove.filter(k => k.includes('_desc_'));
    if (descKeys.length > 0) {
      descKeys.forEach(k => localStorage.removeItem(k));
    } else {
      // Remove half of the series cache keys
      keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {
    // ignore
  }
};

export const setCachedSeries = (key: string, data: any) => {
  const entry = {
    timestamp: Date.now(),
    data
  };

  // Always store in memory cache
  memoryCache.set(key, entry);

  // Attempt to persist to localStorage safely
  try {
    localStorage.setItem(`series_cache_v2_${key}`, JSON.stringify(entry));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.number === -2147024882) {
      // Quota exceeded: prune localStorage and try once more
      pruneLocalStorage();
      try {
        localStorage.setItem(`series_cache_v2_${key}`, JSON.stringify(entry));
      } catch (retryErr) {
        // If still failing, memoryCache already holds it safely
      }
    }
  }
};

