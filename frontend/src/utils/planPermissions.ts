export type PlanTier = 'free' | 'streaming' | 'reading' | 'premium';

const STREAMING_CATEGORIES = new Set(['movie', 'series', 'anime']);
const READING_CATEGORIES = new Set(['book', 'comic', 'manga']);

export function getUserPlanTier(user: any): PlanTier {
  if (!user) return 'free';
  const tier = String(user.plan_tier || '').toLowerCase();
  if (user.has_active_subscription && (tier === 'streaming' || tier === 'reading' || tier === 'premium')) {
    return tier;
  }
  if (user.is_admin || user.is_vip) return 'premium';
  if (!user.is_pro) return 'free';
  if (tier === 'streaming' || tier === 'reading' || tier === 'premium') {
    return tier;
  }
  // Backwards compatibility: existing Pro users before plan_tier migration default to 'premium'
  return 'premium';
}

export function isCategoryInPlan(user: any, itemType?: string | null): boolean {
  const tier = getUserPlanTier(user);
  if (tier === 'premium') return true;
  if (!itemType) return false;
  const norm = itemType.toLowerCase();
  if (tier === 'streaming') return STREAMING_CATEGORIES.has(norm);
  if (tier === 'reading') return READING_CATEGORIES.has(norm);
  return false;
}

export function getMaxFavoritesForCategory(user: any, itemType?: string | null): number {
  return isCategoryInPlan(user, itemType) ? 10 : 1;
}

export function canUseAntiSpoiler(user: any): boolean {
  const tier = getUserPlanTier(user);
  return tier === 'premium' || tier === 'streaming';
}

export function canUseReconsumptionHistory(user: any, itemType?: string | null): boolean {
  return isCategoryInPlan(user, itemType);
}

export function canCustomizeColor(user: any): boolean {
  return getUserPlanTier(user) === 'premium';
}

export function canCreatePrivateGuides(user: any): boolean {
  return getUserPlanTier(user) === 'premium';
}

export function hasPremiumBadge(user: any): boolean {
  return getUserPlanTier(user) === 'premium';
}
