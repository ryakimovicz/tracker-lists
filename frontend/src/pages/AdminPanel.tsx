import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Check, X, ShieldAlert } from 'lucide-react';

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

  const handleUpdateStatus = async (reportId: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.put(`/admin/reports/covers/${reportId}`, { status });
      fetchReports();
    } catch(err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando...</div>;

  return (
    <div className="glass-card" style={{ maxWidth: 800, margin: '2rem auto', textAlign: 'left', padding: '2rem' }}>
      <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldAlert size={28} /> Panel de Administración
      </h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>Reportes de portadas NSFW</p>
      
      {reports?.covers && reports.covers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.covers.map((r: any) => (
            <div key={r.report_id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>Reporte #{r.report_id}</strong> - {r.item_type} ({r.external_id})
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Reportado por: {r.reporter_username} el {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                    Estado actual: <strong style={{ color: r.status === 'APPROVED' ? '#ef4444' : r.status === 'REJECTED' ? '#10b981' : '#f59e0b' }}>{r.status}</strong>
                  </div>
                </div>
                
                {r.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleUpdateStatus(r.report_id, 'APPROVED')} className="btn-primary" style={{ background: '#ef4444', padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={16} /> Aprobar (Desenfocar)
                    </button>
                    <button onClick={() => handleUpdateStatus(r.report_id, 'REJECTED')} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <X size={16} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No hay reportes pendientes.</p>
      )}
    </div>
  );
};
