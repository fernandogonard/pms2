// components/BillingInfo.js
// Componente para mostrar información de facturación de una reserva

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const BillingInfo = ({ reservationId, onPaymentProcessed }) => {
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'efectivo',
    transactionId: '',
    notes: ''
  });
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (reservationId) {
      loadBillingData();
    }
  }, [reservationId]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/billing/reservations/${reservationId}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setBillingData(data.data);
      } else {
        throw new Error(data.message || 'Error cargando información de facturación');
      }
    } catch (error) {
      console.error('Error cargando información de facturación:', error);
      setMessage('Error cargando información de facturación');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      setMessage('Por favor ingrese un monto válido');
      return;
    }

    if (parseFloat(paymentData.amount) > billingData.balance.pending) {
      setMessage('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    try {
      setProcessing(true);
      const response = await apiFetch(`/api/billing/reservations/${reservationId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentData.amount),
          method: paymentData.method,
          transactionId: paymentData.transactionId || undefined,
          notes: paymentData.notes || undefined
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage('Pago procesado correctamente');
        setShowPaymentForm(false);
        setPaymentData({
          amount: '',
          method: 'efectivo',
          transactionId: '',
          notes: ''
        });
        await loadBillingData(); // Recargar datos
        
        // Notificar al componente padre
        if (onPaymentProcessed) {
          onPaymentProcessed(data.data);
        }
      } else {
        throw new Error(data.message || 'Error procesando pago');
      }
    } catch (error) {
      console.error('Error procesando pago:', error);
      setMessage(error.message || 'Error procesando pago');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price) => {
    return `$ ${price?.toLocaleString() || 0}`;
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      'pendiente': '#dc3545',
      'parcial': '#ffc107',
      'pagado': '#28a745',
      'reembolsado': '#6c757d'
    };
    return colors[status] || '#6c757d';
  };

  const getPaymentStatusText = (status) => {
    const texts = {
      'pendiente': 'Pendiente',
      'parcial': 'Pago Parcial',
      'pagado': 'Pagado',
      'reembolsado': 'Reembolsado'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <div className="billing-info loading">
        <div className="spinner"></div>
        <p>Cargando información de facturación...</p>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="billing-info error">
        <p>No se pudo cargar la información de facturación</p>
      </div>
    );
  }

  return (
    <div className="billing-info">
      <div className="billing-header">
        <h4>💳 Información de Facturación</h4>
        <div 
          className="payment-status" 
          style={{ backgroundColor: getPaymentStatusColor(billingData.payment.status) }}
        >
          {getPaymentStatusText(billingData.payment.status)}
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Información del Cliente */}
      <div className="section client-info">
        <h5>👤 Cliente</h5>
        <p><strong>{billingData.client.name}</strong></p>
        <p>{billingData.client.email}</p>
        {billingData.client.phone && <p>📞 {billingData.client.phone}</p>}
      </div>

      {/* Detalles de la Reserva */}
      <div className="section reservation-details">
        <h5>🏨 Detalles de Reserva</h5>
        <div className="details-grid">
          <div className="detail-item">
            <span className="label">Tipo:</span>
            <span className="value">{billingData.reservation.tipo.toUpperCase()}</span>
          </div>
          <div className="detail-item">
            <span className="label">Cantidad:</span>
            <span className="value">{billingData.reservation.cantidad} habitación(es)</span>
          </div>
          <div className="detail-item">
            <span className="label">Check-in:</span>
            <span className="value">{new Date(billingData.reservation.checkIn).toLocaleDateString()}</span>
          </div>
          <div className="detail-item">
            <span className="label">Check-out:</span>
            <span className="value">{new Date(billingData.reservation.checkOut).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Información de Precios */}
      <div className="section pricing-details">
        <h5>💰 Desglose de Precios</h5>
        <div className="pricing-breakdown">
          <div className="pricing-row">
            <span>Precio por noche:</span>
            <span>{formatPrice(billingData.pricing.pricePerNight)}</span>
          </div>
          <div className="pricing-row">
            <span>Noches:</span>
            <span>{billingData.pricing.totalNights}</span>
          </div>
          <div className="pricing-row">
            <span>Cantidad de habitaciones:</span>
            <span>{billingData.reservation.cantidad}</span>
          </div>
          <div className="pricing-row subtotal">
            <span>Subtotal:</span>
            <span>{formatPrice(billingData.pricing.subtotal)}</span>
          </div>
          <div className="pricing-row">
            <span>IVA (21%):</span>
            <span>{formatPrice(billingData.pricing.taxes)}</span>
          </div>
          <div className="pricing-row total">
            <span><strong>Total:</strong></span>
            <span><strong>{formatPrice(billingData.pricing.total)}</strong></span>
          </div>
        </div>
      </div>

      {/* Estado de Pagos */}
      <div className="section payment-summary">
        <h5>💳 Estado de Pagos</h5>
        <div className="payment-breakdown">
          <div className="payment-row">
            <span>Total a pagar:</span>
            <span>{formatPrice(billingData.balance.total)}</span>
          </div>
          <div className="payment-row paid">
            <span>Pagado:</span>
            <span>{formatPrice(billingData.balance.paid)}</span>
          </div>
          <div className="payment-row pending">
            <span>Pendiente:</span>
            <span><strong>{formatPrice(billingData.balance.pending)}</strong></span>
          </div>
        </div>

        {billingData.payment.paymentDate && (
          <div className="payment-details">
            <p><strong>Último pago:</strong> {new Date(billingData.payment.paymentDate).toLocaleDateString()}</p>
            <p><strong>Método:</strong> {billingData.payment.method}</p>
            {billingData.payment.transactionId && (
              <p><strong>ID Transacción:</strong> {billingData.payment.transactionId}</p>
            )}
          </div>
        )}
      </div>

      {/* Formulario de Pago */}
      {billingData.balance.pending > 0 && (
        <div className="section payment-form">
          {!showPaymentForm ? (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="btn-process-payment"
            >
              💳 Procesar Pago
            </button>
          ) : (
            <div className="payment-form-content">
              <h5>💳 Procesar Pago</h5>
              
              <div className="form-group">
                <label>Monto a pagar:</label>
                <div className="amount-input">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0"
                    max={billingData.balance.pending}
                    min="0"
                    step="100"
                  />
                </div>
                <small>Máximo: {formatPrice(billingData.balance.pending)}</small>
              </div>

              <div className="form-group">
                <label>Método de pago:</label>
                <select
                  value={paymentData.method}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="cheque">📝 Cheque</option>
                </select>
              </div>

              {paymentData.method !== 'efectivo' && (
                <div className="form-group">
                  <label>ID de Transacción:</label>
                  <input
                    type="text"
                    value={paymentData.transactionId}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, transactionId: e.target.value }))}
                    placeholder="Número de transacción, autorización, etc."
                  />
                </div>
              )}

              <div className="form-group">
                <label>Notas (opcional):</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observaciones adicionales..."
                  rows="2"
                />
              </div>

              <div className="form-actions">
                <button
                  onClick={processPayment}
                  disabled={processing}
                  className="btn-confirm-payment"
                >
                  {processing ? '⏳ Procesando...' : '✅ Confirmar Pago'}
                </button>
                <button
                  onClick={() => {
                    setShowPaymentForm(false);
                    setMessage('');
                  }}
                  disabled={processing}
                  className="btn-cancel"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Información de Factura */}
      {billingData.invoice.number && (
        <div className="section invoice-info">
          <h5>🧾 Información de Factura</h5>
          <p><strong>Número:</strong> {billingData.invoice.number}</p>
          <p><strong>Fecha de emisión:</strong> {new Date(billingData.invoice.issueDate).toLocaleDateString()}</p>
          <p><strong>Vencimiento:</strong> {new Date(billingData.invoice.dueDate).toLocaleDateString()}</p>
          <p><strong>Estado:</strong> {billingData.invoice.isPaid ? '✅ Pagada' : '⏳ Pendiente'}</p>
        </div>
      )}

      <style jsx>{`
        .billing-info {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin: 20px 0;
        }

        .billing-info.loading, .billing-info.error {
          text-align: center;
          padding: 40px;
          color: #6c757d;
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

        .billing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e9ecef;
        }

        .billing-header h4 {
          color: #2c3e50;
          margin: 0;
        }

        .payment-status {
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.9em;
          font-weight: 500;
        }

        .message {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 15px;
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

        .section {
          margin-bottom: 25px;
        }

        .section h5 {
          color: #495057;
          margin-bottom: 15px;
          font-size: 1.1em;
        }

        .client-info p {
          margin: 5px 0;
          color: #6c757d;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f8f9fa;
        }

        .detail-item .label {
          color: #6c757d;
          font-weight: 500;
        }

        .detail-item .value {
          color: #495057;
          font-weight: 600;
        }

        .pricing-breakdown, .payment-breakdown {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .pricing-row, .payment-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .pricing-row:last-child, .payment-row:last-child {
          border-bottom: none;
        }

        .pricing-row.subtotal {
          border-top: 1px solid #dee2e6;
          margin-top: 8px;
          font-weight: 500;
        }

        .pricing-row.total {
          background: #e3f2fd;
          margin: 8px -15px -15px;
          padding: 12px 15px;
          border-radius: 0 0 8px 8px;
          font-size: 1.1em;
        }

        .payment-row.paid span:last-child {
          color: #28a745;
          font-weight: 600;
        }

        .payment-row.pending span:last-child {
          color: #dc3545;
          font-weight: 600;
        }

        .payment-details {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }

        .payment-details p {
          margin: 5px 0;
          color: #6c757d;
        }

        .btn-process-payment {
          background: #28a745;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 1em;
          transition: background 0.2s ease;
        }

        .btn-process-payment:hover {
          background: #1e7e34;
        }

        .payment-form-content {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #007bff;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          color: #495057;
          font-weight: 500;
        }

        .amount-input {
          display: flex;
          align-items: center;
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 6px;
          padding: 8px 12px;
        }

        .amount-input:focus-within {
          border-color: #007bff;
        }

        .currency {
          font-weight: bold;
          color: #495057;
          margin-right: 5px;
        }

        .amount-input input {
          border: none;
          background: transparent;
          flex: 1;
          font-size: 1.1em;
          font-weight: 600;
        }

        .amount-input input:focus {
          outline: none;
        }

        .form-group small {
          color: #6c757d;
          font-size: 0.9em;
          margin-top: 5px;
          display: block;
        }

        .form-group select, .form-group input, .form-group textarea {
          width: 100%;
          padding: 10px;
          border: 2px solid #dee2e6;
          border-radius: 6px;
          font-size: 1em;
        }

        .form-group select:focus, .form-group input:focus, .form-group textarea:focus {
          outline: none;
          border-color: #007bff;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .btn-confirm-payment, .btn-cancel {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-confirm-payment {
          background: #28a745;
          color: white;
        }

        .btn-confirm-payment:hover:not(:disabled) {
          background: #1e7e34;
        }

        .btn-confirm-payment:disabled {
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

        .invoice-info p {
          margin: 8px 0;
          color: #495057;
        }
      `}</style>
    </div>
  );
};

export default BillingInfo;