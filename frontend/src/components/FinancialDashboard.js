// components/FinancialDashboard.js
// Dashboard financiero con resumen de ingresos y pagos

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const FinancialDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadFinancialData();
  }, [dateRange]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [summaryRes, invoicesRes] = await Promise.all([
        apiFetch(`/api/billing/summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        apiFetch('/api/billing/invoices/pending')
      ]);

      const summaryData = await summaryRes.json();
      const invoicesData = await invoicesRes.json();

      if (summaryRes.ok && summaryData.success) {
        setSummary(summaryData.data.summary);
      }

      if (invoicesRes.ok && invoicesData.success) {
        setPendingInvoices(invoicesData.data);
      }

    } catch (error) {
      console.error('Error cargando datos financieros:', error);
      setError('Error cargando datos financieros');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return `$ ${price?.toLocaleString() || 0}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="financial-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="financial-dashboard">
      <div className="dashboard-header">
        <h3>📊 Dashboard Financiero</h3>
        <div className="date-range">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <span>hasta</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {summary && (
        <div className="financial-summary">
          <div className="summary-cards">
            <div className="summary-card revenue">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <h4>Revenue Total</h4>
                <p className="amount">{formatPrice(summary.totalRevenue)}</p>
                <small>{summary.totalReservations} reservas</small>
              </div>
            </div>

            <div className="summary-card paid">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <h4>Pagado</h4>
                <p className="amount">{formatPrice(summary.totalPaid)}</p>
                <small>{Math.round((summary.totalPaid / summary.totalRevenue) * 100) || 0}% del total</small>
              </div>
            </div>

            <div className="summary-card pending">
              <div className="card-icon">⏳</div>
              <div className="card-content">
                <h4>Pendiente</h4>
                <p className="amount">{formatPrice(summary.totalPending)}</p>
                <small>{Math.round((summary.totalPending / summary.totalRevenue) * 100) || 0}% del total</small>
              </div>
            </div>

            <div className="summary-card average">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <h4>Promedio por Reserva</h4>
                <p className="amount">{formatPrice(summary.averageReservationValue)}</p>
                <small>Por reserva</small>
              </div>
            </div>
          </div>

          {/* Métodos de Pago */}
          {Object.keys(summary.paymentMethods).length > 0 && (
            <div className="payment-methods">
              <h4>💳 Métodos de Pago</h4>
              <div className="methods-grid">
                {Object.entries(summary.paymentMethods).map(([method, amount]) => (
                  <div key={method} className="method-item">
                    <span className="method-name">
                      {method === 'efectivo' ? '💵 Efectivo' :
                       method === 'tarjeta' ? '💳 Tarjeta' :
                       method === 'transferencia' ? '🏦 Transferencia' :
                       method === 'cheque' ? '📝 Cheque' : method}
                    </span>
                    <span className="method-amount">{formatPrice(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estados de Reservas */}
          {Object.keys(summary.reservationsByStatus).length > 0 && (
            <div className="reservation-status">
              <h4>📋 Estado de Reservas</h4>
              <div className="status-grid">
                {Object.entries(summary.reservationsByStatus).map(([status, count]) => (
                  <div key={status} className="status-item">
                    <span className="status-name">
                      {status === 'reservada' ? '📅 Reservadas' :
                       status === 'checkin' ? '🏨 Check-in' :
                       status === 'checkout' ? '🚪 Check-out' :
                       status === 'cancelada' ? '❌ Canceladas' : status}
                    </span>
                    <span className="status-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Facturas Pendientes */}
      {pendingInvoices.length > 0 && (
        <div className="pending-invoices">
          <h4>🧾 Facturas Pendientes ({pendingInvoices.length})</h4>
          <div className="invoices-list">
            {pendingInvoices.slice(0, 5).map(invoice => (
              <div key={invoice.id} className="invoice-item">
                <div className="invoice-info">
                  <span className="invoice-number">{invoice.invoiceNumber}</span>
                  <span className="client-name">{invoice.client.name}</span>
                </div>
                <div className="invoice-amounts">
                  <span className="total-amount">{formatPrice(invoice.amount)}</span>
                  <span className="pending-amount">
                    Pendiente: {formatPrice(invoice.pending)}
                  </span>
                </div>
                <div className="invoice-dates">
                  <span className={`due-date ${invoice.overdue ? 'overdue' : ''}`}>
                    {invoice.overdue ? '🚨 Vencida' : '📅'} {formatDate(invoice.dueDate)}
                  </span>
                </div>
              </div>
            ))}
            {pendingInvoices.length > 5 && (
              <div className="more-invoices">
                +{pendingInvoices.length - 5} facturas más
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .financial-dashboard {
          background: #1e2026;
          color: #fff;
          padding: 20px;
          border-radius: 12px;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .dashboard-header h3 {
          margin: 0;
          color: #fff;
        }

        .date-range {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .date-range input {
          background: #23272f;
          color: #fff;
          border: 1px solid #444;
          padding: 6px 10px;
          border-radius: 6px;
        }

        .date-range span {
          color: #bbb;
          font-size: 0.9em;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #bbb;
        }

        .spinner {
          border: 3px solid #444;
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

        .error-message {
          background: #dc3545;
          color: white;
          padding: 10px 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .summary-card {
          background: #23272f;
          border-radius: 10px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          border-left: 4px solid;
        }

        .summary-card.revenue { border-color: #28a745; }
        .summary-card.paid { border-color: #007bff; }
        .summary-card.pending { border-color: #ffc107; }
        .summary-card.average { border-color: #17a2b8; }

        .card-icon {
          font-size: 2em;
          opacity: 0.8;
        }

        .card-content h4 {
          margin: 0 0 5px 0;
          color: #bbb;
          font-size: 0.9em;
          font-weight: 500;
        }

        .card-content .amount {
          margin: 0 0 5px 0;
          font-size: 1.8em;
          font-weight: bold;
          color: #fff;
        }

        .card-content small {
          color: #888;
          font-size: 0.8em;
        }

        .payment-methods, .reservation-status {
          background: #23272f;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .payment-methods h4, .reservation-status h4 {
          margin: 0 0 15px 0;
          color: #fff;
        }

        .methods-grid, .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .method-item, .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #1e2026;
          border-radius: 6px;
        }

        .method-name, .status-name {
          color: #bbb;
        }

        .method-amount, .status-count {
          color: #fff;
          font-weight: 600;
        }

        .pending-invoices {
          background: #23272f;
          border-radius: 10px;
          padding: 20px;
        }

        .pending-invoices h4 {
          margin: 0 0 15px 0;
          color: #fff;
        }

        .invoices-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .invoice-item {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr;
          gap: 15px;
          padding: 12px;
          background: #1e2026;
          border-radius: 6px;
          border-left: 3px solid #ffc107;
        }

        .invoice-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .invoice-number {
          color: #fff;
          font-weight: 600;
          font-size: 0.9em;
        }

        .client-name {
          color: #bbb;
          font-size: 0.85em;
        }

        .invoice-amounts {
          display: flex;
          flex-direction: column;
          gap: 3px;
          text-align: right;
        }

        .total-amount {
          color: #fff;
          font-weight: 600;
        }

        .pending-amount {
          color: #ffc107;
          font-size: 0.85em;
        }

        .invoice-dates {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .due-date {
          color: #bbb;
          font-size: 0.85em;
          padding: 4px 8px;
          border-radius: 4px;
          background: #2a2d35;
        }

        .due-date.overdue {
          color: #fff;
          background: #dc3545;
        }

        .more-invoices {
          text-align: center;
          color: #888;
          font-style: italic;
          padding: 10px;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 15px;
            align-items: stretch;
          }

          .date-range {
            justify-content: center;
          }

          .invoice-item {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .invoice-amounts {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default FinancialDashboard;