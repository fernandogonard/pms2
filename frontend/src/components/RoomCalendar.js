// components/RoomCalendar.optimized.js
// Calendario visual de ocupación de habitaciones CON VIRTUALIZACIÓN Y CACHE
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import useCalendarData from '../hooks/useCalendarData';
import useWebSocket from '../hooks/useWebSocket';
import useSessionGuard from '../hooks/useSessionGuard';
import './AccessibilityFeatures.css';

const ROW_HEIGHT = 80;
const VISIBLE_ROWS = 12;
const ROW_BUFFER = 3;

const RoomCalendar = () => {
  const { data, loading, error, refresh } = useCalendarData(14);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainer = useRef(null);
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  // WebSocket con deduplicación y debounce
  // Triggers: reserva creada/modificada, check-in, check-out, limpieza, mantenimiento, asignación
  const { wsError } = useWebSocket({
    onMessage: payload => {
      if (!payload?.type) return false;
      
      const criticalEvents = [
        'reservation_created',
        'reservation_updated',
        'reservation_cancelled',
        'checkin_completed',
        'checkout_completed',
        'cleaning_scheduled',
        'cleaning_completed',
        'maintenance_scheduled',
        'maintenance_completed',
        'room_assigned',
        'room_state_changed'
      ];
      
      if (criticalEvents.includes(payload.type)) {
        // Trigger refresh inmediato
        refresh(true);
        return true;
      }
      
      return false;
    },
    enabled: canFetch
  });

  if (!canFetch) {
    return (
      <div style={{ background: '#1c1c1c', borderRadius: 16, padding: 24, color: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Calendario de ocupación</h2>
        <p style={{ color: '#ccc', marginTop: 12 }}>
          {sessionExpired
            ? 'Tu sesión expiró. Vuelve a iniciar sesión para consultar el calendario.'
            : authLoading
              ? 'Validando sesión...'
              : 'Debes iniciar sesión para ver el calendario.'}
        </p>
      </div>
    );
  }

  // Virtualización: calcular filas visibles
  const visibleRanges = useMemo(() => {
    if (!data?.rooms) return { start: 0, slice: [], topSpacer: 0, bottomSpacer: 0 };
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_BUFFER);
    const end = Math.min(data.rooms.length, start + VISIBLE_ROWS + ROW_BUFFER * 2);
    const slice = data.rooms.slice(start, end);
    const topSpacer = start * ROW_HEIGHT;
    const bottomSpacer = Math.max(0, (data.rooms.length - end) * ROW_HEIGHT);
    return { start, slice, topSpacer, bottomSpacer };
  }, [data?.rooms, scrollTop]);

  const handleScroll = useCallback(e => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Preprocesar reservas en un mapa para evitar búsquedas O(N²)
  const reservationLookup = useMemo(() => {
    if (!data?.reservations || !data?.assignments) return {};
    const lookup = {};
    data.reservations.forEach(r => {
      const assignedRoomIds = data.assignments[r._id] || [];
      assignedRoomIds.forEach(roomId => {
        if (!lookup[roomId]) lookup[roomId] = [];
        lookup[roomId].push(r);
      });
    });
    return lookup;
  }, [data?.reservations, data?.assignments]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', margin: '24px 0' }}>
        <div style={{ 
          display: 'inline-block', 
          width: 40, 
          height: 40, 
          border: '5px solid #222', 
          borderTop: '5px solid #2563eb', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
        <p>Cargando calendario...</p>
      </div>
    );
  }

  const wsNotice = wsError ? (
    <div 
      role="alert" 
      aria-live="polite"
      style={{
        background:'#ef4444',
        color:'#fff',
        padding:12,
        borderRadius:8,
        marginBottom:12,
        fontWeight:600
      }}
    >
      Conexión en tiempo real desconectada. Los datos mostrados son la última carga estática.
    </div>
  ) : null;

  const roomsData = data?.rooms || [];
  const overbooked = data?.overbooked || {};
  const assignments = data?.assignments || {};
  const reservations = data?.reservations || [];
  const days = data?.days || [];

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
  
    // Lógica para manejar el cambio de reserva
    console.log(`Reserva ${draggableId} movida de ${source.droppableId} a ${destination.droppableId}`);
  };

  const renderTooltip = (state, reservation) => {
    switch (state) {
      case 'checkout_hoy':
        return 'Checkout pendiente hoy';
      case 'checkin_pendiente':
        return 'Check-in pendiente - aún no confirmado';
      case 'ocupada':
        return `Ocupada - Huésped presente`;
      case 'limpieza':
        return 'En limpieza - No disponible';
      case 'mantenimiento':
        return 'En mantenimiento - No disponible';
      case 'fuera_de_servicio':
        return 'Fuera de servicio - No disponible';
      case 'disponible':
        return 'Disponible - Libre para reservar';
      default:
        return 'Estado desconocido';
    }
  };

  // Función para obtener color y estilos según estado
  const getStateStyles = (state) => {
    const baseStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    };

    const stateColors = {
      'disponible': { background: '#10b981', color: '#fff', borderLeft: '3px solid #059669' },
      'ocupada': { background: '#3b82f6', color: '#fff', borderLeft: '3px solid #1d4ed8' },
      'checkin_pendiente': { background: '#f59e0b', color: '#fff', borderLeft: '3px solid #d97706' },
      'checkout_hoy': { background: '#ef4444', color: '#fff', borderLeft: '3px solid #991b1b' },
      'limpieza': { background: '#6366f1', color: '#fff', borderLeft: '3px solid #4f46e5' },
      'mantenimiento': { background: '#8b5cf6', color: '#fff', borderLeft: '3px solid #7c3aed' },
      'fuera_de_servicio': { background: '#6b7280', color: '#fff', borderLeft: '3px solid #4b5563' }
    };

    return {
      ...baseStyle,
      ...(stateColors[state] || stateColors['disponible'])
    };
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        role="grid"
        aria-label="Calendario de habitaciones"
        tabIndex="0"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            scrollContainer.current.scrollBy({ left: 100, behavior: 'smooth' });
          } else if (e.key === 'ArrowLeft') {
            scrollContainer.current.scrollBy({ left: -100, behavior: 'smooth' });
          }
        }}
        style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32 }}
      >
        <div 
          ref={scrollContainer}
          onScroll={handleScroll}
          style={{ 
            overflowX: 'auto', 
            overflowY: 'auto',
            flex: 1,
            maxHeight: 'calc(100vh - 200px)'
          }}
        >
          {error && (
            <div 
              role="alert"
              style={{
                background: '#ef4444',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                marginBottom: 12,
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}
          {wsNotice}
          <div className="calendar-status-legend">
            <h4 style={{ marginTop: 0, marginBottom: 12 }}>Leyenda de estados</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="calendar-status-item" style={{ background: '#10b981', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                ✅ Disponible
              </div>
              <div className="calendar-status-item" style={{ background: '#3b82f6', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                🏠 Ocupada
              </div>
              <div className="calendar-status-item" style={{ background: '#f59e0b', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                📋 Check-in pendiente
              </div>
              <div className="calendar-status-item" style={{ background: '#ef4444', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                🚪 Checkout hoy
              </div>
              <div className="calendar-status-item" style={{ background: '#6366f1', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                🧹 Limpieza
              </div>
              <div className="calendar-status-item" style={{ background: '#8b5cf6', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                🔧 Mantenimiento
              </div>
              <div className="calendar-status-item" style={{ background: '#6b7280', padding: 8, borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600, gridColumn: '1 / -1' }}>
                ⛔ Fuera de servicio
              </div>
            </div>
          </div>

          <div style={{ overflowY: 'auto', height: '100%' }}>
            <div style={{ height: visibleRanges.topSpacer }} />
            {visibleRanges.slice.map((room, index) => (
              <Droppable key={room._id} droppableId={room._id} direction="horizontal">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', gap: 8, padding: 8 }}>
                    <div style={{ width: 80, textAlign: 'center', fontWeight: 600 }}>#{room.number}</div>
                    {days.map((day, dayIndex) => {
                      const state = room.states?.[day] || 'disponible';
                      const stateStyle = getStateStyles(state);
                      
                      return (
                        <Draggable 
                          key={`${room._id}-${day}`} 
                          draggableId={`${room._id}-${day}`} 
                          index={dayIndex}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                ...stateStyle,
                                width: 80,
                                height: ROW_HEIGHT,
                                opacity: snapshot.isDragging ? 0.8 : 1,
                                boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.3)' : 'none'
                              }}
                              title={renderTooltip(state)}
                              role="gridcell"
                              aria-label={`Habitación ${room.number}, ${day}: ${renderTooltip(state)}`}
                            >
                              <div style={{ textAlign: 'center', fontSize: 11 }}>
                                <div>{day.slice(5)}</div>
                                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{state}</div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
            <div style={{ height: visibleRanges.bottomSpacer }} />
          </div>
        </div>

        {/* Panel lateral con reservas visibles */}
        <aside 
          role="complementary"
          aria-label="Reservas activas"
          style={{ width: 420, maxHeight: 520, overflowY: 'auto', background: '#0a0a0a', color: '#fff', padding: 12, borderRadius: 8 }}
        >
          <h3 style={{ marginTop: 0 }}>Reservas visibles ({reservations.length})</h3>
          {reservations.length === 0 && <div style={{ color: '#bbb' }}>No hay reservas activas.</div>}
          {reservations.map(r => {
            const checkIn = r.checkIn ? r.checkIn.slice(0,10) : '-';
            const checkOut = r.checkOut ? r.checkOut.slice(0,10) : '-';
            
            const assignedRoomIds = assignments[r._id] || [];
            const isVirtual = !assignedRoomIds || assignedRoomIds.length === 0;
            
            let assignedRoomText = '—';
            if (!isVirtual) {
              const assignedRoomNumbers = assignedRoomIds.map(roomId => {
                const room = roomsData.find(rm => rm._id === roomId);
                return room ? `#${room.number}` : `#${roomId}`;
              });
              assignedRoomText = assignedRoomNumbers.join(', ');
            }
            
            const intersects = days.some(d => (r.checkIn && r.checkOut) && (d >= r.checkIn.slice(0,10) && d < r.checkOut.slice(0,10)));
            if (!intersects) return null;
            
            return (
              <div key={r._id} style={{ background: '#111', border: '1px solid #222', padding: 10, marginBottom: 8, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{r.name || (r.user && r.user.name) || 'Reserva'}</strong>
                  <span style={{ color: isVirtual ? '#f59e42' : '#fff' }}>
                    {isVirtual ? 'Virtual' : assignedRoomText}
                  </span>
                </div>
                <div style={{ color: '#bbb', fontSize: 13 }}>
                  {checkIn} → {checkOut} · {r.tipo || ''}
                  {(r.cantidad && r.cantidad > 1) && <span style={{ color: '#fbbf24', fontWeight: 600 }}> · {r.cantidad} habitaciones</span>}
                </div>
                <div style={{ 
                  marginTop: 4, 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  fontSize: 11, 
                  fontWeight: 600,
                  display: 'inline-block',
                  background: r.status === 'checkin' ? '#22c55e' : r.status === 'reservada' ? '#f59e42' : '#6b7280',
                  color: '#fff'
                }}>
                  {r.status === 'checkin' ? '✅ Check-in realizado' : 
                   r.status === 'reservada' ? '📋 Reservada (pendiente check-in)' : 
                   r.status || 'Estado desconocido'}
                </div>
                {isVirtual && <div style={{ marginTop: 6, color: '#f59e42', fontWeight: 600 }}>
                  Sin habitación asignada — {r.cantidad > 1 ? `${r.cantidad} habitaciones` : '1 habitación'} pendiente(s)
                </div>}
              </div>
            );
          })}
        </aside>
      </div>
    </DragDropContext>
  );
};

export default RoomCalendar;
