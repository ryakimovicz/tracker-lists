export const DEFAULT_CATEGORY_ORDER = [
  'movie',
  'series',
  'anime',
  'book',
  'comic',
  'manga',
  'game'
] as const;

export type CategoryType = typeof DEFAULT_CATEGORY_ORDER[number];

/**
 * Returns the normalized category order as an array of strings.
 * Falls back to DEFAULT_CATEGORY_ORDER.
 * Also parses JSON strings or comma-separated strings if needed.
 */
export function getOrderedCategories(customOrder?: string[] | string | null): string[] {
  if (!customOrder) return [...DEFAULT_CATEGORY_ORDER];

  let rawList: string[] = [];
  if (Array.isArray(customOrder)) {
    rawList = customOrder;
  } else if (typeof customOrder === 'string') {
    try {
      const parsed = JSON.parse(customOrder);
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else {
        rawList = customOrder.split(',').map(s => s.trim());
      }
    } catch {
      rawList = customOrder.split(',').map(s => s.trim());
    }
  }

  // Filter only valid categories and preserve unique order
  const validSet = new Set<string>(DEFAULT_CATEGORY_ORDER);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    const clean = item.toLowerCase().trim();
    if (validSet.has(clean) && !seen.has(clean)) {
      result.push(clean);
      seen.add(clean);
    }
  }

  // Append any missing default categories at the end
  for (const cat of DEFAULT_CATEGORY_ORDER) {
    if (!seen.has(cat)) {
      result.push(cat);
      seen.add(cat);
    }
  }

  return result;
}

/**
 * Sorts an array of items based on their category type using the given custom order.
 */
export function sortByCategoryOrder<T>(
  items: T[],
  getType: (item: T) => string,
  customOrder?: string[] | string | null
): T[] {
  const order = getOrderedCategories(customOrder);
  const indexMap = new Map<string, number>();
  order.forEach((cat, idx) => indexMap.set(cat, idx));

  return [...items].sort((a, b) => {
    const typeA = getType(a);
    const typeB = getType(b);
    const idxA = indexMap.has(typeA) ? indexMap.get(typeA)! : 999;
    const idxB = indexMap.has(typeB) ? indexMap.get(typeB)! : 999;
    return idxA - idxB;
  });
}

/**
 * Sorts tab/filter objects. 'all' is always kept first,
 * and 'user' / 'guide' (if present) are kept at the end.
 */
export function sortFilterTabs<T extends { value?: string; key?: string; type?: string }>(
  tabs: T[],
  customOrder?: string[] | string | null
): T[] {
  const order = getOrderedCategories(customOrder);
  const indexMap = new Map<string, number>();
  order.forEach((cat, idx) => indexMap.set(cat, idx));

  const getVal = (item: T): string => item.value || item.key || item.type || '';

  return [...tabs].sort((a, b) => {
    const valA = getVal(a);
    const valB = getVal(b);

    if (valA === 'all') return -1;
    if (valB === 'all') return 1;

    const isSpecialA = valA === 'user' || valA === 'guide';
    const isSpecialB = valB === 'user' || valB === 'guide';

    if (isSpecialA && !isSpecialB) return 1;
    if (!isSpecialA && isSpecialB) return -1;
    if (isSpecialA && isSpecialB) {
      if (valA === 'user' && valB === 'guide') return -1;
      if (valA === 'guide' && valB === 'user') return 1;
      return 0;
    }

    const idxA = indexMap.has(valA) ? indexMap.get(valA)! : 999;
    const idxB = indexMap.has(valB) ? indexMap.get(valB)! : 999;
    return idxA - idxB;
  });
}

/**
 * Returns the human-readable category name based on current language.
 * Default is English (e.g. Movies, Series), translated to Spanish (Películas, Series) when isEs is true.
 */
export function getCategoryLabel(type: string, isEs: boolean, plural: boolean = true): string {
  const clean = type.toLowerCase().trim();
  if (isEs) {
    switch (clean) {
      case 'movie': return plural ? 'Películas' : 'Película';
      case 'series': return plural ? 'Series' : 'Serie';
      case 'anime': return plural ? 'Animes' : 'Anime';
      case 'book': return plural ? 'Libros' : 'Libro';
      case 'comic': return plural ? 'Cómics' : 'Cómic';
      case 'manga': return plural ? 'Mangas' : 'Manga';
      case 'game': return plural ? 'Juegos' : 'Juego';
      case 'guide': return plural ? 'Guías' : 'Guía';
      case 'user': return plural ? 'Usuarios' : 'Usuario';
      default: return type;
    }
  }

  // English (Default)
  switch (clean) {
    case 'movie': return plural ? 'Movies' : 'Movie';
    case 'series': return plural ? 'Series' : 'Series';
    case 'anime': return 'Anime';
    case 'book': return plural ? 'Books' : 'Book';
    case 'comic': return plural ? 'Comics' : 'Comic';
    case 'manga': return 'Manga';
    case 'game': return plural ? 'Games' : 'Game';
    case 'guide': return plural ? 'Guides' : 'Guide';
    case 'user': return plural ? 'Users' : 'User';
    default: return type;
  }
}
