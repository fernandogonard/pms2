// components/RoomReservationForm.js
// Formulario de reserva para una habitación específica

import React, { useState, useEffect } from 'react';
import './RoomReservationForm.css';
import { apiFetch } from '../utils/api';

const API_RESERVATIONS = '/api/reservations';



const RoomReservationForm = ({ roomType, cantidad, checkIn, checkOut, disabled }) => {
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
      setMessage('¡Reserva realizada con éxito!');
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
