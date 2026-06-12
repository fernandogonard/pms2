// components/RoomCalendar.js
// Calendario visual de ocupación — popover al hover con datos de reserva/limpieza/mantenimiento
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useCalendarData } from '../hooks/useCalendarData';
import { useWebSocket } from '../hooks/useWebSocket';

const STATUS_CONFIG = {
  available:          { bg: '#22c55e', label: 'Libre',         icon: '✓', textColor: '#fff' },
  disponible:         { bg: '#22c55e', label: 'Libre',         icon: '✓', textColor: '#fff' },
  ocupada:            { bg: '#ef4444', label: 'Ocupada',       icon: '●', textColor: '#fff' },
  reservada:          { bg: '#f59e42', label: 'Reservada',     icon: '◉', textColor: '#fff' },
  confirmada:         { bg: '#3b82f6', label: 'Confirmada',    icon: '✔', textColor: '#fff' },
  checkout:           { bg: '#a855f7', label: 'Checkout',      icon: '↗', textColor: '#fff' },
  checkout_hoy:       { bg: '#f97316', label: 'Checkout Hoy',  icon: '📅', textColor: '#fff' },
  checkin:            { bg: '#06b6d4', label: 'Check-in',      icon: '↘', textColor: '#fff' },
  mantenimiento:      { bg: '#eab308', label: 'Mantenimiento', icon: '🔧', textColor: '#000' },
  fuera_de_servicio:  { bg: '#6b7280', label: 'Fuera de servicio', icon: '✕', textColor: '#fff' },
  limpieza:           { bg: '#8b5cf6', label: 'Limpieza',      icon: '🧹', textColor: '#fff' },
};

const getStatusStyle = (status) => STATUS_CONFIG[status] || { bg: '#374151', label: status || '?', icon: '?', textColor: '#fff' };

const today = new Date().toISOString().split('T')[0];

// ── Popover flotante ────────────────────────────────────
const CellPopover = ({ info, position }) => {
  if (!info) return null;
  const { room, date, status, dayData } = info;
  const cfg = getStatusStyle(status);
  const res = dayData?.reservation;
  const checkout = room.checkoutInfo;
  const d = new Date(date + 'T12:00:00');
  const dateLabel = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{
      position: 'fixed',
      top: position.y,
      left: position.x,
      zIndex: 9999,
      background: '#1e293b',
      border: '1px solid #475569',
      borderRadius: 10,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      minWidth: 260,
      maxWidth: 320,
      pointerEvents: 'none',
      animation: 'fadeIn 0.15s ease'
    }}>
      {/* Header con color del estado */}
      <div style={{
        background: cfg.bg,
        color: cfg.textColor,
        padding: '8px 14px',
        borderRadius: '10px 10px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: 600,
        fontSize: 13
      }}>
        <span>{cfg.icon} {cfg.label}</span>
        <span style={{ opacity: 0.8, fontSize: 11 }}>#{room.roomNumber} · {room.roomType}</span>
      </div>

      <div style={{ padding: '10px 14px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
        {/* Fecha */}
        <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize', marginBottom: 6 }}>
          📅 {dateLabel}
        </div>

        {/* Datos de reserva REGULAR */}
        {res && res.guest && (
          <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 2 }}>
              👤 {res.guest}
            </div>
            {res.dni && <div style={{ color: '#94a3b8' }}>DNI: {res.dni}</div>}
            {res.email && <div style={{ color: '#94a3b8' }}>✉️ {res.email}</div>}
            {res.phone && <div style={{ color: '#94a3b8' }}>📱 {res.phone}</div>}
            {res.checkIn && res.checkOut && (
              <div style={{ color: '#60a5fa', marginTop: 4, fontSize: 11 }}>
                🗓️ {res.checkIn} → {res.checkOut}
              </div>
            )}
          </div>
        )}

        {/* DATOS DE CHECKOUT HOY */}
        {checkout && (
          <div style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#f97316', fontSize: 13, marginBottom: 4 }}>
              📅 CHECKOUT HOY
            </div>
            <div style={{ color: '#fbbf24' }}>👤 {checkout.guestName || 'Huésped'}</div>
            {checkout.isPaid ? (
              <div style={{ color: '#22c55e', fontSize: 11, marginTop: 2 }}>✅ Pagado: ${checkout.amountPaid}</div>
            ) : (
              <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2, fontWeight: 600 }}>
                ⚠️ PAGO PENDIENTE: ${checkout.totalAmount - checkout.amountPaid}
              </div>
            )}
            {checkout.cleaningStatus && (
              <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
                🧹 Limpieza: {checkout.cleaningStatus === 'no_asignada' ? '❌ Sin asignar' :
                              checkout.cleaningStatus === 'asignada' ? '📌 Asignada' :
                              checkout.cleaningStatus === 'en_progreso' ? '🧹 En progreso' :
                              '✨ Completada'}
              </div>
            )}
          </div>
        )}

        {/* Limpieza */}
        {(room.pendingHousekeeping || room.lastCleaning) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {room.pendingHousekeeping && (
              <span style={{ color: '#a78bfa', background: '#1e1b4b', padding: '2px 8px', borderRadius: 4 }}>
                🧹 Limpieza pendiente
              </span>
            )}
            {room.lastCleaning && (
              <span style={{ color: '#94a3b8' }}>
                Última: {new Date(room.lastCleaning).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>
        )}

        {/* Mantenimiento */}
        {(status === 'mantenimiento' || room.currentMaintenance) && (
          <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>
            🔧 {room.currentMaintenance?.description || 'En mantenimiento'}
          </div>
        )}

        {/* Fuera de servicio */}
        {status === 'fuera_de_servicio' && (
          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
            ✕ Habitación inhabilitada
          </div>
        )}

        {/* Info habitación */}
        <div style={{ borderTop: '1px solid #334155', marginTop: 6, paddingTop: 6, display: 'flex', gap: 12, color: '#64748b', fontSize: 11 }}>
          {room.roomFloor && <span>Piso {room.roomFloor}</span>}
          {room.roomPrice && <span>${room.roomPrice}/noche</span>}
        </div>
      </div>
    </div>
  );
};

