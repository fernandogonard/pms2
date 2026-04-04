import React, { useState, useRef } from 'react';
import Modal from 'react-modal';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { apiFetch } from '../utils/api';

Modal.setAppElement('#root');

const API_RESERVATIONS = '/api/reservations';

const AdvancedReservationModal = ({ isOpen, onRequestClose, onClose, onReservationSuccess, afterReservation }) => {
  const closeModal = onRequestClose || onClose;
  const [form, setForm] = useState({
    tipo: 'doble',
    cantidad: 1,
    checkIn: '',
    checkOut: '',
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    whatsapp: '',
    notas: ''
  });
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (submittingRef.current) return;

    // Validaciones de fecha
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) {
      toast.error('La fecha de check-out debe ser posterior al check-in');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const res = await apiFetch(API_RESERVATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: form.tipo,
          cantidad: Number(form.cantidad),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          nombre: form.nombre,
          apellido: form.apellido,
          dni: form.dni,
          email: form.email,
          whatsapp: form.whatsapp,
          notas: form.notas
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear la reserva');
      toast.success('Reserva creada con éxito');
      onReservationSuccess && onReservationSuccess();
      afterReservation && afterReservation();
      closeModal();
      setForm({ tipo: 'doble', cantidad: 1, checkIn: '', checkOut: '', nombre: '', apellido: '', dni: '', email: '', whatsapp: '', notas: '' });
    } catch (err) {
      toast.error(err.message || 'Error al crear la reserva');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={closeModal}
      contentLabel="Nueva Reserva"
      style={{ content: { maxWidth: 520, margin: 'auto', borderRadius: 12, padding: 28, background: '#1a1a2e', color: '#fff' } }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 20, color: '#fff' }}>Nueva Reserva</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <select name="tipo" value={form.tipo} onChange={handleChange} required style={{ flex: 1, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }}>
            <option value="doble">Doble</option>
            <option value="triple">Triple</option>
            <option value="cuadruple">Cuádruple</option>
            <option value="suite">Suite</option>
          </select>
          <input name="cantidad" type="number" min={1} max={20} value={form.cantidad} onChange={handleChange} required style={{ width: 70, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} placeholder="Cant." />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input name="checkIn" type="date" min={todayStr} value={form.checkIn} onChange={handleChange} required style={{ flex: 1, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
          <input name="checkOut" type="date" min={form.checkIn || todayStr} value={form.checkOut} onChange={handleChange} required style={{ flex: 1, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input name="nombre" placeholder="Nombre *" value={form.nombre} onChange={handleChange} required style={{ flex: 1, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
          <input name="apellido" placeholder="Apellido *" value={form.apellido} onChange={handleChange} required style={{ flex: 1, background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
        </div>
        <input name="dni" placeholder="DNI *" value={form.dni} onChange={handleChange} required style={{ background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
        <input name="email" type="email" placeholder="Email *" value={form.email} onChange={handleChange} required style={{ background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
        <input name="whatsapp" placeholder="WhatsApp (opcional)" value={form.whatsapp} onChange={handleChange} style={{ background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px' }} />
        <textarea name="notas" placeholder="Notas (opcional)" value={form.notas} onChange={handleChange} rows={3} style={{ background: '#2a2a3e', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 10px', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #0099ff, #004c99)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {loading ? 'Guardando...' : 'Confirmar reserva'}
          </button>
          <button type="button" onClick={closeModal} style={{ padding: '10px 20px', background: '#444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cerrar</button>
        </div>
      </form>
    </Modal>
  );
};

export const DemoReservationWithToast = () => {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setModalOpen(true)}>Abrir modal avanzado de reserva</button>
      <AdvancedReservationModal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        onReservationSuccess={() => {}}
      />
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
};

export default AdvancedReservationModal;
