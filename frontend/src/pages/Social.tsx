import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

type FilterType = 'all' | 'progress' | 'guides';

export const Social: React.FC = () => {
  const [feed, setFeed] = useState<any[]>([]);
  const [newGuides, setNewGuides] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSocial = async () => {
      try {
        setLoading(true);
        // 1. Fetch Activity
        const activityRes = await apiClient.get('/social/users/feed/activity');
        if (activityRes.data) {
          setFeed(activityRes.data);
        }

        // 2. Fetch New Guides
        const guidesRes = await apiClient.get('/social/lists/feed/social');
        if (guidesRes.data) {
          setNewGuides(guidesRes.data);
        }
      } catch (err) {
        console.error('Failed to fetch social feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSocial();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando actividad...</div>;
  }

  // Combine and sort feed
  let combinedFeed = [];
  
  if (filter === 'all' || filter === 'progress') {
    combinedFeed.push(...feed.map(item => ({ ...item, feedType: 'progress', date: new Date(item.completed_at) })));
  }
  if (filter === 'all' || filter === 'guides') {
    combinedFeed.push(...newGuides.map(list => ({ ...list, feedType: 'new_guide', date: new Date(list.created_at) })));
  }

  combinedFeed.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ 
            background: filter === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'all' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Todo
        </button>
        <button 
          onClick={() => setFilter('progress')}
          style={{ 
            background: filter === 'progress' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'progress' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Progreso
        </button>
        <button 
          onClick={() => setFilter('guides')}
          style={{ 
            background: filter === 'guides' ? 'var(--accent-primary)' : 'transparent',
            color: filter === 'guides' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
          Nuevas Guías
        </button>
      </div>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {combinedFeed.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No hay actividad reciente 😴</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Parece que las personas que sigues no han estado activas. ¡Encuentra nuevos usuarios para seguir!</p>
            <Link to="/explore" style={{ 
              background: 'var(--accent-primary)', 
              color: '#fff', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '8px', 
              textDecoration: 'none',
              fontWeight: 600
            }}>Ir a Explorar</Link>
          </div>
        ) : (
          combinedFeed.map((item, idx) => {
            const onClickHandler = () => {
              if (item.feedType === 'progress' && item.list_id) {
                // If it's a guide-related progress (it has list_id), open the guide
                navigate(`/guide/${item.list_id}`);
              } else if (item.feedType === 'new_guide' && item.id) {
                // If it's a new guide, open the guide
                navigate(`/guide/${item.id}`);
              }
            };
            
            return (
            <div 
              key={idx} 
              className="glass-card activity-card" 
              style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={onClickHandler}
            >
              
              {/* Avatar */}
              <div style={{ 
                width: '48px', height: '48px', 
                borderRadius: '50%', 
                background: 'var(--glass-border)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                {(item.username || item.creator?.username || 'U').charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                
                {item.feedType === 'progress' ? (
                  <>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{item.username}</span> completó <span style={{ fontWeight: 600 }}>{item.item_title}</span>
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                       <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>En la guía: <em>{item.list_title}</em></span>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{item.creator?.username}</span> creó una nueva guía
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                       <h4 style={{ margin: '0 0 0.25rem 0' }}>{item.title}</h4>
                       {item.description && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.description}</p>}
                    </div>
                  </>
                )}

                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.75rem' }}>
                  {item.date.toLocaleString()}
                </span>
              </div>
            </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Social;
