// components/RoomCalendar.js
// Calendario visual de ocupación con virtualización de filas + columnas para 500x365
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCalendarData } from '../hooks/useCalendarData';
import { useWebSocket } from '../hooks/useWebSocket';

// ── Constantes de layout ──────────────────────────────
const ROOM_COL_WIDTH = 150;
const DAY_COL_WIDTH  = 55;
const ROW_HEIGHT     = 34;
const HEADER_HEIGHT  = 42;
const GRID_HEIGHT    = 540; // altura visible del grid en px

const STATUS_CONFIG = {
  // 9 ESTADOS DISTINTOS CON COLORES CLAROS Y DIFERENCIADOS
  available:          { bg: '#10b981', label: 'Libre',              icon: '✓',  textColor: '#fff' },   // Verde brillante
  disponible:         { bg: '#10b981', label: 'Libre',              icon: '✓',  textColor: '#fff' },   // Verde (alias)
  
  reservada:          { bg: '#3b82f6', label: 'Reservada',          icon: '◉',  textColor: '#fff' },   // Azul
  confirmada:         { bg: '#0ea5e9', label: 'Confirmada',         icon: '✔',  textColor: '#fff' },   // Cyan/Turquesa
  
  checkin:            { bg: '#06b6d4', label: 'Check-in',           icon: '↘',  textColor: '#fff' },   // Turquesa oscuro
  ocupada:            { bg: '#dc2626', label: 'Ocupada',            icon: '●',  textColor: '#fff' },   // Rojo intenso
  
  limpieza:           { bg: '#8b5cf6', label: 'Limpieza',           icon: '🧹', textColor: '#fff' },   // Púrpura
  checkout:           { bg: '#a855f7', label: 'Checkout',           icon: '↗',  textColor: '#fff' },   // Púrpura claro
  checkout_hoy:       { bg: '#f97316', label: 'Checkout Hoy',       icon: '📅', textColor: '#fff' },   // Naranja
  
  mantenimiento:      { bg: '#eab308', label: 'Mantenimiento',      icon: '🔧', textColor: '#000' },   // Amarillo
  conflicto:          { bg: '#ef4444', label: 'Conflicto',           icon: '⚠',  textColor: '#fff' },   // Rojo alerta
  fuera_de_servicio:  { bg: '#6b7280', label: 'Fuera de servicio',  icon: '✕',  textColor: '#fff' },   // Gris
};

const getStatusStyle = (status) => STATUS_CONFIG[status] || { bg: '#374151', label: status || '?', icon: '?', textColor: '#fff' };

const today = new Date().toISOString().split('T')[0];

