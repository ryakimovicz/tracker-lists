import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';
import { getUserPlanTier } from '../utils/planPermissions';
import { getProfileTheme } from '../utils/profileThemes';
import { getGuideImportanceStyle } from '../utils/guideImportance';
import { shouldShowTranslateButton } from '../utils/languageDetect';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Check,
  CheckCheck,
  Share2,
  ArrowDownCircle,
  SkipForward,
  BookOpen,
  EyeOff,
  Languages,
  Heart,
  Star,
  MessageSquare,
  Send,
  Trash2,
  ThumbsUp,
  Reply,
  Pencil,
  Lock,
  Flag
} from 'lucide-react';
import { ItemDetailsModal, RootReviewEditor } from '../components/ItemDetailsModal';
import { ReplaceSavedGuideModal } from '../components/ReplaceSavedGuideModal';
import { ProModal } from '../components/ProModal';
import { AdBanner } from '../components/AdBanner';
import { renderFormattedContentWithMentions, AuthorUsername } from '../components/MentionTag';
import { CommentSortBar } from '../components/CommentSortBar';
import { sortRepliesOldestFirst, sortRootComments, type CommentSortMode } from '../utils/commentSort';


interface CommentItem {
  id: number;
  user_id: number;
  list_id: number;
  parent_id?: number | null;
  content: string | null;
  is_deleted?: boolean;
  created_at: string;
  creator_username: string;
  photo_url?: string;
  vote_count: number;
  is_voted_by_me: boolean;
}

interface CommentTreeNode extends CommentItem {
  replies: CommentTreeNode[];
}

