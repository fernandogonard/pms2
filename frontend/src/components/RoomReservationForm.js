// components/RoomReservationForm.js
// Formulario de reserva para una habitación específica

import React, { useState, useEffect } from 'react';
import './RoomReservationForm.css';
import { apiFetch } from '../utils/api';

const API_RESERVATIONS = '/api/reservations';



const RoomReservationForm = ({ roomType, cantidad, checkIn, checkOut, disabled, onSuccess }) => {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // datos de la reserva confirmada

  useEffect(() => {
    if (roomType && cantidad && checkIn && checkOut) {
      calculatePrice();
    }
  }, [roomType, cantidad, checkIn, checkOut]);

  const calculatePrice = async () => {
    try {
      setLoadingPrice(true);
      const res = await apiFetch('/api/billing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: roomType, cantidad, checkIn, checkOut })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPricing(data.data);
      }
    } catch (err) {
      console.error('Error calculando precio:', err);
    } finally {
      setLoadingPrice(false);
    }
  };

  const formatPrice = (price) => {
    return `$ ${price?.toLocaleString() || 0}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(API_RESERVATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: roomType, cantidad, nombre, apellido, dni, email, whatsapp, checkIn, checkOut })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al reservar');
      setConfirmed(data);
      setNombre('');
      setApellido('');
      setDni('');
      setEmail('');
      setWhatsapp('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // —— Pantalla de confirmación ———————————————————————————————————————————————
  if (confirmed) {
    const ref  = confirmed._id ? String(confirmed._id).slice(-6).toUpperCase() : '------';
    const ci   = confirmed.checkIn  ? new Date(confirmed.checkIn).toLocaleDateString('es-AR')  : checkIn;
    const co   = confirmed.checkOut ? new Date(confirmed.checkOut).toLocaleDateString('es-AR') : checkOut;
    const total = confirmed.pricing?.total
      ? `$${confirmed.pricing.total.toLocaleString('es-AR')}`
      : null;
    const waLink = confirmed.whatsAppLinks?.confirmation;

    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
        <h2 style={{ color: '#22c55e', fontWeight: 800, marginBottom: 4 }}>¡Reserva confirmada!</h2>
        <div style={{ color: '#9ca3af', marginBottom: 24, fontSize: 15 }}>Tu reserva fue registrada correctamente</div>

        <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 14, padding: '20px 24px', maxWidth: 380, margin: '0 auto 24px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Referencia</span>
            <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 15 }}>#{ref}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Tipo</span>
            <span style={{ color: '#f9fafb', fontWeight: 600, textTransform: 'capitalize' }}>{confirmed.tipo || roomType}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Check-in</span>
            <span style={{ color: '#f9fafb' }}>{ci}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Check-out</span>
            <span style={{ color: '#f9fafb' }}>{co}</span>
          </div>
          {confirmed.pricing?.totalNights && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#6b7280', fontSize: 13 }}>Noches</span>
              <span style={{ color: '#f9fafb' }}>{confirmed.pricing.totalNights}</span>
            </div>
          )}
          {total && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #1f2937' }}>
              <span style={{ color: '#6b7280', fontSize: 13, fontWeight: 600 }}>Total</span>
              <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 16 }}>{total}</span>
            </div>
          )}
        </div>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#25d366', color: '#000', textDecoration: 'none',
              fontWeight: 700, fontSize: 15, padding: '12px 24px', borderRadius: 10,
              marginBottom: 12, boxShadow: '0 4px 12px #25d36633'
            }}
          >
            📲 Enviar confirmación por WhatsApp
          </a>
        )}

        <div>
          <button
            onClick={() => { setConfirmed(null); setPricing(null); setMessage(''); setError(''); if (onSuccess) onSuccess(); }}
            style={{ background: '#1f2937', color: '#d1d5db', border: '1px solid #374151', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            Hacer otra reserva
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="room-reservation-form" onSubmit={handleSubmit}>
      {/* Información de Precios */}
      {pricing && (
        <div className="pricing-info">
          <h4>💰 Desglose de Precios</h4>
          <div className="pricing-details">
            <div className="pricing-row">
              <span>Precio por noche:</span>
              <span>{formatPrice(pricing.pricePerNight)}</span>
            </div>
            <div className="pricing-row">
              <span>Noches ({pricing.totalNights}):</span>
              <span>{formatPrice(pricing.pricePerNight * pricing.totalNights)}</span>
            </div>
            <div className="pricing-row">
              <span>Habitaciones ({cantidad}):</span>
              <span>{formatPrice(pricing.subtotal)}</span>
            </div>
            <div className="pricing-row">
              <span>IVA (21%):</span>
              <span>{formatPrice(pricing.taxes)}</span>
            </div>
            <div className="pricing-row total">
              <span><strong>Total:</strong></span>
              <span><strong>{formatPrice(pricing.total)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {loadingPrice && (
        <div className="loading-price">
          <span className="spinner"></span>
          Calculando precio...
        </div>
      )}

      <div className="form-row">
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Nombre" disabled={disabled || loading} />
        <input type="text" value={apellido} onChange={e => setApellido(e.target.value)} required placeholder="Apellido" disabled={disabled || loading} />
      </div>
      <div className="form-row">
        <input type="text" value={dni} onChange={e => setDni(e.target.value)} required placeholder="DNI" disabled={disabled || loading} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email" disabled={disabled || loading} />
        <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="WhatsApp" disabled={disabled || loading} />
      </div>
      {/* checkIn y checkOut ya vienen del wizard, no se editan aquí */}
      <button type="submit" disabled={disabled || loading}>
        {loading ? (
          <span>
            <span style={{ display: 'inline-block', width: 20, height: 20, border: '3px solid #222', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
            Reservando...
          </span>
        ) : `Reservar por ${pricing ? formatPrice(pricing.total) : '...'}`}
      </button>
      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
};

export default RoomReservationForm;
