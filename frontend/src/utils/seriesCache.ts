// In-memory L1 cache: guarantees instant synchronous access without quota limits
const memoryCache = new Map<string, { timestamp: number; data: any }>();

const getLangPrefix = () => {
  try {
    return localStorage.getItem('language') || 'es';
  } catch {
    return 'es';
  }
};

const isLanguageSpecificKey = (key: string): boolean => {
  return key.startsWith('desc_') || key.startsWith('series_') || key.endsWith('_metadata');
};

const readRaw = (fullKey: string) => {
  const mem = memoryCache.get(fullKey);
  if (mem) {
    if (Date.now() - mem.timestamp < 24 * 60 * 60 * 1000) {
      return mem.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }

  try {
    const item = localStorage.getItem(`series_cache_v2_${fullKey}`);
    if (item) {
      const parsed = JSON.parse(item);
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

export const getCachedSeries = (key: string) => {
  if (!key) return null;
  const lang = getLangPrefix();

  if (isLanguageSpecificKey(key)) {
    const localized = readRaw(`${lang}_${key}`);
    if (localized !== null) return localized;
    const fallbackLang = lang === 'es' ? 'en' : 'es';
    const fallback = readRaw(`${fallbackLang}_${key}`);
    if (fallback !== null) return fallback;
    return readRaw(key);
  }

  // Language-independent key: check direct key first
  const direct = readRaw(key);
  if (direct !== null) return direct;

  // Fallback / auto-migration: check legacy prefixed keys (es_... or en_...)
  const esVal = readRaw(`es_${key}`);
  if (esVal !== null) {
    setCachedSeries(key, esVal);
    return esVal;
  }
  const enVal = readRaw(`en_${key}`);
  if (enVal !== null) {
    setCachedSeries(key, enVal);
    return enVal;
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
  if (!key) return;
  const lang = getLangPrefix();

  const writeRaw = (fullKey: string) => {
    const entry = {
      timestamp: Date.now(),
      data
    };
    memoryCache.set(fullKey, entry);
    try {
      localStorage.setItem(`series_cache_v2_${fullKey}`, JSON.stringify(entry));
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.number === -2147024882) {
        pruneLocalStorage();
        try {
          localStorage.setItem(`series_cache_v2_${fullKey}`, JSON.stringify(entry));
        } catch (retryErr) {
          // memoryCache already holds it safely
        }
      }
    }
  };

  if (isLanguageSpecificKey(key)) {
    writeRaw(`${lang}_${key}`);
  } else {
    // Store globally so it is available regardless of UI language
    writeRaw(key);
    // Also keep es_ and en_ in sync for backwards compatibility
    writeRaw(`es_${key}`);
    writeRaw(`en_${key}`);
  }
};

export const removeCachedSeries = (key: string) => {
  if (!key) return;
  const keysToRemove = [key, `es_${key}`, `en_${key}`];
  keysToRemove.forEach(fullKey => {
    memoryCache.delete(fullKey);
    try {
      localStorage.removeItem(`series_cache_v2_${fullKey}`);
    } catch (e) {}
  });
};

/**
 * Safely retrieves series metadata checking all possible cache key conventions
 * (series_${id}, ${id}_metadata, clean id variants) and rejects poisoned single-season dummy records.
 */
export const getCachedSeriesMetadata = (seriesId?: string | number | null) => {
  if (!seriesId) return null;
  const sId = String(seriesId);
  const cleanId = sId.replace(/^tvm[-_]|^metron_series_|^metron_|^cv_vol_|^cv_/, '');

  const candidates = [
    `${sId}_metadata`,
    `series_${sId}`,
    `tvm_${cleanId}_metadata`,
    `series_tvm_${cleanId}`,
    `${cleanId}_metadata`,
    `series_${cleanId}`
  ];

  for (const k of candidates) {
    const data = getCachedSeries(k);
    if (data && typeof data === 'object') {
      // Check if this metadata is a poisoned single-season fallback
      if (Array.isArray(data.seasons)) {
        const isDummySingleSeason = data.seasons.length === 1 &&
          data.seasons[0]?.season_number === 1 &&
          (data.number_of_seasons > 1 || (!data.name && !data.title));
        if (isDummySingleSeason) {
          continue; // ignore poisoned candidate
        }
      }
      return data;
    }
  }
  return null;
};

/**
 * Sets series metadata consistently across all key conventions.
 */
export const setCachedSeriesMetadata = (seriesId?: string | number | null, data?: any) => {
  if (!seriesId || !data) return;
  const sId = String(seriesId);
  const cleanId = sId.replace(/^tvm[-_]|^metron_series_|^metron_|^cv_vol_|^cv_/, '');

  setCachedSeries(`${sId}_metadata`, data);
  setCachedSeries(`series_${sId}`, data);
  if (cleanId && cleanId !== sId) {
    setCachedSeries(`${cleanId}_metadata`, data);
    setCachedSeries(`series_${cleanId}`, data);
    if (!sId.startsWith('tvm_') && !sId.startsWith('metron_') && !sId.startsWith('cv_')) {
      setCachedSeries(`tvm_${cleanId}_metadata`, data);
      setCachedSeries(`series_tvm_${cleanId}`, data);
    }
  }
};

/**
 * Clears any poisoned single-season fallback metadata entry for a given series ID.
 */
export const invalidatePoisonedSeriesCache = (seriesId?: string | number | null) => {
  if (!seriesId) return;
  const sId = String(seriesId);
  const cleanId = sId.replace(/^tvm[-_]|^metron_series_|^metron_|^cv_vol_|^cv_/, '');
  const keys = [
    `${sId}_metadata`,
    `series_${sId}`,
    `tvm_${cleanId}_metadata`,
    `series_tvm_${cleanId}`,
    `${cleanId}_metadata`,
    `series_${cleanId}`
  ];
  keys.forEach(k => {
    const d = getCachedSeries(k);
    if (d && Array.isArray(d.seasons) && d.seasons.length === 1 && d.seasons[0]?.season_number === 1 && (d.number_of_seasons > 1 || (!d.name && !d.title))) {
      removeCachedSeries(k);
    }
  });
};

export const clearCachedSeriesMatching = (pattern: RegExp | string) => {
  // Clear from memoryCache
  for (const k of Array.from(memoryCache.keys())) {
    const match = typeof pattern === 'string' ? k.includes(pattern) : pattern.test(k);
    if (match) {
      memoryCache.delete(k);
    }
  }
  // Clear from localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const match = typeof pattern === 'string' ? k.includes(pattern) : pattern.test(k);
        if (match) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
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


