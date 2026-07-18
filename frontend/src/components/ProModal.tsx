import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Star, Check, X, Palette, Lock, Crown } from 'lucide-react';
import { apiClient } from '../api/client';

interface ProModalProps {
  onClose: () => void;
}

export const ProModal: React.FC<ProModalProps> = ({ onClose }) => {
  const { language } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const handleTogglePro = async (isPro: boolean) => {
    setLoading(true);
    setErrorMsg('');
    try {
      await apiClient.post('/users/me/mock-pro', { is_pro: isPro });
      await refreshProfile();
      onClose();
    } catch (err) {
      setErrorMsg(language === 'es' ? 'Error al procesar la solicitud.' : 'Error processing request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000,
      padding: '1rem'
    }} onClick={onClose}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
        
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Crown size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pathd Pro
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: '0.5rem 0 0 0' }}>
            {language === 'es' ? 'Desbloquea el verdadero poder de Pathd.' : 'Unlock the true power of Pathd.'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <Palette color="#f59e0b" size={20} style={{ marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0' }}>{language === 'es' ? 'Personalización Extrema' : 'Extreme Customization'}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Elige tu propio color principal (Accent Color) que se reflejará en todo tu perfil y guías para todos los visitantes.' : 'Choose your own accent color that will reflect across your profile and guides for all visitors.'}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <Star color="#f59e0b" size={20} style={{ marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0' }}>{language === 'es' ? 'Destacados Ilimitados' : 'Unlimited Favorites'}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Rompe el límite de 4 destacados en tu perfil. Muestra todas tus obras favoritas sin restricciones.' : 'Break the 4-favorites limit on your profile. Show off all your favorite works without restrictions.'}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <Lock color="#f59e0b" size={20} style={{ marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0' }}>{language === 'es' ? 'Guías Privadas' : 'Private Guides'}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {language === 'es' ? 'Crea guías secretas solo para ti o guías "No Listadas" para compartir solo con quien tú quieras.' : 'Create secret guides just for you, or "Unlisted" guides to share only with whoever you want.'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!user?.is_pro ? (
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 600, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff' }}
              onClick={() => handleTogglePro(true)}
              disabled={loading}
            >
              {loading ? '...' : (language === 'es' ? 'Suscribirse (Demo)' : 'Subscribe (Demo)')}
            </button>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Check size={18} /> {language === 'es' ? '¡Ya eres usuario Pro!' : 'You are a Pro user!'}
              </p>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
                onClick={() => handleTogglePro(false)}
                disabled={loading}
              >
                {loading ? '...' : (language === 'es' ? 'Revertir a Gratuito (Dev)' : 'Revert to Free (Dev)')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
