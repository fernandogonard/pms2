// components/ReservationTable.js
// Tabla de gestión visual de reservas (CRUD)
import React, { useEffect, useState } from 'react';

// Construye un link wa.me con el mensaje de confirmación pre-completado
function buildWaLink(r) {
  const phone = r.client?.whatsapp;
  if (!phone) return null;
  const n = String(phone).replace(/\D/g, '');
  const normalized = n.startsWith('54') ? n : '54' + (n.startsWith('0') ? n.slice(1) : n);
  const ref   = r._id ? String(r._id).slice(-6).toUpperCase() : '------';
  const ci    = r.checkIn  ? new Date(r.checkIn).toLocaleDateString('es-AR')  : '-';
  const co    = r.checkOut ? new Date(r.checkOut).toLocaleDateString('es-AR') : '-';
  const tipo  = (r.tipo || '').toUpperCase();
  const total = r.pricing?.total ? `$${r.pricing.total.toLocaleString('es-AR')}` : 'a confirmar';
  const nombre = r.client?.nombre || 'Huésped';
  const msg =
    `\ud83c\udfe8 *MiHotel* \u2014 Confirmación de reserva\n\n` +
    `Hola *${nombre}*, tu reserva fue registrada \u2705\n\n` +
    `\ud83d\udccb *Referencia:* #${ref}\n` +
    `\ud83d\udecf\ufe0f *Tipo:* ${tipo}\n` +
    `\ud83d\udcc5 *Check-in:* ${ci}\n` +
    `\ud83d\udcc5 *Check-out:* ${co}\n` +
    `\ud83d\udcb0 *Total:* ${total}\n\n` +
    `\u00a1Te esperamos!`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
}

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
  const [clientLookup, setClientLookup] = useState(null); // null | 'searching' | 'found' | 'new'

  // —— Filtros de búsqueda ——————————————————————————————————————
  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // —— Modal de checkout con pagos ————————————————————————————————
  // null | { id, reservationName, billing: null|data, payments: [{amount,method,notes}], loading, submitting, error }
  const [checkoutModal, setCheckoutModal] = useState(null);
  const [viewPaymentsModal, setViewPaymentsModal] = useState(null); // null | { nombre, paymentHistory, total, paid }

  // —— DNI autocomplete: buscar cliente existente al escribir el DNI ————————————————
  useEffect(() => {
    if (!form.dni || form.dni.length < 7 || editingId) { setClientLookup(null); return; }
    setClientLookup('searching');
    const timer = setTimeout(async () => {
      try {
        const { apiFetch } = await import('../utils/api');
        const res = await apiFetch(`/api/clients/lookup?dni=${encodeURIComponent(form.dni)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.found && data.client) {
            setForm(prev => ({
              ...prev,
              nombre:   data.client.nombre   || prev.nombre,
              apellido: data.client.apellido || prev.apellido,
              email:    data.client.email    || prev.email,
              whatsapp: data.client.whatsapp || prev.whatsapp,
            }));
            setClientLookup('found');
          } else {
            setClientLookup('new');
          }
        } else {
          setClientLookup('new');
        }
      } catch { setClientLookup(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.dni, editingId]);

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
      setClientLookup(null);
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

  // Check-in
  const handleCheckin = async id => {
    if (!window.confirm('¿Confirmar check-in?')) return;
    setError(''); setSuccess('');
    const { apiFetch } = await import('../utils/api');
    const res = await apiFetch(`${API_RESERVATIONS}/${id}/checkin`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setError(data.message || data.error || 'Error al hacer check-in'); return; }
    setSuccess('Check-in realizado correctamente');
    fetchData();
  };

  // Check-out — abre modal de caja para registrar pago antes de confirmar
  const openCheckoutModal = async (id) => {
    const r = reservations.find(res => res._id === id);
    const nombre = r?.client ? `${r.client.nombre || ''} ${r.client.apellido || ''}`.trim() : 'Huésped';
    setCheckoutModal({ id, reservationName: nombre, billing: null, payments: [{ amount: '', method: 'efectivo', notes: '' }], loading: true, submitting: false, error: '' });
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch(`/api/billing/reservations/${id}`);
      const data = await res.json();
      if (data.success) {
        setCheckoutModal(prev => ({ ...prev, billing: data.data, loading: false }));
      } else {
        setCheckoutModal(prev => ({ ...prev, loading: false, error: data.message || 'Error cargando factura' }));
      }
    } catch {
      setCheckoutModal(prev => ({ ...prev, loading: false, error: 'Error de red' }));
    }
  };

  const handleCheckoutConfirm = async () => {
    if (!checkoutModal) return;
    const { id, payments, billing } = checkoutModal;
    const total     = billing?.balance?.total   || billing?.pricing?.total || 0;
    const alreadyPd = billing?.balance?.paid    || billing?.payment?.amountPaid || 0;
    const saldo     = Math.max(0, total - alreadyPd);
    const validPays = payments.filter(p => p.amount && parseFloat(p.amount) > 0);
    if (saldo > 0.01 && validPays.length === 0) {
      setCheckoutModal(prev => ({ ...prev, error: 'Hay saldo pendiente. Ingresá al menos un pago o marcá como "sin cobro".' }));
      return;
    }
    setCheckoutModal(prev => ({ ...prev, submitting: true, error: '' }));
    const { apiFetch } = await import('../utils/api');
    for (const p of validPays) {
      try {
        await apiFetch(`/api/billing/reservations/${id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(p.amount), method: p.method, notes: p.notes || '' })
        });
      } catch { /* si falla un pago individual no bloqueamos el checkout */ }
    }
    const res = await apiFetch(`${API_RESERVATIONS}/${id}/checkout`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setCheckoutModal(prev => ({ ...prev, submitting: false, error: data.message || data.error || 'Error al hacer check-out' }));
      return;
    }
    setCheckoutModal(null);
    setSuccess('Check-out realizado correctamente');
    fetchData();
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

      {/* ── Barra de filtros ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, background: '#1a1a2e', padding: 12, borderRadius: 10, alignItems: 'center' }}>
        <input placeholder="Buscar nombre, apellido, DNI..." value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 10px', minWidth: 200, fontSize: 13 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
          <option value="">Todos los estados</option>
          <option value="reservada">⏳ Reservada</option>
          <option value="checkin">✅ Check-in</option>
          <option value="checkout">🚪 Check-out</option>
          <option value="cancelada">❌ Cancelada</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa' }}>
          Check-in desde
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
          hasta
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
        </div>
        {(filterSearch || filterStatus || filterFrom || filterTo) && (
          <button onClick={() => { setFilterSearch(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}
            style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div> style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, background: '#222', padding: 16, borderRadius: 12, alignItems: 'center' }}>
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
        <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: `1px solid ${clientLookup === 'found' ? '#22c55e' : clientLookup === 'new' ? '#f59e0b' : '#444'}`, borderRadius: 6, padding: 8, width: 100 }} placeholder="DNI" />
        {clientLookup === 'searching' && <span style={{ color: '#60a5fa', fontSize: 12 }}>⏳ buscando…</span>}
        {clientLookup === 'found' && <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✅ Cliente encontrado</span>}
        {clientLookup === 'new' && <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>🆕 Cliente nuevo</span>}
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
      {!loading && (() => {
        const filtered = reservations.filter(r => {
          if (filterStatus && r.status !== filterStatus) return false;
          if (filterFrom && r.checkIn && r.checkIn.slice(0, 10) < filterFrom) return false;
          if (filterTo   && r.checkIn && r.checkIn.slice(0, 10) > filterTo)   return false;
          if (filterSearch) {
            const q = filterSearch.toLowerCase();
            const nombre   = (r.client?.nombre   || r.nombre   || '').toLowerCase();
            const apellido = (r.client?.apellido || r.apellido || '').toLowerCase();
            const dni      = (r.client?.dni      || r.dni      || '').toLowerCase();
            if (!nombre.includes(q) && !apellido.includes(q) && !dni.includes(q)) return false;
          }
          return true;
        });
        return (
        <>
        {(filterSearch || filterStatus || filterFrom || filterTo) && (
          <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>
            Mostrando {filtered.length} de {reservations.length} reservas
          </div>
        )}
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
            {filtered.map(r => (
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {r.status === 'reservada' && (
                      <button onClick={() => handleCheckin(r._id)} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}>✅ Check-in</button>
                    )}
                    {r.status === 'checkin' && (
                      <button onClick={() => openCheckoutModal(r._id)} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}>🚪 Check-out</button>
                    )}
                    {r.status === 'checkout' && (
                      <button onClick={() => {
                        const nombre = r.client ? `${r.client.nombre||''} ${r.client.apellido||''}`.trim() : 'Huésped';
                        setViewPaymentsModal({ nombre, paymentHistory: r.paymentHistory || [], total: r.pricing?.total || 0, paid: r.payment?.amountPaid || 0, extras: r.extras || [] });
                      }} style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1e4080', borderRadius: 6, padding: '6px 11px', fontWeight: 600, fontSize: 12 }}>
                        🧾 Ver Pagos
                      </button>
                    )}
                    {(() => { const waLink = buildWaLink(r); return waLink ? (
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        title="Enviar confirmación por WhatsApp"
                        style={{ background: '#25d366', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, textDecoration: 'none', fontSize: 13 }}
                      >📲 WA</a>
                    ) : null; })()}
                    <button onClick={() => handleEdit(r)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Editar</button>
                    <button onClick={() => handleDelete(r._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Eliminar</button>
                    <button onClick={() => openAssignModal(r)} style={{ background: '#f59e42', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}>Habitación</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
        );
        })()}
      {/* ═══════ MODAL CHECK-OUT CON CAJA DE PAGOS ═══════ */}
      {checkoutModal && (() => {
        const b     = checkoutModal.billing;
        const total = b?.balance?.total ?? b?.pricing?.total ?? 0;
        const paid  = b?.balance?.paid  ?? b?.payment?.amountPaid ?? 0;
        const saldo = Math.max(0, total - paid);
        const extras = b?.extras || [];
        const history = b?.paymentHistory || [];
        const paysSoFar = checkoutModal.payments.filter(p => p.amount && parseFloat(p.amount) > 0);
        const enteringNow = paysSoFar.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const saldoTrasNuevos = Math.max(0, saldo - enteringNow);
        const fmt = n => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
        const METHODS = [
          { value: 'efectivo',     label: '💵 Efectivo' },
          { value: 'tarjeta',      label: '💳 Tarjeta Crédito' },
          { value: 'debito',       label: '💳 Tarjeta Débito' },
          { value: 'transferencia',label: '🏦 Transferencia' },
          { value: 'cheque',       label: '📝 Cheque' },
        ];
        return (
          <div style={{ position: 'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
            <div style={{ background:'#111827', color:'#fff', borderRadius:14, width:560, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', border:'1px solid #374151' }}>
              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#1e3a5f,#0f172a)', padding:'20px 24px', borderRadius:'14px 14px 0 0', borderBottom:'1px solid #374151' }}>
                <h3 style={{ margin:0, color:'#60a5fa', fontSize:18, fontWeight:700 }}>🚪 Check-out — {checkoutModal.reservationName}</h3>
                <p style={{ margin:'4px 0 0', color:'#9ca3af', fontSize:13 }}>Registrá el pago antes de confirmar la salida</p>
              </div>

              <div style={{ padding:'20px 24px' }}>
                {/* Resumen de factura */}
                {checkoutModal.loading ? (
                  <div style={{ color:'#aaa', textAlign:'center', padding:24 }}>Cargando factura...</div>
                ) : b ? (
                  <>
                    <div style={{ background:'#1f2937', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', fontSize:13 }}>
                        <span style={{ color:'#9ca3af' }}>Total alojamiento:</span><span style={{ color:'#fff', fontWeight:600 }}>{fmt(b.pricing?.subtotal || b.pricing?.total)}</span>
                        {extras.length > 0 && <><span style={{ color:'#9ca3af' }}>Cargos extra:</span><span style={{ color:'#f59e0b', fontWeight:600 }}>{fmt(extras.reduce((s,e)=>s+(e.amount||0),0))}</span></>}
                        <span style={{ color:'#9ca3af' }}>TOTAL FACTURADO:</span><span style={{ color:'#22c55e', fontWeight:700, fontSize:15 }}>{fmt(total)}</span>
                        {paid > 0 && <><span style={{ color:'#9ca3af' }}>Ya cobrado:</span><span style={{ color:'#60a5fa', fontWeight:600 }}>- {fmt(paid)}</span></>}
                        <span style={{ color: saldo > 0.01 ? '#fbbf24' : '#9ca3af', fontWeight:700 }}>SALDO A COBRAR:</span>
                        <span style={{ color: saldo > 0.01 ? '#fbbf24' : '#22c55e', fontWeight:700, fontSize:15 }}>{saldo > 0.01 ? fmt(saldo) : '✅ Saldado'}</span>
                      </div>
                      {history.length > 0 && (
                        <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #374151' }}>
                          <div style={{ color:'#9ca3af', fontSize:11, marginBottom:6 }}>PAGOS YA REGISTRADOS:</div>
                          {history.map((h,i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#d1d5db', marginBottom:3 }}>
                              <span>{new Date(h.date).toLocaleDateString('es-AR')} — {h.method}</span>
                              <span style={{ color:'#22c55e' }}>{fmt(h.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulario de pagos */}
                    {saldo > 0.01 ? (
                      <>
                        <div style={{ color:'#e5e7eb', fontWeight:600, marginBottom:10, fontSize:14 }}>💳 Registrar pago{checkoutModal.payments.length > 1 ? 's' : ''}:</div>
                        {checkoutModal.payments.map((p, i) => (
                          <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                            <input
                              type="number" min="0" step="0.01" placeholder={`Monto ${i+1}`}
                              value={p.amount}
                              onChange={e => setCheckoutModal(prev => {
                                const pays = [...prev.payments];
                                pays[i] = { ...pays[i], amount: e.target.value };
                                return { ...prev, payments: pays };
                              })}
                              style={{ width:110, background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'7px 10px', fontSize:13 }}
                            />
                            <select
                              value={p.method}
                              onChange={e => setCheckoutModal(prev => {
                                const pays = [...prev.payments];
                                pays[i] = { ...pays[i], method: e.target.value };
                                return { ...prev, payments: pays };
                              })}
                              style={{ flex:1, background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'7px 8px', fontSize:13 }}
                            >
                              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <input
                              type="text" placeholder="Nota (opcional)"
                              value={p.notes}
                              onChange={e => setCheckoutModal(prev => {
                                const pays = [...prev.payments];
                                pays[i] = { ...pays[i], notes: e.target.value };
                                return { ...prev, payments: pays };
                              })}
                              style={{ width:110, background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'7px 8px', fontSize:12 }}
                            />
                            {checkoutModal.payments.length > 1 && (
                              <button onClick={() => setCheckoutModal(prev => ({ ...prev, payments: prev.payments.filter((_,j)=>j!==i) }))}
                                style={{ background:'#7f1d1d', color:'#fca5a5', border:'none', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontWeight:700 }}>✕</button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setCheckoutModal(prev => ({ ...prev, payments: [...prev.payments, { amount:'', method:'efectivo', notes:'' }] }))}
                          style={{ background:'#1f2937', color:'#9ca3af', border:'1px dashed #4b5563', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:12, marginBottom:12 }}
                        >+ Agregar otro método de pago</button>

                        {/* Resumen de lo que se va a cobrar ahora */}
                        <div style={{ background: saldoTrasNuevos < -0.5 ? '#7f1d1d22' : saldoTrasNuevos < 0.5 ? '#052e1622' : '#1c140022', border:`1px solid ${saldoTrasNuevos < -0.5 ? '#dc2626' : saldoTrasNuevos < 0.5 ? '#16a34a' : '#ca8a04'}`, borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13 }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ color:'#9ca3af' }}>Ingresando ahora:</span>
                            <span style={{ color:'#60a5fa', fontWeight:600 }}>{fmt(enteringNow)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                            <span style={{ fontWeight:700, color: saldoTrasNuevos < -0.5 ? '#f87171' : saldoTrasNuevos < 0.5 ? '#22c55e' : '#fbbf24' }}>
                              {saldoTrasNuevos < -0.5 ? '⚠️ Monto excede el saldo' : saldoTrasNuevos < 0.5 ? '✅ Saldo cubierto' : `Restante: ${fmt(saldoTrasNuevos)}`}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ background:'#052e16', border:'1px solid #16a34a', borderRadius:8, padding:'12px 16px', marginBottom:14, color:'#22c55e', fontWeight:600, fontSize:14 }}>
                        ✅ Esta reserva ya se encuentra totalmente saldada.
                      </div>
                    )}
                  </>
                ) : null}

                {checkoutModal.error && <div style={{ color:'#f87171', fontWeight:600, marginBottom:10, fontSize:13 }}>{checkoutModal.error}</div>}

                {/* Botones */}
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                  <button onClick={() => setCheckoutModal(null)} disabled={checkoutModal.submitting}
                    style={{ background:'#374151', color:'#d1d5db', border:'none', borderRadius:8, padding:'10px 22px', cursor:'pointer', fontWeight:600 }}>
                    Cancelar
                  </button>
                  <button onClick={handleCheckoutConfirm} disabled={checkoutModal.loading || checkoutModal.submitting}
                    style={{ background: checkoutModal.submitting ? '#555' : '#f59e0b', color:'#000', border:'none', borderRadius:8, padding:'10px 22px', cursor:checkoutModal.loading||checkoutModal.submitting?'not-allowed':'pointer', fontWeight:700, opacity:checkoutModal.loading?0.5:1 }}>
                    {checkoutModal.submitting ? 'Procesando...' : '🚪 Confirmar Check-out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ MODAL VER PAGOS (checkout completado) ═══════ */}
      {viewPaymentsModal && (() => {
        const { nombre, paymentHistory, total, paid, extras } = viewPaymentsModal;
        const fmt = n => `$${Math.round(n||0).toLocaleString('es-AR')}`;
        const MLABELS = { efectivo:'💵 Efectivo', tarjeta:'💳 T. Crédito', debito:'💳 T. Débito', transferencia:'🏦 Transferencia', cheque:'📝 Cheque' };
        const extrasTotal = (extras||[]).reduce((s,e)=>s+(e.amount||0),0);
        return (
          <div style={{ position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}
            onClick={() => setViewPaymentsModal(null)}>
            <div style={{ background:'#111827', color:'#fff', borderRadius:14, width:460, maxHeight:'80vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', border:'1px solid #374151' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background:'linear-gradient(135deg,#052e16,#0f172a)', padding:'18px 22px', borderRadius:'14px 14px 0 0', borderBottom:'1px solid #374151' }}>
                <h3 style={{ margin:0, color:'#22c55e', fontSize:17, fontWeight:700 }}>🧾 Comprobante de Pago</h3>
                <p style={{ margin:'3px 0 0', color:'#9ca3af', fontSize:13 }}>{nombre}</p>
              </div>
              <div style={{ padding:'18px 22px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px 14px', fontSize:13, marginBottom:16 }}>
                  {extrasTotal > 0 && <><span style={{ color:'#9ca3af' }}>Cargos extra:</span><span style={{ color:'#f59e0b', fontWeight:600 }}>{fmt(extrasTotal)}</span></>}
                  <span style={{ color:'#9ca3af' }}>Total facturado:</span><span style={{ color:'#22c55e', fontWeight:700 }}>{fmt(total)}</span>
                  <span style={{ color:'#9ca3af' }}>Total cobrado:</span><span style={{ color:'#60a5fa', fontWeight:700 }}>{fmt(paid)}</span>
                </div>
                {paymentHistory.length === 0 ? (
                  <div style={{ color:'#6b7280', textAlign:'center', padding:20 }}>Sin pagos registrados</div>
                ) : (
                  <>
                    <div style={{ color:'#9ca3af', fontSize:11, marginBottom:6, fontWeight:600 }}>HISTORIAL DE COBROS:</div>
                    {paymentHistory.map((h,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#1f2937', borderRadius:8, padding:'10px 14px', marginBottom:7 }}>
                        <div>
                          <div style={{ color:'#e5e7eb', fontWeight:600, fontSize:13 }}>{MLABELS[h.method] || h.method}</div>
                          <div style={{ color:'#6b7280', fontSize:11 }}>{new Date(h.date).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}{h.notes ? ' — '+h.notes : ''}</div>
                        </div>
                        <div style={{ color:'#22c55e', fontWeight:700, fontSize:16 }}>{fmt(h.amount)}</div>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #374151', paddingTop:10, marginTop:6 }}>
                      <span style={{ color:'#9ca3af', fontWeight:600 }}>TOTAL COBRADO</span>
                      <span style={{ color:'#22c55e', fontWeight:700, fontSize:17 }}>{fmt(paymentHistory.reduce((s,h)=>s+(h.amount||0),0))}</span>
                    </div>
                  </>
                )}
                <div style={{ textAlign:'right', marginTop:18 }}>
                  <button onClick={() => setViewPaymentsModal(null)} style={{ background:'#374151', color:'#d1d5db', border:'none', borderRadius:8, padding:'9px 22px', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
