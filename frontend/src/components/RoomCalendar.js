// components/RoomCalendar.js
// Calendario visual de ocupación de habitaciones — vista de un vistazo
import React, { useMemo, useState } from 'react';
import { useCalendarData } from '../hooks/useCalendarData';
import { useWebSocket } from '../hooks/useWebSocket';

const STATUS_CONFIG = {
  available:          { bg: '#22c55e', label: 'Libre',         icon: '✓' },
  disponible:         { bg: '#22c55e', label: 'Libre',         icon: '✓' },
  ocupada:            { bg: '#ef4444', label: 'Ocupada',       icon: '●' },
  reservada:          { bg: '#f59e42', label: 'Reservada',     icon: '◉' },
  confirmada:         { bg: '#3b82f6', label: 'Confirmada',    icon: '✔' },
  checkout:           { bg: '#a855f7', label: 'Checkout',      icon: '↗' },
  checkin:            { bg: '#06b6d4', label: 'Check-in',      icon: '↘' },
  mantenimiento:      { bg: '#eab308', label: 'Mant.',         icon: '🔧' },
  fuera_de_servicio:  { bg: '#6b7280', label: 'Fuera serv.',   icon: '✕' },
  limpieza:           { bg: '#8b5cf6', label: 'Limpieza',      icon: '🧹' },
};

const getStatusStyle = (status) => {
  return STATUS_CONFIG[status] || { bg: '#374151', label: status || '?', icon: '?' };
};

const today = new Date().toISOString().split('T')[0];

export const RoomCalendar = ({ startDate: startDateProp, days = 14 }) => {
  const startDate = startDateProp || new Date().toISOString().slice(0, 10);
  const { data, loading, error, refetch } = useCalendarData(startDate, days);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useWebSocket({
    onMessage: (payload) => {
      if (payload.type?.startsWith('reservation_') || payload.type?.startsWith('room_')) {
        refetch();
      }
    },
    onError: (msg) => console.error('WS Error:', msg),
    onClose: () => console.log('WS Closed')
  });

  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + i);
      arr.push(date.toISOString().split('T')[0]);
    }
    return arr;
  }, [startDate, days]);

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
      <div className="spinner-border" role="status" style={{ marginBottom: 10 }}></div>
      <div>Cargando calendario...</div>
    </div>
  );
  if (error) return <div className="alert alert-danger">Error: {error}</div>;
  if (!data.length) return <div className="alert alert-warning">No hay habitaciones para mostrar</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Calendario de Habitaciones</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).filter(([k]) => !['disponible'].includes(k)).map(([key, val]) => (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ccc' }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: val.bg, display: 'inline-block' }}></span>
              {val.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #374151' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: days * 55 + 150 }}>
          <thead>
            <tr>
              <th style={{ background: '#1f2937', color: '#e5e7eb', padding: '8px 10px', textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, width: 150, borderBottom: '2px solid #374151' }}>
                Habitación
              </th>
              {dates.map(date => {
                const d = new Date(date + 'T12:00:00');
                const isToday = date === today;
                return (
                  <th key={date} style={{
                    background: isToday ? '#1e3a5f' : '#1f2937',
                    color: isToday ? '#60a5fa' : '#9ca3af',
                    padding: '6px 2px',
                    textAlign: 'center',
                    fontWeight: isToday ? 700 : 500,
                    borderBottom: '2px solid #374151',
                    whiteSpace: 'nowrap',
                    fontSize: 11
                  }}>
                    <div>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map(room => (
              <tr key={room.roomId} style={{ borderBottom: '1px solid #2d3748' }}>
                <td style={{
                  background: '#111827',
                  color: '#e5e7eb',
                  padding: '6px 10px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  borderRight: '1px solid #374151'
                }}
                  onClick={() => setSelectedRoom(room)}
                >
                  <span style={{ color: '#60a5fa' }}>#{room.roomNumber}</span>
                  <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 4, fontSize: 10, textTransform: 'capitalize' }}>
                    {room.roomType}
                  </span>
                  {room.pendingHousekeeping && <span title="Pendiente limpieza" style={{ marginLeft: 4 }}>🧹</span>}
                </td>
                {dates.map((date) => {
                  const dayData = (room.dates || []).find(d => d.date === date);
                  const status = dayData ? dayData.status : 'available';
                  const cfg = getStatusStyle(status);
                  const isToday = date === today;
                  return (
                    <td
                      key={date}
                      title={`#${room.roomNumber} — ${date}: ${cfg.label}`}
                      onClick={() => setSelectedRoom({ ...room, selectedDate: date, selectedStatus: status })}
                      style={{
                        background: cfg.bg,
                        textAlign: 'center',
                        cursor: 'pointer',
                        padding: '4px 2px',
                        transition: 'filter 0.15s',
                        opacity: status === 'available' || status === 'disponible' ? 0.65 : 1,
                        outline: isToday ? '2px solid #60a5fa' : 'none',
                        outlineOffset: -2,
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.25)'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                    >
                      <div style={{ fontSize: 14, lineHeight: 1 }}>{cfg.icon}</div>
                      {dayData?.reservation?.user && (
                        <div style={{ fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 50, margin: '0 auto' }}>
                          {dayData.reservation.user}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRoom && (
        <div style={{ marginTop: 16, padding: 16, background: '#1f2937', borderRadius: 8, color: '#e5e7eb', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>
              <span style={{ color: '#60a5fa' }}>#{selectedRoom.roomNumber}</span>
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8, textTransform: 'capitalize' }}>{selectedRoom.roomType}</span>
            </h3>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedRoom(null)}
            >✕</button>
          </div>
          {selectedRoom.selectedDate && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <span><strong>Fecha:</strong> {selectedRoom.selectedDate}</span>
              <span>
                <strong>Estado:</strong>{' '}
                <span style={{
                  color: getStatusStyle(selectedRoom.selectedStatus).bg,
                  fontWeight: 600
                }}>
                  {getStatusStyle(selectedRoom.selectedStatus).label}
                </span>
              </span>
              {selectedRoom.roomStatus && <span><strong>Estado hab.:</strong> {selectedRoom.roomStatus}</span>}
              {selectedRoom.pendingHousekeeping && <span style={{ color: '#a855f7' }}>🧹 Limpieza pendiente</span>}
              {selectedRoom.lastCleaning && (
                <span><strong>Última limpieza:</strong> {new Date(selectedRoom.lastCleaning).toLocaleDateString('es-ES')}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
