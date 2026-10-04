import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ActivityModal } from './ActivityModal';
import { SocialActivityCard } from './SocialActivityCard';
import type { ActivityCardData } from './SocialActivityCard';
import { PathdLoader } from './PathdLoader';
import { useTranslation } from '../context/LanguageContext';

export const PostRouteModal: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const id = params.id || (pathParts[0] === 'post' ? pathParts[1] : undefined);
  const { language } = useTranslation();
  const isEs = language === 'es';

  const stateActivity = (location.state as any)?.activity as ActivityCardData | undefined;
  const [activity, setActivity] = useState<ActivityCardData | null>(stateActivity || null);
  const [loading, setLoading] = useState<boolean>(!stateActivity);
  const [error, setError] = useState<string | null>(null);

  const [likesCount, setLikesCount] = useState<number>(stateActivity?.likes_count || 0);
  const [isLiked, setIsLiked] = useState<boolean>(stateActivity?.is_liked_by_me || false);
  const [commentsCount, setCommentsCount] = useState<number>(stateActivity?.comments_count || 0);

  useEffect(() => {
    if (stateActivity) {
      setActivity(stateActivity);
      setLikesCount(stateActivity.likes_count || 0);
      setIsLiked(stateActivity.is_liked_by_me || false);
      setCommentsCount(stateActivity.comments_count || 0);
      setLoading(false);
      return;
    }

    if (!id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient.get(`/social/feed/activity/${id}`)
      .then(res => {
        if (!isMounted) return;
        setActivity(res.data);
        setLikesCount(res.data.likes_count || 0);
        setIsLiked(res.data.is_liked_by_me || false);
        setCommentsCount(res.data.comments_count || 0);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Failed to load activity post:', err);
        setError(isEs ? 'Publicación no encontrada o eliminada' : 'Post not found or deleted');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, stateActivity, isEs]);

  const handleClose = () => {
    const bg = (location.state as any)?.backgroundLocation;
    if (bg) {
      const targetUrl = typeof bg === 'string' ? bg : `${bg.pathname || '/'}${bg.search || ''}${bg.hash || ''}`;
      navigate(targetUrl, { replace: true });
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/social');
    }
  };

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activity) return;

    const prevLiked = isLiked;
    const prevCount = likesCount;

    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await apiClient.post(`/social/activity/${activity.id}/like`);
      setIsLiked(res.data.liked);
      setLikesCount(res.data.likes_count);
    } catch {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <PathdLoader size="medium" message={isEs ? 'Cargando publicación...' : 'Loading post...'} />
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="glass-card"
          style={{
            maxWidth: '450px',
            width: '100%',
            padding: '2rem',
            textAlign: 'center',
            borderRadius: '16px'
          }}
        >
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {error || (isEs ? 'Publicación no disponible' : 'Post not available')}
          </h3>
          <button
            onClick={handleClose}
            className="btn-primary"
            style={{ borderRadius: '20px', padding: '0.6rem 1.5rem' }}
          >
            {isEs ? 'Volver' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ActivityModal
      activity={activity}
      isOpen={true}
      onClose={handleClose}
      likesCount={likesCount}
      isLiked={isLiked}
      onToggleLike={handleToggleLike}
      commentsCount={commentsCount}
      onCommentsCountChange={(cnt) => setCommentsCount(cnt)}
      renderCardBody={(closeBtn) => (
        <SocialActivityCard
          activity={activity}
          isOwnActivity={false}
          onOpenItem={(item) => {
            const targetType = item.item_type || 'movie';
            const targetId = item.external_id || item.id;
            if (targetType && targetId) {
              navigate(`/item/${targetType}/${targetId}`, {
                state: { backgroundLocation: (location.state as any)?.backgroundLocation || location, item }
              });
            }
          }}
          renderOnlyBody={true}
          customCloseButton={closeBtn}
        />
      )}
    />
  );
};
