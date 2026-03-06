import React, { useState, useEffect } from 'react';
import RoomReservationForm from './RoomReservationForm';

// Paso 1: Selección de tipo de habitación
function RoomTypeSelector({ tipos, loading, value, onChange, onNext }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#f9fafb', marginBottom: 16 }}>1. Seleccioná el tipo de habitación</h2>
      {loading ? (
        <div style={{ color: '#9ca3af' }}>Cargando tipos disponibles…</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {tipos.map(tipo => (
            <button
              key={tipo}
              onClick={() => onChange(tipo)}
              style={{
                padding: '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 16,
                border: value === tipo ? '2px solid #2563eb' : '2px solid #374151',
                background: value === tipo ? '#1e40af' : '#1f2937',
                color: '#fff', cursor: 'pointer', textTransform: 'capitalize',
                boxShadow: value === tipo ? '0 0 12px #2563eb66' : 'none',
              }}
            >
              {tipo}
            </button>
          ))}
        </div>
      )}
      <button
        disabled={!value}
        onClick={onNext}
        style={{
          marginTop: 20, padding: '10px 24px', borderRadius: 8,
          background: value ? '#2563eb' : '#374151',
          color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: value ? 'pointer' : 'not-allowed'
        }}
      >
        Siguiente →
      </button>
    </div>
  );
}

// Paso 2: Selección de fechas con validación
function DateRangeSelector({ checkIn, checkOut, setCheckIn, setCheckOut, onNext, onBack }) {
  const today = new Date().toISOString().slice(0, 10);
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
    : today;

  const nights = checkIn && checkOut
    ? Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000)
    : 0;

  const isValid = checkIn >= today && checkOut > checkIn && nights >= 1;

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#f9fafb', marginBottom: 16 }}>2. Elegí las fechas</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>Check-in</label>
          <input
            type="date" value={checkIn} min={today}
            onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(''); }}
            style={{ padding: '10px 14px', borderRadius: 8, background: '#1f2937', color: '#fff', border: '1px solid #374151', fontSize: 15 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>Check-out</label>
          <input
            type="date" value={checkOut} min={minCheckOut}
            onChange={e => setCheckOut(e.target.value)}
            disabled={!checkIn}
            style={{ padding: '10px 14px', borderRadius: 8, background: !checkIn ? '#111' : '#1f2937', color: '#fff', border: '1px solid #374151', fontSize: 15 }}
          />
        </div>
      </div>
      {nights > 0 && (
        <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 12 }}>🌙 {nights} noche{nights !== 1 ? 's' : ''}</div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ padding: '10px 20px', borderRadius: 8, background: '#374151', color: '#d1d5db', border: 'none', fontWeight: 600, cursor: 'pointer' }}>← Atrás</button>
        <button
          disabled={!isValid}
          onClick={onNext}
          style={{ padding: '10px 24px', borderRadius: 8, background: isValid ? '#2563eb' : '#374151', color: '#fff', border: 'none', fontWeight: 600, cursor: isValid ? 'pointer' : 'not-allowed' }}
        >
          Buscar disponibilidad →
        </button>
      </div>
    </div>
  );
}

