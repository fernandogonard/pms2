import React, { useState } from 'react';
import RoomReservationForm from './RoomReservationForm';

// Paso 1: Selección de tipo de habitación
function RoomTypeSelector({ tipos, value, onChange, onNext }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>1. Selecciona el tipo de habitación</h2>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 18, padding: 8, borderRadius: 8 }}>
        <option value="">-- Selecciona --</option>
        {tipos.map(tipo => (
          <option key={tipo} value={tipo}>{tipo}</option>
        ))}
      </select>
      <button disabled={!value} onClick={onNext} style={{ marginLeft: 16, padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}>Siguiente</button>
    </div>
  );
}

// Paso 2: Selección de fechas
function DateRangeSelector({ checkIn, checkOut, setCheckIn, setCheckOut, onNext, onBack }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>2. Selecciona las fechas</h2>
      <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} style={{ marginRight: 12, padding: 8, borderRadius: 8 }} />
      <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} style={{ marginRight: 12, padding: 8, borderRadius: 8 }} />
      <button onClick={onBack} style={{ marginRight: 12, padding: '8px 18px', borderRadius: 8 }}>Atrás</button>
      <button disabled={!checkIn || !checkOut} onClick={onNext} style={{ padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}>Siguiente</button>
    </div>
  );
}

// Paso 3: Mostrar habitaciones disponibles
function AvailableRoomsList({ disponibilidad, onSelect, onBack, error }) {
  const [cantidad, setCantidad] = React.useState(1);
  if (!disponibilidad) return null;
  const max = disponibilidad.disponibles || 0;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>3. Selecciona cantidad a reservar</h2>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '8px 18px', borderRadius: 8 }}>Atrás</button>
      {error && <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>}
      <div style={{ background: '#23272F', color: '#fff', borderRadius: 12, padding: 18, minWidth: 220, boxShadow: '0 2px 8px #0002', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{disponibilidad.type?.toUpperCase()}</div>
        <div style={{ fontSize: 15, marginBottom: 4 }}>Habitaciones disponibles: <b>{disponibilidad.disponibles}</b></div>
        <div style={{ fontSize: 15, marginBottom: 4 }}>Plazas por habitación: <b>{disponibilidad.plazasPorHabitacion}</b></div>
        <div style={{ fontSize: 15, marginBottom: 4 }}>Plazas totales: <b>{disponibilidad.plazasTotales}</b></div>
        <div style={{ fontSize: 15, marginBottom: 8 }}>Precio por noche: <b>${disponibilidad.precio ?? '-'}</b></div>
        <label style={{ fontSize: 15, marginRight: 8 }}>Cantidad a reservar:</label>
        <input type="number" min={1} max={max} value={cantidad} onChange={e => setCantidad(Math.max(1, Math.min(max, Number(e.target.value))))} style={{ width: 60, padding: 4, borderRadius: 6, border: '1px solid #444', marginRight: 8 }} />
        <button disabled={max === 0} onClick={() => onSelect({ cantidad, disponibilidad })} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 600, marginLeft: 8 }}>Reservar</button>
        {max === 0 && <div style={{ color: '#ef4444', marginTop: 8 }}>No hay disponibilidad para ese tipo y fechas.</div>}
      </div>
    </div>
  );
}

// Paso 4: Formulario de reserva
function BookingWizard() {
  const [step, setStep] = useState(1);
  const [roomType, setRoomType] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState('');
  const tipos = ['doble', 'triple', 'cuadruple']; // Puedes cargar esto dinámicamente

  async function fetchAvailableRooms() {
    setError('');
    setDisponibilidad(null);
    try {
  const res = await (await import('../utils/api')).apiFetch(`/api/rooms/available?type=${roomType}&checkIn=${checkIn}&checkOut=${checkOut}`);
      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        setError('Error al consultar habitaciones disponibles.');
        return;
      }
      if (!contentType || !contentType.includes('application/json')) {
        setError('Respuesta inesperada del servidor.');
        return;
      }
      const data = await res.json();
      setDisponibilidad(data);
    } catch (err) {
      setError('No se pudo conectar con el servidor.');
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', marginTop: 32, background: '#18191A', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px #0003' }}>
      {step === 1 && (
        <RoomTypeSelector tipos={tipos} value={roomType} onChange={setRoomType} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <DateRangeSelector checkIn={checkIn} checkOut={checkOut} setCheckIn={setCheckIn} setCheckOut={setCheckOut} onNext={() => { fetchAvailableRooms(); setStep(3); }} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <>
          {disponibilidad && typeof disponibilidad.disponibles === 'number' ? (
            <AvailableRoomsList disponibilidad={disponibilidad} onSelect={r => { setReserva(r); setStep(4); }} onBack={() => setStep(2)} error={error} />
          ) : (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <h2 style={{ color: '#ef4444', marginBottom: 18 }}>No hay disponibilidad para ese tipo y fechas.</h2>
              <button onClick={() => setStep(2)} style={{ padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}>Volver</button>
            </div>
          )}
        </>
      )}
      {step === 4 && reserva && (
        <div>
          <h2>4. Completa tus datos y reserva</h2>
          <div style={{ marginBottom: 16, fontWeight: 600 }}>
            Tipo: {disponibilidad.type?.toUpperCase()}<br />
            Cantidad: {reserva.cantidad} habitación(es) ({reserva.cantidad * (disponibilidad.plazasPorHabitacion || 1)} plazas)
          </div>
          <RoomReservationForm roomType={disponibilidad.type} cantidad={reserva.cantidad} checkIn={checkIn} checkOut={checkOut} />
          <button onClick={() => setStep(3)} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8 }}>Atrás</button>
        </div>
      )}
    </div>
  );
}

export default BookingWizard;
