// components/ReceptionReservations.js
// Panel de recepcionista: listado de reservas por fecha y check-in/check-out rápido
import React, { useEffect, useState } from 'react';
import { createWS } from '../utils/wsClient';
import AdvancedReservationModal from './AdvancedReservationModal';

// Usar apiFetch('/api/...') para inyectar REACT_APP_API_URL y Authorization
const API_RESERVATIONS = '/api/reservations';
const API_ROOMS = '/api/rooms';
const API_USERS = '/api/users';

const ReceptionReservations = () => {
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(''); // Ya no se filtra por fecha por defecto
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');

  // Cargar datos
  const fetchData = async () => {
    try {
      const { apiFetch } = await import('../utils/api');
      const [reservationsRes, roomsRes, usersRes] = await Promise.all([
        apiFetch(API_RESERVATIONS),
        apiFetch(API_ROOMS),
        apiFetch(API_USERS)
      ]);
      const reservationsData = await reservationsRes.json();
      const roomsData = await roomsRes.json();
      const usersData = await usersRes.json();
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setLoading(false);
    } catch (err) {
      setError('No se pudieron cargar los datos.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // WebSocket para refresco en tiempo real (con reconexión)
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
  const client = createWS(`${buildWsBase().replace(/\/$/, '')}/ws`, {
      onmessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && data.type.startsWith('reservation_')) fetchData();
        } catch (e) {}
      },
      onerror: () => setError('Error en la conexión en tiempo real. Reconectando...'),
      onclose: () => setError('Conexión en tiempo real desconectada. Reconectando...')
    });
    return () => client.close();
  }, []);

  // Cambiar estado de reserva (check-in/check-out)
  const handleStatus = async (id, status) => {
    const { apiFetch } = await import('../utils/api');
    const res = await apiFetch(`${API_RESERVATIONS}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Error al actualizar estado');
      return;
    }
    setError(''); // Limpiar mensaje de error
    fetchData();
  };

  // Filtros avanzados: habitación, estado, búsqueda, fecha (opcional)
  const filtered = reservations.filter(r => {
    let match = true;
    if (date) {
      match = match && r.checkIn && r.checkIn.slice(0, 10) === date;
    }
    if (statusFilter) {
      match = match && r.status === statusFilter;
    }
    if (roomFilter) {
      const roomId = typeof r.room === 'object' && r.room ? r.room._id : r.room;
      match = match && roomId === roomFilter;
    }
    if (search) {
      const userName = (r.user && typeof r.user === 'object' && r.user.name) ? r.user.name : users.find(u => u._id === (typeof r.user === 'object' && r.user ? r.user._id : r.user))?.name || '';
      const publicName = r.name || '';
      const email = r.email || '';
      match = match && (
        userName.toLowerCase().includes(search.toLowerCase()) ||
        publicName.toLowerCase().includes(search.toLowerCase()) ||
        email.toLowerCase().includes(search.toLowerCase())
      );
    }
    return match;
  });

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
      <button onClick={() => setModalOpen(true)} style={{marginBottom: 16, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 16, fontWeight: 600}}>Nueva reserva avanzada</button>
      <AdvancedReservationModal isOpen={modalOpen} onRequestClose={() => setModalOpen(false)} afterReservation={fetchData} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input type="text" placeholder="Buscar cliente, nombre o email" value={search} onChange={e => setSearch(e.target.value)} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, minWidth: 180 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="">Todos los estados</option>
          <option value="reservada">Reservada</option>
          <option value="checkin">Check-in</option>
          <option value="checkout">Check-out</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="">Todas las habitaciones</option>
          {rooms.map(room => <option key={room._id} value={room._id}>#{room.number} ({room.type})</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
      </div>
      {loading && (
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, border: '5px solid #222', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
        </div>
      )}
      {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 500 }}>{error}</div>}
      {!loading && (
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#18191A', color: '#fff' }}>
              <th style={{ padding: 10 }}>Habitación</th>
              <th style={{ padding: 10 }}>Cliente</th>
              <th style={{ padding: 10 }}>Check-in</th>
              <th style={{ padding: 10 }}>Check-out</th>
              <th style={{ padding: 10 }}>Estado</th>
              <th style={{ padding: 10 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
                <td style={{ padding: 10 }}>{
                  (r.room && typeof r.room === 'object' && r.room.number) ? r.room.number :
                  rooms.find(room => room._id === (typeof r.room === 'object' && r.room ? r.room._id : r.room))?.number || '-'
                }</td>
                <td style={{ padding: 10 }}>{
                  (r.user && typeof r.user === 'object' && r.user.name) ? r.user.name :
                  users.find(user => user._id === (typeof r.user === 'object' && r.user ? r.user._id : r.user))?.name || r.name || '-'
                }</td>
                <td style={{ padding: 10 }}>{r.checkIn ? r.checkIn.slice(0, 10) : '-'}</td>
                <td style={{ padding: 10 }}>{r.checkOut ? r.checkOut.slice(0, 10) : '-'}</td>
                <td style={{ padding: 10 }}>{r.status}</td>
                <td style={{ padding: 10 }}>
                  {r.status === 'reservada' && <button onClick={() => handleStatus(r._id, 'checkin')} style={{ ...buttonStyle, marginRight: 8 }}>Check-in</button>}
                  {r.status === 'checkin' && <button onClick={() => handleStatus(r._id, 'checkout')} style={buttonStyle}>Check-out</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReceptionReservations;
