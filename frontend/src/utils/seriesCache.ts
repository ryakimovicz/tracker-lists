export const getCachedSeries = (key: string) => {
  try {
    const item = localStorage.getItem(`series_cache_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      // Cache expires after 24h
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.error("Cache read error", e);
  }
  return null;
};

export const setCachedSeries = (key: string, data: any) => {
  try {
    localStorage.setItem(`series_cache_${key}`, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.error("Cache write error", e);
  }
};
