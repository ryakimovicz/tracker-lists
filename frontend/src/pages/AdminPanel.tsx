import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { ShieldAlert } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await apiClient.get('/admin/reports');
      setReports(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando...</div>;

  return (
    <div className="glass-card" style={{ maxWidth: 800, margin: '2rem auto', textAlign: 'left', padding: '2rem' }}>
      <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldAlert size={28} /> Panel de Administración
      </h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>Gestión de Reportes</p>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '1rem' }}>Reportes Pendientes</h4>
        <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
          {JSON.stringify(reports, null, 2)}
        </pre>
      </div>
    </div>
  );
};