export const ViewGuide: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { hash } = location;
  const { language } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [guide, setGuide] = useState<any | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isTogglingSave, setIsTogglingSave] = useState(false);
  const [isMarkingConsumed, setIsMarkingConsumed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [minImportanceFilter, setMinImportanceFilter] = useState<number | null>(null);

  // Ratings & Reviews state
  const [guideReviews, setGuideReviews] = useState<any[]>([]);
  const [communityTab, setCommunityTab] = useState<'guide' | 'reviews' | 'comments'>('guide');
  const communityTabRefs = useRef<Record<'guide' | 'reviews' | 'comments', HTMLButtonElement | null>>({
    guide: null,
    reviews: null,
    comments: null,
  });
  const communityTabIndicatorRef = useRef<HTMLDivElement | null>(null);
  const communityTabIndicatorReadyRef = useRef(false);

  const moveCommunityTabIndicator = useCallback((tab: 'guide' | 'reviews' | 'comments', immediate = false) => {
    const btn = communityTabRefs.current[tab];
    const ind = communityTabIndicatorRef.current;
    if (!btn || !ind) return;
    if (immediate) {
      ind.style.transition = 'none';
    } else {
      ind.style.transition = 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), width 0.16s cubic-bezier(0.2, 0, 0, 1), opacity 0.12s ease';
    }
    ind.style.transform = `translate3d(${btn.offsetLeft}px, 0, 0)`;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.opacity = '1';
    if (immediate) {
      void ind.offsetWidth;
      ind.style.transition = 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), width 0.16s cubic-bezier(0.2, 0, 0, 1), opacity 0.12s ease';
    }
  }, []);
  const [hasAcceptedCommentsSpoiler, setHasAcceptedCommentsSpoiler] = useState(false);
  const [revealedReviewSpoilers, setRevealedReviewSpoilers] = useState<Record<number, boolean>>({});
  const [translatedGuideMap, setTranslatedGuideMap] = useState<Record<string, string>>({});
  const [isGuideTranslated, setIsGuideTranslated] = useState(false);
  const [isTranslatingGuide, setIsTranslatingGuide] = useState(false);
  const [translatedReviews, setTranslatedReviews] = useState<Record<number, { text: string; show: boolean; loading?: boolean }>>({});
  const [translatedComments, setTranslatedComments] = useState<Record<number, { text: string; show: boolean; loading?: boolean }>>({});
  const [userRating, setUserRating] = useState<number | null>(null);
  const [userReviewText, setUserReviewText] = useState<string>('');
  const [userReviewIsSpoiler, setUserReviewIsSpoiler] = useState<boolean>(false);
  const [myGuideReviewId, setMyGuideReviewId] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [isSavingRating, setIsSavingRating] = useState(false);

  // Comments state
  const [comments, setComments] = useState<CommentItem[]>([]);

  useEffect(() => {
    if (loading || !guide) return;
    const immediate = !communityTabIndicatorReadyRef.current;
    const rafId = window.requestAnimationFrame(() => {
      moveCommunityTabIndicator(communityTab, immediate);
      communityTabIndicatorReadyRef.current = true;
    });
    const onResize = () => moveCommunityTabIndicator(communityTab, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [communityTab, loading, guide, language, guideReviews.length, comments.length, moveCommunityTabIndicator]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{
    rootCommentId: number;
    replyToUser: string;
    targetCommentId: number;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [collapsedReplies, setCollapsedReplies] = useState<Record<number, boolean>>({});
  const [commentSortMode, setCommentSortMode] = useState<CommentSortMode>('relevance');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Standalone details modal states
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [replaceGuideModal, setReplaceGuideModal] = useState<{
    isOpen: boolean;
    guideToReplaceTitle: string;
  }>({
    isOpen: false,
    guideToReplaceTitle: ''
  });

  const renderImportanceTag = (rank: number | null | undefined, fontSize = '0.72rem') => {
    const st = getGuideImportanceStyle(rank, language, isLight);
    if (!st) return null;
    return (
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: st.color,
          background: st.bg,
          border: `1px solid ${st.border}`,
          boxShadow: st.glow || 'none',
          padding: '0.08rem 0.45rem',
          borderRadius: '999px',
          lineHeight: 1.35,
          whiteSpace: 'nowrap'
        }}
      >
        {st.label}
      </span>
    );
  };

  const getPriorityLabel = (rank: number | null, lang: string) => {
    if (!rank) return '';
    switch (rank) {
      case 1: return lang === 'es' ? 'Extra' : 'Extra';
      case 2: return lang === 'es' ? 'Opcional' : 'Optional';
      case 3: return lang === 'es' ? 'Recomendado' : 'Recommended';
      case 4: return lang === 'es' ? 'Importante' : 'Important';
      case 5: return lang === 'es' ? 'Esencial' : 'Essential';
      default: return '';
    }
  };

  const handleToggleSaveGuide = async (replaceLast = false) => {
    if (!guide || isTogglingSave) return;
    setIsTogglingSave(true);
    setErrorMsg('');
    try {
      if (isSaved) {
        await apiClient.delete(`/lists/${guide.id}/save`);
        setIsSaved(false);
      } else {
        const url = replaceLast ? `/lists/${guide.id}/save?replace_last=true` : `/lists/${guide.id}/save`;
        await apiClient.post(url);
        setIsSaved(true);
      }
    } catch (err: any) {
      const errData = err.response?.data?.detail;
      if (errData && typeof errData === 'object' && errData.code === 'FOLLOW_LIMIT_REACHED') {
        setReplaceGuideModal({
          isOpen: true,
          guideToReplaceTitle: errData.replace_guide_title || (language === 'es' ? 'tu última guía seguida' : 'your last followed guide')
        });
      } else {
        setErrorMsg(typeof errData === 'string' ? errData : (language === 'es' ? 'Error al actualizar el seguimiento de la guía' : 'Failed to toggle guide follow'));
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } finally {
      setIsTogglingSave(false);
    }
  };


  const fetchGuideReviews = async (userIdOverride?: number) => {
    if (!id) return;
    try {
      const res = await apiClient.get(`/reviews/guide/${id}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setGuideReviews(list.filter((r: any) => !r.parent_id && ((typeof r.rating === 'number' && r.rating > 0) || (r.content && r.content.trim()))));
      const rated = list.filter((r: any) => !r.parent_id && typeof r.rating === 'number' && r.rating > 0);
      if (rated.length > 0) {
        const sum = rated.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
        setAverageRating(Math.round((sum / rated.length) * 10) / 10);
        setTotalRatings(rated.length);
      } else {
        setAverageRating(null);
        setTotalRatings(0);
      }
      const uid = userIdOverride ?? currentUser?.id;
      if (uid) {
        const mine = list.find((r: any) => r.user_id === uid && !r.parent_id);
        if (mine) {
          setMyGuideReviewId(mine.id);
          setUserRating(mine.rating ?? null);
          setUserReviewText(mine.content || '');
          setUserReviewIsSpoiler(Boolean(mine.is_spoiler));
        } else {
          setMyGuideReviewId(null);
          setUserRating(null);
          setUserReviewText('');
          setUserReviewIsSpoiler(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch guide reviews', err);
    }
  };

  const handleSaveGuideReview = async (ratingVal: number, content: string, isSpoiler: boolean) => {
    if (!guide || !currentUser || isSavingRating) return;
    setIsSavingRating(true);
    try {
      const res = await apiClient.post(`/reviews/guide/${guide.id}`, {
        rating: ratingVal > 0 ? ratingVal : null,
        content: content.trim() ? content : null,
        is_spoiler: isSpoiler,
        item_title: guide.title,
        image_url: guide.section_descriptions?.banner_url || null
      });
      if (res.data?.id) setMyGuideReviewId(res.data.id);
      setUserRating(ratingVal > 0 ? ratingVal : null);
      setUserReviewText(content);
      setUserReviewIsSpoiler(isSpoiler);
      await fetchGuideReviews(currentUser.id);
    } catch (err) {
      console.error('Failed to save guide review', err);
    } finally {
      setIsSavingRating(false);
    }
  };

  useEffect(() => {
    setIsGuideTranslated(false);
    setTranslatedGuideMap({});
    setTranslatedReviews({});
    setTranslatedComments({});
  }, [language]);

  const tGuide = (text?: string | null) => {
    if (!text) return text || '';
    if (isGuideTranslated && translatedGuideMap[text]) {
      return translatedGuideMap[text];
    }
    return text;
  };

  const handleTranslateGuide = async () => {
    if (!guide || isTranslatingGuide) return;
    if (isGuideTranslated) {
      setIsGuideTranslated(false);
      return;
    }
    if (Object.keys(translatedGuideMap).length > 0) {
      setIsGuideTranslated(true);
      return;
    }

    const textsToTranslate = new Set<string>();
    const addText = (s?: string | null) => {
      if (s && s.trim()) textsToTranslate.add(s);
    };
    addText(guide.title);
    addText(guide.description);
    const flow = guide.section_descriptions?.flow || [];
    for (const el of flow) {
      addText(el.title);
      addText(el.description);
      for (const sub of (el.subblocks || [])) {
        addText(sub.title);
        addText(sub.description);
      }
    }
    for (const it of (guide.items || [])) {
      addText(it.custom_notes);
    }

    const uniqueTexts = Array.from(textsToTranslate);
    if (uniqueTexts.length === 0) return;

    setIsTranslatingGuide(true);
    try {
      const nextMap: Record<string, string> = {};
      await Promise.all(
        uniqueTexts.map(async (txt) => {
          try {
            const res = await apiClient.post('/translate/', { text: txt, target_language: language });
            if (res.data?.translated_text) {
              nextMap[txt] = res.data.translated_text;
            }
          } catch {
            // keep original on single-item failure
          }
        })
      );
      setTranslatedGuideMap(nextMap);
      setIsGuideTranslated(true);
    } finally {
      setIsTranslatingGuide(false);
    }
  };

  const handleTranslateReview = async (revId: number, content: string) => {
    if (!content?.trim()) return;
    const existing = translatedReviews[revId];
    if (existing?.loading) return;
    if (existing?.text) {
      setTranslatedReviews(prev => ({ ...prev, [revId]: { ...existing, show: !existing.show } }));
      return;
    }
    setTranslatedReviews(prev => ({ ...prev, [revId]: { text: '', show: false, loading: true } }));
    try {
      const res = await apiClient.post('/translate/', { text: content, target_language: language });
      setTranslatedReviews(prev => ({
        ...prev,
        [revId]: { text: res.data?.translated_text || content, show: true, loading: false }
      }));
    } catch {
      setTranslatedReviews(prev => ({ ...prev, [revId]: { text: '', show: false, loading: false } }));
    }
  };

  const handleTranslateComment = async (commentId: number, content: string) => {
    if (!content?.trim()) return;
    const existing = translatedComments[commentId];
    if (existing?.loading) return;
    if (existing?.text) {
      setTranslatedComments(prev => ({ ...prev, [commentId]: { ...existing, show: !existing.show } }));
      return;
    }
    setTranslatedComments(prev => ({ ...prev, [commentId]: { text: '', show: false, loading: true } }));
    try {
      const res = await apiClient.post('/translate/', { text: content, target_language: language });
      setTranslatedComments(prev => ({
        ...prev,
        [commentId]: { text: res.data?.translated_text || content, show: true, loading: false }
      }));
    } catch {
      setTranslatedComments(prev => ({ ...prev, [commentId]: { text: '', show: false, loading: false } }));
    }
  };

  const handleVoteGuideReview = async (reviewId: number) => {
    if (!currentUser) return;
    setGuideReviews(prev => prev.map(r => {
      if (r.id !== reviewId) return r;
      const nextVoted = !r.user_has_voted;
      return {
        ...r,
        user_has_voted: nextVoted,
        votes_count: Math.max(0, (r.votes_count || 0) + (nextVoted ? 1 : -1))
      };
    }));
    try {
      const res = await apiClient.post(`/reviews/${reviewId}/vote`);
      if (res.data) {
        setGuideReviews(prev => prev.map(r =>
          r.id === reviewId
            ? {
                ...r,
                user_has_voted: Boolean(res.data.user_has_voted ?? res.data.voted ?? r.user_has_voted),
                votes_count: typeof res.data.votes_count === 'number' ? res.data.votes_count : r.votes_count
              }
            : r
        ));
      }
    } catch (err) {
      console.error('Failed to vote guide review', err);
      fetchGuideReviews(currentUser.id);
    }
  };

  const handleDeleteGuideReview = async () => {
    if (!myGuideReviewId || isSavingRating) return;
    setIsSavingRating(true);
    try {
      await apiClient.delete(`/reviews/${myGuideReviewId}`);
      setMyGuideReviewId(null);
      setUserRating(null);
      setUserReviewText('');
      setUserReviewIsSpoiler(false);
      await fetchGuideReviews(currentUser?.id);
    } catch (err) {
      console.error('Failed to delete guide review', err);
    } finally {
      setIsSavingRating(false);
    }
  };

  const handleSaveRating = async (ratingVal: number | null) => {
    if (!guide || isSavingRating) return;
    setIsSavingRating(true);
    try {
      const res = await apiClient.post(`/social/lists/${guide.id}/rating`, { rating: ratingVal });
      setUserRating(res.data.user_rating);
      setAverageRating(res.data.average_rating);
      setTotalRatings(res.data.total_ratings);
    } catch (err) {
      console.error("Failed to save rating", err);
    } finally {
      setIsSavingRating(false);
    }
  };

  const fetchComments = async () => {
    if (!id) return;
    try {
      setIsLoadingComments(true);
      const res = await apiClient.get(`/social/lists/${id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error("Failed to fetch comments", err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide || !newCommentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await apiClient.post(`/social/lists/${guide.id}/comments`, { content: newCommentText.trim() });
      setComments(prev => [res.data, ...prev]);
      setNewCommentText('');
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!guide) return;
    try {
      await apiClient.delete(`/social/lists/${guide.id}/comments/${commentId}`);
      await fetchComments();
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const handleReportComment = async (commentId: number) => {
    if (!currentUser || !guide) return;
    const promptMsg = language === 'es' ? '¿Por qué deseas reportar este comentario? (mínimo 5 caracteres)' : 'Why are you reporting this comment? (minimum 5 characters)';
    const reason = window.prompt(promptMsg);
    if (!reason || reason.trim().length < 5) return;
    try {
      await apiClient.post(`/social/lists/${guide.id}/comments/${commentId}/report`, { reason: reason.trim() });
      alert(language === 'es' ? 'Reporte enviado exitosamente.' : 'Report submitted successfully.');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        alert(err.response.data.detail);
      } else {
        alert(language === 'es' ? 'Error al enviar reporte.' : 'Failed to submit report.');
      }
    }
  };

  const handleOpenReply = (rootCommentId: number, targetCommentId: number, targetUsername: string) => {
    if (replyTarget && replyTarget.targetCommentId === targetCommentId) {
      setReplyTarget(null);
      setReplyText('');
    } else {
      setReplyTarget({
        rootCommentId,
        replyToUser: targetUsername,
        targetCommentId
      });
      setReplyText(`@${targetUsername} `);
      // Auto un-collapse so thread is visible
      setCollapsedReplies(prev => ({ ...prev, [rootCommentId]: false }));
    }
  };

  const handlePostReply = async (e: React.FormEvent, rootParentId: number) => {
    e.preventDefault();
    if (!guide || !replyText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await apiClient.post(`/social/lists/${guide.id}/comments`, {
        content: replyText.trim(),
        parent_id: rootParentId
      });
      setComments(prev => [...prev, res.data]);
      setReplyText('');
      setReplyTarget(null);
      // Auto un-collapse parent so the new reply is visible immediately
      setCollapsedReplies(prev => ({ ...prev, [rootParentId]: false }));
    } catch (err) {
      console.error("Failed to post reply", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleCollapseReplies = (commentId: number) => {
    setCollapsedReplies(prev => {
      const currentlyCollapsed = prev[commentId] !== false;
      return {
        ...prev,
        [commentId]: !currentlyCollapsed
      };
    });
  };

  const renderCommentContent = (content: string | null) => {
    return renderFormattedContentWithMentions(content);
  };

  const buildCommentTree = (items: CommentItem[]): CommentTreeNode[] => {
    const map = new Map<number, CommentTreeNode>();
    const roots: CommentTreeNode[] = [];

    items.forEach(item => {
      map.set(item.id, { ...item, replies: [] });
    });

    const findRootId = (parentId: number): number => {
      let curr = map.get(parentId);
      while (curr && curr.parent_id && map.has(curr.parent_id)) {
        curr = map.get(curr.parent_id);
      }
      return curr ? curr.id : parentId;
    };

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const rootId = findRootId(item.parent_id);
        const rootNode = map.get(rootId);
        if (rootNode && rootNode.id !== node.id) {
          rootNode.replies.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    roots.forEach(r => {
      r.replies = sortRepliesOldestFirst(r.replies);
    });

    return sortRootComments(roots, commentSortMode, (r) => r.replies.length);
  };

  const handleVoteComment = async (commentId: number) => {
    if (!guide) return;
    try {
      const res = await apiClient.post(`/social/lists/${guide.id}/comments/${commentId}/vote`);
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            is_voted_by_me: res.data.voted,
            vote_count: res.data.voted ? c.vote_count + 1 : Math.max(0, c.vote_count - 1)
          };
        }
        return c;
      }));
    } catch (err) {
      console.error("Failed to vote comment", err);
    }
  };

  const formatCommentDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return language === 'es' ? 'hace un momento' : 'just now';
      if (diffMinutes < 60) return language === 'es' ? `hace ${diffMinutes} min` : `${diffMinutes}m ago`;
      if (diffHours < 24) return language === 'es' ? `hace ${diffHours} h` : `${diffHours}h ago`;
      if (diffDays < 7) return language === 'es' ? `hace ${diffDays} d` : `${diffDays}d ago`;

      return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return dateStr;
    }
  };

  const fetchListDetails = () => {
    if (!id) return;
    apiClient.get(`/lists/${id}`)
      .then(response => {
        setGuide(response.data);
        setIsSaved(!!response.data.is_saved_by_me);
        const cachedCollapse = localStorage.getItem(`guide_collapsed_${id}`);
        if (cachedCollapse) {
          try {
            setCollapsedNodes(JSON.parse(cachedCollapse));
          } catch(e) {
            setCollapsedNodes({});
          }
        } else {
          setCollapsedNodes({});
        }
      })
      .catch(() => {
        setErrorMsg(language === 'es' ? 'Error al cargar los detalles de la guía.' : 'Error loading guide details.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Fetch guide details, profile and comments on mount
  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    fetchListDetails();
    fetchComments();

    // Fetch user profile and library
    apiClient.get('/users/me')
      .then(res => {
        setCurrentUser(res.data);
        fetchGuideReviews(res.data?.id);
      })
      .catch(e => {
        console.error(e);
        fetchGuideReviews();
      });

    apiClient.get('/library/')
      .then(res => setLibraryItems(res.data || []))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    const currentFlow = guide?.section_descriptions?.flow;
    if (hash && currentFlow && currentFlow.length > 0) {
      setTimeout(() => {
        const elId = hash.replace('#', '');
        const element = document.getElementById(elId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-animation');
          setTimeout(() => element.classList.remove('highlight-animation'), 2500);
        }
      }, 500);
    }
  }, [hash, guide]);

  const toggleNodeCollapse = (nodeId: string) => {
    if (!guide) return;
    setCollapsedNodes(prev => {
      const updated = { ...prev, [nodeId]: !prev[nodeId] };
      localStorage.setItem(`guide_collapsed_${guide.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const computeGuideCounts = (updatedItems: any[]) => {
    const completedCount = updatedItems.filter((i: any) => i.is_completed).length;
    const skippedCount = updatedItems.filter((i: any) => i.is_skipped && !i.is_completed).length;
    const effectiveTotal = updatedItems.length - skippedCount;
    const progressPercentage = effectiveTotal > 0 ? (completedCount / effectiveTotal) * 100 : 0;
    return {
      completed_count: completedCount,
      skipped_count: skippedCount,
      progress_percentage: Math.round(progressPercentage * 100) / 100
    };
  };

  const handleToggleItemProgress = async (itemId: number) => {
    if (!guide) return;
    const prevGuide = guide;

    // Optimistic update (0ms UI latency)
    setGuide((prev: any) => {
      if (!prev) return null;
      const updatedItems = (prev.items || []).map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              is_completed: !item.is_completed,
              is_skipped: !item.is_completed ? false : item.is_skipped,
              already_consumed: !item.is_completed ? true : item.already_consumed
            }
          : item
      );
      return {
        ...prev,
        items: updatedItems,
        ...computeGuideCounts(updatedItems)
      };
    });

    try {
      await apiClient.post(`/lists/items/${itemId}/toggle`);
      window.dispatchEvent(new Event('library-updated'));
    } catch (err: any) {
      setGuide(prevGuide);
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to toggle item progress.');
    }
  };

  const handleToggleItemSkip = async (itemId: number) => {
    if (!guide) return;
    const prevGuide = guide;

    // Optimistic update (0ms UI latency)
    setGuide((prev: any) => {
      if (!prev) return null;
      const updatedItems = (prev.items || []).map((item: any) => {
        if (item.id !== itemId) return item;
        const nextSkipped = !item.is_skipped;
        return {
          ...item,
          is_skipped: nextSkipped,
          is_completed: nextSkipped ? false : item.is_completed
        };
      });
      return {
        ...prev,
        items: updatedItems,
        ...computeGuideCounts(updatedItems)
      };
    });

    try {
      await apiClient.post(`/lists/items/${itemId}/toggle-skip`);
      window.dispatchEvent(new Event('library-updated'));
    } catch (err: any) {
      setGuide(prevGuide);
      setErrorMsg(language === 'es' ? 'Error al saltear la obra.' : 'Failed to toggle skip.');
    }
  };

  const handleMarkAlreadyConsumed = async () => {
    if (!guide || isMarkingConsumed) return;
    setIsMarkingConsumed(true);
    try {
      const res = await apiClient.post(`/lists/${guide.id}/mark-consumed`);
      const markedIds = new Set<number>(res.data?.marked_item_ids || []);
      if (markedIds.size > 0) {
        setGuide((prev: any) => {
          if (!prev) return null;
          const updatedItems = (prev.items || []).map((item: any) =>
            markedIds.has(item.id)
              ? { ...item, is_completed: true, is_skipped: false }
              : item
          );
          return {
            ...prev,
            items: updatedItems,
            ...computeGuideCounts(updatedItems)
          };
        });
        window.dispatchEvent(new Event('library-updated'));
      }
    } catch {
      setErrorMsg(language === 'es' ? 'Error al marcar las obras ya consumidas.' : 'Failed to mark already consumed items.');
    } finally {
      setIsMarkingConsumed(false);
    }
  };

  const handleBulkToggle = async (itemIds: number[], completed: boolean) => {
    if (!guide || itemIds.length === 0) return;
    const prevGuide = guide;

    // Optimistic update (0ms UI latency)
    setGuide((prev: any) => {
      if (!prev) return null;
      const idSet = new Set(itemIds);
      const updatedItems = (prev.items || []).map((item: any) =>
        idSet.has(item.id)
          ? { ...item, is_completed: completed, is_skipped: completed ? false : item.is_skipped }
          : item
      );
      return {
        ...prev,
        items: updatedItems,
        ...computeGuideCounts(updatedItems)
      };
    });

    try {
      await apiClient.post(`/lists/${guide.id}/items/bulk-toggle`, {
        item_ids: itemIds,
        completed
      });
      window.dispatchEvent(new Event('library-updated'));
    } catch (err: any) {
      setGuide(prevGuide);
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to update bulk progress.');
    }
  };

  const handleBulkSkip = async (itemIds: number[], skipped: boolean) => {
    if (!guide || itemIds.length === 0) return;
    const prevGuide = guide;

    // Optimistic update (0ms UI latency)
    setGuide((prev: any) => {
      if (!prev) return null;
      const idSet = new Set(itemIds);
      const updatedItems = (prev.items || []).map((item: any) =>
        idSet.has(item.id)
          ? { ...item, is_skipped: skipped, is_completed: skipped ? false : item.is_completed }
          : item
      );
      return {
        ...prev,
        items: updatedItems,
        ...computeGuideCounts(updatedItems)
      };
    });

    try {
      await apiClient.post(`/lists/${guide.id}/items/bulk-skip`, {
        item_ids: itemIds,
        skipped
      });
      window.dispatchEvent(new Event('library-updated'));
    } catch (err: any) {
      setGuide(prevGuide);
      setErrorMsg(language === 'es' ? 'Error al saltear los elementos.' : 'Failed to update bulk skip.');
    }
  };

  const renderSkipIconButton = (
    isSkipped: boolean,
    onClick: () => void,
    size: number,
    title: string
  ) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        flexShrink: 0,
        border: isSkipped ? '1.5px solid #94a3b8' : '1.5px solid var(--border-color)',
        background: isSkipped ? 'rgba(148, 163, 184, 0.24)' : 'transparent',
        color: isSkipped ? '#94a3b8' : 'var(--text-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        transition: 'all 0.2s'
      }}
    >
      <SkipForward size={Math.round(size * 0.54)} />
    </button>
  );

  const renderTickButton = (
    isCompleted: boolean,
    onClick: () => void,
    size: number,
    title: string
  ) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        flexShrink: 0,
        border: `2px solid ${isCompleted ? 'var(--accent-primary)' : 'var(--text-secondary)'}`,
        background: isCompleted ? 'var(--accent-primary)' : 'transparent',
        color: isCompleted ? '#fff' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        transition: 'all 0.2s'
      }}
    >
      <Check size={Math.round(size * 0.6)} strokeWidth={3} />
    </button>
  );

  const handleOpenItemDetails = (item: any) => {
    if (!item) return;
    const targetType = item.item_type || 'movie';
    const targetId = item.external_id || item.id;
    if (targetType && targetId) {
      navigate(`/item/${targetType}/${targetId}`, {
        state: { backgroundLocation: location, item: { ...item, list_id: parseInt(id as string, 10) } }
      });
    } else {
      setSelectedItem({ ...item, list_id: parseInt(id as string, 10) });
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <p>{language === 'es' ? 'Cargando guía...' : 'Loading guide...'}</p>
      </div>
    );
  }

  if (errorMsg || !guide) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> {language === 'es' ? 'Volver' : 'Back'}
        </button>
        <div className="glass-card" style={{ padding: '2rem', borderColor: '#ef4444' }}>
          <p style={{ color: '#ef4444' }}>{errorMsg || (language === 'es' ? 'Guía no encontrada.' : 'Guide not found.')}</p>
        </div>
      </div>
    );
  }

  const docFlowList = guide.section_descriptions?.flow || [];
  const itemsList = guide.items || [];
  const itemsById = new Map<number, any>(itemsList.map((i: any) => [i.id, i]));

  const getSectionItemIds = (sectionEl: any) => {
    const ids: number[] = [];
    const idx = docFlowList.findIndex((x: any) => x.id === sectionEl.id);
    if (idx === -1) return ids;
    for (let i = idx + 1; i < docFlowList.length; i++) {
      const el = docFlowList[i];
      if (el.type === 'section') break;
      if (el.type === 'block') {
        (el.items || []).forEach((item: any) => ids.push(item.id));
        (el.subblocks || []).forEach((sub: any) => {
          (sub.items || []).forEach((item: any) => ids.push(item.id));
        });
      }
    }
    return ids;
  };

  const getBlockItemIds = (blockEl: any) => {
    const ids: number[] = [];
    (blockEl.items || []).forEach((item: any) => ids.push(item.id));
    (blockEl.subblocks || []).forEach((sub: any) => {
      (sub.items || []).forEach((item: any) => ids.push(item.id));
    });
    return ids;
  };

  const getSubblockItemIds = (subblockEl: any) => {
    return (subblockEl.items || []).map((item: any) => item.id);
  };

  const canShowGuideImages = (() => {
    if (currentUser && guide && currentUser.id === guide.creator_id) {
      return getUserPlanTier(currentUser) !== 'free';
    }
    if ((guide as any)?.creator_plan_tier) {
      return (guide as any).creator_plan_tier !== 'free';
    }
    return true;
  })();

  const guideAccentCssVars = (canShowGuideImages && guide?.section_descriptions?.accent_color)
    ? getProfileTheme(guide.section_descriptions.accent_color, isLight).cssVariables
    : undefined;

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto', ...(guideAccentCssVars || {}) }}>
      {canShowGuideImages && guide.section_descriptions?.background_url && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${guide.section_descriptions.background_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.14,
            pointerEvents: 'none'
          }}
        />,
        document.body
      )}

      <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', position: 'relative', zIndex: 1, backdropFilter: 'none', WebkitBackdropFilter: 'none', transform: 'none' }}>
        {canShowGuideImages && guide.section_descriptions?.banner_url && (
          <div style={{ width: '100%', aspectRatio: '3 / 1', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={guide.section_descriptions.banner_url} alt={guide.title} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{tGuide(guide.title)}</h1>
            {currentUser && (() => {
              const sampleText = [
                guide.title,
                guide.description,
                ...(guide.section_descriptions?.flow || []).flatMap((el: any) => [
                  el.title,
                  el.description,
                  ...(el.subblocks || []).flatMap((s: any) => [s.title, s.description])
                ])
              ].filter(Boolean).join(' ');
              return isGuideTranslated || shouldShowTranslateButton(sampleText, language);
            })() && (
              <button
                type="button"
                onClick={handleTranslateGuide}
                disabled={isTranslatingGuide}
                className="btn-secondary"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isGuideTranslated ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderColor: isGuideTranslated ? 'var(--accent-primary)' : undefined
                }}
              >
                <Languages size={14} />
                {isTranslatingGuide
                  ? (language === 'es' ? 'Traduciendo...' : 'Translating...')
                  : isGuideTranslated
                    ? (language === 'es' ? 'Ver original' : 'Show original')
                    : (language === 'es' ? 'Traducir' : 'Translate')}
              </button>
            )}
          </div>
            {guide.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                {tGuide(guide.description)}
              </p>
            )}
            
            {/* Creator Author Pill + Average Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Creada por' : 'Created by'}
              </span>
              <div
                onClick={() => {
                  const target = guide.creator_username || guide.creator_id;
                  if (target) navigate(`/user/${encodeURIComponent(String(target))}`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.2rem 0.65rem 0.2rem 0.3rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  cursor: guide.creator_id ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if (guide.creator_id) { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
                onMouseLeave={(e) => { if (guide.creator_id) { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-secondary)'; } }}
                title={language === 'es' ? 'Ver perfil del creador' : 'View creator profile'}
              >
                {guide.creator_photo_url ? (
                  <img
                    src={guide.creator_photo_url}
                    alt={guide.creator_username}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {(guide.creator_username || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {guide.creator_username}
                </span>
              </div>
              </div>
              <div
                onClick={() => setCommunityTab('reviews')}
                title={language === 'es' ? 'Ver reseñas' : 'View reviews'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.65rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <Star size={14} fill={averageRating ? '#f59e0b' : 'none'} color={averageRating ? '#f59e0b' : 'var(--text-muted)'} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {averageRating !== null ? averageRating.toFixed(1) : '-'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  ({totalRatings} {totalRatings === 1 ? (language === 'es' ? 'voto' : 'vote') : (language === 'es' ? 'votos' : 'votes')})
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {currentUser && guide && (currentUser.id === guide.creator_id || currentUser.is_admin) && (
              <button
                type="button"
                onClick={() => {
                  if (guide.can_edit) {
                    navigate(`/create?id=${guide.id}`);
                  } else {
                    setShowProModal(true);
                  }
                }}
                title={guide.can_edit ? (language === 'es' ? 'Editar guía' : 'Edit guide') : (language === 'es' ? 'Guía en modo solo lectura (Pasa a Premium para editar)' : 'Read-only guide (Upgrade to Premium to edit)')}
                style={{
                  background: guide.can_edit ? 'var(--bg-secondary)' : 'rgba(245, 158, 11, 0.15)',
                  border: guide.can_edit ? '1px solid var(--border-color)' : '1px solid rgba(245, 158, 11, 0.4)',
                  color: guide.can_edit ? 'var(--text-secondary)' : '#f59e0b',
                  borderRadius: '50%',
                  width: '42px',
                  height: '42px',
                  minWidth: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = guide.can_edit ? 'var(--accent-primary)' : '#f59e0b';
                  (e.currentTarget as HTMLElement).style.borderColor = guide.can_edit ? 'var(--accent-primary)' : '#f59e0b';
                  (e.currentTarget as HTMLElement).style.background = guide.can_edit ? 'rgba(124, 58, 237, 0.1)' : 'rgba(245, 158, 11, 0.25)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = guide.can_edit ? 'var(--text-secondary)' : '#f59e0b';
                  (e.currentTarget as HTMLElement).style.borderColor = guide.can_edit ? 'var(--border-color)' : 'rgba(245, 158, 11, 0.4)';
                  (e.currentTarget as HTMLElement).style.background = guide.can_edit ? 'var(--bg-secondary)' : 'rgba(245, 158, 11, 0.15)';
                }}
              >
                {guide.can_edit ? <Pencil size={18} /> : <Lock size={18} />}
              </button>
            )}


            <button
              type="button"
              onClick={() => handleToggleSaveGuide(false)}
              disabled={isTogglingSave}

              title={isSaved ? (language === 'es' ? 'Dejar de seguir guía' : 'Unfollow guide') : (language === 'es' ? 'Seguir guía' : 'Follow guide')}
              style={{
                background: isSaved ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                border: isSaved ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                color: isSaved ? '#ef4444' : 'var(--text-secondary)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                minWidth: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSaved ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!isSaved) {
                  (e.currentTarget as HTMLElement).style.color = '#ef4444';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaved) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
                }
              }}
            >
              <Heart size={22} fill={isSaved ? '#ef4444' : 'none'} />
            </button>
            <button
              type="button"
              onClick={() => {}}
              title={language === 'es' ? 'Compartir' : 'Share'}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Progreso Completado:' : 'Completed Progress:'}</span>
            <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.35rem', fontWeight: 700 }}>
              {guide.completed_count} / {Math.max(0, guide.total_count - (guide.skipped_count || 0))} ({guide.progress_percentage}%)
            </h4>
            {(guide.skipped_count || 0) > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                {guide.skipped_count} {guide.skipped_count === 1 ? (language === 'es' ? 'salteado' : 'skipped') : (language === 'es' ? 'salteados' : 'skipped')}
              </span>
            )}
            {currentUser && (() => {
              const unmarkedConsumedCount = itemsList.filter((i: any) => i.already_consumed && !i.is_completed).length;
              if (unmarkedConsumedCount <= 0) return null;
              return (
                <button
                  type="button"
                  onClick={handleMarkAlreadyConsumed}
                  disabled={isMarkingConsumed}
                  title={
                    language === 'es'
                      ? 'Tilda en esta guía las obras que ya consumiste antes sin sumar al contador'
                      : 'Check items you have already consumed without incrementing your consumption count'
                  }
                  style={{
                    marginTop: '0.65rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: isMarkingConsumed ? 'wait' : 'pointer',
                    opacity: isMarkingConsumed ? 0.65 : 1,
                    transition: 'border-color 0.2s ease, background 0.2s ease'
                  }}
                >
                  <CheckCheck size={15} color="var(--accent-primary)" />
                  {isMarkingConsumed
                    ? (language === 'es' ? 'Marcando...' : 'Marking...')
                    : (language === 'es'
                        ? `Marcar ya consumidos (${unmarkedConsumedCount})`
                        : `Mark already consumed (${unmarkedConsumedCount})`)}
                </button>
              );
            })()}
          </div>
          <div>
            {/* Interactive Half-Star Rating & Review Box (matches media items) */}
            {currentUser && (
              <div style={{ minWidth: 0, width: '100%' }}>
                <RootReviewEditor
                  initialRating={userRating || 0}
                  initialReview={userReviewText}
                  initialIsSpoiler={userReviewIsSpoiler}
                  onSave={handleSaveGuideReview}
                  onDelete={handleDeleteGuideReview}
                  hasExistingReview={myGuideReviewId !== null || (userRating !== null && userRating > 0)}
                  isSaving={isSavingRating}
                  isItemTracked={true}
                  isEpisode={false}
                  user={currentUser}
                  language={language}
                />
              </div>
            )}
          </div>
        </div>

        {/* Main Guide / Reviews / Comments Tabs */}
        <div
          onMouseLeave={() => moveCommunityTabIndicator(communityTab)}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', marginTop: '0.25rem' }}
        >
          <button
            ref={(el) => { communityTabRefs.current.guide = el; }}
            type="button"
            onClick={() => setCommunityTab('guide')}
            onMouseEnter={() => moveCommunityTabIndicator('guide')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 0 0.75rem 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              color: communityTab === 'guide' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '1.05rem',
              fontWeight: 700,
              transition: 'color 0.15s ease'
            }}
          >
            <BookOpen size={17} color={communityTab === 'guide' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
            {language === 'es' ? 'Guía' : 'Guide'}
          </button>
          <button
            ref={(el) => { communityTabRefs.current.reviews = el; }}
            type="button"
            onClick={() => setCommunityTab('reviews')}
            onMouseEnter={() => moveCommunityTabIndicator('reviews')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 0 0.75rem 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              color: communityTab === 'reviews' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '1.05rem',
              fontWeight: 700,
              transition: 'color 0.15s ease'
            }}
          >
            <Star size={17} color={communityTab === 'reviews' ? 'var(--accent-primary)' : 'var(--text-secondary)'} fill={communityTab === 'reviews' ? 'var(--accent-primary)' : 'none'} />
            {language === 'es' ? 'Reseñas' : 'Reviews'} ({guideReviews.length})
          </button>
          <button
            ref={(el) => { communityTabRefs.current.comments = el; }}
            type="button"
            onClick={() => setCommunityTab('comments')}
            onMouseEnter={() => moveCommunityTabIndicator('comments')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 0 0.75rem 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              color: communityTab === 'comments' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '1.05rem',
              fontWeight: 700,
              transition: 'color 0.15s ease'
            }}
          >
            <MessageSquare size={17} color={communityTab === 'comments' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
            {language === 'es' ? 'Comentarios' : 'Comments'} ({comments.length})
          </button>
          <div
            ref={communityTabIndicatorRef}
            style={{
              position: 'absolute',
              bottom: '-1px',
              left: 0,
              width: 0,
              height: '2px',
              background: 'var(--accent-primary)',
              opacity: 0,
              transition: 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), width 0.16s cubic-bezier(0.2, 0, 0, 1), opacity 0.12s ease',
              pointerEvents: 'none',
              willChange: 'transform, width'
            }}
          />
        </div>

        {communityTab === 'guide' ? (
        <>
        {/* Importance Filters & Next Pending Shortcut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { value: null, label: language === 'es' ? 'Todos' : 'All' },
              { value: 5, label: language === 'es' ? 'Esencial' : 'Essential' },
              { value: 4, label: language === 'es' ? 'Importante' : 'Important' },
              { value: 3, label: language === 'es' ? 'Recomendado' : 'Recommended' },
              { value: 2, label: language === 'es' ? 'Opcional' : 'Optional' },
              { value: 1, label: language === 'es' ? 'Extra' : 'Extra' }
            ].map(opt => {
              const active = minImportanceFilter === opt.value;
              const impStyle = opt.value ? getGuideImportanceStyle(opt.value, language, isLight) : null;
              const tabColor = impStyle ? impStyle.color : 'var(--accent-primary)';
              const tabText = opt.value === null
                ? 'var(--accent-text, #ffffff)'
                : (!isLight && (opt.value === 1 || opt.value === 2 || opt.value === 4 || opt.value === 5) ? '#0f172a' : '#ffffff');
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setMinImportanceFilter(opt.value)}
                  className={`profile-category-tab ${active ? 'selected' : ''}`}
                  style={{
                    padding: '0.28rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: active ? 600 : 500,
                    background: active ? tabColor : 'transparent',
                    '--tab-color': tabColor,
                    '--tab-text': tabText,
                    boxShadow: active && impStyle?.glow ? impStyle.glow : undefined
                  } as React.CSSProperties}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {itemsList.some((i: any) => !i.is_completed && !i.is_skipped) && (
            <button
              type="button"
              onClick={() => {
                // Find first pending item in docFlow order (respecting current importance filter)
                let nextPendingId: number | null = null;
                let parentIdsToExpand: string[] = [];
                if (docFlowList.length > 0) {
                  let currentSecId: string | null = null;
                  for (const el of docFlowList) {
                    if (el.type === 'section') {
                      currentSecId = el.id;
                    } else if (el.type === 'block') {
                      for (const bi of (el.items || [])) {
                        const fullItem = itemsById.get(bi.id);
                        if (fullItem && !fullItem.is_completed && !fullItem.is_skipped) {
                          const rank = fullItem.importance_rank ?? fullItem.inherited_importance_rank ?? el.importance_rank ?? 0;
                          if (minImportanceFilter === null || rank >= minImportanceFilter) {
                            nextPendingId = fullItem.id;
                            parentIdsToExpand = [currentSecId, el.id].filter(Boolean) as string[];
                            break;
                          }
                        }
                      }
                      if (nextPendingId !== null) break;
                      for (const sub of (el.subblocks || [])) {
                        for (const si of (sub.items || [])) {
                          const fullItem = itemsById.get(si.id);
                          if (fullItem && !fullItem.is_completed && !fullItem.is_skipped) {
                            const rank = fullItem.importance_rank ?? fullItem.inherited_importance_rank ?? sub.importance_rank ?? el.importance_rank ?? 0;
                            if (minImportanceFilter === null || rank >= minImportanceFilter) {
                              nextPendingId = fullItem.id;
                              parentIdsToExpand = [currentSecId, el.id, sub.id].filter(Boolean) as string[];
                              break;
                            }
                          }
                        }
                        if (nextPendingId !== null) break;
                      }
                      if (nextPendingId !== null) break;
                    }
                  }
                }
                if (nextPendingId === null) {
                  const fallback = itemsList.find((i: any) => !i.is_completed && !i.is_skipped);
                  nextPendingId = fallback ? fallback.id : null;
                }
                if (nextPendingId !== null) {
                  if (parentIdsToExpand.length > 0) {
                    setCollapsedNodes(prev => {
                      const next = { ...prev };
                      parentIdsToExpand.forEach(pid => { next[pid] = false; });
                      return next;
                    });
                  }
                  const targetId = nextPendingId;
                  setTimeout(() => {
                    const domEl = document.querySelector(`[data-guide-item-id="${targetId}"]`) as HTMLElement | null;
                    if (domEl) {
                      domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      domEl.style.transition = 'box-shadow 0.4s ease';
                      domEl.style.boxShadow = '0 0 0 2px var(--accent-primary)';
                      setTimeout(() => { domEl.style.boxShadow = 'none'; }, 1600);
                    }
                  }, 60);
                }
              }}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ArrowDownCircle size={14} />
              {language === 'es' ? 'Ir al siguiente pendiente' : 'Jump to next pending'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
          {(() => {
            if (docFlowList.length === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {itemsList.map((item: any) => {
                    return (
                      <div
                        key={item.id}
                        data-guide-item-id={item.id}
                        onClick={() => handleOpenItemDetails(item)}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', opacity: item.is_skipped ? 0.65 : 1, transition: 'opacity 0.2s ease, border-color 0.2s ease' }}
                      >
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              loading="lazy"
                              decoding="async"
                              onClick={(e) => { e.stopPropagation(); setZoomedImage(item.image_url); }}
                              style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in', flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h5 style={{ margin: 0, fontSize: '0.95rem' }}>{item.title}</h5>
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                            {renderSkipIconButton(
                              Boolean(item.is_skipped),
                              () => handleToggleItemSkip(item.id),
                              24,
                              item.is_skipped ? (language === 'es' ? 'Dejar de saltear' : 'Unskip') : (language === 'es' ? 'Saltear obra' : 'Skip')
                            )}
                            {renderTickButton(
                              Boolean(item.is_completed),
                              () => handleToggleItemProgress(item.id),
                              24,
                              item.is_completed ? (language === 'es' ? 'Desmarcar' : 'Unmark') : (language === 'es' ? 'Marcar como completado' : 'Mark as completed')
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            let currentSectionCollapsed = false;
            return docFlowList.map((el: any) => {
              if (el.type === 'section') {
                const sectionIds = getSectionItemIds(el);
                const isSectionCompleted = sectionIds.length > 0 && sectionIds.every((id: number) => itemsById.get(id)?.is_completed);
                const isSectionSkipped = sectionIds.length > 0 && sectionIds.every((id: number) => itemsById.get(id)?.is_skipped);
                const isCollapsed = collapsedNodes[el.id] || false;
                currentSectionCollapsed = isCollapsed;
                
                return (
                  <React.Fragment key={el.id}>
                    {canShowGuideImages && el.banner_url && (
                      <div style={{ width: '100%', aspectRatio: '3 / 1', borderRadius: '10px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                        <img src={el.banner_url} alt={el.title || 'Section cover'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div id={el.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: el.banner_url ? '0.25rem' : '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', transition: 'background-color 2.5s ease-out' }}>
                    <button
                      onClick={() => toggleNodeCollapse(el.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ color: 'var(--accent-primary)', fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                        {tGuide(el.title).toUpperCase() || (language === 'es' ? 'SECCIÓN SIN TÍTULO' : 'UNTITLED SECTION')}
                      </h3>
                      {el.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.25rem 0 0 0' }}>{tGuide(el.description)}</p>}
                    </div>
                    {sectionIds.length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                        {renderSkipIconButton(
                          isSectionSkipped,
                          () => handleBulkSkip(sectionIds, !isSectionSkipped),
                          26,
                          isSectionSkipped ? (language === 'es' ? 'Dejar de saltear sección' : 'Unskip section') : (language === 'es' ? 'Saltear sección' : 'Skip section')
                        )}
                        {renderTickButton(
                          isSectionCompleted,
                          () => handleBulkToggle(sectionIds, !isSectionCompleted),
                          26,
                          isSectionCompleted ? (language === 'es' ? 'Desmarcar sección' : 'Unmark section') : (language === 'es' ? 'Completar sección' : 'Complete section')
                        )}
                      </div>
                    )}
                  </div>
                  </React.Fragment>
                );
              }

              if (el.type === 'block') {
                if (currentSectionCollapsed) return null;

                const blockItemsIds = (el.items || []).map((i: any) => i.id);
                const blockItems = blockItemsIds
                  .map((id: number) => itemsById.get(id))
                  .filter(Boolean)
                  .filter((item: any) => {
                    if (minImportanceFilter === null) return true;
                    const rank = item.importance_rank ?? item.inherited_importance_rank ?? el.importance_rank ?? 0;
                    return rank >= minImportanceFilter;
                  });
                if (minImportanceFilter !== null && blockItems.length === 0 && (el.importance_rank ?? 0) < minImportanceFilter) {
                  return null;
                }
                const allBlockIds = getBlockItemIds(el);
                const isBlockCompleted = allBlockIds.length > 0 && allBlockIds.every((id: number) => itemsById.get(id)?.is_completed);
                const isBlockSkipped = allBlockIds.length > 0 && allBlockIds.every((id: number) => itemsById.get(id)?.is_skipped);
                const isCollapsed = collapsedNodes[el.id] || false;
                
                const priorityLabel = getPriorityLabel(el.importance_rank, language);

                return (
                  <div id={el.id} key={el.id} style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'background-color 2.5s ease-out', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleNodeCollapse(el.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{tGuide(el.title) || (language === 'es' ? 'Bloque sin título' : 'Untitled Block')}</h4>
                          {priorityLabel && renderImportanceTag(el.importance_rank, '0.75rem')}
                        </div>
                        {el.description && <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>{tGuide(el.description)}</p>}
                      </div>
                      {allBlockIds.length > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                          {renderSkipIconButton(
                            isBlockSkipped,
                            () => handleBulkSkip(allBlockIds, !isBlockSkipped),
                            24,
                            isBlockSkipped ? (language === 'es' ? 'Dejar de saltear bloque' : 'Unskip block') : (language === 'es' ? 'Saltear bloque' : 'Skip block')
                          )}
                          {renderTickButton(
                            isBlockCompleted,
                            () => handleBulkToggle(allBlockIds, !isBlockCompleted),
                            24,
                            isBlockCompleted ? (language === 'es' ? 'Desmarcar bloque' : 'Unmark block') : (language === 'es' ? 'Completar bloque' : 'Complete block')
                          )}
                        </div>
                      )}
                    </div>

                    {!isCollapsed && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          {blockItems.map((item: any) => {
                            const flowItem = (el.items || []).find((i: any) => i.id === item.id);
                            const blockImportance = el.importance_rank ?? 3;
                            const itemImportance = item.importance_rank ?? flowItem?.importance_rank ?? blockImportance;
                            const showItemPriority = itemImportance !== blockImportance;
                            const itemPriorityLabel = showItemPriority ? getPriorityLabel(itemImportance, language) : null;

                            return (
                              <div
                                key={item.id}
                                data-guide-item-id={item.id}
                                onClick={() => handleOpenItemDetails(item)}
                                style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', opacity: item.is_skipped ? 0.65 : 1, transition: 'opacity 0.2s ease, border-color 0.2s ease' }}
                              >
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt={item.title}
                                      loading="lazy"
                                      decoding="async"
                                      onClick={(e) => { e.stopPropagation(); setZoomedImage(item.image_url); }}
                                      style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in', flexShrink: 0 }}
                                    />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {(() => {
                                      const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                                      if (match) {
                                        const series = match[1].trim();
                                        const s = match[2];
                                        const e = match[3];
                                        const epName = match[4].replace(/^\s*-\s*/, '').trim();
                                        const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{series}</span>
                                              {itemPriorityLabel && renderImportanceTag(itemImportance, '0.72rem')}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{formattedSE}</span>
                                            {epName && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{epName}</span>}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                                          <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</h5>
                                          {itemPriorityLabel && renderImportanceTag(itemImportance, '0.72rem')}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                    {renderSkipIconButton(
                                      Boolean(item.is_skipped),
                                      () => handleToggleItemSkip(item.id),
                                      24,
                                      item.is_skipped ? (language === 'es' ? 'Dejar de saltear' : 'Unskip') : (language === 'es' ? 'Saltear obra' : 'Skip')
                                    )}
                                    {renderTickButton(
                                      Boolean(item.is_completed),
                                      () => handleToggleItemProgress(item.id),
                                      24,
                                      item.is_completed ? (language === 'es' ? 'Desmarcar' : 'Unmark') : (language === 'es' ? 'Marcar como completado' : 'Mark as completed')
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {(el.subblocks || []).map((sub: any) => {
                          const subItemsIds = (sub.items || []).map((i: any) => i.id);
                          const subItems = subItemsIds
                            .map((id: number) => itemsById.get(id))
                            .filter(Boolean)
                            .filter((item: any) => {
                              if (minImportanceFilter === null) return true;
                              const rank = item.importance_rank ?? item.inherited_importance_rank ?? sub.importance_rank ?? el.importance_rank ?? 0;
                              return rank >= minImportanceFilter;
                            });
                          if (minImportanceFilter !== null && subItems.length === 0 && (sub.importance_rank ?? el.importance_rank ?? 0) < minImportanceFilter) {
                            return null;
                          }
                          const allSubblockIds = getSubblockItemIds(sub);
                          const isSubblockCompleted = allSubblockIds.length > 0 && allSubblockIds.every((id: number) => itemsById.get(id)?.is_completed);
                          const isSubblockSkipped = allSubblockIds.length > 0 && allSubblockIds.every((id: number) => itemsById.get(id)?.is_skipped);
                          const isSubCollapsed = collapsedNodes[sub.id] || false;
                          
                          const blockImportance = el.importance_rank ?? 3;
                          const showSubPriority = sub.importance_rank && sub.importance_rank !== blockImportance;
                          const subPriorityLabel = showSubPriority ? getPriorityLabel(sub.importance_rank, language) : null;

                          return (
                            <div id={sub.id} key={sub.id} style={{ marginLeft: '1.5rem', paddingLeft: '0.75rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'background-color 2.5s ease-out', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => toggleNodeCollapse(sub.id)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                                >
                                  {isSubCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{tGuide(sub.title) || (language === 'es' ? 'Subbloque sin título' : 'Untitled Subblock')}</h5>
                                    {subPriorityLabel && renderImportanceTag(sub.importance_rank, '0.72rem')}
                                  </div>
                                  {sub.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>{tGuide(sub.description)}</p>}
                                </div>
                                {allSubblockIds.length > 0 && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                    {renderSkipIconButton(
                                      isSubblockSkipped,
                                      () => handleBulkSkip(allSubblockIds, !isSubblockSkipped),
                                      22,
                                      isSubblockSkipped ? (language === 'es' ? 'Dejar de saltear subbloque' : 'Unskip subblock') : (language === 'es' ? 'Saltear subbloque' : 'Skip subblock')
                                    )}
                                    {renderTickButton(
                                      isSubblockCompleted,
                                      () => handleBulkToggle(allSubblockIds, !isSubblockCompleted),
                                      22,
                                      isSubblockCompleted ? (language === 'es' ? 'Desmarcar subbloque' : 'Unmark subblock') : (language === 'es' ? 'Completar subbloque' : 'Complete subblock')
                                    )}
                                  </div>
                                )}
                              </div>

                              {!isSubCollapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem' }}>
                                  {subItems.map((item: any) => {
                                    const flowItem = (sub.items || []).find((i: any) => i.id === item.id);
                                    const subImportance = sub.importance_rank ?? blockImportance;
                                    const itemImportance = item.importance_rank ?? flowItem?.importance_rank ?? subImportance;
                                    const showItemPriority = itemImportance !== subImportance;
                                    const itemPriorityLabel = showItemPriority ? getPriorityLabel(itemImportance, language) : null;

                                    return (
                                      <div
                                        key={item.id}
                                        data-guide-item-id={item.id}
                                        onClick={() => handleOpenItemDetails(item)}
                                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.45rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer', opacity: item.is_skipped ? 0.65 : 1, transition: 'opacity 0.2s ease, border-color 0.2s ease' }}
                                      >
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                          {item.image_url && (
                                            <img
                                              src={item.image_url}
                                              alt={item.title}
                                              loading="lazy"
                                              decoding="async"
                                              onClick={(e) => { e.stopPropagation(); setZoomedImage(item.image_url); }}
                                              style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in', flexShrink: 0 }}
                                            />
                                          )}
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            {(() => {
                                              const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                                              if (match) {
                                                const series = match[1].trim();
                                                const s = match[2];
                                                const e = match[3];
                                                const epName = match[4].replace(/^\s*-\s*/, '').trim();
                                                const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                                return (
                                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{series}</span>
                                                      {itemPriorityLabel && renderImportanceTag(itemImportance, '0.7rem')}
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{formattedSE}</span>
                                                    {epName && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{epName}</span>}
                                                  </div>
                                                );
                                              }
                                              return (
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                  <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</h6>
                                                  {itemPriorityLabel && renderImportanceTag(itemImportance, '0.7rem')}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                            {renderSkipIconButton(
                                              Boolean(item.is_skipped),
                                              () => handleToggleItemSkip(item.id),
                                              22,
                                              item.is_skipped ? (language === 'es' ? 'Dejar de saltear' : 'Unskip') : (language === 'es' ? 'Saltear obra' : 'Skip')
                                            )}
                                            {renderTickButton(
                                              Boolean(item.is_completed),
                                              () => handleToggleItemProgress(item.id),
                                              22,
                                              item.is_completed ? (language === 'es' ? 'Desmarcar' : 'Unmark') : (language === 'es' ? 'Marcar como completado' : 'Mark as completed')
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              }
              return null;
            });
          })()}
        </div>
        </>
        ) : communityTab === 'reviews' ? (
          guideReviews.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.92rem', fontStyle: 'italic' }}>
              {language === 'es' ? 'Aún no hay reseñas en esta guía. ¡Sé el primero en valorarla!' : 'No reviews on this guide yet. Be the first to review it!'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {guideReviews.map((rev: any) => {
                const isSpoilerHidden = Boolean(rev.is_spoiler && !revealedReviewSpoilers[rev.id]);
                return (
                  <div key={rev.id} style={{ padding: '1rem 1.25rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {rev.user_photo_url ? (
                          <img src={rev.user_photo_url} alt={rev.username} loading="lazy" decoding="async" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                            {(rev.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{rev.username || 'User'}</span>
                          {rev.created_at && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(rev.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {rev.is_spoiler && (
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <EyeOff size={11} />
                            Spoiler
                          </span>
                        )}
                        {typeof rev.rating === 'number' && rev.rating > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '0.2rem 0.55rem', borderRadius: '999px' }}>
                            <Star size={13} fill="#f59e0b" color="#f59e0b" />
                            {Number(rev.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {rev.content && (
                      <div style={{ position: 'relative' }}>
                        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.55, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', filter: isSpoilerHidden ? 'blur(6px)' : 'none', userSelect: isSpoilerHidden ? 'none' : 'auto', transition: 'filter 0.2s ease' }}>
                          {translatedReviews[rev.id]?.show ? translatedReviews[rev.id].text : rev.content}
                        </p>
                        {isSpoilerHidden && (
                          <button
                            type="button"
                            onClick={() => setRevealedReviewSpoilers(prev => ({ ...prev, [rev.id]: true }))}
                            className="btn-secondary"
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.78rem', padding: '0.3rem 0.8rem' }}
                          >
                            {language === 'es' ? 'Mostrar reseña' : 'Show review'}
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                      <button
                        type="button"
                        disabled={!currentUser}
                        onClick={() => handleVoteGuideReview(rev.id)}
                        style={{
                          background: rev.user_has_voted ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          border: rev.user_has_voted ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                          color: rev.user_has_voted ? '#3b82f6' : 'var(--text-secondary)',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: currentUser ? 'pointer' : 'default',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <ThumbsUp size={12} fill={rev.user_has_voted ? '#3b82f6' : 'none'} />
                        <span>{rev.votes_count || 0}</span>
                      </button>
                      {currentUser && rev.content && !isSpoilerHidden && (translatedReviews[rev.id]?.show || shouldShowTranslateButton(rev.content, language)) && (
                        <button
                          type="button"
                          disabled={translatedReviews[rev.id]?.loading}
                          onClick={() => handleTranslateReview(rev.id, rev.content)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: translatedReviews[rev.id]?.show ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            borderRadius: '4px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Languages size={12} />
                          <span>
                            {translatedReviews[rev.id]?.loading
                              ? '...'
                              : translatedReviews[rev.id]?.show
                                ? (language === 'es' ? 'Ver original' : 'Show original')
                                : (language === 'es' ? 'Traducir' : 'Translate')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : !hasAcceptedCommentsSpoiler && (guide?.progress_percentage ?? 0) < 100 ? (
          <div style={{ padding: '2rem 1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              {language === 'es' ? 'AVISO DE SPOILERS' : 'SPOILER WARNING'}
            </span>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '460px', lineHeight: 1.5 }}>
              {language === 'es'
                ? 'Esta sección puede contener spoilers sobre las obras incluidas en esta guía. ¿Estás seguro de que querés ver los comentarios?'
                : 'This section may contain spoilers about the works included in this guide. Are you sure you want to view the comments?'}
            </p>
            <button
              type="button"
              onClick={() => setHasAcceptedCommentsSpoiler(true)}
              className="btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 1rem', borderColor: 'rgba(239, 68, 68, 0.45)', color: 'var(--text-primary)' }}
            >
              {language === 'es' ? 'Ver comentarios de todas formas' : 'Show comments anyway'}
            </button>
          </div>
        ) : (
        <>
        {/* New Comment Box */}
        {currentUser ? (
          <form onSubmit={handlePostComment} style={{ marginBottom: '2rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            {currentUser.photo_url ? (
              <img
                src={currentUser.photo_url}
                alt={currentUser.username}
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)', flexShrink: 0, marginTop: '0.2rem' }}
              />
            ) : (
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, marginTop: '0.2rem' }}>
                {(currentUser.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={language === 'es' ? 'Escribe un comentario público sobre esta guía...' : 'Write a public comment on this guide...'}
                rows={3}
                maxLength={1000}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {newCommentText.length} / 1000
                </span>
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.88rem',
                    opacity: (!newCommentText.trim() || isSubmittingComment) ? 0.6 : 1,
                    cursor: (!newCommentText.trim() || isSubmittingComment) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Send size={15} />
                  {isSubmittingComment ? (language === 'es' ? 'Publicando...' : 'Posting...') : (language === 'es' ? 'Comentar' : 'Comment')}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {language === 'es' ? 'Inicia sesión para dejar un comentario.' : 'Log in to leave a comment.'}
          </div>
        )}

        {/* Comments List */}
        {isLoadingComments ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {language === 'es' ? 'Cargando comentarios...' : 'Loading comments...'}
          </div>
        ) : comments.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.92rem', fontStyle: 'italic' }}>
            {language === 'es' ? 'Aún no hay comentarios en esta guía. ¡Sé el primero en opinar!' : 'No comments on this guide yet. Be the first to comment!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {(() => {
              const rootNodes = buildCommentTree(comments);

              const renderReplyForm = (rootCommentId: number, targetCommentId: number, placeholderUser: string) => {
                if (replyTarget?.targetCommentId !== targetCommentId) return null;
                return (
                  <form
                    onSubmit={(e) => handlePostReply(e, rootCommentId)}
                    style={{
                      marginLeft: targetCommentId === rootCommentId ? '1.5rem' : '0.5rem',
                      padding: '1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--accent-primary)',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      marginTop: '0.4rem'
                    }}
                  >
                    {currentUser?.photo_url ? (
                      <img
                        src={currentUser.photo_url}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {(currentUser?.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <textarea
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={language === 'es' ? `Respondiendo a @${placeholderUser}...` : `Replying to @${placeholderUser}...`}
                        rows={2}
                        maxLength={1000}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                          fontSize: '0.88rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {replyText.length} / 1000
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => { setReplyTarget(null); setReplyText(''); }}
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            {language === 'es' ? 'Cancelar' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            disabled={!replyText.trim() || isSubmittingComment}
                            className="btn-primary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.9rem',
                              fontSize: '0.8rem'
                            }}
                          >
                            <Send size={13} />
                            {isSubmittingComment ? (language === 'es' ? 'Enviando...' : 'Sending...') : (language === 'es' ? 'Responder' : 'Reply')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                );
              };

              return (
                <>
                  {rootNodes.length > 1 && (
                    <CommentSortBar
                      sortMode={commentSortMode}
                      onChange={setCommentSortMode}
                      language={language}
                    />
                  )}
                  {rootNodes.map((node) => {
                const isReplyingRoot = replyTarget?.targetCommentId === node.id;
                const isCollapsed = collapsedReplies[node.id] !== false;
                const hasReplies = node.replies && node.replies.length > 0;

                return (
                  <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* Root Comment Card (Depth 0) */}
                    <div
                      style={{
                        padding: '1.15rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {node.is_deleted ? (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              ?
                            </div>
                          ) : node.photo_url ? (
                            <img
                              src={node.photo_url}
                              alt={node.creator_username}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {(node.creator_username || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <AuthorUsername
                            username={node.creator_username}
                            isDeleted={node.is_deleted}
                            deletedLabel={language === 'es' ? 'Usuario' : 'User'}
                            style={{ fontSize: '0.9rem' }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>• {formatCommentDate(node.created_at)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {!node.is_deleted && currentUser && currentUser.id !== node.user_id && (
                            <button
                              onClick={() => handleReportComment(node.id)}
                              title={language === 'es' ? 'Reportar' : 'Report'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#f59e0b')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <Flag size={13} />
                            </button>
                          )}
                          {!node.is_deleted && currentUser && (currentUser.id === node.user_id || currentUser.is_admin) && (
                            <button
                              onClick={() => handleDeleteComment(node.id)}
                              title={language === 'es' ? 'Eliminar comentario' : 'Delete comment'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comment text */}
                      {node.is_deleted ? (
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {language === 'es' ? 'Comentario eliminado.' : 'Comment deleted.'}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                          {renderCommentContent(translatedComments[node.id]?.show ? translatedComments[node.id].text : node.content)}
                        </p>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        {!node.is_deleted && (
                          <button
                            onClick={() => handleVoteComment(node.id)}
                            style={{
                              background: node.is_voted_by_me ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                              border: node.is_voted_by_me ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                              color: node.is_voted_by_me ? '#3b82f6' : 'var(--text-secondary)',
                              borderRadius: '4px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <ThumbsUp size={12} fill={node.is_voted_by_me ? '#3b82f6' : 'none'} />
                            <span>{node.vote_count}</span>
                          </button>
                        )}
                        {currentUser && !node.is_deleted && node.content && (translatedComments[node.id]?.show || shouldShowTranslateButton(node.content, language)) && (
                          <button
                            type="button"
                            disabled={translatedComments[node.id]?.loading}
                            onClick={() => handleTranslateComment(node.id, node.content || '')}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              color: translatedComments[node.id]?.show ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              borderRadius: '4px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Languages size={12} />
                            <span>
                              {translatedComments[node.id]?.loading
                                ? '...'
                                : translatedComments[node.id]?.show
                                  ? (language === 'es' ? 'Ver original' : 'Show original')
                                  : (language === 'es' ? 'Traducir' : 'Translate')}
                            </span>
                          </button>
                        )}

                        {currentUser && (
                          <button
                            onClick={() => handleOpenReply(node.id, node.id, node.is_deleted ? (language === 'es' ? 'Usuario' : 'User') : node.creator_username)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: isReplyingRoot ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.4rem'
                            }}
                          >
                            <Reply size={13} />
                            <span>{isReplyingRoot ? (language === 'es' ? 'Cancelar respuesta' : 'Cancel reply') : (language === 'es' ? 'Responder' : 'Reply')}</span>
                          </button>
                        )}

                        {hasReplies && (
                          <button
                            onClick={() => toggleCollapseReplies(node.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.4rem'
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                            <span>
                              {isCollapsed
                                ? (language === 'es' ? `Mostrar ${node.replies.length} ${node.replies.length === 1 ? 'respuesta' : 'respuestas'}` : `Show ${node.replies.length} ${node.replies.length === 1 ? 'reply' : 'replies'}`)
                                : (language === 'es' ? `Ocultar ${node.replies.length} ${node.replies.length === 1 ? 'respuesta' : 'respuestas'}` : `Hide ${node.replies.length} ${node.replies.length === 1 ? 'reply' : 'replies'}`)
                              }
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Reply Form under Root comment */}
                    {renderReplyForm(node.id, node.id, node.creator_username)}

                    {/* Single-Level Replies Container */}
                    {hasReplies && !isCollapsed && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                          marginLeft: '1.5rem',
                          paddingLeft: '1rem',
                          borderLeft: '2px solid var(--border-color)',
                          marginTop: '0.25rem'
                        }}
                      >
                        {node.replies.map((reply) => {
                          const isReplyingChild = replyTarget?.targetCommentId === reply.id;
                          return (
                            <div key={reply.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div
                                style={{
                                  padding: '0.95rem',
                                  background: 'rgba(255,255,255,0.02)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem'
                                }}
                              >
                                {/* Reply Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {reply.is_deleted ? (
                                      <div style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        flexShrink: 0
                                      }}>
                                        ?
                                      </div>
                                    ) : reply.photo_url ? (
                                      <img
                                        src={reply.photo_url}
                                        alt={reply.creator_username}
                                        style={{
                                          width: '26px',
                                          height: '26px',
                                          borderRadius: '50%',
                                          objectFit: 'cover',
                                          border: '1px solid var(--border-color)',
                                          flexShrink: 0
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        flexShrink: 0
                                      }}>
                                        {(reply.creator_username || 'U')[0].toUpperCase()}
                                      </div>
                                    )}
                                    <AuthorUsername
                                      username={reply.creator_username}
                                      isDeleted={reply.is_deleted}
                                      deletedLabel={language === 'es' ? 'Usuario' : 'User'}
                                      style={{ fontSize: '0.85rem' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {formatCommentDate(reply.created_at)}</span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {!reply.is_deleted && currentUser && currentUser.id !== reply.user_id && (
                                      <button
                                        onClick={() => handleReportComment(reply.id)}
                                        title={language === 'es' ? 'Reportar' : 'Report'}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--text-muted)',
                                          cursor: 'pointer',
                                          padding: '0.2rem',
                                          display: 'flex',
                                          alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f59e0b')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                      >
                                        <Flag size={12} />
                                      </button>
                                    )}
                                    {!reply.is_deleted && currentUser && (currentUser.id === reply.user_id || currentUser.is_admin) && (
                                      <button
                                        onClick={() => handleDeleteComment(reply.id)}
                                        title={language === 'es' ? 'Eliminar respuesta' : 'Delete reply'}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--text-muted)',
                                          cursor: 'pointer',
                                          padding: '0.2rem',
                                          display: 'flex',
                                          alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Reply Text */}
                                {reply.is_deleted ? (
                                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    {language === 'es' ? 'Comentario eliminado.' : 'Comment deleted.'}
                                  </p>
                                ) : (
                                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                    {renderCommentContent(translatedComments[reply.id]?.show ? translatedComments[reply.id].text : reply.content)}
                                  </p>
                                )}

                                {/* Reply Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                  {!reply.is_deleted && (
                                    <button
                                      onClick={() => handleVoteComment(reply.id)}
                                      style={{
                                        background: reply.is_voted_by_me ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                        border: reply.is_voted_by_me ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                                        color: reply.is_voted_by_me ? '#3b82f6' : 'var(--text-secondary)',
                                        borderRadius: '4px',
                                        padding: '0.15rem 0.45rem',
                                        fontSize: '0.75rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      <ThumbsUp size={11} fill={reply.is_voted_by_me ? '#3b82f6' : 'none'} />
                                      <span>{reply.vote_count}</span>
                                    </button>
                                  )}
                                  {currentUser && !reply.is_deleted && reply.content && (translatedComments[reply.id]?.show || shouldShowTranslateButton(reply.content, language)) && (
                                    <button
                                      type="button"
                                      disabled={translatedComments[reply.id]?.loading}
                                      onClick={() => handleTranslateComment(reply.id, reply.content || '')}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border-color)',
                                        color: translatedComments[reply.id]?.show ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        borderRadius: '4px',
                                        padding: '0.15rem 0.45rem',
                                        fontSize: '0.73rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Languages size={11} />
                                      <span>
                                        {translatedComments[reply.id]?.loading
                                          ? '...'
                                          : translatedComments[reply.id]?.show
                                            ? (language === 'es' ? 'Ver original' : 'Show original')
                                            : (language === 'es' ? 'Traducir' : 'Translate')}
                                      </span>
                                    </button>
                                  )}

                                  {currentUser && (
                                    <button
                                      onClick={() => handleOpenReply(node.id, reply.id, reply.creator_username)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: isReplyingChild ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        padding: '0.15rem 0.35rem'
                                      }}
                                    >
                                      <Reply size={12} />
                                      <span>{isReplyingChild ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Responder' : 'Reply')}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inline Reply Form under Child Reply */}
                              {renderReplyForm(node.id, reply.id, reply.creator_username)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
                </>
              );
            })()}
          </div>
        )}
        </>
        )}
      </div>

      {/* Non-intrusive Guide AdBanner */}
      <AdBanner />

      {selectedItem && (() => {
        const currentLibItem = libraryItems.find((x: any) => x.external_id === selectedItem.external_id && x.item_type === selectedItem.item_type) || selectedItem;
        const isFav = Boolean(currentLibItem?.is_favorite);

        const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
          try {
            await apiClient.put(`/library/${itemId}`, { is_favorite: !currentFav });
            setLibraryItems((prev: any[]) => prev.map(item => item.id === itemId ? { ...item, is_favorite: !currentFav } : item));
            if (selectedItem && selectedItem.id === itemId) {
              setSelectedItem((prev: any) => prev ? { ...prev, is_favorite: !currentFav } : null);
            }
          } catch (err) {
            console.error("Failed to toggle favorite in ViewGuide", err);
          }
        };

        return (
          <ItemDetailsModal
            item={currentLibItem}
            isOwnProfile={!!currentUser}
            onClose={() => setSelectedItem(null)}
            onUpdate={() => {
              fetchListDetails();
              apiClient.get('/library/').then(res => setLibraryItems(res.data || [])).catch(() => {});
            }}
            onOpenItem={(item) => handleOpenItemDetails(item)}
            isFavorite={isFav}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      })()}

      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomedImage}
            alt="Zoomed preview"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

      {/* Replace Followed Guide Modal */}
      <ReplaceSavedGuideModal
        isOpen={replaceGuideModal.isOpen}
        onClose={() => setReplaceGuideModal({ isOpen: false, guideToReplaceTitle: '' })}
        targetGuideTitle={guide?.title || ''}
        guideToReplaceTitle={replaceGuideModal.guideToReplaceTitle}
        onConfirmReplace={() => handleToggleSaveGuide(true)}
        onOpenProModal={() => setShowProModal(true)}
      />

      {/* Pro Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}
    </div>
  );
};
export default ViewGuide;

