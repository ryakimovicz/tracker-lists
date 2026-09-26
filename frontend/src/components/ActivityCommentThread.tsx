import React, { useState, useEffect, useRef } from 'react';
import { Send, Reply, Trash2, ThumbsUp, Image as ImageIcon, Flag } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { KlipyPicker } from './KlipyPicker';
import type { SelectedKlipyMedia } from './KlipyPicker';
import { MediaAttachmentView } from './ItemDetailsModal';
import { renderFormattedContentWithMentions, AuthorUsername } from './MentionTag';

export interface ActivityCommentItem {
  id: number;
  activity_id: number;
  user_id: number;
  username: string;
  photo_url?: string | null;
  parent_id?: number | null;
  content?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  audio_url?: string | null;
  is_deleted?: boolean;
  votes_count: number;
  is_voted_by_me: boolean;
  created_at: string;
  replies?: ActivityCommentItem[];
}

interface ActivityCommentThreadProps {
  activityId: number;
  onCommentsCountChange?: (count: number) => void;
}

export const ActivityCommentThread: React.FC<ActivityCommentThreadProps> = ({
  activityId,
  onCommentsCountChange
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [comments, setComments] = useState<ActivityCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedKlipyMedia | null>(null);
  const [showKlipy, setShowKlipy] = useState(false);

  // Replying
  const [replyTarget, setReplyTarget] = useState<{ id: number; username: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMedia, setReplyMedia] = useState<SelectedKlipyMedia | null>(null);
  const [showReplyKlipy, setShowReplyKlipy] = useState(false);

  const countTotal = (items: ActivityCommentItem[]): number => {
    let count = 0;
    for (const item of items) {
      count += 1;
      if (item.replies && item.replies.length > 0) {
        count += countTotal(item.replies);
      }
    }
    return count;
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/social/activity/${activityId}/comments`);
      if (Array.isArray(res.data)) {
        setComments(res.data);
        if (onCommentsCountChange) {
          onCommentsCountChange(countTotal(res.data));
        }
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [activityId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !selectedMedia) return;

    try {
      setSubmitting(true);
      await apiClient.post(`/social/activity/${activityId}/comments`, {
        content: text.trim() || null,
        parent_id: null,
        media_url: selectedMedia?.url || null,
        media_type: selectedMedia?.type || null,
        audio_url: (selectedMedia?.type === 'clip' ? selectedMedia.url : null)
      });
      setText('');
      setSelectedMedia(null);
      await fetchComments();
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent, parentId: number) => {
    e.preventDefault();
    if (!replyText.trim() && !replyMedia) return;

    try {
      setSubmitting(true);
      await apiClient.post(`/social/activity/${activityId}/comments`, {
        content: replyText.trim() || null,
        parent_id: parentId,
        media_url: replyMedia?.url || null,
        media_type: replyMedia?.type || null,
        audio_url: (replyMedia?.type === 'clip' ? replyMedia.url : null)
      });
      setReplyText('');
      setReplyMedia(null);
      setReplyTarget(null);
      await fetchComments();
    } catch (err) {
      console.error('Error replying:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateVoteInTree = (nodes: ActivityCommentItem[], commentId: number, voted: boolean, votesCount: number): ActivityCommentItem[] => {
    return nodes.map(n => {
      if (n.id === commentId) {
        return { ...n, is_voted_by_me: voted, votes_count: votesCount };
      }
      if (n.replies && n.replies.length > 0) {
        return {
          ...n,
          replies: updateVoteInTree(n.replies, commentId, voted, votesCount)
        };
      }
      return n;
    });
  };

  const handleVoteComment = async (commentId: number) => {
    try {
      const res = await apiClient.post(`/social/comments/${commentId}/vote`);
      setComments(prev => updateVoteInTree(prev, commentId, res.data.voted, res.data.votes_count));
    } catch (err) {
      console.error('Error voting comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiClient.delete(`/social/comments/${commentId}`);
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleReportComment = async (commentId: number) => {
    if (!user) return;
    const promptMsg = isEs ? '¿Por qué deseas reportar este comentario? (mínimo 5 caracteres)' : 'Why are you reporting this comment? (minimum 5 characters)';
    const reason = window.prompt(promptMsg);
    if (!reason || reason.trim().length < 5) return;
    try {
      await apiClient.post(`/social/activity/comments/${commentId}/report`, { reason: reason.trim() });
      alert(isEs ? 'Reporte enviado exitosamente.' : 'Report submitted successfully.');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        alert(err.response.data.detail);
      } else {
        alert(isEs ? 'Error al enviar reporte.' : 'Failed to submit report.');
      }
    }
  };

  const replyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (replyTarget && replyInputRef.current) {
      replyInputRef.current.focus();
      const len = replyInputRef.current.value.length;
      replyInputRef.current.setSelectionRange(len, len);
    }
  }, [replyTarget?.id]);

  const getAllDescendantReplies = (comment: ActivityCommentItem): ActivityCommentItem[] => {
    const list: ActivityCommentItem[] = [];
    const traverse = (node: ActivityCommentItem) => {
      if (node.replies && node.replies.length > 0) {
        for (const child of node.replies) {
          list.push(child);
          traverse(child);
        }
      }
    };
    traverse(comment);
    return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const renderSingleComment = (item: ActivityCommentItem, isChild = false) => {
    const isReplyingThis = replyTarget?.id === item.id;
    const canDelete = user && (user.id === item.user_id || user.is_admin);

    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.65rem 0'
        }}
      >
        {/* Avatar */}
        {item.is_deleted ? (
          <div
            style={{
              width: isChild ? '28px' : '34px',
              height: isChild ? '28px' : '34px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isChild ? '0.75rem' : '0.85rem',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            ?
          </div>
        ) : item.photo_url ? (
          <img
            src={item.photo_url}
            alt={item.username}
            style={{ width: isChild ? '28px' : '34px', height: isChild ? '28px' : '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: isChild ? '28px' : '34px',
              height: isChild ? '28px' : '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isChild ? '0.75rem' : '0.85rem',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {(item.username || 'U')[0].toUpperCase()}
          </div>
        )}

        {/* Content body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <AuthorUsername
              username={item.username}
              isDeleted={item.is_deleted}
              deletedLabel={isEs ? 'Usuario' : 'User'}
              style={{ fontSize: '0.88rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(item.created_at).toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {item.is_deleted ? (
            <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.86rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {isEs ? 'Comentario eliminado.' : 'Comment deleted.'}
            </p>
          ) : (
            <>
              {item.content && (
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', lineHeight: 1.4, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {renderFormattedContentWithMentions(item.content)}
                </p>
              )}

              {/* Media / GIF / Clip */}
              {item.media_url && (
                <div style={{ margin: '0.45rem 0' }}>
                  <MediaAttachmentView
                    mediaUrl={item.media_url}
                    mediaType={item.media_type}
                    maxWidth="320px"
                    maxHeight="220px"
                    allowPausePlay={true}
                  />
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            {!item.is_deleted && (
              <button
                onClick={() => handleVoteComment(item.id)}
                style={{
                  background: item.is_voted_by_me ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: item.is_voted_by_me ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  color: item.is_voted_by_me ? '#3b82f6' : 'var(--text-muted)',
                  borderRadius: '4px',
                  padding: '0.15rem 0.4rem',
                  fontSize: '0.76rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer'
                }}
              >
                <ThumbsUp size={12} fill={item.is_voted_by_me ? '#3b82f6' : 'none'} />
                <span>{item.votes_count}</span>
              </button>
            )}

            {user && (
              <button
                onClick={() => {
                  if (isReplyingThis) {
                    setReplyTarget(null);
                  } else {
                    const uname = item.is_deleted ? (isEs ? 'Usuario' : 'User') : item.username;
                    setReplyTarget({ id: item.id, username: uname });
                    setReplyText(`@${uname} `);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isReplyingThis ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Reply size={12} />
                <span>{isReplyingThis ? (isEs ? 'Cancelar' : 'Cancel') : (isEs ? 'Responder' : 'Reply')}</span>
              </button>
            )}

            {!item.is_deleted && user && user.id !== item.user_id && (
              <button
                onClick={() => handleReportComment(item.id)}
                title={isEs ? 'Reportar' : 'Report'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.15rem'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f59e0b')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Flag size={12} />
              </button>
            )}

            {!item.is_deleted && canDelete && (
              <button
                onClick={() => handleDeleteComment(item.id)}
                title={isEs ? 'Eliminar' : 'Delete'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.15rem'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Reply form under this specific comment/reply */}
          {isReplyingThis && (
            <form onSubmit={(e) => handlePostReply(e, item.id)} style={{ marginTop: '0.65rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`${isEs ? 'Respondiendo a' : 'Replying to'} @${item.username}...`}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary, rgba(0,0,0,0.2))',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowReplyKlipy(true)}
                  title="KLIPY (GIFs / Memes / Audio)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    padding: '0.35rem'
                  }}
                >
                  <ImageIcon size={18} />
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!replyText.trim() && !replyMedia)}
                  className="btn-primary"
                  style={{ padding: '0.45rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem' }}
                >
                  <Send size={13} />
                </button>
              </div>

              {replyMedia && (
                <div style={{ marginTop: '0.6rem' }}>
                  <MediaAttachmentView
                    mediaUrl={replyMedia.url}
                    mediaType={replyMedia.type}
                    maxWidth="180px"
                    maxHeight="130px"
                    borderAccent
                    isRemovable
                    onRemove={() => setReplyMedia(null)}
                    removeTitle={isEs ? 'Quitar multimedia' : 'Remove media'}
                    allowPausePlay={true}
                  />
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.75rem' }}>
      {/* Input box */}
      {user ? (
        <form onSubmit={handlePostComment} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isEs ? 'Escribe un comentario...' : 'Write a comment...'}
              style={{
                flex: 1,
                padding: '0.55rem 0.9rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary, rgba(0,0,0,0.15))',
                color: 'var(--text-primary)',
                fontSize: '0.88rem'
              }}
            />
            <button
              type="button"
              onClick={() => setShowKlipy(true)}
              title="KLIPY (GIFs / Memes / Audio)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                padding: '0.4rem'
              }}
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="submit"
              disabled={submitting || (!text.trim() && !selectedMedia)}
              className="btn-primary"
              style={{ padding: '0.55rem 1rem', borderRadius: '20px', fontSize: '0.85rem' }}
            >
              <Send size={15} />
            </button>
          </div>

          {selectedMedia && (
            <div style={{ marginTop: '0.6rem' }}>
              <MediaAttachmentView
                mediaUrl={selectedMedia.url}
                mediaType={selectedMedia.type}
                maxWidth="220px"
                maxHeight="160px"
                borderAccent
                isRemovable
                onRemove={() => setSelectedMedia(null)}
                removeTitle={isEs ? 'Quitar multimedia' : 'Remove media'}
                allowPausePlay={true}
              />
            </div>
          )}
        </form>
      ) : (
        <div style={{ padding: '0.6rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isEs ? 'Inicia sesión para comentar.' : 'Log in to comment.'}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isEs ? 'Cargando comentarios...' : 'Loading comments...'}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isEs ? 'Sé el primero en comentar.' : 'Be the first to comment.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comments.map(rootComment => {
            const descendantReplies = getAllDescendantReplies(rootComment);
            return (
              <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Root Comment */}
                {renderSingleComment(rootComment, false)}

                {/* All descendant replies flattened at a single indentation level */}
                {descendantReplies.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      marginLeft: '1.5rem',
                      paddingLeft: '0.85rem',
                      borderLeft: '2px solid var(--border-color)',
                      marginTop: '0.1rem',
                      marginBottom: '0.4rem'
                    }}
                  >
                    {descendantReplies.map(reply => renderSingleComment(reply, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Klipy pickers */}
      {showKlipy && (
        <KlipyPicker
          isOpen={true}
          onClose={() => setShowKlipy(false)}
          onSelectMedia={(m) => {
            setSelectedMedia(m);
            setShowKlipy(false);
          }}
        />
      )}

      {showReplyKlipy && (
        <KlipyPicker
          isOpen={true}
          onClose={() => setShowReplyKlipy(false)}
          onSelectMedia={(m) => {
            setReplyMedia(m);
            setShowReplyKlipy(false);
          }}
        />
      )}
    </div>
  );
};
