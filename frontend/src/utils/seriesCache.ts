// In-memory L1 cache: guarantees instant synchronous access without quota limits
const memoryCache = new Map<string, { timestamp: number; data: any }>();

const getLangPrefix = () => {
  try {
    return localStorage.getItem('language') || 'es';
  } catch {
    return 'es';
  }
};

export const getCachedSeries = (key: string) => {
  const lang = getLangPrefix();
  const fullKey = `${lang}_${key}`;

  // 1. Check in-memory cache first
  const mem = memoryCache.get(fullKey);
  if (mem) {
    if (Date.now() - mem.timestamp < 24 * 60 * 60 * 1000) {
      return mem.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }

  // 2. Fallback to localStorage
  try {
    const item = localStorage.getItem(`series_cache_v2_${fullKey}`);
    if (item) {
      const parsed = JSON.parse(item);
      // Cache expires after 24h
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        memoryCache.set(fullKey, parsed);
        return parsed.data;
      } else {
        localStorage.removeItem(`series_cache_v2_${fullKey}`);
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
  const lang = getLangPrefix();
  const fullKey = `${lang}_${key}`;

  const entry = {
    timestamp: Date.now(),
    data
  };

  // Always store in memory cache
  memoryCache.set(fullKey, entry);

  // Attempt to persist to localStorage safely
  try {
    localStorage.setItem(`series_cache_v2_${fullKey}`, JSON.stringify(entry));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.number === -2147024882) {
      // Quota exceeded: prune localStorage and try once more
      pruneLocalStorage();
      try {
        localStorage.setItem(`series_cache_v2_${fullKey}`, JSON.stringify(entry));
      } catch (retryErr) {
        // If still failing, memoryCache already holds it safely
      }
    }
  }
};

/**
 * Returns the localized title of a media item if available in the cache (e.g. 'El Mentalista' for Spanish, 'The Mentalist' for English),
 * fallback to the item's stored title.
 */
export const getLocalizedDisplayTitle = (item: any): string => {
  if (!item) return '';
  const extId = item.external_id || item.id;
  if (!extId) return item.title || item.name || '';

  // Check if series/anime metadata or desc cache holds a localized title
  const cachedSeriesMeta = getCachedSeries(`series_${extId}`);
  if (cachedSeriesMeta && cachedSeriesMeta.name) {
    return cachedSeriesMeta.name;
  }
  const cachedMeta = getCachedSeries(`${extId}_metadata`);
  if (cachedMeta && cachedMeta.name) {
    return cachedMeta.name;
  }
  const descKey = `desc_${item.item_type}_${extId}`;
  const cachedDesc = getCachedSeries(descKey);
  if (cachedDesc && cachedDesc.title) {
    return cachedDesc.title;
  }

  return item.title || item.name || '';
};

