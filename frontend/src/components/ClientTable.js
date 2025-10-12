// components/ClientTable.js
// Gestión visual de clientes/huespedes (CRUD, búsqueda, historial)
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const API_CLIENTS = '/api/clients';

const ClientTable = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', whatsapp: '' });
  const [editingId, setEditingId] = useState(null);
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [reservations, setReservations] = useState([]);

  // Cargar clientes
  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_CLIENTS}?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [search]);

  // Crear o editar cliente
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_CLIENTS}/${editingId}` : API_CLIENTS;
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Error al guardar cliente');
        return;
      }
      setSuccess(editingId ? 'Cliente actualizado con éxito.' : 'Cliente creado con éxito.');
      setForm({ nombre: '', apellido: '', email: '', whatsapp: '' });
      setEditingId(null);
      fetchClients();
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar cliente
  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este cliente?')) return;
    const res = await apiFetch(`${API_CLIENTS}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Error al eliminar cliente');
      return;
    }
    fetchClients();
  };

  // Editar cliente
  const handleEdit = client => {
    setForm({
      nombre: client.nombre,
      apellido: client.apellido,
      email: client.email,
      whatsapp: client.whatsapp
    });
    setEditingId(client._id);
  };

  // Ver historial de reservas
  const handleShowHistory = async id => {
    setSelected(id);
    setReservations([]);
    setLoading(true);
    try {
      const res = await apiFetch(`${API_CLIENTS}/${id}`);
      if (!res.ok) {
        setError('No se pudo obtener el historial.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Gestión de clientes/huespedes</h2>
      <input type="text" placeholder="Buscar por nombre, apellido, email o whatsapp" value={search} onChange={e => setSearch(e.target.value)} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8, marginBottom: 16, width: 350 }} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#222', padding: 16, borderRadius: 12, alignItems: 'center' }}>
        <input type="text" placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="text" placeholder="Apellido" value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="email" placeholder="Correo electrónico" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="text" placeholder="WhatsApp" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 500, minWidth: 100 }} disabled={loading}>
          {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
        </button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ nombre: '', apellido: '', email: '', whatsapp: '' }); setError(''); setSuccess(''); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Cancelar</button>}
      </form>
      {success && <div style={{ color: '#22c55e', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{success}</div>}
      {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{error}</div>}
      {!loading && (
        <table style={{ borderCollapse: 'collapse', width: '100%', background: '#1C1C1C', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
          <thead>
            <tr style={{ background: '#18191A', color: '#fff' }}>
              <th style={{ padding: 10 }}>Nombre</th>
              <th style={{ padding: 10 }}>Apellido</th>
              <th style={{ padding: 10 }}>Correo electrónico</th>
              <th style={{ padding: 10 }}>WhatsApp</th>
              <th style={{ padding: 10 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
                <td style={{ padding: 10 }}>{client.nombre}</td>
                <td style={{ padding: 10 }}>{client.apellido}</td>
                <td style={{ padding: 10 }}>{client.email}</td>
                <td style={{ padding: 10 }}>{client.whatsapp}</td>
                <td style={{ padding: 10 }}>
                  <button onClick={() => handleEdit(client)} style={{ marginRight: 8, background: '#007BFF', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Editar</button>
                  <button onClick={() => handleDelete(client._id)} style={{ marginRight: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Eliminar</button>
                  <button onClick={() => handleShowHistory(client._id)} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 500 }}>Historial</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selected && (
        <div style={{ background: '#18191A', color: '#fff', borderRadius: 12, padding: 16, marginTop: 24 }}>
          <h3>Historial de reservas</h3>
          {reservations.length === 0 ? (
            <p>No hay reservas para este cliente.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', background: '#222', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
              <thead>
                <tr style={{ background: '#18191A', color: '#fff' }}>
                  <th style={{ padding: 8 }}>Check-in</th>
                  <th style={{ padding: 8 }}>Check-out</th>
                  <th style={{ padding: 8 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map(r => (
                  <tr key={r._id}>
                    <td style={{ padding: 8 }}>{r.checkIn ? r.checkIn.slice(0, 10) : ''}</td>
                    <td style={{ padding: 8 }}>{r.checkOut ? r.checkOut.slice(0, 10) : ''}</td>
                    <td style={{ padding: 8 }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={() => { setSelected(null); setReservations([]); }} style={{ marginTop: 12, background: '#444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px' }}>Cerrar</button>
        </div>
      )}
    </div>
  );
};

export default ClientTable;
