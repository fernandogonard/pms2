// components/UserTable.js
// Tabla de gestión visual de usuarios (CRUD)
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const API_USERS = '/api/users';

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cliente' });
  const [editingId, setEditingId] = useState(null);
  const [success, setSuccess] = useState('');

  // Cargar usuarios
  const fetchUsers = async () => {
    try {
      const res = await apiFetch(API_USERS);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Crear o editar usuario
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_USERS}/${editingId}` : API_USERS;
      const body = { ...form };
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Error al guardar usuario');
        return;
      }
      setSuccess(editingId ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.');
      setForm({ name: '', email: '', password: '', role: 'cliente' });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    const res = await apiFetch(`${API_USERS}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Error al eliminar usuario');
      return;
    }
    fetchUsers();
  };

  // Editar usuario
  const handleEdit = user => {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditingId(user._id);
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
      <h2>Gestión de usuarios</h2>
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#222', padding: 16, borderRadius: 12, alignItems: 'center' }}>
        <input type="text" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <input type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editingId} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }}>
          <option value="admin">Admin</option>
          <option value="recepcionista">Recepcionista</option>
          <option value="cliente">Cliente</option>
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
  {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', email: '', password: '', role: 'cliente' }); setError(''); setSuccess(''); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Cancelar</button>}
      </form>
  {success && <div style={{ color: '#22c55e', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{success}</div>}
  {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>{error}</div>}
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#18191A', color: '#fff' }}>
            <th style={{ padding: 10 }}>Nombre</th>
            <th style={{ padding: 10 }}>Email</th>
            <th style={{ padding: 10 }}>Rol</th>
            <th style={{ padding: 10 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user._id} style={{ background: '#222', color: '#fff', borderBottom: '1px solid #333' }}>
              <td style={{ padding: 10 }}>{user.name}</td>
              <td style={{ padding: 10 }}>{user.email}</td>
              <td style={{ padding: 10 }}>{user.role}</td>
              <td style={{ padding: 10 }}>
                <button onClick={() => handleEdit(user)} style={{ marginRight: 8, ...buttonStyle }}>Editar</button>
                <button onClick={() => handleDelete(user._id)} style={{ ...buttonStyle, background: '#ef4444' }}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
