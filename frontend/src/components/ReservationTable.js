// components/ReservationTable.js
// Tabla de gestión visual de reservas (CRUD)
import React, { useEffect, useState } from 'react';

// Usar rutas relativas y apiFetch('/api/...') para manejar base URL y Authorization
const API_RESERVATIONS = '/api/reservations';
const API_ROOMS = '/api/rooms';
const API_USERS = '/api/users';

const ReservationTable = () => {
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ tipo: '', cantidad: 1, user: '', checkIn: '', checkOut: '', status: 'reservada', nombre: '', apellido: '', dni: '', email: '', whatsapp: '' });
  const [editingId, setEditingId] = useState(null);
  const [success, setSuccess] = useState('');
  const [assignModal, setAssignModal] = useState({ open: false, reservation: null, candidates: [], loading: false });
  const [selectedRooms, setSelectedRooms] = useState([]);

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
  }, []);

  // Crear o editar reserva
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_RESERVATIONS}/${editingId}` : API_RESERVATIONS;
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setError('No autorizado. Por favor, inicia sesión nuevamente.');
          return;
        }
        setError(data.message || 'Error al guardar reserva');
        return;
      }
      setSuccess(editingId ? 'Reserva actualizada con éxito.' : 'Reserva creada con éxito.');
      setForm({ tipo: '', cantidad: 1, user: '', checkIn: '', checkOut: '', status: 'reservada', nombre: '', apellido: '', dni: '', email: '', whatsapp: '' });
      setEditingId(null);
      fetchData();
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar reserva
  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta reserva?')) return;
    const { apiFetch } = await import('../utils/api');
    const res = await apiFetch(`${API_RESERVATIONS}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Error al eliminar reserva');
      return;
    }
    fetchData();
  };

  // Editar reserva
  const handleEdit = r => {
    setForm({
      tipo: r.tipo || '',
      cantidad: r.cantidad || 1,
      user: r.user,
      checkIn: r.checkIn ? r.checkIn.slice(0, 10) : '',
      checkOut: r.checkOut ? r.checkOut.slice(0, 10) : '',
      status: r.status,
      nombre: r.client?.nombre || '',
      apellido: r.client?.apellido || '',
      dni: r.client?.dni || '',
      email: r.client?.email || '',
      whatsapp: r.client?.whatsapp || ''
    });
    setEditingId(r._id);
  };

  // Asignar habitación manualmente a una reserva
  const openAssignModal = async (r) => {
    setAssignModal({ open: true, reservation: r, candidates: [], loading: true });
    try {
      const { apiFetch } = await import('../utils/api');
      const q = `?type=${encodeURIComponent(r.tipo)}&checkIn=${r.checkIn ? r.checkIn.slice(0,10) : ''}&checkOut=${r.checkOut ? r.checkOut.slice(0,10) : ''}`;
      const roomsRes = await apiFetch(`${API_ROOMS}/available${q}`);
      if (!roomsRes.ok) {
        const d = await roomsRes.json();
        setError(d.message || 'No se pudieron obtener habitaciones disponibles');
        setAssignModal({ open: false, reservation: null, candidates: [], loading: false });
        return;
      }
      const roomsData = await roomsRes.json();
      const candidates = Array.isArray(roomsData.candidates) ? roomsData.candidates : [];
      const rejected = Array.isArray(roomsData.rejected) ? roomsData.rejected : [];
        setAssignModal({ open: true, reservation: r, candidates, rejected, loading: false });
        setSelectedRooms([]);
    } catch (err) {
      setError('Error al obtener candidatos');
      setAssignModal({ open: false, reservation: null, candidates: [], rejected: [], loading: false });
    }
  };

  const doAssign = async (roomId) => {
    if (!assignModal.reservation) return;
    try {
      const { apiFetch } = await import('../utils/api');
      // si hay selectedRooms y su longitud > 0 usamos eso, sino usamos el roomId único
      const payloadRooms = selectedRooms.length > 0 ? selectedRooms : (roomId ? [roomId] : []);
      if (payloadRooms.length === 0) { setError('Seleccione al menos una habitación'); return; }
      const res = await apiFetch(`${API_RESERVATIONS}/${assignModal.reservation._id}/assign-room`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: payloadRooms })
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || 'Error asignando habitación');
        return;
      }
      setSuccess('Habitación(es) asignada(s) correctamente');
      setAssignModal({ open: false, reservation: null, candidates: [], loading: false });
      setSelectedRooms([]);
      fetchData();
    } catch (err) {
      setError('Error en asignación');
    }
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

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Gestión de reservas</h2>
      {loading && (
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, border: '5px solid #222', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, background: '#222', padding: 16, borderRadius: 12, alignItems: 'center' }}>
        {/* Fila 1: datos de la reserva */}
        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="">Tipo</option>
          <option value="doble">Doble</option>
          <option value="triple">Triple</option>
          <option value="cuadruple">Cuádruple</option>
        </select>
        <input type="number" min={1} value={form.cantidad} onChange={e => setForm({ ...form, cantidad: Math.max(1, Number(e.target.value)) })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 70 }} placeholder="Cant." />
        <input type="date" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="date" value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        {/* Fila 2: datos del cliente */}
        <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 120 }} placeholder="Nombre" />
        <input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 120 }} placeholder="Apellido" />
        <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 100 }} placeholder="DNI" />
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 160 }} placeholder="Email" />
        <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, width: 120 }} placeholder="WhatsApp" />
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 500, minWidth: 100 }} disabled={loading}>
          {loading ? (
            <span>
              <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #222', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
              Guardando...
            </span>
          ) : (editingId ? 'Actualizar' : 'Crear')}
        </button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ tipo: '', cantidad: 1, user: '', checkIn: '', checkOut: '', status: 'reservada', nombre: '', apellido: '', dni: '', email: '', whatsapp: '' }); setError(''); setSuccess(''); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Cancelar</button>}
      </form>
      {success && <div style={{ color: '#22c55e', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{success}</div>}
      {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{error}</div>}
      {!loading && (
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#18191A', color: '#fff' }}>
              <th style={{ padding: 10 }}>Tipo</th>
              <th style={{ padding: 10 }}>Cantidad</th>
              <th style={{ padding: 10 }}>Habitación asignada</th>
              <th style={{ padding: 10 }}>Usuario</th>
              <th style={{ padding: 10 }}>Cliente</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Check-in</th>
              <th style={{ padding: 10 }}>Check-out</th>
              <th style={{ padding: 10 }}>💰 Total</th>
              <th style={{ padding: 10 }}>💳 Estado Pago</th>
              <th style={{ padding: 10 }}>Estado</th>
              <th style={{ padding: 10 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
                <td style={{ padding: 10 }}>{r.tipo || '-'}</td>
                <td style={{ padding: 10 }}>{r.cantidad || 1}</td>
                <td style={{ padding: 10 }}>
                  {/* Si la reserva tiene habitación asignada, mostrarla */}
                  {Array.isArray(r.room)
                    ? r.room.map((roomObj, idx) => {
                        const roomData = rooms.find(room => room._id === (typeof roomObj === 'object' ? roomObj._id : roomObj));
                        return roomData ? roomData.number : '-';
                      }).join(', ')
                    : r.room && typeof r.room === 'object' && r.room.number
                      ? r.room.number
                      : r.room
                        ? (rooms.find(room => room._id === (typeof r.room === 'object' ? r.room._id : r.room))?.number || '-')
                        : (() => {
                            // Asignación virtual: buscar habitaciones del tipo y descontar plazas
                            const habitacionesTipo = rooms.filter(room => room.type === r.tipo && room.status === 'disponible');
                            if (habitacionesTipo.length === 0) return <span title="Sin stock disponible">Sin stock</span>;
                            // Si la cantidad reservada excede el stock, mostrar aviso de sobreventa
                            if (r.cantidad > habitacionesTipo.length) {
                              return <span style={{ color: '#ef4444', fontWeight: 700 }} title={`Sobreventa: ${r.cantidad - habitacionesTipo.length} reserva(s) sin stock disponible`}>Sobrevendida</span>;
                            }
                            // Para reservas por cantidad, mostrar los primeros 3 y un resumen si hay más
                            const asignadas = habitacionesTipo.slice(0, r.cantidad);
                            const maxShow = 3;
                            const visibles = asignadas.slice(0, maxShow);
                            const ocultas = asignadas.slice(maxShow);
                            return (
                              <>
                                {visibles.map(h => (
                                  <span key={h._id} style={{ color: '#f59e42', fontWeight: 600, marginRight: 4 }} title="Ocupada virtualmente por reserva, se asigna real en check-in">#{h.number} (Ocupada virtual)</span>
                                ))}
                                {ocultas.length > 0 && (
                                  <span style={{ color: '#f59e42', fontWeight: 600, cursor: 'pointer' }} title={ocultas.map(h => `#${h.number} (Ocupada virtual)`).join(', ')}>
                                    +{ocultas.length} más
                                  </span>
                                )}
                              </>
                            );
                          })()
                  }
                </td>
                <td style={{ padding: 10 }}> {
                  (r.user && typeof r.user === 'object' && r.user.name) ? r.user.name :
                  users.find(user => user._id === (typeof r.user === 'object' && r.user ? r.user._id : r.user))?.name || '-'
                }</td>
                <td style={{ padding: 10 }}>{r.client ? `${r.client.nombre || ''} ${r.client.apellido || ''}`.trim() || '-' : '-'}</td>
                <td style={{ padding: 10 }}>{r.client?.email || '-'}</td>
                <td style={{ padding: 10 }}>{r.checkIn ? r.checkIn.slice(0, 10) : '-'}</td>
                <td style={{ padding: 10 }}>{r.checkOut ? r.checkOut.slice(0, 10) : '-'}</td>
                <td style={{ padding: 10, fontWeight: 600, color: '#22c55e' }}>
                  {r.pricing && r.pricing.total ? `$ ${r.pricing.total.toLocaleString()}` : 'Sin precio'}
                </td>
                <td style={{ padding: 10 }}>
                  {r.payment && r.payment.status ? (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.85em',
                      fontWeight: 600,
                      color: 'white',
                      background: r.payment.status === 'pagado' ? '#22c55e' :
                                  r.payment.status === 'parcial' ? '#f59e0b' :
                                  r.payment.status === 'reembolsado' ? '#6b7280' : '#ef4444'
                    }}>
                      {r.payment.status === 'pagado' ? '✅ Pagado' :
                       r.payment.status === 'parcial' ? '⚠️ Parcial' :
                       r.payment.status === 'reembolsado' ? '↩️ Reembolso' : '⏳ Pendiente'}
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Sin info</span>
                  )}
                </td>
                <td style={{ padding: 10 }}>{r.status}</td>
                <td style={{ padding: 10 }}>
                  <button onClick={() => handleEdit(r)} style={{ marginRight: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Editar</button>
                  <button onClick={() => handleDelete(r._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Eliminar</button>
                  <button onClick={() => openAssignModal(r)} style={{ marginLeft: 8, background: '#f59e42', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}>Asignar habitación</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Modal simple para asignación */}
      {assignModal.open && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', color: '#fff', padding: 20, borderRadius: 8, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Asignar habitación para reserva {assignModal.reservation._id}</h3>
            {assignModal.loading ? <div>Cargando candidatos...</div> : (
              <div>
                {assignModal.candidates.length === 0 && assignModal.rejected && assignModal.rejected.length === 0 && <div>No hay habitaciones candidatas disponibles para estas fechas.</div>}
                {assignModal.candidates.map(c => (
                  <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      { (assignModal.reservation && (assignModal.reservation.cantidad || 1) > 1) && (
                        <input type="checkbox" checked={selectedRooms.includes(c._id)} onChange={(e) => {
                          if (e.target.checked) setSelectedRooms(prev => [...prev, c._id]);
                          else setSelectedRooms(prev => prev.filter(id => id !== c._id));
                        }} />
                      ) }
                      <div># {c.number} — {c.type} — {c.status}</div>
                    </div>
                    <div>
                      <button onClick={() => doAssign(c._id)} style={{ marginRight: 8, background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px' }}>Asignar</button>
                    </div>
                  </div>
                ))}
                {assignModal.rejected && assignModal.rejected.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Habitaciones no candidatas (razón)</div>
                    {assignModal.rejected.map(rj => {
                      const reasons = (rj.reason || '').split(';').map(part => (part === 'solapamiento' ? 'Solapamiento' : part === 'estado' ? 'Estado' : part));
                      const conflictIds = (rj.reasonDetails && rj.reasonDetails.conflictReservationIds) ? rj.reasonDetails.conflictReservationIds : [];
                      const tooltip = conflictIds.length > 0 ? `Solapa con reserva(s): ${conflictIds.join(', ')}` : (rj.reason === 'solapamiento' ? 'Solapa con una reserva existente en esas fechas' : (rj.reason && rj.reason.includes('estado') ? 'El estado de la habitación impide la asignación (mantenimiento/limpieza)' : rj.reason));
                      return (
                        <div key={rj._id} title={tooltip} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #333', color: '#999' }}>
                          <div># {rj.number} — {rj.type} — {rj.status}</div>
                          <div style={{ fontStyle: 'italic' }}>{reasons.join(', ')}{conflictIds.length>0 ? ` — Conflicta con: ${conflictIds.join(', ')}` : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button onClick={() => {
                    // si hay selectedRooms > 0 y la reserva pide multiples, permitir asignar en bloque
                    if (selectedRooms.length > 0) { doAssign(); return; }
                    setAssignModal({ open: false, reservation: null, candidates: [], loading: false });
                  }} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>{selectedRooms.length>0 ? `Asignar ${selectedRooms.length}` : 'Cerrar'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationTable;
