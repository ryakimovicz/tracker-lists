import React from 'react';

export const Recommended: React.FC = () => {
  return (
    <div className="glass-card" style={{ maxWidth: 800, margin: '2rem auto', textAlign: 'left' }}>
      <h2>Guías Recomendadas</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>Explora cronologías populares y destacadas de la comunidad (Próximamente)...</p>
    </div>
  );
};
