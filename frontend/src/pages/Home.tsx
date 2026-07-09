import React from 'react';

export const Home: React.FC = () => {
  return (
    <div className="glass-card" style={{ maxWidth: 800, margin: '2rem auto', textAlign: 'left' }}>
      <h2>Inicio</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>Feed de actividad y novedades en construcción...</p>
    </div>
  );
};
export default Home;
