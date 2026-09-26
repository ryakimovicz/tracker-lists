import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, MoreVertical, EyeOff, Eye, Star, Film, Tv, Sparkles, Book, Gamepad2, Compass, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ActivityCommentThread } from './ActivityCommentThread';
import { StarRatingDisplay } from './ItemDetailsModal';
import { renderFormattedContentWithMentions, AuthorUsername } from './MentionTag';

export interface ActivityCardData {
  id: number;
  user_id: number;
  username: string;
  user_photo_url?: string | null;
  activity_type: string;
  item_title?: string | null;
  item_type?: string | null;
  external_id?: string | null;
  list_id?: number | null;
  image_url?: string | null;
  details?: string | null;
  metadata_json?: string | null;
  is_hidden: boolean;
  likes_count: number;
  is_liked_by_me: boolean;
  comments_count: number;
  created_at: string;
}

interface SocialActivityCardProps {
  activity: ActivityCardData;
  isOwnActivity?: boolean;
  onVisibilityToggle?: (id: number, isHidden: boolean) => void;
  onOpenItem?: (item: any) => void;
}

export const SocialActivityCard: React.FC<SocialActivityCardProps> = ({
  activity,
  isOwnActivity = false,
  onVisibilityToggle,
  onOpenItem
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [likesCount, setLikesCount] = useState(activity.likes_count || 0);
  const [isLiked, setIsLiked] = useState(activity.is_liked_by_me || false);
  const [commentsCount, setCommentsCount] = useState(activity.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isHidden, setIsHidden] = useState(activity.is_hidden || false);
  const [likeAnimating, setLikeAnimating] = useState(false);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 300);

    const prevLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await apiClient.post(`/social/activity/${activity.id}/like`);
      setIsLiked(res.data.liked);
      setLikesCount(res.data.likes_count);
    } catch (err) {
      // Revert on error
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiClient.patch(`/social/feed/activity/${activity.id}/visibility`);
      setIsHidden(res.data.is_hidden);
      setShowMenu(false);
      if (onVisibilityToggle) {
        onVisibilityToggle(activity.id, res.data.is_hidden);
      }
    } catch (err) {
      console.error('Error toggling visibility:', err);
    }
  };

  const isGuideActivity = activity.item_type === 'guide' || activity.activity_type.startsWith('guide_');

  const handleClickCard = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isGuideActivity && activity.list_id) {
      navigate(`/guide/${activity.list_id}`);
      return;
    }

    if (onOpenItem) {
      let effectiveItemType = (meta.series_item_type || activity.item_type || meta.item_type || 'series').toLowerCase();
      if (effectiveItemType === 'episode') effectiveItemType = 'series';
      if (meta.series_external_id && String(meta.series_external_id).startsWith('anime_')) effectiveItemType = 'anime';

      let effectiveExternalId = meta.series_external_id || meta.parent_external_id || meta.work_ext_id || activity.external_id || undefined;
      const cleanTitle = meta.series_title || meta.work_title || (parsedEpisode ? parsedEpisode.seriesName : (parsedComicIssue ? parsedComicIssue.seriesName : activity.item_title));
      
      // If the activity is an episode (e.g. tvm-ep-12345), resolve parent show ID so it opens the series modal
      if (effectiveExternalId && typeof effectiveExternalId === 'string' && effectiveExternalId.startsWith('tvm-ep-')) {
        const epNumId = effectiveExternalId.replace('tvm-ep-', '');
        try {
          const epRes = await fetch(`https://api.tvmaze.com/episodes/${epNumId}`);
          if (epRes.ok) {
            const epData = await epRes.json();
            const showId = epData?._links?.show?.href ? epData._links.show.href.split('/').pop() : null;
            if (showId) {
              effectiveExternalId = `tvm_${showId}`;
            }
          }
        } catch (_) {}
      } else if (effectiveExternalId && typeof effectiveExternalId === 'string' && effectiveExternalId.startsWith('cv_issue_')) {
        effectiveItemType = 'comic';
        if (meta.volume_id || meta.series_external_id) {
          effectiveExternalId = meta.volume_id || meta.series_external_id;
        } else {
          try {
            const issueRes = await apiClient.get(`/search/comic/issue/${effectiveExternalId}`);
            if (issueRes.data?.parent_series?.external_id) {
              effectiveExternalId = issueRes.data.parent_series.external_id;
            }
          } catch (_) {}
        }
      }

      const itemToOpen = {
        external_id: effectiveExternalId,
        id: (!effectiveExternalId && activity.list_id) ? activity.list_id : undefined,
        title: cleanTitle || activity.item_title || 'Media',
        image_url: activity.image_url || undefined,
        item_type: effectiveItemType,
        tracking_list_id: activity.list_id || undefined
      };
      onOpenItem(itemToOpen);
    }
  };

  // Human readable action text (capitalized and media-aware)
  const getActionPhrase = () => {
    const rawType = (activity.item_type || meta.item_type || '').toLowerCase();
    const isComicOrBook = ['comic', 'manga', 'book'].includes(rawType);
    const isWatchable = ['series', 'anime', 'movie', 'episode', 'season'].includes(rawType);
    const isGame = rawType === 'game';

    switch (activity.activity_type) {
      case 'item_status_changed':
      case 'item_completed':
        if (isComicOrBook) return isEs ? 'Leyó' : 'Read';
        if (isWatchable) return isEs ? 'Vio' : 'Watched';
        if (isGame) return isEs ? 'Completó' : 'Completed';
        return isEs ? 'Completó' : 'Completed';
      case 'item_rated':
        return isEs ? 'Calificó' : 'Rated';
      case 'item_reviewed':
        return isEs ? 'Escribió una reseña de' : 'Reviewed';
      case 'guide_created':
        return isEs ? 'Creó la guía' : 'Created the guide';
      case 'guide_rated':
        return isEs ? 'Calificó la guía' : 'Rated the guide';
      case 'guide_commented':
        return isEs ? 'Comentó en la guía' : 'Commented on the guide';
      case 'user_followed':
        return isEs ? 'Comenzó a seguir a' : 'Started following';
      case 'shelf_add':
      case 'item_added_to_library':
        return isEs ? 'Agregó a su biblioteca' : 'Added to library';
      case 'shelf_favorite':
      case 'item_favorited':
        return isEs ? 'Destacó en su perfil' : 'Favorited';
      default:
        return isEs ? 'Registró actividad en' : 'Logged activity on';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 1) {
        const mins = Math.max(1, Math.floor(diffMs / 60000));
        return `${mins}m`;
      }
      if (diffHours < 24) return `${diffHours}h`;
      const days = Math.floor(diffHours / 24);
      if (days < 7) return `${days}d`;
      return d.toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Helpers for Categories and Episode Formatting
  const getCategoryMeta = (rawType?: string | null) => {
    const t = (rawType || 'series').toLowerCase();
    switch (t) {
      case 'movie':
        return {
          label: isEs ? 'Película' : 'Movie',
          icon: <Film size={13} />,
          className: 'tag-badge tag-movie',
          themeColor: 'var(--color-movie)'
        };
      case 'series':
      case 'episode':
      case 'season':
        return {
          label: isEs ? 'Serie' : 'Series',
          icon: <Tv size={13} />,
          className: 'tag-badge tag-series',
          themeColor: 'var(--color-series)'
        };
      case 'anime':
        return {
          label: isEs ? 'Anime' : 'Anime',
          icon: <Sparkles size={13} />,
          className: 'tag-badge tag-anime',
          themeColor: 'var(--color-anime)'
        };
      case 'book':
        return {
          label: isEs ? 'Libro' : 'Book',
          icon: <Book size={13} />,
          className: 'tag-badge tag-book',
          themeColor: 'var(--color-book)'
        };
      case 'comic':
        return {
          label: isEs ? 'Cómic' : 'Comic',
          icon: <Book size={13} />,
          className: 'tag-badge tag-comic',
          themeColor: 'var(--color-comic)'
        };
      case 'manga':
        return {
          label: isEs ? 'Manga' : 'Manga',
          icon: <Book size={13} />,
          className: 'tag-badge tag-manga',
          themeColor: 'var(--color-manga)'
        };
      case 'game':
        return {
          label: isEs ? 'Videojuego' : 'Game',
          icon: <Gamepad2 size={13} />,
          className: 'tag-badge tag-game',
          themeColor: 'var(--color-game)'
        };
      case 'guide':
        return {
          label: isEs ? 'Guía' : 'Guide',
          icon: <Compass size={13} />,
          className: 'tag-badge tag-guide',
          themeColor: 'var(--color-guide)'
        };
      default:
        return {
          label: isEs ? 'Obra' : 'Media',
          icon: <Tv size={13} />,
          className: 'tag-badge tag-series',
          themeColor: 'var(--color-series)'
        };
    }
  };

  // Parse metadata if present
  const meta = React.useMemo(() => {
    if (!activity.metadata_json) return {} as Record<string, any>;
    try {
      return typeof activity.metadata_json === 'string' ? JSON.parse(activity.metadata_json) : activity.metadata_json;
    } catch {
      return {} as Record<string, any>;
    }
  }, [activity.metadata_json]);

  // Parse episode title into structured parts
  const parseEpisodeInfo = (title?: string | null) => {
    const rawText = (title || '').trim();
    const isEp = (activity.item_type || meta.item_type) === 'series' ||
      (activity.item_type || meta.item_type) === 'anime' ||
      (activity.item_type || meta.item_type) === 'episode' ||
      (activity.external_id && String(activity.external_id).startsWith('tvm-ep-')) ||
      meta.is_single_episode;

    if (!rawText && !isEp) return null;

    const match = rawText.match(/^(?:(.*?)\s*-\s*)?[sS](\d+)[eE](\d+)(?:\s*-\s*(.*))?$/);
    if (match) {
      const seriesName = (match[1] || meta.show_name || meta.series_title || '').trim();
      const seasonNum = parseInt(match[2], 10);
      const episodeNum = parseInt(match[3], 10);
      const sPadded = seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`;
      const ePadded = episodeNum < 10 ? `0${episodeNum}` : `${episodeNum}`;
      const epCode = isEs ? `T${sPadded} | E${ePadded}` : `S${sPadded} | E${ePadded}`;
      const episodeName = (match[4] || '').trim();
      return { seriesName, epCode, episodeName };
    }

    // Fallback: check metadata for season & episode numbers
    if (meta.season_number && meta.episode_number) {
      const seasonNum = parseInt(String(meta.season_number), 10);
      const episodeNum = parseInt(String(meta.episode_number), 10);
      const sPadded = seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`;
      const ePadded = episodeNum < 10 ? `0${episodeNum}` : `${episodeNum}`;
      const epCode = isEs ? `T${sPadded} | E${ePadded}` : `S${sPadded} | E${ePadded}`;
      let seriesName = (meta.show_name || meta.series_title || '').trim();
      let episodeName = '';

      if (!seriesName && rawText.includes(' - ')) {
        seriesName = rawText.split(' - ')[0].trim();
      }
      if (rawText.includes(' - ')) {
        episodeName = rawText.split(' - ').slice(1).join(' - ').trim();
      } else if (!rawText.startsWith('Episode (')) {
        episodeName = rawText;
      }

      return { seriesName, epCode, episodeName };
    }

    // Fallback for "Series - Episode Name" when it's an episode activity
    if (isEp && rawText.includes(' - ') && !rawText.startsWith('Episode (')) {
      const parts = rawText.split(' - ');
      const seriesName = (meta.show_name || meta.series_title || parts[0]).trim();
      const episodeName = parts.slice(1).join(' - ').trim();
      return { seriesName, epCode: '', episodeName };
    }

    // Fallback for "Episode (tvm-ep-XXXX)"
    if (isEp && (rawText.startsWith('Episode (') || !rawText) && (meta.show_name || meta.series_title)) {
      return {
        seriesName: (meta.show_name || meta.series_title).trim(),
        epCode: '',
        episodeName: isEs ? 'un episodio' : 'an episode'
      };
    }

    return null;
  };

  // Parse comic issue into structured parts
  const parseComicIssueInfo = (title?: string | null) => {
    const rawText = (title || '').trim();
    const isComic = (activity.item_type || meta.item_type) === 'comic' ||
      (activity.item_type || meta.item_type) === 'manga' ||
      (activity.external_id && String(activity.external_id).startsWith('cv_issue_'));

    if (!rawText && !isComic) return null;

    const match = rawText.match(/^(.*?)\s*#(\d+(?:\.\d+)?)(?:\s*-\s*(.*))?$/);
    if (match) {
      const seriesName = (match[1] || meta.series_title || meta.volume_title || '').trim();
      const issueNum = match[2].trim();
      const issueTitle = match[3]?.trim();
      return { seriesName, issueCode: `#${issueNum}`, issueTitle };
    }

    if (meta.issue_number) {
      const issueCode = `#${meta.issue_number}`;
      const seriesName = (meta.series_title || meta.volume_title || '').trim();
      let issueTitle = '';
      if (!rawText.startsWith('Comic (')) {
        issueTitle = rawText;
      }
      return { seriesName, issueCode, issueTitle };
    }

    if (isComic && (rawText.startsWith('Comic (') || !rawText) && (meta.series_title || meta.volume_title)) {
      return {
        seriesName: (meta.series_title || meta.volume_title).trim(),
        issueCode: '',
        issueTitle: isEs ? 'un número' : 'an issue'
      };
    }

    return null;
  };

  const parsedEpisode = parseEpisodeInfo(activity.item_title);
  const parsedComicIssue = !parsedEpisode && !meta.is_range ? parseComicIssueInfo(activity.item_title) : null;
  const categoryMeta = getCategoryMeta(activity.item_type || meta.item_type);

  // Check if details is a clean review comment (not just "completed" or star number)
  const isReviewComment = activity.activity_type === 'item_reviewed' && activity.details && activity.details.trim().length > 0;
  const isRating = activity.activity_type === 'item_rated' || activity.activity_type === 'guide_rated';
  const numericRating = (isRating && activity.details && !isNaN(Number(activity.details)))
    ? Number(activity.details)
    : (meta?.rating !== undefined && meta?.rating !== null && !isNaN(Number(meta.rating)) ? Number(meta.rating) : null);

  // Reviews do not have comments in Social
  const isReviewActivity = activity.activity_type === 'item_reviewed' || activity.activity_type === 'item_rated';
  const canHaveComments = !isReviewActivity;

  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isFooterHovered, setIsFooterHovered] = useState(false);
  const [isLikeHovered, setIsLikeHovered] = useState(false);

  const isClickable = Boolean(
    (isGuideActivity && activity.list_id) ||
    (onOpenItem && (activity.external_id || activity.list_id || activity.item_title))
  );

  // Helper to split a title so the last word is bundled with the category icon badge
  const renderTitleWithBadge = (titleText: string) => {
    const trimmed = (titleText || '').trim();
    const lastSpaceIdx = trimmed.lastIndexOf(' ');

    const leadText = lastSpaceIdx !== -1 ? trimmed.slice(0, lastSpaceIdx + 1) : '';
    const lastWord = lastSpaceIdx !== -1 ? trimmed.slice(lastSpaceIdx + 1) : trimmed;

    const titleColor = isCardHovered
      ? (categoryMeta?.themeColor || 'var(--accent-primary)')
      : (isGuideActivity ? 'var(--accent-primary)' : 'var(--text-primary)');

    return (
      <>
        {leadText && (
          <span
            style={{
              fontWeight: 700,
              color: titleColor,
              transition: 'color 0.2s ease'
            }}
          >
            {leadText}
          </span>
        )}
        <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
          <span
            style={{
              fontWeight: 700,
              color: titleColor,
              transition: 'color 0.2s ease'
            }}
          >
            {lastWord}
          </span>

          {categoryMeta && (
            <span
              title={categoryMeta.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: categoryMeta.themeColor || 'var(--accent-primary)',
                marginLeft: '0.35rem',
                verticalAlign: 'middle',
                filter: isCardHovered ? 'drop-shadow(0 0 6px rgba(255,255,255,0.25))' : 'none',
                transition: 'filter 0.2s ease'
              }}
            >
              {categoryMeta.icon}
            </span>
          )}
        </span>
      </>
    );
  };

  return (
    <div
      className="glass-card activity-card"
      style={{
        padding: '1.25rem',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        opacity: isHidden ? 0.6 : 1,
        position: 'relative',
        background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
        border: isHidden ? '1px dashed var(--border-color)' : '1px solid var(--border-color)',
        transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.2s ease',
        height: '100%',
        justifyContent: 'space-between'
      }}
    >
      {/* Clickable Card Body (Header + Poster + Action Description + Review) */}
      <div
        onClick={handleClickCard}
        onMouseEnter={() => setIsCardHovered(true)}
        onMouseLeave={() => setIsCardHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          cursor: isClickable ? 'pointer' : 'default',
          flex: 1
        }}
      >
        {/* 1. Header row: User avatar + Username + Timestamp + Menu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/user/${encodeURIComponent(activity.username)}`);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', minWidth: 0 }}
          >
            {activity.user_photo_url ? (
              <img
                src={activity.user_photo_url}
                alt={activity.username}
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #6366f1))',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {(activity.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <AuthorUsername
                username={activity.username}
                style={{
                  fontSize: '0.92rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                {formatRelativeTime(activity.created_at)}
              </span>
            </div>
          </div>

          {/* 3-dots menu for owner */}
          {isOwnActivity && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  borderRadius: '6px'
                }}
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    background: 'var(--bg-secondary, #1e1e24)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                    zIndex: 20,
                    minWidth: '180px',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={handleToggleVisibility}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.55rem 0.85rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{isHidden ? (isEs ? 'Mostrar en mi muro' : 'Show on feed') : (isEs ? 'Ocultar de mi muro' : 'Hide from feed')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Prominent Poster Cover Art */}
        {activity.image_url && (
          <div
            style={{
              width: '100%',
              height: '240px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'var(--bg-tertiary, rgba(0,0,0,0.2))',
              position: 'relative',
              boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <img
              src={activity.image_url}
              alt={activity.item_title || 'Cover'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: isCardHovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          </div>
        )}

        {/* 3. Action Sentence with badge */}
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {meta.is_range ? (
            (() => {
              const isComic = (activity.item_type || meta.item_type) === 'comic' || (activity.item_type || meta.item_type) === 'manga';
              const workName = meta.work_title || activity.item_title?.split(' (')[0] || activity.item_title;
              const alsoAdded = !!meta.also_added;
              const verb = alsoAdded
                ? (isComic ? (isEs ? 'Agregó y leyó del' : 'Added and read from') : (isEs ? 'Agregó y vio del' : 'Added and watched from'))
                : (isComic ? (isEs ? 'Leyó del' : 'Read from') : (isEs ? 'Vio del' : 'Watched from'));

              return (
                <>
                  <span style={{ marginRight: '0.35rem' }}>{verb}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>
                    {meta.start_unit}
                  </span>
                  <span style={{ marginRight: '0.35rem' }}>{isEs ? 'al' : 'to'}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>
                    {meta.end_unit}
                  </span>
                  <span style={{ marginRight: '0.35rem' }}>{isEs ? 'de' : 'of'}</span>
                  {renderTitleWithBadge(workName)}
                </>
              );
            })()
          ) : parsedEpisode ? (
            (() => {
              const verb = activity.activity_type === 'item_rated'
                ? (isEs ? 'Calificó el' : 'Rated')
                : activity.activity_type === 'item_reviewed'
                ? (isEs ? 'Reseñó el' : 'Reviewed')
                : (isEs ? 'Vio el' : 'Watched');
              return (
                <>
                  <span style={{ marginRight: '0.35rem' }}>{verb}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>
                    {parsedEpisode.epCode}
                  </span>
                  {parsedEpisode.episodeName && (
                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.35rem' }}>
                      ({parsedEpisode.episodeName})
                    </span>
                  )}
                  <span style={{ marginRight: '0.35rem' }}>{isEs ? 'de' : 'of'}</span>
                  {renderTitleWithBadge(parsedEpisode.seriesName)}
                </>
              );
            })()
          ) : parsedComicIssue ? (
            (() => {
              const verb = activity.activity_type === 'item_rated'
                ? (isEs ? 'Calificó el' : 'Rated')
                : activity.activity_type === 'item_reviewed'
                ? (isEs ? 'Reseñó el' : 'Reviewed')
                : (isEs ? 'Leyó el' : 'Read');
              return (
                <>
                  <span style={{ marginRight: '0.35rem' }}>{verb}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>
                    {parsedComicIssue.issueCode}
                  </span>
                  {parsedComicIssue.issueTitle && (
                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.35rem' }}>
                      ({parsedComicIssue.issueTitle})
                    </span>
                  )}
                  <span style={{ marginRight: '0.35rem' }}>{isEs ? 'de' : 'of'}</span>
                  {renderTitleWithBadge(parsedComicIssue.seriesName)}
                </>
              );
            })()
          ) : (
            <>
              <span style={{ marginRight: '0.35rem' }}>{getActionPhrase()}</span>
              {activity.item_title && renderTitleWithBadge(activity.item_title)}
            </>
          )}

          {isHidden && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontStyle: 'italic', marginLeft: '0.35rem' }}>
              ({isEs ? 'Oculto' : 'Hidden'})
            </span>
          )}
        </div>

        {/* 4. Review speech bubble if user reviewed */}
        {isReviewComment && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderLeft: '3px solid var(--accent-primary)',
              padding: '0.65rem 0.95rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.86rem',
              color: 'var(--text-primary)',
              lineHeight: 1.45,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {renderFormattedContentWithMentions(activity.details)}
          </div>
        )}

        {/* 5. Star rating highlight */}
        {numericRating !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <StarRatingDisplay rating={numericRating} size={14} gap="2px" />
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>
              {numericRating} / 5
            </span>
          </div>
        )}
      </div>

      {/* Footer / Action Bar (Like + Comments) */}
      <div
        onClick={canHaveComments ? () => setShowComments(!showComments) : undefined}
        onMouseEnter={() => setIsFooterHovered(true)}
        onMouseLeave={() => setIsFooterHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          paddingTop: '0.45rem',
          marginTop: '0.2rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          cursor: canHaveComments ? 'pointer' : 'default',
          userSelect: 'none'
        }}
      >
        {/* Like Button (ThumbsUp) */}
        <button
          onClick={handleToggleLike}
          disabled={!user}
          style={{
            background: isLiked ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: isLiked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
            color: isLiked ? '#3b82f6' : 'var(--text-secondary)',
            borderRadius: '20px',
            padding: '0.35rem 0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: user ? 'pointer' : 'default',
            fontSize: '0.88rem',
            fontWeight: 600,
            transition: 'all 0.15s ease',
            transform: likeAnimating ? 'scale(1.15)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            setIsLikeHovered(true);
            if (!isLiked) {
              e.currentTarget.style.color = '#3b82f6';
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            setIsLikeHovered(false);
            if (!isLiked) {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <ThumbsUp size={17} fill={isLiked ? '#3b82f6' : 'none'} color={isLiked ? '#3b82f6' : 'currentColor'} />
          <span>{likesCount}</span>
        </button>

        {/* Comment Indicator / Button (Hidden for Reviews) */}
        {canHaveComments && (
          <div
            style={{
              background: (showComments || (isFooterHovered && !isLikeHovered)) ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
              border: (showComments || (isFooterHovered && !isLikeHovered)) ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
              color: (showComments || (isFooterHovered && !isLikeHovered)) ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderRadius: '20px',
              padding: '0.35rem 0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={18} />
            <span>{commentsCount} {isEs ? (commentsCount === 1 ? 'comentario' : 'comentarios') : (commentsCount === 1 ? 'comment' : 'comments')}</span>
          </div>
        )}
      </div>

      {/* Comments Accordion (Only if allowed) */}
      {canHaveComments && showComments && (
        <ActivityCommentThread
          activityId={activity.id}
          onCommentsCountChange={(cnt) => setCommentsCount(cnt)}
        />
      )}
    </div>
  );
};
