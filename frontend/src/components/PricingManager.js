// components/PricingManager.js
// Componente para gestionar precios de tipos de habitación

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const PricingManager = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadRoomTypes();
  }, []);

  const loadRoomTypes = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/billing/room-types');
      const data = await response.json();
      if (response.ok && data.success) {
        setRoomTypes(data.data);
      } else {
        throw new Error(data.message || 'Error cargando tipos de habitación');
      }
    } catch (error) {
      console.error('Error cargando tipos de habitación:', error);
      setMessage('Error cargando tipos de habitación');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (roomType) => {
    setEditingType(roomType.id);
    setEditPrice(roomType.basePrice.toString());
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingType(null);
    setEditPrice('');
    setMessage('');
  };

  const savePrice = async (roomTypeId) => {
    if (!editPrice || isNaN(editPrice) || parseFloat(editPrice) <= 0) {
      setMessage('Por favor ingrese un precio válido mayor a 0');
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(`/api/billing/room-types/${roomTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrice: parseFloat(editPrice)
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage('Precio actualizado correctamente');
        setEditingType(null);
        setEditPrice('');
        await loadRoomTypes(); // Recargar datos
      } else {
        throw new Error(data.message || 'Error actualizando precio');
      }
    } catch (error) {
      console.error('Error actualizando precio:', error);
      setMessage('Error actualizando precio');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price, currency = 'ARS') => {
    const symbols = { ARS: '$', USD: 'U$S', EUR: '€' };
    return `${symbols[currency] || '$'} ${price.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="pricing-manager">
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando precios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-manager">
      <div className="pricing-header">
        <h3>💰 Gestión de Precios</h3>
        <p>Administra los precios por tipo de habitación</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="room-types-grid">
        {roomTypes.map(roomType => (
          <div key={roomType.id} className="room-type-card">
            <div className="room-type-header">
              <h4>{roomType.name.toUpperCase()}</h4>
              <span className="capacity">👥 {roomType.capacity} personas</span>
            </div>

            <div className="room-type-content">
              <p className="description">{roomType.description}</p>
              
              <div className="amenities">
                <strong>Servicios:</strong>
                <ul>
                  {roomType.amenities.map((amenity, index) => (
                    <li key={index}>{amenity}</li>
                  ))}
                </ul>
              </div>

              <div className="pricing-section">
                {editingType === roomType.id ? (
                  <div className="price-edit">
                    <div className="price-input-group">
                      <span className="currency-symbol">$</span>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Precio por noche"
                        min="0"
                        step="100"
                      />
                      <span className="currency-label">/ noche</span>
                    </div>
                    <div className="price-actions">
                      <button 
                        onClick={() => savePrice(roomType.id)}
                        disabled={saving}
                        className="btn-save"
                      >
                        {saving ? 'Guardando...' : '💾 Guardar'}
                      </button>
                      <button 
                        onClick={cancelEdit}
                        disabled={saving}
                        className="btn-cancel"
                      >
                        ❌ Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="price-display">
                    <div className="current-price">
                      <span className="price-amount">{formatPrice(roomType.basePrice)}</span>
                      <span className="price-period">/ noche</span>
                    </div>
                    <button 
                      onClick={() => startEdit(roomType)}
                      className="btn-edit"
                    >
                      ✏️ Editar Precio
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .pricing-manager {
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 20px 0;
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .pricing-header h3 {
          color: #2c3e50;
          margin-bottom: 5px;
        }

        .pricing-header p {
          color: #6c757d;
          margin: 0;
        }

        .loading {
          text-align: center;
          padding: 40px;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #007bff;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .message {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .room-types-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
        }

        .room-type-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s ease;
        }

        .room-type-card:hover {
          transform: translateY(-2px);
        }

        .room-type-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e9ecef;
        }

        .room-type-header h4 {
          color: #2c3e50;
          margin: 0;
          font-size: 1.3em;
        }

        .capacity {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 8px;
          border-radius: 16px;
          font-size: 0.9em;
        }

        .description {
          color: #6c757d;
          margin-bottom: 15px;
          line-height: 1.4;
        }

        .amenities {
          margin-bottom: 20px;
        }

        .amenities strong {
          color: #495057;
          display: block;
          margin-bottom: 8px;
        }

        .amenities ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .amenities li {
          padding: 2px 0;
          color: #6c757d;
          font-size: 0.9em;
        }

        .amenities li:before {
          content: "✓ ";
          color: #28a745;
          font-weight: bold;
        }

        .pricing-section {
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }

        .price-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .current-price {
          display: flex;
          align-items: baseline;
          gap: 5px;
        }

        .price-amount {
          font-size: 1.5em;
          font-weight: bold;
          color: #28a745;
        }

        .price-period {
          color: #6c757d;
          font-size: 0.9em;
        }

        .btn-edit {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          transition: background 0.2s ease;
        }

        .btn-edit:hover {
          background: #0056b3;
        }

        .price-edit {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .price-input-group {
          display: flex;
          align-items: center;
          gap: 5px;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 6px;
          border: 2px solid #dee2e6;
        }

        .price-input-group:focus-within {
          border-color: #007bff;
        }

        .currency-symbol {
          font-weight: bold;
          color: #495057;
        }

        .price-input-group input {
          border: none;
          background: transparent;
          flex: 1;
          padding: 4px;
          font-size: 1.1em;
          font-weight: bold;
        }

        .price-input-group input:focus {
          outline: none;
        }

        .currency-label {
          color: #6c757d;
          font-size: 0.9em;
        }

        .price-actions {
          display: flex;
          gap: 10px;
        }

        .btn-save, .btn-cancel {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-save {
          background: #28a745;
          color: white;
        }

        .btn-save:hover:not(:disabled) {
          background: #1e7e34;
        }

        .btn-save:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #545b62;
        }
      `}</style>
    </div>
  );
};

export default PricingManager;