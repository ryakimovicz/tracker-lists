export type CommentSortMode = 'relevance' | 'newest';

export interface SortableCommentLike {
  id?: number;
  created_at?: string | null;
  is_deleted?: boolean;
  vote_count?: number;
  votes_count?: number;
  likes_count?: number;
  rating?: number | null;
}

const parseTimestamp = (dateStr?: string | null): number => {
  if (!dateStr) return 0;
  const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
};

/**
 * Replies to a parent comment are always sorted chronologically: oldest on top, newest at bottom.
 */
export function sortRepliesOldestFirst<T extends SortableCommentLike>(replies: T[]): T[] {
  return [...replies].sort((a, b) => {
    const diff = parseTimestamp(a.created_at) - parseTimestamp(b.created_at);
    if (diff !== 0) return diff;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/**
 * Relevance score for root (parent) comments: combines votes/likes, number of replies,
 * and gentle time decay so strong discussions stay prominent while fresh comments tie-break higher.
 */
export function computeRootCommentRelevance<T extends SortableCommentLike>(
  root: T,
  repliesCount: number,
  nowMs: number = Date.now()
): number {
  const votes = Math.max(0, Number(root.votes_count ?? root.vote_count ?? root.likes_count ?? 0));
  const createdMs = parseTimestamp(root.created_at);
  const ageHours = createdMs > 0 ? Math.max(0, (nowMs - createdMs) / 3600000) : 720;

  if (root.is_deleted) {
    if (repliesCount === 0) return -1e9;
    return (repliesCount * 0.5) / Math.pow(ageHours + 6, 0.35);
  }

  const engagement = 1 + votes * 3 + repliesCount * 2;
  return engagement / Math.pow(ageHours + 6, 0.35);
}

/**
 * Sorts root (parent) comments either by relevance or by date (newest first).
 */
export function sortRootComments<T extends SortableCommentLike>(
  roots: T[],
  mode: CommentSortMode,
  getRepliesCount: (root: T) => number
): T[] {
  const nowMs = Date.now();
  return [...roots].sort((a, b) => {
    if (mode === 'newest') {
      const diff = parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
      if (diff !== 0) return diff;
      return (b.id ?? 0) - (a.id ?? 0);
    }

    const scoreDiff =
      computeRootCommentRelevance(b, getRepliesCount(b), nowMs) -
      computeRootCommentRelevance(a, getRepliesCount(a), nowMs);
    if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;

    const timeDiff = parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
    if (timeDiff !== 0) return timeDiff;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
