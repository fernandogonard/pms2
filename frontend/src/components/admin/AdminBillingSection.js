// components/admin/AdminBillingSection.js
// Sección de gestión de facturación para administradores

import React from 'react';
import { apiFetch } from '../../utils/api';
import PricingManager from '../PricingManager';
import FinancialDashboard from '../FinancialDashboard';

const AdminBillingSection = () => {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [summary, setSummary] = React.useState(null);
  const [pendingCount, setPendingCount] = React.useState(0);

  // ——— Facturas ———————————————————————————————————
  const [invoices, setInvoices] = React.useState([]);
  const [invoicesLoading, setInvoicesLoading] = React.useState(false);
  const [invoicesError, setInvoicesError] = React.useState('');
  const [invoiceSuccess, setInvoiceSuccess] = React.useState('');
  const [genInvoiceId, setGenInvoiceId] = React.useState('');

  // ——— Pagos ———————————————————————————————————————
  const [activeReservations, setActiveReservations] = React.useState([]);
  const [paymentsLoading, setPaymentsLoading] = React.useState(false);
  const [paymentsError, setPaymentsError] = React.useState('');
  const [paymentsSuccess, setPaymentsSuccess] = React.useState('');
  const [paymentTarget, setPaymentTarget] = React.useState(null);
  const [paymentForm, setPaymentForm] = React.useState({ amount: '', method: 'efectivo', notes: '' });

  React.useEffect(() => {
    apiFetch('/api/billing/summary')
      .then(r => r.json())
      .then(data => { if (data.success) setSummary(data.data.summary); })
      .catch(() => {});

    apiFetch('/api/billing/invoices/pending')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.invoices)) setPendingCount(data.invoices.length);
        else if (data.success && Array.isArray(data.data)) setPendingCount(data.data.length);
      })
      .catch(() => {});
  }, []);

  const loadInvoices = React.useCallback(async () => {
    setInvoicesLoading(true); setInvoicesError('');
    try {
      const r = await apiFetch('/api/billing/invoices/pending');
      const data = await r.json();
      if (data.success) setInvoices(Array.isArray(data.data) ? data.data : []);
      else setInvoicesError(data.message || 'Error cargando facturas');
    } catch { setInvoicesError('Error de red'); }
    finally { setInvoicesLoading(false); }
  }, []);

  const loadActiveReservations = React.useCallback(async () => {
    setPaymentsLoading(true); setPaymentsError('');
    try {
      const r = await apiFetch('/api/reservations?status=checkin&limit=50');
      const data = await r.json();
      const list = Array.isArray(data) ? data
        : Array.isArray(data.reservations) ? data.reservations
        : Array.isArray(data.data) ? data.data : [];
      setActiveReservations(list);
    } catch { setPaymentsError('Error de red'); }
    finally { setPaymentsLoading(false); }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'invoices') loadInvoices();
    if (activeTab === 'payments') loadActiveReservations();
  }, [activeTab, loadInvoices, loadActiveReservations]);

  const handleGenerateInvoice = async (reservationId) => {
    if (!reservationId) return;
    setInvoicesError(''); setInvoiceSuccess('');
    try {
      const r = await apiFetch(`/api/billing/reservations/${reservationId}/invoice`, { method: 'POST' });
      const data = await r.json();
      if (data.success) {
        setInvoiceSuccess(`Factura ${data.data?.invoiceNumber || 'generada'} creada correctamente`);
        setGenInvoiceId('');
        loadInvoices();
        apiFetch('/api/billing/invoices/pending').then(r => r.json())
          .then(d => { if (d.success) setPendingCount(Array.isArray(d.data) ? d.data.length : 0); }).catch(() => {});
      } else {
        setInvoicesError(data.message || 'Error generando factura');
      }
    } catch { setInvoicesError('Error de red'); }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setPaymentsError(''); setPaymentsSuccess('');
    try {
      const r = await apiFetch(`/api/billing/reservations/${paymentTarget}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentForm.amount), method: paymentForm.method, notes: paymentForm.notes })
      });
      const data = await r.json();
      if (data.success) {
        setPaymentsSuccess('Pago registrado correctamente');
        setPaymentTarget(null);
        setPaymentForm({ amount: '', method: 'efectivo', notes: '' });
        loadActiveReservations();
      } else {
        setPaymentsError(data.message || 'Error procesando pago');
      }
    } catch { setPaymentsError('Error de red'); }
  };

  // Formatea número como moneda
  const fmt = (n) => n >= 1000 ? `$${Math.round(n).toLocaleString('es-AR')}` : `$${Math.round(n || 0)}`;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Financiero', icon: '📊' },
    { id: 'pricing', label: 'Gestión de Precios', icon: '💰' },
    { id: 'invoices', label: 'Facturas', icon: '🧾' },
    { id: 'payments', label: 'Pagos', icon: '💳' }
  ];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>💰 Sistema de Facturación</h2>
          <p style={subtitleStyle}>Gestión completa de precios, pagos y facturación</p>
        </div>
      </div>

      {/* Estadísticas financieras rápidas */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>💵</div>
          <div>
            <div style={statValueStyle}>{summary ? fmt(summary.totalRevenue) : '—'}</div>
            <div style={statLabelStyle}>Ingresos del Mes</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>✅</div>
          <div>
            <div style={statValueStyle}>{summary ? fmt(summary.totalPaid) : '—'}</div>
            <div style={statLabelStyle}>Total Cobrado</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🧾</div>
          <div>
            <div style={statValueStyle}>{summary ? summary.totalReservations : '—'}</div>
            <div style={statLabelStyle}>Reservas Facturadas</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⚠️</div>
          <div>
            <div style={statValueStyle}>{pendingCount}</div>
            <div style={statLabelStyle}>Facturas Pendientes</div>
          </div>
        </div>
      </div>

      {/* Navegación por tabs */}
      <div style={tabsContainerStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab.id ? activeTabStyle : {})
            }}
          >
            <span style={tabIconStyle}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido según tab activo */}
      <div style={contentContainerStyle}>
        {activeTab === 'dashboard' && (
          <div style={tabContentStyle}>
            <FinancialDashboard />
          </div>
        )}
        
        {activeTab === 'pricing' && (
          <div style={tabContentStyle}>
            <PricingManager />
          </div>
        )}
        
        {activeTab === 'invoices' && (
          <div style={tabContentStyle}>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ color: 'white', margin: 0 }}>🧾 Facturas Pendientes de Pago</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="ID de reserva"
                    value={genInvoiceId}
                    onChange={e => setGenInvoiceId(e.target.value)}
                    style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 12px', width: 220, fontSize: 14 }}
                  />
                  <button
                    onClick={() => handleGenerateInvoice(genInvoiceId)}
                    disabled={!genInvoiceId}
                    style={{ background: '#0099ff', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: genInvoiceId ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: genInvoiceId ? 1 : 0.5 }}
                  >+ Generar Factura</button>
                  <button onClick={loadInvoices} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>↺</button>
                </div>
              </div>
              {invoiceSuccess && <div style={{ color: '#22c55e', marginBottom: 12, fontWeight: 600 }}>{invoiceSuccess}</div>}
              {invoicesError && <div style={{ color: '#ef4444', marginBottom: 12, fontWeight: 600 }}>{invoicesError}</div>}
              {invoicesLoading ? (
                <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Cargando facturas...</div>
              ) : invoices.length === 0 ? (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                  No hay facturas pendientes de pago
                </div>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}># Factura</th>
                      <th style={{ padding: '10px 12px' }}>Cliente</th>
                      <th style={{ padding: '10px 12px' }}>Total</th>
                      <th style={{ padding: '10px 12px' }}>Pagado</th>
                      <th style={{ padding: '10px 12px' }}>Saldo</th>
                      <th style={{ padding: '10px 12px' }}>Vence</th>
                      <th style={{ padding: '10px 12px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                        <td style={{ padding: '10px 12px', color: '#00ccff', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '10px 12px' }}>{inv.client?.name || '-'}<br /><span style={{ fontSize: 11, color: '#6b7280' }}>{inv.client?.email || ''}</span></td>
                        <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{fmt(inv.amount)}</td>
                        <td style={{ padding: '10px 12px' }}>{fmt(inv.amountPaid)}</td>
                        <td style={{ padding: '10px 12px', color: inv.pending > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>{fmt(inv.pending)}</td>
                        <td style={{ padding: '10px 12px', color: inv.overdue ? '#ef4444' : '#aaa' }}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR') : '-'}
                          {inv.overdue && <span style={{ marginLeft: 6, fontSize: 10, background: '#ef4444', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>VENCIDA</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: inv.paymentStatus === 'completado' ? '#052e16' : inv.paymentStatus === 'parcial' ? '#1c1400' : '#1a0606',
                            color: inv.paymentStatus === 'completado' ? '#22c55e' : inv.paymentStatus === 'parcial' ? '#f59e0b' : '#f87171',
                          }}>{inv.paymentStatus || 'pendiente'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'payments' && (
          <div style={tabContentStyle}>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: 'white', margin: 0 }}>💳 Registrar Pagos — Huéspedes con Check-in</h3>
                <button onClick={loadActiveReservations} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>↺ Actualizar</button>
              </div>
              {paymentsSuccess && <div style={{ color: '#22c55e', marginBottom: 12, fontWeight: 600 }}>{paymentsSuccess}</div>}
              {paymentsError && <div style={{ color: '#ef4444', marginBottom: 12, fontWeight: 600 }}>{paymentsError}</div>}

              {paymentTarget && (
                <div style={{ background: 'rgba(0,153,255,0.08)', border: '1px solid rgba(0,153,255,0.3)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h4 style={{ color: '#00ccff', margin: '0 0 14px 0' }}>Registrar Pago — Reserva {paymentTarget.slice(-6).toUpperCase()}</h4>
                  <form onSubmit={handleProcessPayment} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>Monto ($)</div>
                      <input type="number" min="1" step="0.01" value={paymentForm.amount}
                        onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required
                        style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 12px', width: 140 }} />
                    </div>
                    <div>
                      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>Método</div>
                      <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                        style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 12px' }}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>Notas (opcional)</div>
                      <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                        placeholder="Ej: Pago parcial, saldo pendiente"
                        style={{ background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 12px', width: 240 }} />
                    </div>
                    <button type="submit" style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}>✓ Registrar</button>
                    <button type="button" onClick={() => { setPaymentTarget(null); setPaymentForm({ amount: '', method: 'efectivo', notes: '' }); }}
                      style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Cancelar</button>
                  </form>
                </div>
              )}

              {paymentsLoading ? (
                <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Cargando reservas activas...</div>
              ) : activeReservations.length === 0 ? (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🛏️</div>
                  No hay huéspedes con check-in activo en este momento
                </div>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Huésped</th>
                      <th style={{ padding: '10px 12px' }}>Habitación</th>
                      <th style={{ padding: '10px 12px' }}>Check-in</th>
                      <th style={{ padding: '10px 12px' }}>Check-out</th>
                      <th style={{ padding: '10px 12px' }}>Total</th>
                      <th style={{ padding: '10px 12px' }}>Pagado</th>
                      <th style={{ padding: '10px 12px' }}>Saldo</th>
                      <th style={{ padding: '10px 12px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map(r => {
                      const total = r.pricing?.total || 0;
                      const paid = r.payment?.amountPaid || 0;
                      const balance = total - paid;
                      return (
                        <tr key={r._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                          <td style={{ padding: '10px 12px' }}>
                            {r.client ? `${r.client.nombre} ${r.client.apellido}` : (r.nombre ? `${r.nombre} ${r.apellido}` : '-')}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {Array.isArray(r.room) && r.room.length > 0 ? r.room.map(rm => rm.number || rm).join(', ') : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#aaa' }}>{r.checkIn ? r.checkIn.slice(0, 10) : '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#aaa' }}>{r.checkOut ? r.checkOut.slice(0, 10) : '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{total ? fmt(total) : '-'}</td>
                          <td style={{ padding: '10px 12px' }}>{fmt(paid)}</td>
                          <td style={{ padding: '10px 12px', color: balance > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>{fmt(balance)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => { setPaymentTarget(r._id); setPaymentForm({ amount: balance > 0 ? balance.toString() : '', method: 'efectivo', notes: '' }); setPaymentsSuccess(''); setPaymentsError(''); }}
                              style={{ background: '#0099ff', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >💳 Pagar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Estilos
const containerStyle = {
  padding: '24px',
  maxWidth: '1400px'
};

const headerStyle = {
  marginBottom: '24px'
};

const titleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: 'white',
  margin: '0 0 8px 0'
};

const subtitleStyle = {
  fontSize: '16px',
  color: '#aaa',
  margin: 0
};

const statsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '24px'
};

const statCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '20px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px'
};

const statIconStyle = {
  fontSize: '32px',
  minWidth: '32px'
};

const statValueStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: 'white',
  marginBottom: '4px'
};

const statLabelStyle = {
  fontSize: '12px',
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tabsContainerStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  paddingBottom: '16px'
};

const tabButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const activeTabStyle = {
  background: 'rgba(0, 153, 255, 0.2)',
  color: '#00ccff',
  boxShadow: '0 2px 8px rgba(0, 153, 255, 0.3)'
};

const tabIconStyle = {
  fontSize: '16px'
};

const contentContainerStyle = {
  minHeight: '500px'
};

const tabContentStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
  minHeight: '500px'
};

const comingSoonStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 40px',
  textAlign: 'center'
};

const comingSoonIconStyle = {
  fontSize: '64px',
  marginBottom: '24px',
  opacity: 0.6
};

const comingSoonTitleStyle = {
  fontSize: '24px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '16px'
};

const comingSoonTextStyle = {
  fontSize: '16px',
  color: '#aaa',
  lineHeight: 1.6,
  maxWidth: '500px',
  marginBottom: '24px'
};

const comingSoonBadgeStyle = {
  padding: '8px 16px',
  background: 'rgba(0, 153, 255, 0.2)',
  color: '#00ccff',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

export default AdminBillingSection;