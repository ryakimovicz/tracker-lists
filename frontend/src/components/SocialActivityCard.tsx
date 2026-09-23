import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, MoreVertical, EyeOff, Eye, Star, Film, Tv, Sparkles, Book, Gamepad2, Compass, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ActivityCommentThread } from './ActivityCommentThread';

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

  const handleClickCard = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isGuideActivity && activity.list_id) {
      navigate(`/guide/${activity.list_id}`);
      return;
    }

    if (onOpenItem) {
      const effectiveItemType = activity.item_type || meta.item_type || 'series';
      const cleanTitle = meta.work_title || (parsedEpisode ? parsedEpisode.seriesName : activity.item_title);
      
      const itemToOpen = {
        external_id: activity.external_id || undefined,
        id: (!activity.external_id && activity.list_id) ? activity.list_id : undefined,
        title: cleanTitle || activity.item_title || 'Media',
        image_url: activity.image_url || undefined,
        item_type: effectiveItemType,
        tracking_list_id: activity.list_id || undefined
      };
      onOpenItem(itemToOpen);
    }
  };

  // Human readable action text
  const getActionPhrase = () => {
    switch (activity.activity_type) {
      case 'item_status_changed':
      case 'item_completed':
        return isEs ? 'completó' : 'completed';
      case 'item_rated':
        return isEs ? 'calificó' : 'rated';
      case 'item_reviewed':
        return isEs ? 'escribió una reseña de' : 'reviewed';
      case 'guide_created':
        return isEs ? 'creó la guía' : 'created the guide';
      case 'guide_rated':
        return isEs ? 'calificó la guía' : 'rated the guide';
      case 'guide_commented':
        return isEs ? 'comentó en la guía' : 'commented on the guide';
      case 'user_followed':
        return isEs ? 'comenzó a seguir a' : 'started following';
      case 'shelf_add':
      case 'item_added_to_library':
        return isEs ? 'agregó a su biblioteca' : 'added to library';
      case 'shelf_favorite':
      case 'item_favorited':
        return isEs ? 'destacó en su perfil' : 'favorited';
      default:
        return isEs ? 'registró actividad en' : 'logged activity on';
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

  // Parse episode title into structured parts if formatted like "Series Name - S02E08 - Episode Name"
  const parseEpisodeInfo = (title?: string | null) => {
    if (!title) return null;
    const match = title.match(/^(.*?)\s*-\s*[sS](\d+)[eE](\d+)\s*-\s*(.*)$/);
    if (match) {
      const seriesName = match[1].trim();
      const seasonNum = parseInt(match[2], 10);
      const episodeNum = parseInt(match[3], 10);
      const sPadded = seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`;
      const ePadded = episodeNum < 10 ? `0${episodeNum}` : `${episodeNum}`;
      const epCode = isEs ? `T${sPadded} | E${ePadded}` : `S${sPadded} | E${ePadded}`;
      const episodeName = match[4].trim();
      return { seriesName, epCode, episodeName };
    }
    return null;
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

  const parsedEpisode = parseEpisodeInfo(activity.item_title);
  const categoryMeta = getCategoryMeta(activity.item_type || meta.item_type);

  // Check if details is a clean review comment (not just "completed" or star number)
  const isReviewComment = activity.activity_type === 'item_reviewed' && activity.details && activity.details.trim().length > 0;
  const isRating = activity.activity_type === 'item_rated' || activity.activity_type === 'guide_rated';
  const numericRating = isRating && activity.details && !isNaN(Number(activity.details)) ? Number(activity.details) : null;

  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isFooterHovered, setIsFooterHovered] = useState(false);
  const [isLikeHovered, setIsLikeHovered] = useState(false);

  const isClickable = Boolean(
    (isGuideActivity && activity.list_id) ||
    (onOpenItem && (activity.external_id || activity.list_id || activity.item_title))
  );

  // Helper to split a title so the last word is bundled with the category icon and timestamp
  const renderTitleWithBadgeAndTimestamp = (titleText: string) => {
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
                marginRight: '0.2rem',
                verticalAlign: 'middle',
                filter: isCardHovered ? 'drop-shadow(0 0 6px rgba(255,255,255,0.25))' : 'none',
                transition: 'filter 0.2s ease'
              }}
            >
              {categoryMeta.icon}
            </span>
          )}

          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginLeft: '0.15rem' }}>
            • {formatRelativeTime(activity.created_at)}
          </span>
        </span>
      </>
    );
  };

  return (
    <div
      className="glass-card activity-card"
      style={{
        padding: '1.1rem 1.25rem',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        opacity: isHidden ? 0.6 : 1,
        position: 'relative',
        background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
        border: isHidden ? '1px dashed var(--border-color)' : '1px solid var(--border-color)',
        transition: 'border-color 0.2s ease, background 0.2s ease'
      }}
    >
      {/* Upper Area: Left Content Column + Right Prominent Poster */}
      <div
        onClick={handleClickCard}
        onMouseEnter={() => setIsCardHovered(true)}
        onMouseLeave={() => setIsCardHovered(false)}
        style={{
          display: 'flex',
          gap: '1.1rem',
          alignItems: 'stretch',
          cursor: isClickable ? 'pointer' : 'default'
        }}
      >
        {/* Left main content body */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Header row: User avatar + action sentence + 3-dots */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: 0 }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${encodeURIComponent(activity.username)}`);
                }}
                style={{ cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
              >
                {activity.user_photo_url ? (
                  <img
                    src={activity.user_photo_url}
                    alt={activity.username}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
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
                      fontWeight: 700
                    }}
                  >
                    {(activity.username || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.55 }}>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${encodeURIComponent(activity.username)}`);
                    }}
                    style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', marginRight: '0.35rem' }}
                  >
                    {activity.username}
                  </span>

                  {/* Action sentence with clean wrapping */}
                  {meta.is_range ? (
                    (() => {
                      const isComic = (activity.item_type || meta.item_type) === 'comic';
                      const workName = meta.work_title || activity.item_title?.split(' (')[0] || activity.item_title;
                      const alsoAdded = !!meta.also_added;
                      const verb = alsoAdded
                        ? (isComic ? (isEs ? 'agregó y leyó del' : 'added and read') : (isEs ? 'agregó y vio del' : 'added and watched'))
                        : (isComic ? (isEs ? 'leyó del' : 'read') : (isEs ? 'vio del' : 'watched'));

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
                          {renderTitleWithBadgeAndTimestamp(workName)}
                        </>
                      );
                    })()
                  ) : parsedEpisode ? (
                    <>
                      <span style={{ marginRight: '0.35rem' }}>{isEs ? 'completó el' : 'completed'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>
                        {parsedEpisode.epCode}
                      </span>
                      {parsedEpisode.episodeName && (
                        <span style={{ color: 'var(--text-secondary)', marginRight: '0.35rem' }}>
                          ({parsedEpisode.episodeName})
                        </span>
                      )}
                      <span style={{ marginRight: '0.35rem' }}>{isEs ? 'de' : 'of'}</span>
                      {renderTitleWithBadgeAndTimestamp(parsedEpisode.seriesName)}
                    </>
                  ) : (
                    <>
                      <span style={{ marginRight: '0.35rem' }}>{getActionPhrase()}</span>
                      {activity.item_title && renderTitleWithBadgeAndTimestamp(activity.item_title)}
                    </>
                  )}

                  {isHidden && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontStyle: 'italic', marginLeft: '0.35rem' }}>
                      ({isEs ? 'Oculto' : 'Hidden'})
                    </span>
                  )}
                </div>
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

          {/* Review text speech bubble if user wrote a review */}
          {isReviewComment && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderLeft: '3px solid var(--accent-primary)',
                padding: '0.65rem 0.95rem',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                lineHeight: 1.45,
                wordBreak: 'break-word'
              }}
            >
              "{activity.details}"
            </div>
          )}

          {/* Star rating highlight if item_rated */}
          {numericRating !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  fill={s <= numericRating ? '#f59e0b' : 'none'}
                  color={s <= numericRating ? '#f59e0b' : 'var(--text-muted)'}
                />
              ))}
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, marginLeft: '0.3rem' }}>
                {numericRating} / 5
              </span>
            </div>
          )}
        </div>

        {/* Right side prominent poster covering vertical space */}
        {activity.image_url && (
          <div
            style={{
              flexShrink: 0,
              width: isReviewComment ? '84px' : '72px',
              display: 'flex',
              alignItems: 'stretch',
              overflow: 'hidden',
              borderRadius: '8px'
            }}
          >
            <img
              src={activity.image_url}
              alt={activity.item_title || 'Cover'}
              style={{
                width: isReviewComment ? '84px' : '72px',
                minHeight: isReviewComment ? '110px' : '88px',
                height: '100%',
                maxHeight: isReviewComment ? '150px' : '105px',
                borderRadius: '8px',
                objectFit: 'cover',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                transform: isCardHovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease'
              }}
            />
          </div>
        )}
      </div>

      {/* Footer / Action Bar (Like + Comments) */}
      <div
        onClick={() => setShowComments(!showComments)}
        onMouseEnter={() => setIsFooterHovered(true)}
        onMouseLeave={() => setIsFooterHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          paddingTop: '0.45rem',
          marginTop: '-0.1rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          cursor: 'pointer',
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

        {/* Comment Indicator / Button */}
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
      </div>

      {/* Comments Accordion */}
      {showComments && (
        <ActivityCommentThread
          activityId={activity.id}
          onCommentsCountChange={(cnt) => setCommentsCount(cnt)}
        />
      )}
    </div>
  );
};
