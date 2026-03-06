// pages/ReceptionDashboard.js
// Dashboard de recepcionista — tabbed layout con resumen del día, reservas, cobros y habitaciones
import React, { useState, useEffect, useCallback } from 'react';
import ReceptionLayout from '../layouts/ReceptionLayout';
import ReceptionReservations from '../components/ReceptionReservations';
import RoomStatusBoard from '../components/RoomStatusBoard';
import RoomCalendar from '../components/RoomCalendar';
import CleaningManager from '../components/CleaningManager';
import { apiFetch } from '../utils/api';

// ─── Resumen del día ────────────────────────────────────────────────────────
const DailySummary = ({ onGoTo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, resRes] = await Promise.all([
        apiFetch('/api/rooms'),
        apiFetch('/api/reservations'),
      ]);
      const rooms        = await rRes.json().then(d => Array.isArray(d) ? d : []);
      const reservations = await resRes.json().then(d => Array.isArray(d) ? d : []);

      const checkinHoy        = reservations.filter(r => r.checkIn?.slice(0,10) === today && r.status === 'reservada');
      const checkoutPendiente = reservations.filter(r => r.status === 'checkin' && r.checkOut?.slice(0,10) <= today);
      const disponibles       = rooms.filter(r => r.status === 'disponible');
      const enLimpieza        = rooms.filter(r => r.status === 'limpieza');
      const enMantenimiento   = rooms.filter(r => r.status === 'mantenimiento');
      const ocupadas          = rooms.filter(r => r.status === 'ocupada');

      let cobradoHoy = 0;
      reservations.forEach(r => {
        (r.paymentHistory || []).forEach(p => {
          if (p.date && p.date.slice(0, 10) === today) cobradoHoy += (p.amount || 0);
        });
      });

      const saldoPendiente = reservations
        .filter(r => r.status === 'checkin')
        .reduce((s, r) => {
          const tot  = r.pricing?.total || 0;
          const paid = r.payment?.amountPaid || 0;
          return s + Math.max(0, tot - paid);
        }, 0);

      setData({ checkinHoy, checkoutPendiente, disponibles, enLimpieza, enMantenimiento, ocupadas, cobradoHoy, saldoPendiente });
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const fmt = n => n >= 1000 ? `$${Math.round(n).toLocaleString('es-AR')}` : `$${Math.round(n || 0)}`;
  const dayName = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return <div style={{ color: '#aaa', padding: 40, textAlign: 'center' }}>Cargando resumen del día...</div>;
  if (!data) return null;

  const cards = [
    { label: 'Check-ins de hoy',   value: data.checkinHoy.length,          icon: '✅', color: '#22c55e', go: 'reservas',     alert: false },
    { label: 'Check-outs pend.',   value: data.checkoutPendiente.length,   icon: '🚪', color: '#f59e0b', go: 'reservas',     alert: data.checkoutPendiente.length > 0 },
    { label: 'Disponibles',        value: data.disponibles.length,         icon: '🛏️', color: '#0099ff', go: 'habitaciones', alert: false },
    { label: 'Ocupadas',           value: data.ocupadas.length,            icon: '🔴', color: '#ef4444', go: 'habitaciones', alert: false },
    { label: 'En limpieza',        value: data.enLimpieza.length,          icon: '🧹', color: '#a78bfa', go: 'limpieza',     alert: false },
    { label: 'Mantenimiento',      value: data.enMantenimiento.length,     icon: '🔧', color: '#fb923c', go: 'habitaciones', alert: false },
    { label: 'Cobrado hoy',        value: fmt(data.cobradoHoy),            icon: '💵', color: '#22c55e', go: 'cobros',       alert: false, isAmt: true },
    { label: 'Saldo pendiente',    value: fmt(data.saldoPendiente),        icon: '⏳', color: '#f59e0b', go: 'cobros',       alert: data.saldoPendiente > 0, isAmt: true },
  ];

  return (
    <div>
      <div style={{ color: '#aaa', fontSize: 14, marginBottom: 20, textTransform: 'capitalize' }}>📅 {dayName}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {cards.map((c, i) => (
          <button key={i} onClick={() => onGoTo(c.go)}
            style={{ background: c.alert ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${c.alert ? '#f59e0b60' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12, padding: 18, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: c.isAmt ? 18 : 26, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{c.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.checkinHoy.length > 0 && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px' }}>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ {data.checkinHoy.length} check-in(s) hoy: </span>
            <span style={{ color: '#aaa' }}>
              {data.checkinHoy.slice(0,4).map(r => `${r.client?.nombre || r.nombre || '?'} ${r.client?.apellido || r.apellido || ''}`).join(' · ')}
              {data.checkinHoy.length > 4 ? ` +${data.checkinHoy.length - 4} más` : ''}
            </span>
          </div>
        )}
        {data.checkoutPendiente.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px' }}>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>🚪 {data.checkoutPendiente.length} check-out(s) pendientes: </span>
            <span style={{ color: '#aaa' }}>
              {data.checkoutPendiente.slice(0,4).map(r => `${r.client?.nombre || r.nombre || '?'} ${r.client?.apellido || r.apellido || ''}`).join(' · ')}
              {data.checkoutPendiente.length > 4 ? ` +${data.checkoutPendiente.length - 4} más` : ''}
            </span>
          </div>
        )}
        {data.disponibles.length === 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px' }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Sin habitaciones disponibles en este momento</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button onClick={load} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>↺ Actualizar</button>
      </div>
    </div>
  );
};

// ─── Cobros (recepcionista) ──────────────────────────────────────────────────
const ReceptionPayments = () => {
  const [activeReservations, setActiveReservations] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [paymentTarget,setPaymentTarget]= useState(null);
  const [paymentForm,  setPaymentForm]  = useState({ amount: '', method: 'efectivo', notes: '' });
  const [chargeTarget, setChargeTarget] = useState(null);
  const [chargeForm,   setChargeForm]   = useState({ description: '', amount: '', category: 'otro' });
  const [chargeError,  setChargeError]  = useState('');
  const [chargeSuccess,setChargeSuccess]= useState('');
  const [expandedRow,  setExpandedRow]  = useState(null);
  const [billingDetail,setBillingDetail]= useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await apiFetch('/api/reservations?status=checkin&limit=50');
      const data = await r.json();
      setActiveReservations(Array.isArray(data) ? data : Array.isArray(data.reservations) ? data.reservations : Array.isArray(data.data) ? data.data : []);
    } catch { setError('Error de red'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setError(''); setSuccess('');
    try {
      const r = await apiFetch(`/api/billing/reservations/${paymentTarget}/payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentForm.amount), method: paymentForm.method, notes: paymentForm.notes })
      });
      const data = await r.json();
      if (data.success) { setSuccess('Pago registrado'); setPaymentTarget(null); setPaymentForm({ amount: '', method: 'efectivo', notes: '' }); load(); }
      else setError(data.message || 'Error');
    } catch { setError('Error de red'); }
  };

  const handleLoadDetail = async (id) => {
    if (expandedRow === id) { setExpandedRow(null); return; }
    setExpandedRow(id);
    if (billingDetail[id]) return;
    try {
      const r = await apiFetch(`/api/billing/reservations/${id}`);
      const data = await r.json();
      if (data.success) setBillingDetail(prev => ({ ...prev, [id]: { paymentHistory: data.data?.paymentHistory || [], extras: data.data?.extras || [] } }));
    } catch { /* silencioso */ }
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    if (!chargeTarget) return;
    setChargeError(''); setChargeSuccess('');
    try {
      const r = await apiFetch(`/api/billing/reservations/${chargeTarget}/charge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: chargeForm.description, amount: parseFloat(chargeForm.amount), category: chargeForm.category })
      });
      const data = await r.json();
      if (data.success) {
        setChargeSuccess('Cargo registrado');
        setChargeTarget(null); setChargeForm({ description: '', amount: '', category: 'otro' });
        setBillingDetail(prev => { const n = { ...prev }; delete n[chargeTarget]; return n; });
        load();
      } else setChargeError(data.message || 'Error');
    } catch { setChargeError('Error de red'); }
  };

  const fmt = n => n >= 1000 ? `$${Math.round(n).toLocaleString('es-AR')}` : `$${Math.round(n || 0)}`;
  const inp = { background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 12px' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: 'white', margin: 0 }}>💳 Cobros — Huéspedes activos</h3>
        <button onClick={load} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer' }}>↺ Actualizar</button>
      </div>
      {success      && <div style={{ color: '#22c55e',  marginBottom: 10, fontWeight: 600 }}>{success}</div>}
      {error        && <div style={{ color: '#ef4444',  marginBottom: 10, fontWeight: 600 }}>{error}</div>}
      {chargeSuccess && <div style={{ color: '#a78bfa', marginBottom: 10, fontWeight: 600 }}>{chargeSuccess}</div>}
      {chargeError  && <div style={{ color: '#ef4444',  marginBottom: 10, fontWeight: 600 }}>{chargeError}</div>}

      {paymentTarget && (
        <div style={{ background: 'rgba(0,153,255,0.08)', border: '1px solid rgba(0,153,255,0.3)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <h4 style={{ color: '#00ccff', margin: '0 0 12px 0' }}>💳 Pago — {paymentTarget.slice(-6).toUpperCase()}</h4>
          <form onSubmit={handleProcessPayment} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Monto ($)</div>
              <input type="number" min="1" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required style={{ ...inp, width: 130 }} /></div>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Método</div>
              <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} style={inp}>
                <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option><option value="cheque">Cheque</option>
              </select></div>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Notas</div>
              <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Opcional" style={{ ...inp, width: 180 }} /></div>
            <button type="submit" style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>✓ Registrar</button>
            <button type="button" onClick={() => { setPaymentTarget(null); setPaymentForm({ amount: '', method: 'efectivo', notes: '' }); }} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </div>
      )}

      {chargeTarget && (
        <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <h4 style={{ color: '#a78bfa', margin: '0 0 12px 0' }}>➕ Cargo — {chargeTarget.slice(-6).toUpperCase()}</h4>
          <form onSubmit={handleAddCharge} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Descripción</div>
              <input type="text" value={chargeForm.description} onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })} required placeholder="Minibar, cena..." style={{ ...inp, width: 200 }} /></div>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Monto ($)</div>
              <input type="number" min="1" step="0.01" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })} required style={{ ...inp, width: 110 }} /></div>
            <div><div style={{ color: '#aaa', fontSize: 12, marginBottom: 3 }}>Categoría</div>
              <select value={chargeForm.category} onChange={e => setChargeForm({ ...chargeForm, category: e.target.value })} style={inp}>
                <option value="minibar">🍾 Minibar</option><option value="lavanderia">👔 Lavandería</option>
                <option value="room_service">🍽️ Room Service</option><option value="telefono">📞 Teléfono</option>
                <option value="spa">💆 Spa</option><option value="parking">🚗 Parking</option><option value="otro">📦 Otro</option>
              </select></div>
            <button type="submit" style={{ background: '#a78bfa', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>✓ Agregar</button>
            <button type="button" onClick={() => { setChargeTarget(null); setChargeForm({ description: '', amount: '', category: 'otro' }); setChargeError(''); }} style={{ background: '#374151', color: '#d1d5db', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </div>
      )}

      {loading ? <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Cargando...</div>
      : activeReservations.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}><div style={{ fontSize: 40, marginBottom: 12 }}>🛏️</div>No hay huéspedes con check-in activo</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', textAlign: 'left' }}>
                {['Huésped','Hab.','Check-out','Total','Pagado','Saldo','Acciones'].map(h => <th key={h} style={{ padding: '10px 12px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {activeReservations.map(r => {
                const total = r.pricing?.total || 0, paid = r.payment?.amountPaid || 0, balance = total - paid;
                const detail = billingDetail[r._id], isExp = expandedRow === r._id;
                return (
                  <React.Fragment key={r._id}>
                    <tr style={{ borderBottom: isExp ? 'none' : '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                      <td style={{ padding: '10px 12px' }}>{r.client ? `${r.client.nombre} ${r.client.apellido}` : (r.nombre ? `${r.nombre} ${r.apellido}` : '-')}</td>
                      <td style={{ padding: '10px 12px' }}>{Array.isArray(r.room) && r.room.length > 0 ? r.room.map(rm => rm.number || rm).join(', ') : '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#aaa' }}>{r.checkOut ? r.checkOut.slice(0,10) : '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{total ? fmt(total) : '-'}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt(paid)}</td>
                      <td style={{ padding: '10px 12px', color: balance > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>{fmt(balance)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button onClick={() => { setPaymentTarget(r._id); setChargeTarget(null); setPaymentForm({ amount: balance > 0 ? balance.toString() : '', method: 'efectivo', notes: '' }); setSuccess(''); setError(''); }}
                            style={{ background: '#0099ff', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💳 Pagar</button>
                          <button onClick={() => { setChargeTarget(r._id); setPaymentTarget(null); setChargeForm({ description: '', amount: '', category: 'otro' }); setChargeError(''); setChargeSuccess(''); }}
                            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>➕ Cargo</button>
                          <button onClick={() => handleLoadDetail(r._id)}
                            style={{ background: isExp ? '#374151' : '#1f2937', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: 6, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
                            {isExp ? '▲' : '📋'}</button>
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td colSpan={7} style={{ padding: '0 12px 14px 12px' }}>
                          {!detail ? <div style={{ color: '#aaa', padding: 10, fontSize: 13 }}>Cargando...</div> : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 10 }}>
                              <div>
                                <div style={{ color: '#00ccff', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>💳 Historial de Pagos</div>
                                {detail.paymentHistory.length === 0 ? <div style={{ color: '#6b7280', fontSize: 12 }}>Sin pagos</div>
                                  : detail.paymentHistory.map((p, i) => (
                                    <div key={i} style={{ fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.04)', padding: '3px 0', color: '#ccc' }}>
                                      {p.date ? new Date(p.date).toLocaleDateString('es-AR') : '-'} · <span style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(p.amount)}</span> · {p.method}{p.notes ? ` · ${p.notes}` : ''}
                                    </div>
                                  ))}
                              </div>
                              <div>
                                <div style={{ color: '#a78bfa', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>➕ Cargos Extra</div>
                                {detail.extras.length === 0 ? <div style={{ color: '#6b7280', fontSize: 12 }}>Sin cargos</div>
                                  : detail.extras.map((x, i) => (
                                    <div key={i} style={{ fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.04)', padding: '3px 0', color: '#ccc' }}>
                                      {x.date ? new Date(x.date).toLocaleDateString('es-AR') : '-'} · {x.description} · <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(x.amount)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Dashboard principal ─────────────────────────────────────────────────────
const ReceptionDashboard = () => {
  const [activeTab, setActiveTab] = useState('inicio');

  const tabs = [
    { id: 'inicio',       label: 'Inicio',       icon: '🏠' },
    { id: 'reservas',     label: 'Reservas',     icon: '📅' },
    { id: 'cobros',       label: 'Cobros',       icon: '💳' },
    { id: 'habitaciones', label: 'Habitaciones', icon: '🛏️' },
    { id: 'limpieza',     label: 'Limpieza',     icon: '🧹' },
    { id: 'calendario',   label: 'Calendario',   icon: '📆' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio':       return <DailySummary onGoTo={setActiveTab} />;
      case 'reservas':     return <ReceptionReservations />;
      case 'cobros':       return <ReceptionPayments />;
      case 'habitaciones': return <RoomStatusBoard />;
      case 'limpieza':     return <CleaningManager />;
      case 'calendario':   return <RoomCalendar />;
      default:             return null;
    }
  };

  return (
    <ReceptionLayout>
      <div style={{ background: '#18191A', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
        {/* Tab bar */}
        <div style={{ background: '#111', borderBottom: '1px solid #2a2a2a', display: 'flex', overflowX: 'auto', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? 'rgba(0,153,255,0.15)' : 'transparent',
                color: activeTab === t.id ? '#00ccff' : '#9ca3af',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #0099ff' : '2px solid transparent',
                padding: '14px 20px',
                cursor: 'pointer',
                fontWeight: activeTab === t.id ? 700 : 400,
                fontSize: 14,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {/* Contenido */}
        <div style={{ padding: 24, maxWidth: 1200 }}>
          {renderTab()}
        </div>
      </div>
    </ReceptionLayout>
  );
};

export default ReceptionDashboard;
