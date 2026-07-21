import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

export const Social: React.FC = () => {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSocial = async () => {
      try {
        setLoading(true);
        const activityRes = await apiClient.get('/social/users/feed/activity');
        if (activityRes.data) {
          setFeed(activityRes.data);
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

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {feed.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>No hay actividad reciente 😢</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>Parece que las personas que sigues no han estado activas últimamente. ¡Encuentra nuevos usuarios para seguir!</p>
            <Link to="/explore" style={{ 
              background: 'var(--accent-primary)', 
              color: '#fff', 
              padding: '0.85rem 2rem', 
              borderRadius: '30px', 
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-block',
              transition: 'all 0.2s ease'
            }}>Ir a Explorar</Link>
          </div>
        ) : (
          feed.map((item, idx) => {
            const onClickHandler = () => {
              if (item.list_id) {
                navigate(`/guide/${item.list_id}`);
              } else if (item.external_id) {
                // If it is media without a list_id, navigate to media page
                // We'd need the item type, assuming it's movie/series/game etc
                // For simplicity, just use external_id if possible
              }
            };

            let actionText = "realizó una acción en";
            let icon = "📝";
            
            if (item.activity_type.startsWith("shelf_")) actionText = "actualizó su estantería con";
            if (item.activity_type === "shelf_add") actionText = "agregó a su biblioteca";
            if (item.activity_type === "shelf_favorite") actionText = "marcó como favorito a";
            if (item.activity_type === "item_completed") { actionText = "marcó como completado"; icon = "✅"; }
            if (item.activity_type === "guide_created") { actionText = "creó una nueva guía"; icon = "✨"; }
            if (item.activity_type === "guide_followed") { actionText = "empezó a seguir la guía"; icon = "📌"; }
            if (item.activity_type === "item_added") { actionText = "agregó un elemento a la guía"; icon = "➕"; }
            
            return (
            <div 
              key={idx} 
              className="glass-card activity-card" 
              style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                gap: '1.25rem', 
                alignItems: 'flex-start', 
                cursor: 'pointer',
                transition: 'transform 0.2s, background 0.2s'
              }}
              onClick={onClickHandler}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              
              {/* Avatar */}
              <div style={{ 
                width: '50px', height: '50px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '1.5rem',
                color: '#fff',
                fontWeight: 'bold',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}>
                {(item.username || 'U').charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{item.username}</span> {actionText} <span style={{ fontWeight: 700 }}>{item.item_title}</span> {icon}
                  </p>
                  
                  {/* Rich Content Box */}
                  {(item.image_url || item.details) && (
                    <div style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--glass-border)',
                      padding: '1rem', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      gap: '1rem', 
                      alignItems: 'center',
                      marginTop: '0.75rem'
                    }}>
                       {item.image_url && (
                         <img 
                           src={item.image_url} 
                           alt="Cover" 
                           style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                         />
                       )}
                       <div style={{flex: 1}}>
                         {item.details && (
                           <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                             "{item.details}"
                           </p>
                         )}
                       </div>
                    </div>
                  )}

                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '1rem', fontWeight: 500 }}>
                  {new Date(item.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
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
