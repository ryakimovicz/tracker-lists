export interface KlipyFavoriteItem {
  id: string | number;
  url: string;
  type: 'gif' | 'sticker' | 'meme' | 'clip' | 'emoji';
  slug?: string;
  title?: string;
  preview_url?: string;
  addedAt?: number;
}

const STORAGE_KEY = 'klipy_favorites';

export const getKlipyFavorites = (): KlipyFavoriteItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const isKlipyFavorite = (urlOrId: string | number): boolean => {
  if (!urlOrId) return false;
  const favs = getKlipyFavorites();
  const searchStr = String(urlOrId);
  return favs.some((f) => String(f.id) === searchStr || f.url === searchStr);
};

export const toggleKlipyFavorite = (item: {
  id?: string | number;
  url: string;
  type: 'gif' | 'sticker' | 'meme' | 'clip' | 'emoji';
  slug?: string;
  title?: string;
  preview_url?: string;
}): boolean => {
  if (!item || !item.url) return false;
  const favs = getKlipyFavorites();
  const idStr = item.id ? String(item.id) : item.url;
  
  const existingIndex = favs.findIndex(
    (f) => String(f.id) === idStr || f.url === item.url
  );

  let isNowFav = false;
  if (existingIndex >= 0) {
    favs.splice(existingIndex, 1);
    isNowFav = false;
  } else {
    favs.unshift({
      id: item.id || item.url,
      url: item.url,
      type: item.type || (item.url.endsWith('.mp4') ? 'clip' : 'gif'),
      slug: item.slug || '',
      title: item.title || '',
      preview_url: item.preview_url || item.url,
      addedAt: Date.now()
    });
    isNowFav = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch (e) {}

  // Dispatch custom event to sync all open components
  window.dispatchEvent(
    new CustomEvent('klipy_favorites_changed', {
      detail: { url: item.url, isFavorite: isNowFav }
    })
  );

  return isNowFav;
};