// ── Celda memoizada ────────────────────────────────────
// React.memo evita re-renders de celdas que no cambiaron.
const GridCell = React.memo(({ room, date, dayData, isToday, onCellClick, onCellEnter, onCellLeave }) => {
  const status = dayData ? dayData.status : 'available';
  let finalStatus = status;
  let guestName = dayData?.reservation?.guestName || null;

  if (room.checkoutToday && date === today) {
    finalStatus = 'checkout_hoy';
    guestName = room.checkoutInfo?.guestName || guestName;
  }

  const cfg = getStatusStyle(finalStatus);

  return (
    <div
      onClick={() => onCellClick(room, date, finalStatus, dayData)}
      onMouseEnter={(e) => onCellEnter(e, room, date, finalStatus, dayData)}
      onMouseLeave={onCellLeave}
      style={{
        background: cfg.bg,
        textAlign: 'center',
        cursor: 'pointer',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: status === 'available' || status === 'disponible' ? 0.65 : 1,
        outline: isToday ? '2px solid #60a5fa' : 'none',
        outlineOffset: -2,
        borderRight: '1px solid rgba(0,0,0,0.12)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1 }}>{cfg.icon}</div>
      {guestName && (
        <div style={{ fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 48 }}>
          {guestName.split(' ')[0]}
        </div>
      )}
    </div>
  );
});
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

        {/* INFO DE MANTENIMIENTO */}
        {status === 'mantenimiento' && dayData?.maintenanceInfo && (
          <div style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: 13, marginBottom: 4 }}>
              🔧 MANTENIMIENTO
            </div>
            <div style={{ color: '#fbbf24', fontSize: 12 }}>{dayData.maintenanceInfo.reason}</div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
              📆 {dayData.maintenanceInfo.startDate?.split('T')[0]} → {dayData.maintenanceInfo.endDate?.split('T')[0]}
            </div>
          </div>
        )}

        {/* CONFLICTO / OVERBOOKING */}
        {status === 'conflicto' && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 13, marginBottom: 4 }}>
              ⚠ Conflicto de ocupación
            </div>
            <div style={{ color: '#fecaca', fontSize: 11 }}>
              Hay más de una reserva activa para esta habitación en esta fecha.
            </div>
          </div>
        )}

        {/* Datos de reserva REGULAR */}
        {res && res.guestName && (
          <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 2 }}>
              👤 {res.guestName}
            </div>
            {res.email && <div style={{ color: '#94a3b8', fontSize: 11 }}>✉️ {res.email}</div>}
            {res.checkIn && res.checkOut && (
              <div style={{ color: '#60a5fa', marginTop: 4, fontSize: 11 }}>
                🗓️ {res.checkIn.split('T')[0]} → {res.checkOut.split('T')[0]}
              </div>
            )}
            {res.status && (
              <div style={{ color: '#a8e6cf', marginTop: 3, fontSize: 11, fontWeight: 500 }}>
                Estado: {res.status === 'checkin' ? '🟢 Ocupada' : res.status === 'confirmada' ? '🔵 Confirmada' : '⭕ ' + res.status}
              </div>
            )}
          </div>
        )}

        {/* ESTADO RESERVADA (próxima a ocuparse) */}
        {status === 'reservada' && !res && (
          <div style={{ background: '#1f2937', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: 13, marginBottom: 2 }}>
              ⏰ Próximo check-in
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 11 }}>
              Se ocupará en los próximos días. Habitación reservada.
            </div>
          </div>
        )}

        {/* DATOS DE CHECKOUT HOY */}
        {(checkout && dayData?.checkoutToday) && (
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

        {/* Estado LIMPIEZA */}
        {status === 'limpieza' && dayData?.housekeepingAssignment && (
          <div style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, color: '#a78bfa', fontSize: 13, marginBottom: 2 }}>
              🧹 EN LIMPIEZA
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 11 }}>
              Tipo: {dayData.housekeepingAssignment.housekeepingType === 'repaso' ? 'Repaso (20 min)' :
                     dayData.housekeepingAssignment.housekeepingType === 'limpieza_profunda' ? 'Limpieza profunda (40 min)' :
                     'Checkout limpieza (40 min)'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
              Por: {dayData.housekeepingAssignment.assignedTo || 'Sin asignar'}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 10, marginTop: 2 }}>
              Estado: {dayData.housekeepingAssignment.status === 'asignada' ? '📌 Asignada' :
                       dayData.housekeepingAssignment.status === 'en_progreso' ? '🟠 En progreso' :
                       '✅ Completada'}
            </div>
          </div>
        )}

        {/* Limpieza */}
        {(room.pendingHousekeeping || room.lastCleaning || room.housekeepingState || dayData?.tooltip?.housekeepingStatus) && status !== 'limpieza' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {(dayData?.tooltip?.housekeepingStatus || room.housekeepingState) && (
              <span style={{ color: '#c4b5fd', background: '#2e1065', padding: '2px 8px', borderRadius: 4 }}>
                HK: {dayData?.tooltip?.housekeepingStatus || room.housekeepingState}
              </span>
            )}
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
  const [popover, setPopover]           = useState(null);
  const popoverTimeout = useRef(null);
  const parentRef      = useRef(null);

  // ── Auto-refetch cada 15 s ──────────────────────────
  useEffect(() => {
    const interval = setInterval(refetch, 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  useWebSocket({
    onMessage: (payload) => {
      if (
        payload.type?.startsWith('reservation_') ||
        payload.type?.startsWith('room_') ||
        payload.type === 'cleaning_updated'
      ) { refetch(); }
    },
    onError:  (msg) => console.error('WS Error:', msg),
    onClose:  ()    => console.log('WS Closed'),
  });

  // ── Fechas del rango ────────────────────────────────
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  }, [startDate, days]);

  // ── Índice O(1): roomId → { date → dayData } ───────
  const roomDatesMap = useMemo(() => {
    const map = {};
    data.forEach(room => {
      const byDate = {};
      (room.dates || []).forEach(d => { byDate[d.date] = d; });
      map[room.roomId] = byDate;
    });
    return map;
  }, [data]);

  // ── Virtualizadores ─────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count:           data.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => ROW_HEIGHT,
    overscan:        5,
  });

  const columnVirtualizer = useVirtualizer({
    count:           dates.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => DAY_COL_WIDTH,
    overscan:        3,
    horizontal:      true,
  });

  // ── Handlers memoizados ─────────────────────────────
  const handleCellEnter = useCallback((e, room, date, status, dayData) => {
    clearTimeout(popoverTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const popY = rect.top > 280 ? rect.top - 10 : rect.bottom + 10;
    const popX = Math.min(rect.left, window.innerWidth - 330);
    popoverTimeout.current = setTimeout(() => {
      setPopover({
        info:     { room, date, status, dayData },
        position: { x: Math.max(10, popX), y: popY > 280 ? popY : rect.bottom + 10 },
      });
    }, 250);
  }, []);

  const handleCellLeave = useCallback(() => {
    clearTimeout(popoverTimeout.current);
    setPopover(null);
  }, []);

  const handleCellClick = useCallback((room, date, status, dayData) => {
    setSelectedRoom({ ...room, selectedDate: date, selectedStatus: status, dayData });
  }, []);

  // ── Renders de carga / error ────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
      <div className="spinner-border" role="status" style={{ marginBottom: 10 }} />
      <div>Cargando calendario...</div>
    </div>
  );
  if (error)     return <div className="alert alert-danger">Error: {error}</div>;
  if (!data.length) return <div className="alert alert-warning">No hay habitaciones para mostrar</div>;

  const totalColSize = columnVirtualizer.getTotalSize();
  const totalRowSize = rowVirtualizer.getTotalSize();
  const totalWidth   = ROOM_COL_WIDTH + totalColSize;
  const totalHeight  = HEADER_HEIGHT  + totalRowSize;

  const virtualRows    = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  return (
    <div>
      {/* ── Leyenda ────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Calendario de Habitaciones</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG)
            .filter(([k]) => k !== 'disponible')
            .map(([key, val]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ccc' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: val.bg, display: 'inline-block' }} />
                {val.label}
              </span>
            ))}
        </div>
      </div>

      {/* ── Grid virtualizado ──────────────────────── */}
      <div
        ref={parentRef}
        style={{
          height:       GRID_HEIGHT,
          overflow:     'auto',
          border:       '1px solid #374151',
          borderRadius: 8,
          position:     'relative',
        }}
      >
        {/* Contenedor interno que define el espacio total de scroll */}
        <div style={{ width: totalWidth, height: totalHeight, position: 'relative' }}>

          {/* ── Header pegajoso ─────────────────────── */}
          <div style={{
            position:      'sticky',
            top:           0,
            zIndex:        3,
            height:        HEADER_HEIGHT,
            display:       'flex',
            background:    '#1f2937',
            borderBottom:  '2px solid #374151',
            width:         totalWidth,
          }}>
            {/* Celda "Habitación" doblemente pegajosa (top + left) */}
            <div style={{
              position:   'sticky',
              left:       0,
              zIndex:     4,
              width:      ROOM_COL_WIDTH,
              flexShrink: 0,
              background: '#1f2937',
              display:    'flex',
              alignItems: 'center',
              padding:    '0 10px',
              borderRight:'1px solid #374151',
              color:      '#e5e7eb',
              fontWeight: 600,
              fontSize:   12,
            }}>
              Habitación
            </div>

            {/* Cabeceras de fechas virtualizadas */}
            <div style={{ position: 'relative', width: totalColSize, height: '100%', flexShrink: 0 }}>
              {virtualColumns.map(col => {
                const date    = dates[col.index];
                const d       = new Date(date + 'T12:00:00');
                const isToday = date === today;
                return (
                  <div key={col.key} style={{
                    position:       'absolute',
                    left:           col.start,
                    width:          col.size,
                    height:         '100%',
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    justifyContent: 'center',
                    background:     isToday ? '#1e3a5f' : 'transparent',
                    color:          isToday ? '#60a5fa' : '#9ca3af',
                    fontSize:       11,
                    fontWeight:     isToday ? 700 : 500,
                    borderRight:    '1px solid #2d3748',
                  }}>
                    <div>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Filas virtualizadas ──────────────────── */}
          <div style={{ position: 'relative', height: totalRowSize }}>
            {virtualRows.map(row => {
              const room = data[row.index];
              const byDate = roomDatesMap[room.roomId] || {};
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  style={{
                    position:    'absolute',
                    top:         row.start,
                    height:      row.size,
                    width:       totalWidth,
                    display:     'flex',
                    borderBottom:'1px solid #2d3748',
                  }}
                >
                  {/* Etiqueta de habitación pegajosa al lado izquierdo */}
                  <div
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      position:   'sticky',
                      left:       0,
                      zIndex:     1,
                      width:      ROOM_COL_WIDTH,
                      flexShrink: 0,
                      background: '#111827',
                      display:    'flex',
                      alignItems: 'center',
                      padding:    '0 10px',
                      cursor:     'pointer',
                      borderRight:'1px solid #374151',
                      fontSize:   12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      gap:        4,
                    }}
                  >
                    <span style={{ color: '#60a5fa' }}>#{room.roomNumber}</span>
                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 10, textTransform: 'capitalize' }}>
                      {room.roomType}
                    </span>
                    {room.pendingHousekeeping && (
                      <span title="Limpieza pendiente">🧹</span>
                    )}
                  </div>

                  {/* Celdas de días virtualizadas */}
                  <div style={{ position: 'relative', width: totalColSize, height: '100%', flexShrink: 0 }}>
                    {virtualColumns.map(col => {
                      const date    = dates[col.index];
                      const dayData = byDate[date] || null;
                      const isToday = date === today;
                      return (
                        <div
                          key={col.key}
                          style={{
                            position: 'absolute',
                            left:     col.start,
                            width:    col.size,
                            height:   '100%',
                          }}
                        >
                          <GridCell
                            room={room}
                            date={date}
                            dayData={dayData}
                            isToday={isToday}
                            onCellClick={handleCellClick}
                            onCellEnter={handleCellEnter}
                            onCellLeave={handleCellLeave}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Popover flotante ─────────────────────────── */}
      {popover && <CellPopover info={popover.info} position={popover.position} />}

      {/* ── Panel de habitación seleccionada ─────────── */}
      {selectedRoom && (
        <div style={{
          marginTop: 16, padding: 16,
          background: '#1f2937', borderRadius: 8,
          color: '#e5e7eb', border: '1px solid #374151',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>
              <span style={{ color: '#60a5fa' }}>#{selectedRoom.roomNumber}</span>
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8, textTransform: 'capitalize' }}>
                {selectedRoom.roomType}
              </span>
            </h3>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedRoom(null)}>✕</button>
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
                <span>
                  <strong>Estadía:</strong>{' '}
                  {selectedRoom.dayData.reservation.checkIn} → {selectedRoom.dayData.reservation.checkOut}
                </span>
              )}
              {selectedRoom.pendingHousekeeping && (
                <span style={{ color: '#a855f7' }}>🧹 Limpieza pendiente</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSS animation para popover */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
