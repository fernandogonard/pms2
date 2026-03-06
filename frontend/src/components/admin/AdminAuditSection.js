// components/admin/AdminAuditSection.js
// Sección de historial de auditoría — quién hizo qué y cuándo

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';

const ACTION_LABELS = {
  RESERVA_CREADA: '📅 Reserva Creada',
  RESERVA_EDITADA: '✏️ Reserva Editada',
  RESERVA_CANCELADA: '❌ Reserva Cancelada',
  RESERVA_ELIMINADA: '🗑️ Reserva Eliminada',
  CHECKIN_REALIZADO: '🏨 Check-In',
  CHECKOUT_REALIZADO: '🚪 Check-Out',
  PAGO_PROCESADO: '💳 Pago Procesado',
  CARGO_AGREGADO: '➕ Cargo Extra',
  HABITACION_EDITADA: '🛏️ Habitación Editada',
  HABITACION_ESTADO_CAMBIADO: '🔄 Estado Habitación',
  CLIENTE_CREADO: '👤 Cliente Creado',
  CLIENTE_EDITADO: '✏️ Cliente Editado',
  CLIENTE_ELIMINADO: '🗑️ Cliente Eliminado',
  USUARIO_CREADO: '⚙️ Usuario Creado',
  USUARIO_EDITADO: '⚙️ Usuario Editado',
  USUARIO_ELIMINADO: '⚙️ Usuario Eliminado',
  LOGIN: '🔐 Login',
  LOGOUT: '🔒 Logout',
  PRECIO_ACTUALIZADO: '💰 Precio Actualizado',
  OTRO: '📌 Otro'
};

const ACTION_COLORS = {
  RESERVA_CREADA: '#22c55e',
  RESERVA_EDITADA: '#3b82f6',
  RESERVA_CANCELADA: '#ef4444',
  RESERVA_ELIMINADA: '#ef4444',
  CHECKIN_REALIZADO: '#0099ff',
  CHECKOUT_REALIZADO: '#a855f7',
  PAGO_PROCESADO: '#22c55e',
  CARGO_AGREGADO: '#f59e0b',
  HABITACION_EDITADA: '#3b82f6',
  HABITACION_ESTADO_CAMBIADO: '#f59e0b',
  CLIENTE_CREADO: '#22c55e',
  CLIENTE_EDITADO: '#3b82f6',
  CLIENTE_ELIMINADO: '#ef4444',
  USUARIO_CREADO: '#22c55e',
  USUARIO_EDITADO: '#3b82f6',
  USUARIO_ELIMINADO: '#ef4444',
  LOGIN: '#0099ff',
  LOGOUT: '#6b7280',
  PRECIO_ACTUALIZADO: '#f59e0b',
  OTRO: '#6b7280'
};

