import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="glass-card" style={{ maxWidth: 800, margin: '2rem auto', textAlign: 'left' }}>
      <h2>Mi Estantería</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>Bienvenido {user?.username}. Estantería en construcción...</p>
    </div>
  );
};
