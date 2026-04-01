// components/RoomCalendar.js
// Calendario visual de ocupación de habitaciones CON VIRTUALIZACIÓN Y CACHE
import React, { useMemo, useState } from 'react';
import { useCalendarData } from '../hooks/useCalendarData';
import { useWebSocket } from '../hooks/useWebSocket';

export const RoomCalendar = ({ startDate, days = 14 }) => {
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

  const calendarGrid = useMemo(() => {
    if (!data.length) return null;
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${days}, 1fr)`, gap: '1px', background: '#333' }}>
        <div style={{ background: '#222', color: '#fff', padding: '10px', fontWeight: 'bold' }}>Habitación</div>
        {dates.map(date => (
          <div key={date} style={{ background: '#222', color: '#fff', padding: '10px', fontWeight: 'bold', textAlign: 'center' }}>
            {new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
          </div>
        ))}
        {data.map(room => (
          <React.Fragment key={room.roomId}>
            <div style={{ background: '#18191A', color: '#fff', padding: '10px', cursor: 'pointer' }} onClick={() => setSelectedRoom(room)}>
              #{room.roomNumber} ({room.roomType})
            </div>
            {room.dates.map((day, index) => (
              <div
                key={index}
                style={{
                  background: day.status === 'available' ? '#22c55e' : day.status === 'reservada' ? '#f59e42' : '#ef4444',
                  padding: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  minHeight: '50px'
                }}
                onClick={() => setSelectedRoom({ ...room, selectedDate: day.date })}
              >
                {day.reservation ? (
                  <div style={{ fontSize: '12px', color: '#fff' }}>
                    {day.reservation.user}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#fff' }}>Libre</div>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  }, [data, days, startDate]);

  if (loading) return <div>Cargando calendario...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Calendario de Habitaciones</h2>
      {calendarGrid}
      {selectedRoom && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#222', color: '#fff' }}>
          <h3>Detalles de #{selectedRoom.roomNumber}</h3>
          {selectedRoom.selectedDate && (
            <p>Fecha: {selectedRoom.selectedDate}</p>
          )}
          {/* Más detalles aquí */}
        </div>
      )}
    </div>
  );
};