const AdminAuditSection = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  // Filtros
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [actionOptions, setActionOptions] = useState([]);

  const today = new Date().toISOString().slice(0, 10);

  const loadLogs = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterAction)   params.append('action', filterAction);
      if (filterUser)     params.append('userEmail', filterUser);
      if (filterDateFrom) params.append('dateFrom', filterDateFrom);
      if (filterDateTo)   params.append('dateTo', filterDateTo);

      const r = await apiFetch(`/api/audit?${params.toString()}`);
      const data = await r.json();
      if (data.success) {
        setLogs(data.data || []);
        setPagination(data.pagination || { total: 0, page: 1, pages: 1 });
      } else {
        setError(data.message || 'Error cargando logs');
      }
    } catch { setError('Error de red al cargar historial'); }
    finally { setLoading(false); }
  }, [filterAction, filterUser, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadLogs(1);
    // Cargar estadísticas
    apiFetch('/api/audit/stats').then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); }).catch(() => {});
    // Cargar tipos de acción
    apiFetch('/api/audit/actions').then(r => r.json())
      .then(d => { if (d.success) setActionOptions(d.data || []); }).catch(() => {});
  }, [loadLogs]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadLogs(1);
  };

  const handleClearFilters = () => {
    setFilterAction(''); setFilterUser('');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  const fmtDate = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>📜 Historial de Auditoría</h2>
        <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Registro completo de todas las acciones realizadas en el sistema</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard icon="📋" label="Acciones Hoy" value={stats.totalToday} color="#0099ff" />
          <StatCard icon="📊" label="Total Registros" value={stats.totalAll} color="#a855f7" />
          {(stats.byAction || []).slice(0, 2).map(a => (
            <StatCard key={a._id} icon={ACTION_LABELS[a._id]?.split(' ')[0] || '•'} label={ACTION_LABELS[a._id]?.slice(2) || a._id} value={a.count} color={ACTION_COLORS[a._id] || '#6b7280'} />
          ))}
        </div>
      )}

      {/* Filtros */}
      <form onSubmit={handleSearch} style={{
        background: '#1a1a2e', border: '1px solid #333', borderRadius: 12,
        padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#9ca3af', fontSize: 11 }}>Acción</label>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            style={{ background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 180 }}>
            <option value="">Todas las acciones</option>
            {actionOptions.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#9ca3af', fontSize: 11 }}>Usuario</label>
          <input type="text" placeholder="Email del usuario" value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            style={{ background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: 180 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#9ca3af', fontSize: 11 }}>Desde</label>
          <input type="date" value={filterDateFrom} max={today} onChange={e => setFilterDateFrom(e.target.value)}
            style={{ background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#9ca3af', fontSize: 11 }}>Hasta</label>
          <input type="date" value={filterDateTo} max={today} onChange={e => setFilterDateTo(e.target.value)}
            style={{ background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
        </div>
        <button type="submit" style={{ background: '#0099ff', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          🔍 Filtrar
        </button>
        <button type="button" onClick={handleClearFilters}
          style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
          ✕ Limpiar
        </button>
        <button type="button" onClick={() => loadLogs(1)}
          style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
          ↺
        </button>
      </form>

      {/* Conteo */}
      {!loading && (
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
          {pagination.total} registros encontrados · Página {pagination.page} de {pagination.pages}
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 12, fontWeight: 600 }}>{error}</div>}

      {/* Tabla */}
      {loading ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: 60, fontSize: 16 }}>Cargando historial...</div>
      ) : logs.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          No hay registros de auditoría todavía.<br />
          <span style={{ fontSize: 13, color: '#4b5563' }}>Las acciones del sistema se registrarán automáticamente.</span>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #333' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#9ca3af', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Fecha/Hora</th>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Acción</th>
                  <th style={{ padding: '10px 14px' }}>Descripción</th>
                  <th style={{ padding: '10px 14px' }}>Usuario</th>
                  <th style={{ padding: '10px 14px' }}>Rol</th>
                  <th style={{ padding: '10px 14px' }}>Entidad</th>
                  <th style={{ padding: '10px 14px' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log._id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e5e7eb' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '9px 14px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(log.timestamp)}
                    </td>
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: (ACTION_COLORS[log.action] || '#6b7280') + '22',
                        color: ACTION_COLORS[log.action] || '#9ca3af',
                        border: `1px solid ${(ACTION_COLORS[log.action] || '#6b7280')}44`
                      }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', maxWidth: 300 }}>{log.description}</td>
                    <td style={{ padding: '9px 14px', color: '#a78bfa', fontWeight: 500 }}>{log.userEmail || '-'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 6, fontSize: 11,
                        background: log.userRole === 'admin' ? '#1e3a5f' : '#1a1a2e',
                        color: log.userRole === 'admin' ? '#60a5fa' : '#9ca3af'
                      }}>{log.userRole || '-'}</span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#6b7280', fontSize: 12 }}>
                      {log.entity || '-'}{log.entityId ? ` · ${log.entityId.slice(-6).toUpperCase()}` : ''}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#4b5563', fontSize: 11, fontFamily: 'monospace' }}>{log.ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <button onClick={() => loadLogs(pagination.page - 1)} disabled={pagination.page <= 1}
                style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', opacity: pagination.page <= 1 ? 0.4 : 1 }}>
                ‹ Anterior
              </button>
              <span style={{ color: '#9ca3af', padding: '8px 16px', fontSize: 13 }}>
                {pagination.page} / {pagination.pages}
              </span>
              <button onClick={() => loadLogs(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer', opacity: pagination.page >= pagination.pages ? 0.4 : 1 }}>
                Siguiente ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div style={{ background: '#1a1a2e', border: `1px solid ${color}33`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
    <div style={{ fontSize: 22 }}>{icon}</div>
    <div>
      <div style={{ color: color, fontWeight: 700, fontSize: 20 }}>{value}</div>
      <div style={{ color: '#9ca3af', fontSize: 11 }}>{label}</div>
    </div>
  </div>
);

export default AdminAuditSection;
