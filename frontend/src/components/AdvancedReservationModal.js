import React, { useState, useRef } from 'react';
import Modal from 'react-modal';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

Modal.setAppElement('#root');


import { apiFetch } from '../utils/api';
import useSessionGuard from '../hooks/useSessionGuard';
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
  const [validationError, setValidationError] = useState('');
  const abortControllerRef = useRef(null);
  const { canFetch, sessionExpired } = useSessionGuard();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setValidationError(''); // Limpiar error al editar
  };

  const validateDates = () => {
    if (!form.checkIn || !form.checkOut) {
      return 'Debe seleccionar fechas de check-in y check-out';
    }
    
    const checkIn = new Date(form.checkIn);
    const checkOut = new Date(form.checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return 'La fecha de check-in no puede ser anterior a hoy';
    }

    if (checkOut <= checkIn) {
      return 'La fecha de check-out debe ser posterior a check-in';
    }

    return null;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    
    // Validar fechas
    const dateError = validateDates();
    if (dateError) {
      setValidationError(dateError);
      toast.error(dateError);
      return;
    }

    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!canFetch) {
      const message = sessionExpired
        ? 'Tu sesión expiró. Inicia sesión nuevamente para crear reservas.'
        : 'Debes iniciar sesión para crear reservas.';
      setValidationError(message);
      toast.error(message);
      return;
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setValidationError('');

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
        }),
        signal: abortControllerRef.current.signal
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
      if (err.name === 'AbortError') {
        // Request cancelado, no mostrar error
        return;
      }
      setLoading(false);
      toast.error(err.message || 'Error al crear la reserva');
    }
  };

  const handleClose = () => {
    // Cancelar request al cerrar modal
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setValidationError('');
    onRequestClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Reserva avanzada"
      style={{ content: { maxWidth: 500, margin: 'auto', borderRadius: 12, padding: 24 } }}
    >
      <h2>Reserva avanzada</h2>
      {validationError && (
        <div style={{ 
          color: '#ff4444', 
          backgroundColor: '#fff3f3', 
          padding: '8px 12px', 
          borderRadius: 6, 
          marginBottom: 12,
          border: '1px solid #ffcccc'
        }}>
          {validationError}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required disabled={loading} />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required type="email" disabled={loading} />
        <input name="room" placeholder="Habitación" value={form.room} onChange={handleChange} required disabled={loading} />
        <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required disabled={loading} />
        <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required disabled={loading} />
        <input name="guests" type="number" min={1} value={form.guests} onChange={handleChange} required disabled={loading} />
        <input name="extras" placeholder="Extras (opcional)" value={form.extras} onChange={handleChange} disabled={loading} />
        <button 
          type="submit" 
          disabled={loading || !canFetch}
          style={{
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Guardando...' : 'Confirmar reserva'}
        </button>
      </form>
      <button onClick={handleClose} style={{ marginTop: 16 }} disabled={loading}>Cerrar</button>
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
