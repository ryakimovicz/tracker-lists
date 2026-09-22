/**
 * shelfCache.ts
 * High-performance, synchronous client-side cache and O(1) map builder for user's added works.
 * Supports instant (0ms) render matching on Explore, modals, and search results across 7 media categories.
 */

const SHELF_CACHE_KEY = 'pathd_shelf_cache';
const LIB_CACHE_KEY = 'pathd_lib_cache';

export interface ShelfItemStub {
  id: number;
  external_id: string;
  item_type: string;
  status?: string;
  is_favorite?: boolean;
  tracking_list_id?: number | null;
  completed_at?: string | null;
  last_seen_episode?: string | null;
  title?: string;
  image_url?: string;
  imdb_id?: string;
  custom_badge?: string | null;
  release_date?: string | null;
  [key: string]: any;
}

/**
 * Normalizes item_type and external_id into a fast lookup key.
 */
export const makeShelfKey = (itemType: string, externalId: string | number): string => {
  const normType = String(itemType || '').toLowerCase().trim();
  const normId = String(externalId || '').trim();
  return `${normType}:${normId}`;
};

/**
 * Returns secondary clean keys if external_id contains standard provider prefixes (e.g. cv_vol_123 -> 123)
 */
export const getAlternativeKeys = (itemType: string, externalId: string | number): string[] => {
  const normType = String(itemType || '').toLowerCase().trim();
  const rawId = String(externalId || '').trim();
  const keys: string[] = [];

  const cleanId = rawId
    .replace(/^cv_vol_/, '')
    .replace(/^cv_issue_/, '')
    .replace(/^cv_/, '')
    .replace(/^tvm-ep-/, '')
    .replace(/^tvm_/, '');

  if (cleanId !== rawId) {
    keys.push(`${normType}:${cleanId}`);
  }

  // Handle anime / series interchangeability if applicable
  if (normType === 'anime') {
    keys.push(`series:${rawId}`);
    if (cleanId !== rawId) keys.push(`series:${cleanId}`);
  }

  return keys;
};

/**
 * Synchronous read from localStorage/sessionStorage for Frame-0 instant rendering.
 */
export const getCachedShelfItems = (): ShelfItemStub[] => {
  try {
    const rawShelf = localStorage.getItem(SHELF_CACHE_KEY) || sessionStorage.getItem(SHELF_CACHE_KEY);
    if (rawShelf) {
      const parsed = JSON.parse(rawShelf);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // Fallback to legacy pathd_lib_cache if shelf cache is empty
    const rawLib = localStorage.getItem(LIB_CACHE_KEY) || sessionStorage.getItem(LIB_CACHE_KEY);
    if (rawLib) {
      const parsed = JSON.parse(rawLib);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached shelf items', e);
  }
  return [];
};

/**
 * Stores shelf items into both localStorage and sessionStorage.
 */
export const setCachedShelfItems = (items: ShelfItemStub[]): void => {
  try {
    const serialized = JSON.stringify(items);
    localStorage.setItem(SHELF_CACHE_KEY, serialized);
    sessionStorage.setItem(SHELF_CACHE_KEY, serialized);
  } catch (e) {
    console.warn('Failed to save shelf items to cache', e);
  }
};

/**
 * Creates an O(1) hash map from an array of shelf items.
 * Lookups take ~0.0001ms even with 10,000 items.
 */
export const createShelfMap = (items: ShelfItemStub[]): Map<string, ShelfItemStub> => {
  const map = new Map<string, ShelfItemStub>();
  if (!Array.isArray(items)) return map;

  for (const item of items) {
    if (!item || !item.external_id || !item.item_type) continue;
    const primaryKey = makeShelfKey(item.item_type, item.external_id);
    map.set(primaryKey, item);

    // Also populate alternative keys for resilient lookup
    const altKeys = getAlternativeKeys(item.item_type, item.external_id);
    for (const alt of altKeys) {
      if (!map.has(alt)) {
        map.set(alt, item);
      }
    }
  }

  return map;
};

/**
 * O(1) lookup to find a shelf item by itemType and externalId
 */
export const findInShelfMap = (map: Map<string, ShelfItemStub>, itemType: string, externalId: string | number): ShelfItemStub | undefined => {
  if (!map || !itemType || !externalId) return undefined;
  const primary = makeShelfKey(itemType, externalId);
  const found = map.get(primary);
  if (found) return found;

  const alts = getAlternativeKeys(itemType, externalId);
  for (const alt of alts) {
    const altFound = map.get(alt);
    if (altFound) return altFound;
  }

  return undefined;
};

/**
 * Optimistically updates or inserts an item into both pathd_shelf_cache and pathd_lib_cache.
 */
export const updateCachedShelfItem = (item: ShelfItemStub): void => {
  if (!item) return;
  try {
    const currentItems = getCachedShelfItems();
    const idx = currentItems.findIndex(it => 
      (item.id && it.id === item.id) || 
      (it.external_id === item.external_id && it.item_type === item.item_type)
    );

    let updated: ShelfItemStub[];
    if (idx >= 0) {
      updated = [...currentItems];
      updated[idx] = { ...updated[idx], ...item };
    } else {
      updated = [item, ...currentItems];
    }

    setCachedShelfItems(updated);

    // Also sync pathd_lib_cache for legacy components
    const serialized = JSON.stringify(updated);
    try {
      localStorage.setItem(LIB_CACHE_KEY, serialized);
      sessionStorage.setItem(LIB_CACHE_KEY, serialized);
    } catch (_) {}
  } catch (e) {
    console.warn('Failed to update cached shelf item', e);
  }
};

/**
 * Optimistically removes an item from both pathd_shelf_cache and pathd_lib_cache.
 */
export const removeCachedShelfItem = (id?: number | string, externalId?: string | number, itemType?: string): void => {
  try {
    const currentItems = getCachedShelfItems();
    const filtered = currentItems.filter(it => {
      if (id && it.id === Number(id)) return false;
      if (externalId && itemType && it.external_id === String(externalId) && it.item_type === String(itemType)) return false;
      return true;
    });

    setCachedShelfItems(filtered);

    // Also sync pathd_lib_cache
    const serialized = JSON.stringify(filtered);
    try {
      localStorage.setItem(LIB_CACHE_KEY, serialized);
      sessionStorage.setItem(LIB_CACHE_KEY, serialized);
    } catch (_) {}
  } catch (e) {
    console.warn('Failed to remove cached shelf item', e);
  }
};