// Paso 3: Mostrar habitaciones disponibles
function AvailableRoomsList({ disponibilidad, onSelect, onBack, error }) {
  const [cantidad, setCantidad] = React.useState(1);
  if (!disponibilidad) return null;
  const max = disponibilidad.disponibles || 0;
  const precio = disponibilidad.precio || 0;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: '#f9fafb', marginBottom: 16 }}>3. Confirmar disponibilidad</h2>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '8px 16px', borderRadius: 8, background: '#374151', color: '#d1d5db', border: 'none', fontWeight: 600, cursor: 'pointer' }}>← Atrás</button>
      {error && <div style={{ color: '#f87171', marginBottom: 12 }}>{error}</div>}
      <div style={{ background: '#1f2937', color: '#fff', borderRadius: 14, padding: 24, maxWidth: 360, border: '1.5px solid #374151' }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, textTransform: 'capitalize' }}>🛏️ {disponibilidad.type}</div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>Habitaciones disponibles: <span style={{ color: '#22c55e', fontWeight: 700 }}>{disponibilidad.disponibles}</span></div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>Plazas por habitación: <b style={{ color: '#f9fafb' }}>{disponibilidad.plazasPorHabitacion}</b></div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>Precio por noche: <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>${precio.toLocaleString('es-AR')}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <label style={{ color: '#d1d5db', fontSize: 14 }}>Cantidad:</label>
          <input
            type="number" min={1} max={max} value={cantidad}
            onChange={e => setCantidad(Math.max(1, Math.min(max, Number(e.target.value))))}
            style={{ width: 60, padding: '6px 8px', borderRadius: 6, background: '#111', color: '#fff', border: '1px solid #374151', fontSize: 15, textAlign: 'center' }}
          />
        </div>
        {max === 0 ? (
          <div style={{ color: '#f87171', fontWeight: 600 }}>❌ Sin disponibilidad para esas fechas</div>
        ) : (
          <button
            onClick={() => onSelect({ cantidad, disponibilidad })}
            style={{ width: '100%', padding: '12px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
          >
            Reservar →
          </button>
        )}
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
  const [tipos, setTipos] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Cargar tipos de habitación dinámicamente
  useEffect(() => {
    const load = async () => {
      try {
        const { apiFetch } = await import('../utils/api');
        const res = await apiFetch('/api/rooms/types');
        if (res.ok) {
          const data = await res.json();
          setTipos(Array.isArray(data) ? data : ['doble', 'triple', 'cuadruple']);
        } else {
          setTipos(['doble', 'triple', 'cuadruple']);
        }
      } catch {
        setTipos(['doble', 'triple', 'cuadruple']);
      } finally {
        setLoadingTypes(false);
      }
    };
    load();
  }, []);

  async function fetchAvailableRooms() {
    setError('');
    setDisponibilidad(null);
    try {
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch(`/api/rooms/available?type=${roomType}&checkIn=${checkIn}&checkOut=${checkOut}`);
      if (!res.ok) { setError('Error al consultar habitaciones disponibles.'); return; }
      const data = await res.json();
      setDisponibilidad(data);
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', marginTop: 32, background: '#111827', borderRadius: 18, padding: 36, boxShadow: '0 4px 32px #0005', border: '1px solid #1f2937' }}>
      {/* Indicador de pasos */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['Tipo', 'Fechas', 'Disponibilidad', 'Datos'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13,
              background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#2563eb' : '#1f2937',
              color: step >= i + 1 ? '#fff' : '#6b7280',
            }}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, color: step === i + 1 ? '#f9fafb' : '#6b7280', fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
            {i < 3 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? '#22c55e' : '#1f2937' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <RoomTypeSelector tipos={tipos} loading={loadingTypes} value={roomType} onChange={setRoomType} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <DateRangeSelector checkIn={checkIn} checkOut={checkOut} setCheckIn={setCheckIn} setCheckOut={setCheckOut}
          onNext={() => { fetchAvailableRooms(); setStep(3); }} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <>
          {disponibilidad && typeof disponibilidad.disponibles === 'number' ? (
            <AvailableRoomsList disponibilidad={disponibilidad} onSelect={r => { setReserva(r); setStep(4); }} onBack={() => setStep(2)} error={error} />
          ) : (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <h2 style={{ color: '#f87171', marginBottom: 18 }}>Sin disponibilidad para esas fechas</h2>
              <button onClick={() => setStep(2)} style={{ padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cambiar fechas</button>
            </div>
          )}
        </>
      )}
      {step === 4 && reserva && (
        <div>
          <h2 style={{ color: '#f9fafb', marginBottom: 4 }}>4. Completá tus datos</h2>
          <div style={{ marginBottom: 20, color: '#9ca3af', fontSize: 14 }}>
            🛏️ <span style={{ textTransform: 'capitalize' }}>{disponibilidad.type}</span> — {reserva.cantidad} hab. ·  {checkIn} → {checkOut}
          </div>
          <RoomReservationForm
            roomType={disponibilidad.type}
            cantidad={reserva.cantidad}
            checkIn={checkIn}
            checkOut={checkOut}
            onSuccess={() => setStep(1)}
          />
          <button onClick={() => setStep(3)} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: '#374151', color: '#d1d5db', border: 'none', fontWeight: 600, cursor: 'pointer' }}>← Atrás</button>
        </div>
      )}
    </div>
  );
}

export default BookingWizard;

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
