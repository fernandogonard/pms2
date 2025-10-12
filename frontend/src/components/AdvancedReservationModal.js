import React, { useState } from 'react';
import Modal from 'react-modal';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

Modal.setAppElement('#root');


import { apiFetch } from '../utils/api';
const API_RESERVATIONS = '/api/reservations';

const AdvancedReservationModal = ({ isOpen, onRequestClose, onReservationSuccess, afterReservation }) => {
  const [form, setForm] = useState({
    room: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
    extras: '',
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      // Enviar reserva a la API real
      const res = await apiFetch(API_RESERVATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: form.room,
          name: form.name,
          email: form.email,
          checkIn: form.checkIn,
          checkOut: form.checkOut
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear la reserva');
      setLoading(false);
      toast.success('Reserva creada con éxito');
      onReservationSuccess && onReservationSuccess();
      afterReservation && afterReservation();
      onRequestClose();
      setForm({ room: '', checkIn: '', checkOut: '', guests: 1, extras: '', name: '', email: '' });
    } catch (err) {
      setLoading(false);
      toast.error(err.message || 'Error al crear la reserva');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Reserva avanzada"
      style={{ content: { maxWidth: 500, margin: 'auto', borderRadius: 12, padding: 24 } }}
    >
      <h2>Reserva avanzada</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required type="email" />
        <input name="room" placeholder="Habitación" value={form.room} onChange={handleChange} required />
        <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required />
        <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required />
        <input name="guests" type="number" min={1} value={form.guests} onChange={handleChange} required />
        <input name="extras" placeholder="Extras (opcional)" value={form.extras} onChange={handleChange} />
        <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Confirmar reserva'}</button>
      </form>
      <button onClick={onRequestClose} style={{ marginTop: 16 }}>Cerrar</button>
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
