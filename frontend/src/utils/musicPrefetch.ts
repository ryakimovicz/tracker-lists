import { apiClient } from '../api/client';

// Global in-memory cache for music item details and rankings
// Key: `${type}_${artist.toLowerCase()}_${(name || '').toLowerCase()}`
const musicDetailsCache: Record<string, any> = {};
const ongoingPrefetches: Set<string> = new Set<string>();

export const getCachedMusicDetails = (type: string, artist: string, name?: string) => {
  const key = `${type}_${artist.trim().toLowerCase()}_${(name || '').trim().toLowerCase()}`;
  return musicDetailsCache[key] || null;
};

export const setCachedMusicDetails = (type: string, artist: string, name: string | undefined, data: any) => {
  const key = `${type}_${artist.trim().toLowerCase()}_${(name || '').trim().toLowerCase()}`;
  musicDetailsCache[key] = data;
};

/**
 * Prefetches details for a music item (artist, album, track) with deduplication and concurrency control.
 */
export const prefetchMusicDetails = async (type: 'artist' | 'album' | 'track', artist: string, name?: string): Promise<any> => {
  if (!artist) return null;
  const key = `${type}_${artist.trim().toLowerCase()}_${(name || '').trim().toLowerCase()}`;

  if (musicDetailsCache[key]) {
    return musicDetailsCache[key];
  }

  if (ongoingPrefetches.has(key)) {
    return null;
  }

  ongoingPrefetches.add(key);

  try {
    const res = await apiClient.get('/users/music/details', {
      params: {
        type,
        artist,
        name: name || '',
        period: '7day'
      }
    });

    if (res.data) {
      musicDetailsCache[key] = res.data;

      // Deep secondary prefetch with stagger to prevent network spikes:
      // If we fetched an album, prefetch its artist in background
      if (type === 'album' && res.data.details?.artist) {
        setTimeout(() => {
          prefetchMusicDetails('artist', res.data.details.artist);
        }, 300);
      }

      // If we fetched a track, prefetch its album and artist
      if (type === 'track') {
        if (res.data.details?.artist) {
          setTimeout(() => {
            prefetchMusicDetails('artist', res.data.details.artist);
          }, 300);
        }
        if (res.data.details?.album && res.data.details?.artist) {
          setTimeout(() => {
            prefetchMusicDetails('album', res.data.details.artist, res.data.details.album);
          }, 600);
        }
      }

      return res.data;
    }
  } catch (err) {
    // Fail silently in background prefetch
  } finally {
    ongoingPrefetches.delete(key);
  }
  return null;
};

/**
 * Batch prefetches an array of items with a safe delay between requests to never saturate browser or backend.
 */
export const batchPrefetchMusicItems = (
  items: Array<{ type: 'artist' | 'album' | 'track'; artist: string; name?: string }>,
  maxItems = 10,
  staggerMs = 250
) => {
  const itemsToFetch = items.slice(0, maxItems);
  itemsToFetch.forEach((item, index) => {
    setTimeout(() => {
      prefetchMusicDetails(item.type, item.artist, item.name);
    }, index * staggerMs);
  });
};
