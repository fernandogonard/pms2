// components/ReceptionReservations.optimized.js
// Panel de recepcionista OPTIMIZADO con hooks centralizados
import React, { useCallback, useMemo, useState } from 'react';
import useReceptionReservations from '../hooks/useReceptionReservations';
import useWebSocket from '../hooks/useWebSocket';
import AdvancedReservationModal from './AdvancedReservationModal';

const ReceptionReservations = () => {
  const { data, loading, error: dataError, refetch } = useReceptionReservations();
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    room: '',
    date: ''
  });

  const reservations = data.reservations;
  const rooms = data.rooms;
  const users = data.users;

  // WebSocket con deduplicación
  useWebSocket({
    onMessage: payload => {
      if (!payload?.type?.startsWith('reservation_')) return false;
      refetch({ force: true });
      return true;
    },
    onError: msg => setError(msg),
    onClose: () => setError('Conexión en tiempo real desconectada.')
  });

  // Cambiar estado de reserva
  const handleStatus = useCallback(async (id, status) => {
    const { apiFetch } = await import('../utils/api');
    try {
      const res = await apiFetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Error al actualizar estado');
        return;
      }
      
      setError('');
      refetch({ force: true });
    } catch (err) {
      setError(err.message || 'Error de red');
    }
  }, [refetch]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Filtrado con memoización
  const filtered = useMemo(() => {
    return reservations.filter(r => {
      let match = true;
      
      if (filters.date) {
        match = match && r.checkIn && r.checkIn.slice(0, 10) === filters.date;
      }
      
      if (filters.status) {
        match = match && r.status === filters.status;
      }
      
      if (filters.room) {
        const roomId = typeof r.room === 'object' && r.room ? r.room._id : r.room;
        match = match && roomId === filters.room;
      }
      
      if (filters.search) {
        const userName = (r.user && typeof r.user === 'object' && r.user.name) 
          ? r.user.name 
          : users.find(u => u._id === (typeof r.user === 'object' && r.user ? r.user._id : r.user))?.name || '';
        const publicName = r.name || '';
        const email = r.email || '';
        const searchLower = filters.search.toLowerCase();
        
        match = match && (
          userName.toLowerCase().includes(searchLower) ||
          publicName.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower)
        );
      }
      
      return match;
    });
  }, [reservations, filters, users]);

  const tableStyle = {
    borderCollapse: 'collapse',
    width: '100%',
    background: '#1C1C1C',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  };

  const buttonStyle = {
    background: '#007BFF',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontWeight: 500,
    transition: 'background 0.3s',
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Reservas (todas)</h2>
      
      <button 
        onClick={() => setModalOpen(true)} 
        aria-label="Crear nueva reserva"
        style={{
          marginBottom: 16, 
          background: '#2563eb', 
          color: '#fff', 
          border: 'none', 
          borderRadius: 8, 
          padding: '10px 28px', 
          fontSize: 16, 
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Nueva reserva avanzada
      </button>
      
      <AdvancedReservationModal 
        isOpen={modalOpen} 
        onRequestClose={() => setModalOpen(false)} 
        afterReservation={() => refetch({ force: true })} 
      />

      {/* Filtros */}
      <div 
        role="search"
        aria-label="Filtros de búsqueda"
        style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}
      >
        <input 
          type="text" 
          placeholder="Buscar cliente, nombre o email" 
          value={filters.search} 
          onChange={e => handleFilterChange('search', e.target.value)}
          aria-label="Buscar por nombre o email"
          style={{ 
            background: '#18191A', 
            color: '#fff', 
            border: '1px solid #444', 
            borderRadius: 6, 
            padding: 8, 
            minWidth: 180,
            flex: '1 1 200px'
          }} 
        />
        
        <select 
          value={filters.status} 
          onChange={e => handleFilterChange('status', e.target.value)}
          aria-label="Filtrar por estado"
          style={{ 
            background: '#18191A', 
            color: '#fff', 
            border: '1px solid #444', 
            borderRadius: 6, 
            padding: 8 
          }}
        >
          <option value="">Todos los estados</option>
          <option value="reservada">Reservada</option>
          <option value="checkin">Check-in</option>
          <option value="checkout">Check-out</option>
          <option value="cancelada">Cancelada</option>
        </select>
        
        <select 
          value={filters.room} 
          onChange={e => handleFilterChange('room', e.target.value)}
          aria-label="Filtrar por habitación"
          style={{ 
            background: '#18191A', 
            color: '#fff', 
            border: '1px solid #444', 
            borderRadius: 6, 
            padding: 8 
          }}
        >
          <option value="">Todas las habitaciones</option>
          {rooms.map(room => (
            <option key={room._id} value={room._id}>
              #{room.number} ({room.type})
            </option>
          ))}
        </select>
        
        <input 
          type="date" 
          value={filters.date} 
          onChange={e => handleFilterChange('date', e.target.value)}
          aria-label="Filtrar por fecha de check-in"
          style={{ 
            background: '#18191A', 
            color: '#fff', 
            border: '1px solid #444', 
            borderRadius: 6, 
            padding: 8 
          }} 
        />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', margin: '24px 0' }} role="status" aria-live="polite">
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
          <span className="sr-only">Cargando reservas...</span>
        </div>
      )}

      {(error || dataError) && (
        <div 
          role="alert"
          style={{ color: '#ef4444', marginBottom: 8, fontWeight: 500 }}
        >
          {error || dataError}
        </div>
      )}

      {!loading && (
        <>
          <div style={{ marginBottom: 8, color: '#bbb' }}>
            Mostrando {filtered.length} de {reservations.length} reservas
          </div>
          
          <table role="table" style={tableStyle}>
            <thead>
              <tr style={{ background: '#18191A', color: '#fff' }}>
                <th scope="col" style={{ padding: 10 }}>Habitación</th>
                <th scope="col" style={{ padding: 10 }}>Cliente</th>
                <th scope="col" style={{ padding: 10 }}>Check-in</th>
                <th scope="col" style={{ padding: 10 }}>Check-out</th>
                <th scope="col" style={{ padding: 10 }}>Estado</th>
                <th scope="col" style={{ padding: 10 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
                  <td style={{ padding: 10 }}>
                    {(r.room && typeof r.room === 'object' && r.room.number) 
                      ? r.room.number 
                      : rooms.find(room => room._id === (typeof r.room === 'object' && r.room ? r.room._id : r.room))?.number || '-'}
                  </td>
                  <td style={{ padding: 10 }}>
                    {(r.user && typeof r.user === 'object' && r.user.name) 
                      ? r.user.name 
                      : users.find(user => user._id === (typeof r.user === 'object' && r.user ? r.user._id : r.user))?.name || r.name || '-'}
                  </td>
                  <td style={{ padding: 10 }}>{r.checkIn ? r.checkIn.slice(0, 10) : '-'}</td>
                  <td style={{ padding: 10 }}>{r.checkOut ? r.checkOut.slice(0, 10) : '-'}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: r.status === 'checkin' ? '#22c55e' : r.status === 'reservada' ? '#f59e42' : '#6b7280',
                      color: '#fff'
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: 10 }}>
                    {r.status === 'reservada' && (
                      <button 
                        onClick={() => handleStatus(r._id, 'checkin')} 
                        aria-label={`Hacer check-in de reserva ${r._id}`}
                        style={{ ...buttonStyle, marginRight: 8 }}
                      >
                        Check-in
                      </button>
                    )}
                    {r.status === 'checkin' && (
                      <button 
                        onClick={() => handleStatus(r._id, 'checkout')} 
                        aria-label={`Hacer check-out de reserva ${r._id}`}
                        style={buttonStyle}
                      >
                        Check-out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default ReceptionReservations;
