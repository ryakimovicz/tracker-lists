import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Flame, Star, Compass, Layers } from 'lucide-react';

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', padding: '2rem 0' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.15 }}>
          Cronologías de Lectura, Visualización y Juegos
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', lineHeight: 1.5 }}>
          Crea tus propias guías de orden cronológico, realiza seguimientos de episodios, adopta adiciones de la comunidad y mantén tu biblioteca personal sincronizada en un solo lugar.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
              Ir a mi Estantería <Flame size={18} />
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary" style={{ textDecoration: 'none' }}>
                Empezar Gratis <Flame size={18} />
              </Link>
              <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Iniciar Sesión
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Grids */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2.5rem',
        marginTop: '2rem'
      }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Compass size={24} />
          </div>
          <h3>Multimedios Unificado</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Busca y gestiona libros, mangas, cómics, series de televisión, películas y videojuegos conectando 4 APIs de terceros en un único portal.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Layers size={24} />
          </div>
          <h3>Mods de Comunidad (Additions)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            ¿Falta un especial, novela ligera o episodio de relleno en una guía pública? Inyecta adiciones, compártelas y adopta las de la comunidad con un clic.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', width: 'fit-content' }}>
            <Star size={24} />
          </div>
          <h3>Estantería Flexible (Shelf)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Administra tus estados de consumo (Leyendo, Jugando, Omitido, Completado) con validaciones categóricas rigurosas y sincronización de progreso global.
          </p>
        </div>
      </section>
    </div>
  );
};
