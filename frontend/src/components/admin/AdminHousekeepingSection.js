// components/admin/AdminHousekeepingSection.js
// Panel de Housekeeping — tareas de limpieza y repaso del día

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';

const TASK_META = {
  repaso: {
    label: 'Repaso diario',
    icon: '🧹',
    color: '#f59e0b',
    bg: '#1c1400',
    border: '#78450a',
    desc: 'Limpieza liviana de habitación ocupada',
  },
  limpieza_profunda: {
    label: 'Limpieza profunda',
    icon: '🧼',
    color: '#a78bfa',
    bg: '#130d1e',
    border: '#5b3fa8',
    desc: 'Limpieza completa cada 3 noches',
  },
  limpieza_checkout: {
    label: 'Limpieza post-checkout',
    icon: '🚪',
    color: '#f87171',
    bg: '#1a0606',
    border: '#7f1d1d',
    desc: 'Habitación liberada, lista para disponible',
  },
};

const STATUS_COLOR = {
  disponible: '#22c55e',
  ocupada: '#ef4444',
  limpieza: '#f59e0b',
  mantenimiento: '#a78bfa',
};

const AdminHousekeepingSection = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all'); // all | repaso | limpieza_profunda | limpieza_checkout
  const [completing, setCompleting] = useState(null); // roomId en proceso

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/rooms');
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch {
      setError('Error al cargar habitaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 60000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCompleteTask = async (roomId, task) => {
    const meta = TASK_META[task];
    if (!window.confirm(`¿Confirmar "${meta?.label || task}" completada en hab. ${rooms.find(r => r._id === roomId)?.number}?`)) return;
    setCompleting(roomId);
    setError(''); setSuccess('');
    try {
      const res = await apiFetch(`/api/rooms/${roomId}/complete-task`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Error'); setCompleting(null); return; }
      setSuccess(data.message || 'Tarea completada ✓');
      setTimeout(() => setSuccess(''), 4000);
      fetchRooms();
    } catch {
      setError('Error de red');
    } finally {
      setCompleting(null);
    }
  };

  // Habitaciones con tarea pendiente
  const pendingRooms = rooms.filter(r => r.pendingHousekeeping);
  const filtered = filter === 'all' ? pendingRooms : pendingRooms.filter(r => r.pendingHousekeeping === filter);

  // Contadores por tipo
  const counts = {
    repaso: rooms.filter(r => r.pendingHousekeeping === 'repaso').length,
    limpieza_profunda: rooms.filter(r => r.pendingHousekeeping === 'limpieza_profunda').length,
    limpieza_checkout: rooms.filter(r => r.pendingHousekeeping === 'limpieza_checkout').length,
  };

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🧹 Housekeeping</h2>
          <p style={styles.subtitle}>Tareas de limpieza del día — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={fetchRooms} disabled={loading} style={styles.refreshBtn}>
          {loading ? '⟳ Cargando…' : '🔄 Actualizar'}
        </button>
      </div>

      {/* Mensajes */}
      {error && <div style={styles.alertError}>{error}</div>}
      {success && <div style={styles.alertSuccess}>{success}</div>}

      {/* Tarjetas de resumen */}
      <div style={styles.summaryGrid}>
        {Object.entries(TASK_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            style={{
              ...styles.summaryCard,
              border: `1.5px solid ${filter === key ? meta.color : meta.border}`,
              background: filter === key ? meta.bg : '#181818',
              boxShadow: filter === key ? `0 0 16px ${meta.color}44` : 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 28 }}>{meta.icon}</span>
            <div style={styles.summaryCount(meta.color)}>{counts[key]}</div>
            <div style={styles.summaryLabel}>{meta.label}</div>
            <div style={styles.summaryDesc}>{meta.desc}</div>
          </button>
        ))}

        <div style={{ ...styles.summaryCard, border: '1.5px solid #374151', background: '#181818' }}>
          <span style={{ fontSize: 28 }}>🏨</span>
          <div style={styles.summaryCount('#60a5fa')}>{pendingRooms.length}</div>
          <div style={styles.summaryLabel}>Total pendientes</div>
          <div style={styles.summaryDesc}>de {rooms.length} habitaciones</div>
        </div>
      </div>

      {/* Filtro activo badge */}
      {filter !== 'all' && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Filtrando:</span>
          <span style={{
            background: TASK_META[filter].bg,
            color: TASK_META[filter].color,
            border: `1px solid ${TASK_META[filter].border}`,
            borderRadius: 20, padding: '2px 12px', fontSize: 13, fontWeight: 600,
          }}>
            {TASK_META[filter].icon} {TASK_META[filter].label}
          </span>
          <button onClick={() => setFilter('all')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>✕ quitar filtro</button>
        </div>
      )}

      {/* Tabla de tareas */}
      {loading ? (
        <div style={styles.emptyState}>⟳ Cargando habitaciones…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#22c55e' }}>Sin tareas pendientes</div>
          <div style={{ color: '#6b7280', marginTop: 6 }}>Todo el housekeeping está al día</div>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Hab.', 'Piso', 'Tipo', 'Estado', 'Tarea', 'Asignada', 'Acción'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(room => {
                const meta = TASK_META[room.pendingHousekeeping];
                const isProcessing = completing === room._id;
                return (
                  <tr key={room._id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 700, fontSize: 16 }}>#{room.number}</td>
                    <td style={styles.td}>{room.floor ?? '-'}</td>
                    <td style={styles.td}>{room.type || '-'}</td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: '#111', color: STATUS_COLOR[room.status] || '#fff',
                        border: `1px solid ${STATUS_COLOR[room.status] || '#555'}`,
                      }}>
                        {room.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: meta?.bg || '#111', color: meta?.color || '#fff',
                        border: `1px solid ${meta?.border || '#555'}`,
                      }}>
                        {meta?.icon} {meta?.label || room.pendingHousekeeping}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: 12 }}>
                      {room.pendingHousekeepingAt
                        ? new Date(room.pendingHousekeepingAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleCompleteTask(room._id, room.pendingHousekeeping)}
                        disabled={isProcessing}
                        style={{
                          ...styles.completeBtn,
                          background: isProcessing ? '#374151' : '#22c55e',
                          color: isProcessing ? '#9ca3af' : '#000',
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isProcessing ? '⟳ Procesando…' : (
                          room.pendingHousekeeping === 'limpieza_checkout'
                            ? '✅ Disponible'
                            : '✅ Lista'
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda footer */}
      <div style={styles.footer}>
        <span style={{ color: '#4b5563', fontSize: 12 }}>
          💡 Repaso y limpieza profunda: la habitación permanece <strong style={{ color: '#60a5fa' }}>Ocupada</strong> al completar. 
          Post-checkout: pasa a <strong style={{ color: '#22c55e' }}>Disponible</strong>.
        </span>
      </div>
    </div>
  );
};

// ── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  container: {
    padding: '28px 32px',
    background: '#0f0f0f',
    minHeight: '100vh',
    color: '#fff',
    fontFamily: 'Inter, -apple-system, sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: {
    fontSize: 26, fontWeight: 700, margin: 0, color: '#f9fafb',
  },
  subtitle: {
    color: '#6b7280', fontSize: 14, marginTop: 4, textTransform: 'capitalize',
  },
  refreshBtn: {
    background: '#1f2937', color: '#d1d5db', border: '1px solid #374151',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  alertError: {
    background: '#1a0606', border: '1px solid #7f1d1d', color: '#fca5a5',
    borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14,
  },
  alertSuccess: {
    background: '#052e16', border: '1px solid #166534', color: '#86efac',
    borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16, marginBottom: 28,
  },
  summaryCard: {
    padding: '20px 16px', borderRadius: 12, textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    transition: 'all 0.2s',
  },
  summaryCount: (color) => ({
    fontSize: 36, fontWeight: 800, color, lineHeight: 1,
  }),
  summaryLabel: {
    fontSize: 13, fontWeight: 600, color: '#d1d5db',
  },
  summaryDesc: {
    fontSize: 11, color: '#6b7280',
  },
  tableWrapper: {
    background: '#111', borderRadius: 12, border: '1px solid #1f2937', overflow: 'hidden',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
    color: '#6b7280', background: '#0d0d0d', borderBottom: '1px solid #1f2937',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  tr: {
    borderBottom: '1px solid #1a1a1a',
  },
  td: {
    padding: '14px 16px', fontSize: 14, color: '#e5e7eb',
  },
  completeBtn: {
    border: 'none', borderRadius: 6, padding: '7px 14px',
    fontWeight: 700, fontSize: 13, transition: 'opacity 0.2s',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 0', color: '#4b5563',
  },
  footer: {
    marginTop: 24, padding: '12px 0', borderTop: '1px solid #1f2937',
  },
};

export default AdminHousekeepingSection;
