import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

import { useTranslation } from '../context/LanguageContext';
import {
  ShieldAlert,
  Users,
  Search,
  Crown,
  Star,
  Shield,
  Ban,
  AlertTriangle,
  Gift,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Mail,
  User as UserIcon,
  MessageSquare,
  FileText,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface AdminUser {

  id: number;
  username: string;
  email: string;
  photo_url?: string;
  banner_url?: string;
  created_at: string;
  is_admin: boolean;
  is_vip: boolean;
  is_pro: boolean;
  is_pro_paid: boolean;
  pro_expires_at?: string;
  is_suspended: boolean;
  suspended_until?: string;
  suspension_reason?: string;
  admin_warning?: string;
  admin_warning_at?: string;
  lists_count: number;
}

export const AdminPanel: React.FC = () => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Action states for modal
  const [giftMonths, setGiftMonths] = useState<number>(1);
  const [warningMessage, setWarningMessage] = useState('');
  const [newUserIdInput, setNewUserIdInput] = useState<number | string>('');
  
  // Granular suspension states
  const [suspensionValue, setSuspensionValue] = useState<number>(7);
  const [suspensionUnit, setSuspensionUnit] = useState<'hours' | 'days' | 'weeks' | 'months' | 'years' | 'permanent'>('days');
  const [suspensionReason, setSuspensionReason] = useState('');
  
  // Feedback messages
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning';
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleChangeUserId = () => {
    if (!selectedUser) return;
    const targetId = Number(newUserIdInput);
    if (!targetId || targetId <= 0) {
      setModalFeedback({ type: 'error', text: isEs ? 'Ingresa un ID válido mayor a 0.' : 'Please enter a valid ID greater than 0.' });
      return;
    }
    if (targetId === selectedUser.id) {
      setModalFeedback({ type: 'error', text: isEs ? 'El usuario ya tiene ese ID.' : 'User already has this ID.' });
      return;
    }

    const isChangingSelf = (currentUser?.id === selectedUser.id);
    setConfirmDialog({
      isOpen: true,
      title: isEs ? '¿Reasignar ID de Usuario?' : 'Reassign User ID?',
      message: isEs
        ? `¿Confirmas reasignar al usuario "${selectedUser.username}" del ID #${selectedUser.id} al nuevo ID #${targetId}? ${isChangingSelf ? 'Al cambiar tu propio ID se cerrará tu sesión para que inicies con tus nuevos datos.' : 'Todas sus guías, biblioteca, favoritos y progreso se reasignarán en cascada de forma segura.'}`
        : `Confirm reassigning user "${selectedUser.username}" from ID #${selectedUser.id} to new ID #${targetId}? ${isChangingSelf ? 'Changing your own ID will log you out to authenticate with new ID.' : 'All related guides, library, favorites and progress will be safely remapped in cascade.'}`,
      type: 'warning',
      confirmText: isEs ? 'Reasignar ID' : 'Reassign ID',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          const res = await apiClient.post(`/admin/users/${selectedUser.id}/change-id`, { new_id: targetId });
          
          if (res.data.is_self || isChangingSelf) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return;
          }

          const updated = { ...selectedUser, id: targetId };
          setSelectedUser(updated);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
          setNewUserIdInput('');
          setModalFeedback({ type: 'success', text: isEs ? `ID de usuario actualizado a #${targetId} exitosamente.` : `User ID updated to #${targetId} successfully.` });
        } catch (err: any) {
          setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error changing User ID.' });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };



  useEffect(() => {
    fetchUsers();
    fetchReports();
  }, []);

  const fetchUsers = async (query = searchQuery) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users', { params: { q: query, limit: 100 } });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await apiClient.get('/admin/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(searchQuery);
  };

  const handleOpenUserModal = (user: AdminUser) => {
    setSelectedUser(user);
    setNewUserIdInput(user.id);
    setWarningMessage(user.admin_warning || '');
    setSuspensionReason(user.suspension_reason || '');
    setGiftMonths(1);
    setSuspensionValue(7);
    setSuspensionUnit('days');
    setModalFeedback(null);
  };


  // Actions
  const handleToggleVip = async () => {
    if (!selectedUser || selectedUser.is_admin) return;
    setActionLoading(true);
    try {
      const newVip = !selectedUser.is_vip;
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/vip`, { is_vip: newVip });
      const updated = { ...selectedUser, is_vip: res.data.is_vip, is_pro: res.data.is_pro };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setModalFeedback({
        type: 'success',
        text: isEs ? `Estado VIP ${newVip ? 'habilitado' : 'removido'} con éxito.` : `VIP status ${newVip ? 'enabled' : 'removed'} successfully.`
      });
    } catch (err: any) {
      setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error updating VIP status.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGiftPro = async () => {
    if (!selectedUser || giftMonths <= 0) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/grant-pro`, { months: Number(giftMonths) });
      const updated = { ...selectedUser, is_pro: res.data.is_pro, pro_expires_at: res.data.pro_expires_at };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setModalFeedback({
        type: 'success',
        text: isEs ? `Se regalaron ${giftMonths} mes(es) de Premium con éxito.` : `Successfully gifted ${giftMonths} month(s) of Premium.`
      });
    } catch (err: any) {
      setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error granting Premium.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelUserSubscription = () => {
    if (!selectedUser || selectedUser.is_admin || selectedUser.is_vip) return;
    setConfirmDialog({
      isOpen: true,
      title: isEs ? '¿Cancelar Suscripción?' : 'Cancel Subscription?',
      message: isEs
        ? `¿Estás seguro de que deseas cancelar la suscripción Premium de "${selectedUser.username}"? Se detendrán los cobros automáticos en Dodo Payments.`
        : `Are you sure you want to cancel the Premium subscription for "${selectedUser.username}"? Auto-billing will be stopped in Dodo Payments.`,
      type: 'warning',
      confirmText: isEs ? 'Cancelar Suscripción' : 'Cancel Subscription',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          const res = await apiClient.post(`/admin/users/${selectedUser.id}/cancel-subscription`);
          const updated = {
            ...selectedUser,
            is_pro: res.data.is_pro,
            pro_expires_at: undefined
          };
          setSelectedUser(updated);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
          setModalFeedback({
            type: 'success',
            text: isEs ? `Suscripción de "${selectedUser.username}" cancelada exitosamente.` : `Subscription for "${selectedUser.username}" cancelled successfully.`
          });
        } catch (err: any) {
          setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error cancelling subscription.' });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleSendWarning = async () => {
    if (!selectedUser || !warningMessage.trim()) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/warn`, { message: warningMessage });
      const updated = { ...selectedUser, admin_warning: res.data.admin_warning };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setModalFeedback({
        type: 'success',
        text: isEs ? 'Alerta/Advertencia enviada al usuario.' : 'Warning alert sent to user.'
      });
    } catch (err: any) {
      setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error sending warning.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setModalFeedback(null);
    try {
      const payload: any = {
        value: suspensionValue,
        unit: suspensionUnit,
        reason: suspensionReason.trim() || undefined
      };
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/suspend`, payload);
      const updated = {
        ...selectedUser,
        is_suspended: res.data.is_suspended,
        suspended_until: res.data.suspended_until,
        suspension_reason: res.data.suspension_reason
      };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setModalFeedback({
        type: 'success',
        text: isEs ? `Usuario "${selectedUser.username}" suspendido correctamente.` : `User "${selectedUser.username}" suspended successfully.`
      });
      setSuspensionReason('');
    } catch (err: any) {
      setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error suspending user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspendUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setModalFeedback(null);
    try {
      const res = await apiClient.post(`/admin/users/${selectedUser.id}/unsuspend`);
      const updated = {
        ...selectedUser,
        is_suspended: res.data.is_suspended,
        suspended_until: undefined,
        suspension_reason: undefined
      };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      setModalFeedback({
        type: 'success',
        text: isEs ? `Suspensión de "${selectedUser.username}" removida.` : `Suspension for "${selectedUser.username}" removed.`
      });
    } catch (err: any) {
      setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error removing suspension.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    setConfirmDialog({
      isOpen: true,
      title: isEs ? '¿Eliminar Usuario Permanentemente?' : 'Permanently Delete User?',
      message: isEs
        ? `¿Estás seguro de que deseas eliminar permanentemente al usuario "${selectedUser.username}"? Esta acción no se puede deshacer.`
        : `Are you sure you want to permanently delete user "${selectedUser.username}"? This cannot be undone.`,
      type: 'danger',
      confirmText: isEs ? 'Eliminar Usuario' : 'Delete User',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          await apiClient.delete(`/admin/users/${selectedUser.id}`);
          setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
          setSelectedUser(null);
        } catch (err: any) {
          setModalFeedback({ type: 'error', text: err.response?.data?.detail || 'Error deleting user.' });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleDeleteReportItem = async (type: 'list' | 'comment' | 'review', id: number) => {
    try {
      if (type === 'list') await apiClient.delete(`/admin/lists/${id}`);
      if (type === 'comment') await apiClient.delete(`/admin/comments/${id}`);
      if (type === 'review') await apiClient.delete(`/admin/reviews/${id}`);
      fetchReports();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem', textAlign: 'left' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '1.75rem 2rem', borderRadius: 16, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldAlert size={28} color="#ef4444" /> {isEs ? 'Panel de Administración' : 'Admin Dashboard'}
            </h1>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {isEs ? 'Gestión centralizada de usuarios, privilegios VIP, Premium y moderación.' : 'Centralized management for users, VIP status, Premium perks, and moderation.'}
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.3rem', borderRadius: 12 }}>
            <button
              onClick={() => setActiveTab('users')}
              className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: 8 }}
            >
              <Users size={16} /> {isEs ? 'Usuarios' : 'Users'} ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: 8 }}
            >
              <ShieldAlert size={16} /> {isEs ? 'Reportes' : 'Reports'}
            </button>
          </div>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>

          {/* Search bar and refresh */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 280, display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={isEs ? 'Buscar por usuario o email...' : 'Search by username or email...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', paddingLeft: '2.5rem', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '0 1.25rem' }}>
                {isEs ? 'Buscar' : 'Search'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => fetchUsers(searchQuery)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title={isEs ? 'Recargar lista' : 'Reload list'}
            >
              <RefreshCw size={16} /> {isEs ? 'Actualizar' : 'Refresh'}
            </button>
          </div>

          {/* Users List Grid */}
          {loading ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <div>{isEs ? 'Cargando usuarios...' : 'Loading users...'}</div>
            </div>
          ) : users.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              {isEs ? 'No se encontraron usuarios coincidentes.' : 'No matching users found.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {users.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleOpenUserModal(u)}
                  className="glass-card"
                  style={{
                    padding: '1.25rem',
                    borderRadius: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: u.is_suspended ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-color)',
                    background: u.is_suspended ? 'rgba(239, 68, 68, 0.05)' : undefined
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = u.is_suspended ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-color)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '0.8rem' }}>
                    {u.photo_url ? (
                      <img src={u.photo_url} alt={u.username} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {u.is_admin && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Shield size={10} /> ADMIN
                      </span>
                    )}

                    {u.is_vip && (
                      <span style={{ fontSize: '0.7rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Crown size={10} fill="white" /> VIP
                      </span>
                    )}

                    {u.is_pro && (
                      <span style={{ fontSize: '0.7rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Star size={10} fill="white" /> PREMIUM
                      </span>
                    )}

                    {u.is_suspended && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Ban size={10} /> {isEs ? 'SUSPENDIDO' : 'SUSPENDED'}
                      </span>
                    )}

                    {u.admin_warning && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <AlertTriangle size={10} /> {isEs ? 'ALERTA' : 'WARNED'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <span>ID: #{u.id} • {u.lists_count} {isEs ? 'listas' : 'lists'}</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{isEs ? 'Gestionar →' : 'Manage →'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="glass-card" style={{ padding: '2rem', borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} color="#ef4444" /> {isEs ? 'Reportes Pendientes de Moderación' : 'Pending Content Reports'}
          </h3>

          {!reports || (!reports.lists?.length && !reports.comments?.length && !reports.reviews?.length) ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              {isEs ? 'No hay reportes pendientes. ¡Todo en orden!' : 'No pending reports. Everything is clean!'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {reports.lists?.map((r: any) => (
                <div key={r.report_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={16} color="var(--accent-primary)" /> Lista #{r.list_id}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Motivo: {r.reason} • Por: @{r.reporter_username}</div>
                  </div>
                  <button onClick={() => handleDeleteReportItem('list', r.list_id)} className="btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                    <Trash2 size={14} /> Eliminar Lista
                  </button>
                </div>
              ))}

              {reports.comments?.map((r: any) => (
                <div key={r.report_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MessageSquare size={16} color="var(--accent-primary)" /> Comentario #{r.comment_id}: "{r.comment_content}"
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Motivo: {r.reason} • Por: @{r.reporter_username}</div>
                  </div>
                  <button onClick={() => handleDeleteReportItem('comment', r.comment_id)} className="btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                    <Trash2 size={14} /> Eliminar Comentario
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Actions Modal */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 600,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 20,
              padding: '2rem',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedUser(null)}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
              {selectedUser.photo_url ? (
                <img src={selectedUser.photo_url} alt={selectedUser.username} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.4rem' }}>
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedUser.username}
                  {selectedUser.is_admin && <span style={{ fontSize: '0.7rem', background: '#ef4444', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 4 }}>ADMIN</span>}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedUser.email} • ID #{selectedUser.id}</div>
              </div>
            </div>

            {/* Feedback Alert */}
            {modalFeedback && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  marginBottom: '1.25rem',
                  background: modalFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: modalFeedback.type === 'success' ? '#10b981' : '#ef4444',
                  border: `1px solid ${modalFeedback.type === 'success' ? '#10b981' : '#ef4444'}`
                }}
              >
                {modalFeedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{modalFeedback.text}</span>
              </div>
            )}

            {/* Action Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Action 0: Reasignar ID de Usuario */}
              <div style={{ background: 'rgba(124, 58, 237, 0.08)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', marginBottom: '0.3rem' }}>
                  <Sparkles size={16} /> {isEs ? 'Reasignar ID de Usuario' : 'Reassign User ID'}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {isEs 
                    ? 'Reasigna el ID numérico de este usuario. Todas sus guías creadas, biblioteca, favoritos y progreso se actualizarán en cascada sin pérdida de datos.' 
                    : 'Reassign this user’s numeric ID. All relational guides, library, favorites and progress will be safely remapped in cascade.'}
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID:</span>
                    <input
                      type="number"
                      min={1}
                      value={newUserIdInput}
                      onChange={e => setNewUserIdInput(e.target.value)}
                      className="input-field"
                      style={{ width: '100%', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
                      placeholder="Nuevo ID..."
                    />
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading || !newUserIdInput || Number(newUserIdInput) === selectedUser.id}
                    onClick={handleChangeUserId}
                    className="btn-primary"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 1.25rem', whiteSpace: 'nowrap' }}
                  >
                    {isEs ? 'Guardar ID' : 'Save ID'}
                  </button>
                </div>
              </div>

              {/* Action 1: VIP Toggle (Disabled on Admins) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: selectedUser.is_admin ? 0.6 : 1 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a78bfa' }}>
                    <Crown size={16} /> {isEs ? 'Estatus VIP' : 'VIP Status'}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {selectedUser.is_admin
                      ? (isEs ? 'Los administradores ya poseen todos los beneficios y no requieren VIP.' : 'Admins already possess all perks and do not need VIP.')
                      : (isEs ? 'Habilita todas las funciones Premium gratis. Insignia VIP visible solo para Admins y VIPs.' : 'Unlocks all Premium features for free. VIP badge visible only to Admins & VIPs.')}
                  </div>
                </div>

                {!selectedUser.is_admin && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleToggleVip}
                    className={selectedUser.is_vip ? 'btn-secondary' : 'btn-primary'}
                    style={{
                      background: selectedUser.is_vip ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      color: selectedUser.is_vip ? '#ef4444' : 'white',
                      borderColor: selectedUser.is_vip ? '#ef4444' : 'transparent',
                      fontSize: '0.85rem',
                      padding: '0.45rem 1rem',
                      flexShrink: 0
                    }}
                  >
                    {selectedUser.is_vip ? (isEs ? 'Quitar VIP' : 'Otorgar VIP') : (isEs ? 'Otorgar VIP' : 'Grant VIP')}
                  </button>
                )}
              </div>

              {/* Action 2: Regalar Premium con input numérico manual */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--border-color)', opacity: (selectedUser.is_admin || selectedUser.is_vip) ? 0.7 : 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', marginBottom: '0.3rem' }}>
                  <Gift size={16} /> {isEs ? 'Regalar Suscripción Premium' : 'Gift Premium Access'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: (!selectedUser.is_admin && !selectedUser.is_vip) ? '0.75rem' : '0' }}>
                  {selectedUser.is_admin
                    ? (isEs ? 'Los administradores ya poseen todos los beneficios de Premium de forma permanente.' : 'Admins already possess all Premium perks permanently.')
                    : selectedUser.is_vip
                    ? (isEs ? 'Los usuarios VIP ya poseen todos los beneficios de Premium de forma gratuita.' : 'VIP users already possess all Premium perks for free.')
                    : selectedUser.pro_expires_at
                    ? (isEs ? `Actualmente tiene Premium hasta el ${new Date(selectedUser.pro_expires_at).toLocaleDateString()}` : `Currently has Premium until ${new Date(selectedUser.pro_expires_at).toLocaleDateString()}`)
                    : (isEs ? 'Ingresa la cantidad exacta de meses que deseas otorgar:' : 'Enter the exact amount of months you want to gift:')}
                </div>

                {!selectedUser.is_admin && !selectedUser.is_vip && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Preset quick buttons */}
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {[1, 3, 6, 12].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setGiftMonths(m)}
                          style={{
                            background: giftMonths === m ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: giftMonths === m ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                            color: giftMonths === m ? '#f59e0b' : 'var(--text-secondary)',
                            borderRadius: 6,
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>

                    {/* Manual input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 140 }}>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={giftMonths}
                        onChange={e => setGiftMonths(Math.max(1, parseInt(e.target.value) || 1))}
                        className="input-field"
                        style={{ width: '70px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{isEs ? 'meses' : 'months'}</span>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading || giftMonths <= 0}
                      onClick={handleGiftPro}
                      className="btn-primary"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.85rem', padding: '0.45rem 1.2rem', whiteSpace: 'nowrap' }}
                    >
                      {isEs ? 'Regalar' : 'Gift Pro'}
                    </button>
                  </div>
                )}
              </div>


              {/* Action 2.5: Cancelar Suscripción Premium del Usuario (Solo si tiene Pro y no es Admin ni VIP) */}
              {selectedUser.is_pro && !selectedUser.is_admin && !selectedUser.is_vip && (
                <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444' }}>
                      <Star size={16} /> {isEs ? 'Cancelar Suscripción Premium' : 'Cancel Premium Subscription'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {isEs
                        ? 'Detiene la renovación automática en Dodo Payments y anula futuros cobros del usuario.'
                        : 'Stops automatic renewal in Dodo Payments and prevents future billing for this user.'}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleCancelUserSubscription}
                    className="btn-secondary"
                    style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                  >
                    {isEs ? 'Cancelar Suscripción' : 'Cancel Subscription'}
                  </button>
                </div>
              )}

              {/* Action 3: Enviar Alerta / Advertencia */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', marginBottom: '0.3rem' }}>
                  <AlertTriangle size={16} /> {isEs ? 'Enviar Alerta de Moderación' : 'Send Moderation Warning'}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {isEs ? 'Muestra un banner destacado en el perfil del usuario advirtiéndole sobre alguna infracción.' : 'Displays a prominent warning banner on the user’s profile.'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <textarea
                    rows={2}
                    placeholder={isEs ? 'Escribe el motivo del aviso (ej: Por favor respeta las normas en los comentarios)...' : 'Write the warning notice reason...'}
                    value={warningMessage}
                    onChange={e => setWarningMessage(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: '0.85rem' }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      disabled={actionLoading || !warningMessage.trim() || selectedUser.is_admin}
                      onClick={handleSendWarning}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', color: '#f59e0b', borderColor: '#f59e0b' }}
                    >
                      {isEs ? 'Enviar Advertencia' : 'Send Warning'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action 4: Suspender con duración manual flexible */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', marginBottom: '0.3rem' }}>
                  <Ban size={16} /> {isEs ? 'Suspensión de Cuenta' : 'Account Suspension'}
                </div>

                {selectedUser.is_suspended ? (
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#ef4444', margin: '0.5rem 0' }}>
                      <strong>{isEs ? 'Actualmente suspendido' : 'Currently suspended'}</strong>
                      {selectedUser.suspended_until ? ` (${isEs ? 'Hasta' : 'Until'} ${new Date(selectedUser.suspended_until).toLocaleString()})` : ` (${isEs ? 'Permanente' : 'Permanent'})`}
                      {selectedUser.suspension_reason && <div style={{ marginTop: '0.2rem', color: 'var(--text-secondary)' }}>{isEs ? 'Motivo:' : 'Reason:'} {selectedUser.suspension_reason}</div>}
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleUnsuspendUser}
                      className="btn-primary"
                      style={{ background: '#10b981', fontSize: '0.85rem', padding: '0.45rem 1.2rem', marginTop: '0.5rem' }}
                    >
                      {isEs ? 'Levantar Suspensión' : 'Remove Suspension'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {isEs ? 'Configura la duración exacta a mano o aplica una sanción permanente:' : 'Set custom duration manually or apply permanent suspension:'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {/* Duration selector */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {suspensionUnit !== 'permanent' && (
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={suspensionValue}
                            onChange={e => setSuspensionValue(Math.max(1, parseInt(e.target.value) || 1))}
                            className="input-field"
                            style={{ width: '80px', padding: '0.45rem 0.6rem', fontSize: '0.85rem', textAlign: 'center' }}
                          />
                        )}

                        <select
                          value={suspensionUnit}
                          onChange={e => setSuspensionUnit(e.target.value as any)}
                          className="input-field"
                          style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem', flex: 1, minWidth: 140 }}
                        >
                          <option value="hours">{isEs ? 'Hora(s)' : 'Hour(s)'}</option>
                          <option value="days">{isEs ? 'Día(s)' : 'Day(s)'}</option>
                          <option value="weeks">{isEs ? 'Semana(s)' : 'Week(s)'}</option>
                          <option value="months">{isEs ? 'Mes(es)' : 'Month(s)'}</option>
                          <option value="years">{isEs ? 'Año(s)' : 'Year(s)'}</option>
                          <option value="permanent">{isEs ? '⛔ Permanente (Indefinida)' : '⛔ Permanent (Indefinite)'}</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        placeholder={isEs ? 'Motivo de la suspensión (ej: Spam, lenguaje inapropiado)...' : 'Reason for suspension...'}
                        value={suspensionReason}
                        onChange={e => setSuspensionReason(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          disabled={actionLoading || selectedUser.is_admin}
                          onClick={handleSuspendUser}
                          className="btn-secondary"
                          style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.85rem', padding: '0.45rem 1.2rem' }}
                        >
                          {isEs ? 'Suspender Usuario' : 'Suspend User'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action 5: Eliminar Cuenta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>


                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isEs ? 'Acción irreversible' : 'Irreversible action'}
                </div>
                <button
                  type="button"
                  disabled={actionLoading || selectedUser.is_admin}
                  onClick={handleDeleteUser}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: selectedUser.is_admin ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: selectedUser.is_admin ? 0.4 : 1
                  }}
                >
                  <Trash2 size={15} /> {isEs ? 'Eliminar cuenta permanentemente' : 'Permanently delete account'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Modal */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          type={confirmDialog.type || 'warning'}
          isLoading={actionLoading}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default AdminPanel;
