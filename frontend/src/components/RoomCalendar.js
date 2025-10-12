// components/RoomCalendar.js
// Calendario visual de ocupación de habitaciones
import React, { useEffect, useState } from 'react';
import { createWS } from '../utils/wsClient';
import './AccessibilityFeatures.css';

const RoomCalendar = () => {
  const [roomsData, setRoomsData] = useState([]);
  const [overbooked, setOverbooked] = useState({});
  const [assignments, setAssignments] = useState({});
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]);
  const [wsError, setWsError] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { apiFetch } = await import('../utils/api');
        
        // Calcular rango de fechas (14 días desde hoy para mostrar todas las reservas)
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const startDateStr = startDate.toISOString().slice(0, 10);
        
        const [roomsStatusRes, reservationsRes] = await Promise.all([
          apiFetch(`/api/rooms/status?start=${startDateStr}&days=14`),
          apiFetch('/api/reservations')
        ]);
        
        const statusData = await roomsStatusRes.json();
        const reservationsData = await (reservationsRes.ok ? reservationsRes.json() : []);
        
        // El backend ya calcula todo correctamente
        // Debug: Log para verificar los datos del backend
        console.log('Datos del backend:', {
          statusData,
          reservationsData,
          startDate: startDateStr,
          days: 14
        });
        
        setRoomsData(statusData.rooms || []);
        setOverbooked(statusData.overbooked || {});
        setAssignments(statusData.assignments || {});
        setReservations(Array.isArray(reservationsData) ? reservationsData : []);

        // Generar lista de días (14 días)
        const daysList = [];
        for (let i = 0; i < 14; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          daysList.push(d.toISOString().slice(0, 10));
        }
        setDays(daysList);
        setLoading(false);
      } catch (err) {
        console.error('Error loading calendar data:', err);
        setLoading(false);
      }
    };
    fetchAll();
    // WebSocket para refresco en tiempo real
    setWsError(false);
    // Importar el servicio de redirección de puertos
    const redirectorService = require('../services/redirectorService');
    
    const buildWsBase = () => {
      // Intentar usar el puerto descubierto por el redirectorService
      const wsUrl = redirectorService.getWebSocketUrl();
      if (wsUrl) {
        return wsUrl.replace('/ws', '');
      }
      
      // Fallback al método anterior
      const wsEnv = process.env.REACT_APP_WS_URL && process.env.REACT_APP_WS_URL.trim();
      const apiEnv = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim();
      let base = wsEnv || apiEnv || (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost:5002';
      if (!wsEnv && !apiEnv && typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
        const p = window.location.port;
        if (p === '3000' || p === '3001') {
          // Obtener el puerto guardado del localStorage o usar el puerto por defecto
          const savedPort = localStorage.getItem('backend-port') || '5002';
          base = base.replace(/:30(00|01)$/, `:${savedPort}`);
        }
      }
      if (!/^wss?:\/\//i.test(base)) {
        base = base.replace(/^http/i, 'ws');
      }
      return base;
    };
    const wsUrl = `${buildWsBase().replace(/\/$/, '')}/ws`;
    const client = createWS(wsUrl, {
      onopen: () => setWsError(false),
      onmessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && data.type.startsWith('reservation_')) fetchAll();
        } catch (e) {}
      },
      onclose: () => setWsError(true),
      onerror: () => setWsError(true)
    });
    return () => client.close();
  }, []);

  if (loading) return <p>Cargando calendario...</p>;
  // mostrar aviso de WS si está desconectado pero permitir ver calendario estático
  const wsNotice = wsError ? (
    <div style={{background:'#ef4444',color:'#fff',padding:12,borderRadius:8,marginBottom:12,fontWeight:600}}>
      Conexión en tiempo real desconectada. Los datos mostrados son la última carga estática.
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32 }}>
      <div style={{ overflowX: 'auto', flex: 1 }}>
      {wsNotice}
      <div className="calendar-status-legend">
        <div className="calendar-status-item">
          <div className="calendar-status-color room-status-occupied" /> <span>🏠 Ocupada</span>
        </div>
        <div className="calendar-status-item status-tooltip" data-tooltip="Reserva confirmada pero sin check-in realizado">
          <div className="calendar-status-color room-status-reserved" /> <span>📋 Reservada (sin check-in)</span>
        </div>
        <div className="calendar-status-item status-tooltip" data-tooltip="Huésped ya realizó el check-in">
          <div className="calendar-status-color room-status-checkedin" /> <span>✅ Check-in realizado</span>
        </div>
        <div className="calendar-status-item">
          <div className="calendar-status-color room-status-maintenance" /> <span>🔧 Mantenimiento</span>
        </div>
        <div className="calendar-status-item">
          <div className="calendar-status-color room-status-cleaning" /> <span>🧹 Limpieza</span>
        </div>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: '#00f', color: '#fff' }}>
            <th style={{ padding: 8 }}>Habitación</th>
            {days.map(day => (
              <th key={day} style={{ padding: 8, position: 'relative' }}>
                {day}
                {/* Mostrar aviso de sobreventa si existe para algún tipo ese día */}
                {Object.entries(overbooked).map(([tipo, dias]) => (
                  dias[day] ? (
                    <span key={tipo} style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 11,
                      borderRadius: 4,
                      padding: '2px 6px',
                      zIndex: 2
                    }} title={`Sobreventa: ${dias[day]} reserva(s) de tipo ${tipo} sin stock disponible`}>
                      ¡Sobreventa!
                    </span>
                  ) : null
                ))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roomsData.map(room => (
            <tr key={room._id} style={{ background: '#fff', color: '#0a0a0a' }}>
              <td style={{ padding: 8, fontWeight: 'bold' }}>#{room.number}</td>
              {days.map(day => {
                // El backend ya calculó el estado correcto para cada día
                const estado = room.calendar && room.calendar[day] ? room.calendar[day] : 'disponible';
                let bg = '#e0e0e0', color = '#0a0a0a', label = '', icon = '';

                // Buscar la reserva activa para este día y habitación para verificar su status
                const reservaActiva = reservations.find(r => {
                  if (!r.checkIn || !r.checkOut) return false;
                  const checkInDate = r.checkIn.slice(0, 10);
                  const checkOutDate = r.checkOut.slice(0, 10);
                  const isInRange = day >= checkInDate && day < checkOutDate;
                  
                  // Verificar si esta habitación está asignada a esta reserva
                  const assignedRoomIds = assignments[r._id] || [];
                  const isAssignedToThisRoom = assignedRoomIds.includes(room._id);
                  
                  // Debug solo cuando sea necesario
                  if (isInRange && isAssignedToThisRoom && room.number === 107) {
                    console.log(`🔍 Reserva #107:`, r._id, r.status);
                  }
                  
                  return isInRange && isAssignedToThisRoom;
                });

                // Mapear los estados del backend a colores y etiquetas
                switch (estado) {
                  case 'mantenimiento':
                    bg = '#2563eb'; color = '#fff'; label = 'Mantenimiento'; icon = '🔧';
                    break;
                  case 'limpieza':
                    bg = '#22d3ee'; color = '#0a0a0a'; label = 'Limpieza'; icon = '🧹';
                    break;
                  case 'ocupada':
                    // Diferenciar entre reservada y con check-in realizado
                    if (reservaActiva && reservaActiva.status === 'checkin') {
                      bg = '#22c55e'; color = '#fff'; label = 'Check-in OK'; icon = '✅';
                    } else {
                      bg = '#0a0a0a'; color = '#fff'; label = 'Ocupada'; icon = '🏠';
                    }
                    break;
                  case 'ocupada_virtual':
                    // También diferenciar el estado virtual
                    if (reservaActiva && reservaActiva.status === 'checkin') {
                      bg = '#22c55e'; color = '#fff'; 
                      label = 'Check-in OK'; icon = '✅';
                    } else {
                      bg = '#f59e42'; color = '#fff'; 
                      label = 'Reservada'; icon = '📋';
                    }
                    break;
                  case 'disponible':
                  default:
                    bg = '#e0e0e0'; color = '#0a0a0a'; label = 'Libre'; icon = '';
                    break;
                }

                return (
                  <td key={day} style={{ 
                    padding: 6, 
                    background: bg, 
                    color,
                    textAlign: 'center',
                    fontSize: '11px',
                    position: 'relative',
                    minWidth: '80px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexDirection: 'column' }}>
                      {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
                      <span style={{ lineHeight: '1.1' }}>{label}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Panel lateral con reservas visibles en el rango */}
      <aside style={{ width: 420, maxHeight: 520, overflowY: 'auto', background: '#0a0a0a', color: '#fff', padding: 12, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Reservas visibles ({reservations.length})</h3>
        {reservations.length === 0 && <div style={{ color: '#bbb' }}>No hay reservas activas.</div>}
        {reservations.map(r => {
          const checkIn = r.checkIn ? r.checkIn.slice(0,10) : '-';
          const checkOut = r.checkOut ? r.checkOut.slice(0,10) : '-';
          
          // Verificar si la reserva tiene habitaciones asignadas usando assignments del backend
          const assignedRoomIds = assignments[r._id] || [];
          const isVirtual = !assignedRoomIds || assignedRoomIds.length === 0;
          
          let assignedRoomText = '—';
          if (!isVirtual) {
            // Encontrar los números de habitación basándose en los IDs asignados
            const assignedRoomNumbers = assignedRoomIds.map(roomId => {
              const room = roomsData.find(rm => rm._id === roomId);
              return room ? `#${room.number}` : `#${roomId}`;
            });
            assignedRoomText = assignedRoomNumbers.join(', ');
          }
          
          // Mostrar solo las reservas que intersectan la ventana de días
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
                color: r.status === 'checkin' ? '#fff' : r.status === 'reservada' ? '#fff' : '#fff'
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
  );
};

export default RoomCalendar;
