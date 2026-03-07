// components/RoomTable.js
// Tabla de gestión visual de habitaciones (CRUD)
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const API_ROOMS = '/api/rooms';
const API_RESERVATIONS = '/api/reservations';

const RoomTable = () => {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ number: '', floor: '', type: 'doble', price: '', status: 'disponible' });
  const [editingId, setEditingId] = useState(null);
  const [success, setSuccess] = useState('');

  // Cargar habitaciones y reservas activas
  const fetchRoomsAndReservations = async () => {
    try {
      setLoading(true);
      const [roomsRes, reservationsRes] = await Promise.all([
        apiFetch(API_ROOMS, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Expires': '0'
          }
        }),
        apiFetch(API_RESERVATIONS)
      ]);
      
      const roomsData = await roomsRes.json();
      const reservationsData = await reservationsRes.json();
      
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      // Filtrar solo reservas con check-in
      const activeCheckins = Array.isArray(reservationsData) 
        ? reservationsData.filter(r => r.status === 'checkin') 
        : [];
      setReservations(activeCheckins);
    } catch (e) {
      setError('No se pudieron cargar las habitaciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomsAndReservations();
    // Actualizar cada 60s como respaldo (WebSocket gestionado desde wsClient global)
    const interval = setInterval(fetchRoomsAndReservations, 60000);
    return () => clearInterval(interval);
  }, []);

  // Crear o editar habitación
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_ROOMS}/${editingId}` : API_ROOMS;
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Error al guardar habitación');
        return;
      }
      setSuccess(editingId ? 'Habitación actualizada con éxito.' : 'Habitación creada con éxito.');
      setForm({ number: '', floor: '', type: 'doble', price: '', status: 'disponible' });
      setEditingId(null);
      fetchRoomsAndReservations();
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar habitación
  const handleDelete = async id => {
    if (!window.confirm('\u00bfEliminar esta habitación?')) return;
    const res = await apiFetch(`${API_ROOMS}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Error al eliminar habitación');
      return;
    }
    fetchRoomsAndReservations();
  };

  // Editar habitación
  const handleEdit = room => {
    setForm({
      number: room.number,
      floor: room.floor,
      type: room.type,
      price: room.price,
      status: room.status
    });
    setEditingId(room._id);
  };

  // Cambio rápido de estado (limpieza / disponible / mantenimiento)
  const handleSetStatus = async (roomId, newStatus, roomNumber) => {
    const labels = { limpieza: 'enviar a limpieza', disponible: 'marcar como disponible', mantenimiento: 'enviar a mantenimiento' };
    if (!window.confirm(`¿Confirmar: ${labels[newStatus] || newStatus} la Hab. ${roomNumber}?`)) return;
    setError(''); setSuccess('');
    try {
      const res = await apiFetch(`${API_ROOMS}/${roomId}/set-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Error'); return; }
      setSuccess(data.message);
      fetchRoomsAndReservations();
    } catch { setError('Error de red'); }
  };

  // Completar tarea de housekeeping (repaso / limpieza profunda / limpieza checkout)
  const handleCompleteTask = async (roomId, task) => {
    const labels = { repaso: 'repaso', limpieza_profunda: 'limpieza profunda', limpieza_checkout: 'limpieza post-checkout' };
    if (!window.confirm(`¿Confirmar ${labels[task] || 'tarea'} completado?`)) return;
    setError(''); setSuccess('');
    try {
      const res = await apiFetch(`${API_ROOMS}/${roomId}/complete-task`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Error al completar tarea'); return; }
      setSuccess(data.message || 'Tarea completada');
      fetchRoomsAndReservations();
    } catch { setError('Error de red'); }
  };

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

  // Ordenar habitaciones por número (numérico ascendente)
  const sortedRooms = [...rooms].sort((a, b) => Number(a.number) - Number(b.number));

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Gestión de habitaciones</h2>
      {loading && (
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, border: '5px solid #222', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
        </div>
      )}
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#222', padding: 16, borderRadius: 12, alignItems: 'center' }}>
        <input type="number" placeholder="Número" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="number" placeholder="Piso" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="doble">Doble</option>
          <option value="triple">Triple</option>
          <option value="cuadruple">Cuádruple</option>
        </select>
        <input type="number" placeholder="Precio" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="disponible">Disponible</option>
          <option value="ocupada">Ocupada</option>
          <option value="limpieza">Limpieza</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 500, minWidth: 100 }} disabled={loading}>
          {loading ? (
            <span>
              <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #222', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
              Guardando...
            </span>
          ) : (editingId ? 'Actualizar' : 'Crear')}
        </button>
  {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ number: '', floor: '', type: 'doble', price: '', status: 'disponible' }); setError(''); setSuccess(''); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Cancelar</button>}
      </form>
  {success && <div style={{ color: '#22c55e', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{success}</div>}
  {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{error}</div>}
      {!loading && (
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#18191A', color: '#fff' }}>
              <th style={{ padding: 10 }}>Número</th>
              <th style={{ padding: 10 }}>Piso</th>
              <th style={{ padding: 10 }}>Tipo</th>
              <th style={{ padding: 10 }}>Precio</th>
              <th style={{ padding: 10 }}>Estado</th>
              <th style={{ padding: 10 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedRooms.map(room => {
              // Determinar estado real combinando estado físico y reservas activas con check-in
              const hasActiveCheckin = reservations.some(res => 
                Array.isArray(res.room) 
                  ? res.room.some(r => r === room._id || r._id === room._id) 
                  : res.room === room._id || res.room?._id === room._id
              );
              
              const realStatus = hasActiveCheckin ? 'ocupada' : room.status;
              
              // Estilo condicional según estado
              let statusStyle = { color: '#22c55e', fontWeight: 600 }; // verde para disponible
              if (realStatus === 'ocupada') statusStyle = { color: '#ef4444', fontWeight: 600 }; // rojo para ocupada
              if (realStatus === 'limpieza') statusStyle = { color: '#eab308', fontWeight: 600 }; // amarillo para limpieza
              if (realStatus === 'mantenimiento') statusStyle = { color: '#3b82f6', fontWeight: 600 }; // azul para mantenimiento
              
              return (
                <tr key={room._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
                  <td style={{ padding: 10 }}>{room.number}</td>
                  <td style={{ padding: 10 }}>{room.floor}</td>
                  <td style={{ padding: 10 }}>{room.type}</td>
                  <td style={{ padding: 10 }}>${room.price}</td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={statusStyle}>
                        {room.status === 'disponible' ? '✅ Disponible' :
                         room.status === 'ocupada' ? '🔴 Ocupada' :
                         room.status === 'limpieza' ? '🧹 Limpieza' :
                         '🔧 Mantenimiento'}
                      </span>
                      {room.pendingHousekeeping && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: room.pendingHousekeeping === 'repaso' ? '#1e3a5f' :
                                      room.pendingHousekeeping === 'limpieza_profunda' ? '#3b1e5f' : '#5f1e1e',
                          color: room.pendingHousekeeping === 'repaso' ? '#60a5fa' :
                                 room.pendingHousekeeping === 'limpieza_profunda' ? '#c084fc' : '#fca5a5'
                        }}>
                          {room.pendingHousekeeping === 'repaso' ? '🧹 Repaso pendiente' :
                           room.pendingHousekeeping === 'limpieza_profunda' ? '🧼 Limpieza profunda' :
                           '🚪 Limpiar post-checkout'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {room.pendingHousekeeping && (
                        <button
                          onClick={() => handleCompleteTask(room._id, room.pendingHousekeeping)}
                          style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}
                        >
                          {room.pendingHousekeeping === 'repaso' ? '✅ Repaso hecho' :
                           room.pendingHousekeeping === 'limpieza_profunda' ? '✅ Limpieza hecha' :
                           '✅ Disponible'}
                        </button>
                      )}
                      {/* Botones de cambio rápido de estado */}
                      {(room.status === 'ocupada' || room.status === 'disponible') && (
                        <button
                          onClick={() => handleSetStatus(room._id, 'limpieza', room.number)}
                          style={{ background: '#92400e', color: '#fde68a', border: 'none', borderRadius: 6, padding: '6px 10px', fontWeight: 600, fontSize: 12 }}
                          title="Enviar a limpieza manualmente">
                          🧹 Limpieza
                        </button>
                      )}
                      {room.status === 'limpieza' && (
                        <button
                          onClick={() => handleSetStatus(room._id, 'disponible', room.number)}
                          style={{ background: '#14532d', color: '#86efac', border: 'none', borderRadius: 6, padding: '6px 10px', fontWeight: 600, fontSize: 12 }}
                          title="Marcar como disponible">
                          ✅ Disponible
                        </button>
                      )}
                      {(room.status === 'disponible' || room.status === 'limpieza') && (
                        <button
                          onClick={() => handleSetStatus(room._id, 'mantenimiento', room.number)}
                          style={{ background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 6, padding: '6px 10px', fontWeight: 600, fontSize: 12 }}
                          title="Enviar a mantenimiento">
                          🔧 Mant.
                        </button>
                      )}
                      <button onClick={() => handleEdit(room)} style={{ ...buttonStyle }}>Editar</button>
                      <button onClick={() => handleDelete(room._id)} style={{ ...buttonStyle, background: '#ef4444' }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RoomTable;