export const RoomCalendar = ({ startDate: startDateProp, days = 14 }) => {
  const startDate = startDateProp || new Date().toISOString().slice(0, 10);
  const { data, loading, error, refetch } = useCalendarData(startDate, days);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [popover, setPopover] = useState(null);
  const popoverTimeout = useRef(null);

  useWebSocket({
    onMessage: (payload) => {
      if (payload.type?.startsWith('reservation_') || payload.type?.startsWith('room_')) {
        refetch();
      }
    },
    onError: (msg) => console.error('WS Error:', msg),
    onClose: () => console.log('WS Closed')
  });

  const handleCellEnter = useCallback((e, room, date, status, dayData) => {
    clearTimeout(popoverTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    // Posicionar el popover: arriba de la celda si hay espacio, sino abajo
    const popY = rect.top > 280 ? rect.top - 10 : rect.bottom + 10;
    const popX = Math.min(rect.left, window.innerWidth - 330);
    popoverTimeout.current = setTimeout(() => {
      setPopover({
        info: { room, date, status, dayData },
        position: { x: Math.max(10, popX), y: popY > 280 ? popY : rect.bottom + 10 }
      });
    }, 250); // delay breve para evitar parpadeo
  }, []);

  const handleCellLeave = useCallback(() => {
    clearTimeout(popoverTimeout.current);
    setPopover(null);
  }, []);

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
                  
                  // Si es checkout hoy y la fecha es hoy, mostrar checkout_hoy
                  let finalStatus = status;
                  let guestName = dayData?.reservation?.guest || null;
                  
                  if (room.checkoutToday && date === today) {
                    finalStatus = 'checkout_hoy';
                    guestName = room.checkoutInfo?.guestName || guestName;
                  }
                  
                  const cfg = getStatusStyle(finalStatus);
                  const isToday = date === today;
                  return (
                    <td
                      key={date}
                      onClick={() => setSelectedRoom({ ...room, selectedDate: date, selectedStatus: finalStatus, dayData })}
                      onMouseEnter={(e) => handleCellEnter(e, room, date, finalStatus, dayData)}
                      onMouseLeave={handleCellLeave}
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
                    >
                      <div style={{ fontSize: 14, lineHeight: 1 }}>{cfg.icon}</div>
                      {guestName && (
                        <div style={{ fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 50, margin: '0 auto' }}>
                          {guestName.split(' ')[0]}
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

      {/* Popover flotante */}
      {popover && <CellPopover info={popover.info} position={popover.position} />}

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
                <span style={{ color: getStatusStyle(selectedRoom.selectedStatus).bg, fontWeight: 600 }}>
                  {getStatusStyle(selectedRoom.selectedStatus).label}
                </span>
              </span>
              {selectedRoom.dayData?.reservation?.guest && (
                <span><strong>Huésped:</strong> {selectedRoom.dayData.reservation.guest}</span>
              )}
              {selectedRoom.dayData?.reservation?.checkIn && (
                <span><strong>Estadía:</strong> {selectedRoom.dayData.reservation.checkIn} → {selectedRoom.dayData.reservation.checkOut}</span>
              )}
              {selectedRoom.pendingHousekeeping && <span style={{ color: '#a855f7' }}>🧹 Limpieza pendiente</span>}
            </div>
          )}
        </div>
      )}

      {/* CSS animation para popover */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
