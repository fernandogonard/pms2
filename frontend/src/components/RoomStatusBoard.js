// components/RoomStatusBoard.js
// Panel de habitaciones con estado completo: huésped, pagos, saldo, cargos extra
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const fmt = n => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

const STATUS_CONFIG = {
  disponible:   { label: 'Disponible',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: '✅' },
  ocupada:      { label: 'Ocupada',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '🔴' },
  limpieza:     { label: 'En limpieza',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🧹' },
  mantenimiento:{ label: 'Mantenimiento', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: '🔧' },
};

const MLABELS = {
  efectivo:     '💵 Efectivo',
  tarjeta:      '💳 T. Crédito',
  debito:       '💳 T. Débito',
  transferencia:'🏦 Transferencia',
  cheque:       '📝 Cheque',
};

const CAT_ICONS = {
  minibar:     '🍾',
  lavanderia:  '👔',
  room_service:'🍽️',
  telefono:    '📞',
  spa:         '💆',
  parking:     '🚗',
  otro:        '📦',
};

// ─── Modal rápido de cobro ────────────────────────────────────────────────────
const QuickPayModal = ({ reservation, onClose, onSuccess }) => {
  const balance = Math.max(0, (reservation.pricing?.total || 0) - (reservation.payment?.amountPaid || 0));
  const [amount, setAmount]   = useState(balance > 0 ? String(Math.round(balance)) : '');
  const [method, setMethod]   = useState('efectivo');
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setError('Ingresá un monto válido'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/billing/reservations/${reservation._id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), method, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Error al registrar pago'); setLoading(false); return; }
      onSuccess('Pago registrado correctamente');
    } catch { setError('Error de red'); setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#111827', color:'#fff', borderRadius:14, width:400, padding:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', border:'1px solid #374151' }}>
        <h3 style={{ margin:'0 0 4px', color:'#22c55e', fontSize:16, fontWeight:700 }}>💳 Registrar Pago</h3>
        <p style={{ margin:'0 0 16px', color:'#9ca3af', fontSize:13 }}>
          {reservation.client?.nombre} {reservation.client?.apellido} — Hab. {Array.isArray(reservation.room) ? reservation.room.map(r => r.number || r).join(', ') : '?'}
        </p>
        <div style={{ background:'#1f2937', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ color:'#9ca3af' }}>Total facturado:</span>
            <span style={{ color:'#22c55e', fontWeight:700 }}>{fmt(reservation.pricing?.total)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ color:'#9ca3af' }}>Ya cobrado:</span>
            <span style={{ color:'#60a5fa', fontWeight:600 }}>{fmt(reservation.payment?.amountPaid)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}>
            <span style={{ color: balance > 0 ? '#fbbf24' : '#9ca3af' }}>Saldo pendiente:</span>
            <span style={{ color: balance > 0 ? '#fbbf24' : '#22c55e' }}>{balance > 0 ? fmt(balance) : '✅ Saldado'}</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Monto ($)</div>
            <input type="number" min="0.01" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} required
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:14, boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Método de pago</div>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:13 }}>
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta">💳 T. Crédito</option>
              <option value="debito">💳 T. Débito</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="cheque">📝 Cheque</option>
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Notas (opcional)</div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Seña, abono parcial..."
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:13, boxSizing:'border-box' }} />
          </div>
          {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:10, fontWeight:600 }}>{error}</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{ background:'#374151', color:'#d1d5db', border:'none', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontWeight:600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ background: loading ? '#555' : '#22c55e', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Procesando...' : '✓ Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal rápido de cargo extra ─────────────────────────────────────────────
const QuickChargeModal = ({ reservation, onClose, onSuccess }) => {
  const [desc, setDesc]         = useState('');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState('otro');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!desc || !amount || parseFloat(amount) <= 0) { setError('Completá descripción y monto'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/billing/reservations/${reservation._id}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, amount: parseFloat(amount), category }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Error al agregar cargo'); setLoading(false); return; }
      onSuccess('Cargo extra agregado');
    } catch { setError('Error de red'); setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#111827', color:'#fff', borderRadius:14, width:400, padding:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', border:'1px solid #374151' }}>
        <h3 style={{ margin:'0 0 4px', color:'#a78bfa', fontSize:16, fontWeight:700 }}>➕ Cargo Extra</h3>
        <p style={{ margin:'0 0 16px', color:'#9ca3af', fontSize:13 }}>
          {reservation.client?.nombre} {reservation.client?.apellido} — Hab. {Array.isArray(reservation.room) ? reservation.room.map(r => r.number || r).join(', ') : '?'}
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Categoría</div>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:13 }}>
              <option value="minibar">🍾 Minibar</option>
              <option value="lavanderia">👔 Lavandería</option>
              <option value="room_service">🍽️ Room Service</option>
              <option value="telefono">📞 Teléfono</option>
              <option value="spa">💆 Spa</option>
              <option value="parking">🚗 Parking</option>
              <option value="otro">📦 Otro</option>
            </select>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Descripción</div>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} required
              placeholder="Botella vino, desayuno, etc."
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:13, boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:4 }}>Monto ($)</div>
            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
              style={{ width:'100%', background:'#1f2937', color:'#fff', border:'1px solid #4b5563', borderRadius:6, padding:'8px 10px', fontSize:14, boxSizing:'border-box' }} />
          </div>
          {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:10, fontWeight:600 }}>{error}</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{ background:'#374151', color:'#d1d5db', border:'none', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontWeight:600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ background: loading ? '#555' : '#7c3aed', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : '✓ Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Tarjeta de habitación ────────────────────────────────────────────────────
const RoomCard = ({ room, reservation, onPay, onCharge }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.disponible;

  const total       = reservation?.pricing?.total      || 0;
  const paid        = reservation?.payment?.amountPaid || 0;
  const balance     = Math.max(0, total - paid);
  const extras      = reservation?.extras              || [];
  const history     = reservation?.paymentHistory      || [];
  const extrasTotal = extras.reduce((s, e) => s + (e.amount || 0), 0);

  const guestName = reservation?.client
    ? `${reservation.client.nombre || ''} ${reservation.client.apellido || ''}`.trim()
    : reservation?.nombre
      ? `${reservation.nombre} ${reservation.apellido || ''}`.trim()
      : null;

  const nights = reservation
    ? Math.max(1, Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / 86400000))
    : null;

  return (
    <div style={{
      background: cfg.bg,
      border: `1.5px solid ${cfg.color}40`,
      borderRadius: 14,
      overflow: 'hidden',
      minWidth: 260,
      flex: '1 1 260px',
      maxWidth: 340,
    }}>
      {/* Header */}
      <div style={{ background:`${cfg.color}18`, borderBottom:`1px solid ${cfg.color}30`, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <span style={{ fontWeight:800, fontSize:18, color:'#fff' }}>Hab. {room.number}</span>
          <span style={{ marginLeft:8, color:'#aaa', fontSize:12, textTransform:'capitalize' }}>{room.type} · Piso {room.floor}</span>
        </div>
        <span style={{ background:`${cfg.color}22`, color:cfg.color, border:`1px solid ${cfg.color}44`, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {reservation && guestName ? (
          <>
            {/* Huésped y fechas */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>👤 {guestName}</div>
              <div style={{ color:'#9ca3af', fontSize:12, marginTop:2 }}>
                {reservation.checkIn?.slice(0,10)} → {reservation.checkOut?.slice(0,10)}
                {nights ? <span style={{ marginLeft:6, color:'#60a5fa' }}>({nights} noche{nights !== 1 ? 's' : ''})</span> : null}
              </div>
            </div>

            {/* Bloque de pagos */}
            <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, textAlign:'center' }}>
                <div>
                  <div style={{ color:'#9ca3af', fontSize:10, marginBottom:3 }}>TOTAL</div>
                  <div style={{ color:'#22c55e', fontWeight:700, fontSize:14 }}>{fmt(total)}</div>
                </div>
                <div>
                  <div style={{ color:'#9ca3af', fontSize:10, marginBottom:3 }}>COBRADO</div>
                  <div style={{ color:'#60a5fa', fontWeight:700, fontSize:14 }}>{fmt(paid)}</div>
                </div>
                <div>
                  <div style={{ color:'#9ca3af', fontSize:10, marginBottom:3 }}>SALDO</div>
                  <div style={{ color: balance > 0 ? '#fbbf24' : '#22c55e', fontWeight:700, fontSize:14 }}>
                    {balance > 0 ? fmt(balance) : '✅ $0'}
                  </div>
                </div>
              </div>
              {/* Badges de estado */}
              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                {paid === 0 && (
                  <span style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'1px solid #ef444440', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                    ⚠️ Sin cobro
                  </span>
                )}
                {paid > 0 && balance > 0 && (
                  <span style={{ background:'rgba(245,158,11,0.2)', color:'#fbbf24', border:'1px solid #f59e0b40', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                    💰 Pago parcial
                  </span>
                )}
                {balance <= 0 && paid > 0 && (
                  <span style={{ background:'rgba(34,197,94,0.15)', color:'#22c55e', border:'1px solid #22c55e40', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                    ✅ Saldado
                  </span>
                )}
                {extrasTotal > 0 && (
                  <span style={{ background:'rgba(167,139,250,0.2)', color:'#a78bfa', border:'1px solid #a78bfa40', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                    ➕ Extras {fmt(extrasTotal)}
                  </span>
                )}
              </div>
            </div>

            {/* Detalle expandible */}
            <button onClick={() => setExpanded(e => !e)}
              style={{ background:'none', border:'none', color:'#6b7280', fontSize:12, cursor:'pointer', padding:'2px 0', marginBottom: expanded ? 8 : 0, display:'flex', alignItems:'center', gap:4 }}>
              {expanded ? '▲ Ocultar detalle' : '▼ Ver historial y cargos'}
            </button>

            {expanded && (
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:10, marginBottom:10 }}>
                {history.length > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ color:'#60a5fa', fontSize:11, fontWeight:700, marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Pagos registrados</div>
                    {history.map((h, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#d1d5db', borderBottom:'1px solid rgba(255,255,255,0.04)', paddingBottom:4, marginBottom:4 }}>
                        <span>{h.date ? new Date(h.date).toLocaleDateString('es-AR') : '-'} · {MLABELS[h.method] || h.method}{h.notes ? ` · ${h.notes}` : ''}</span>
                        <span style={{ color:'#22c55e', fontWeight:700 }}>{fmt(h.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {extras.length > 0 && (
                  <div>
                    <div style={{ color:'#a78bfa', fontSize:11, fontWeight:700, marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Cargos extra</div>
                    {extras.map((x, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#d1d5db', borderBottom:'1px solid rgba(255,255,255,0.04)', paddingBottom:4, marginBottom:4 }}>
                        <span>{CAT_ICONS[x.category] || '📦'} {x.description}{x.date ? ` · ${new Date(x.date).toLocaleDateString('es-AR')}` : ''}</span>
                        <span style={{ color:'#f59e0b', fontWeight:700 }}>{fmt(x.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {history.length === 0 && extras.length === 0 && (
                  <div style={{ color:'#6b7280', fontSize:12 }}>Sin movimientos registrados</div>
                )}
              </div>
            )}

            {/* Acciones */}
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => onPay(reservation)}
                style={{ flex:1, background:'#0099ff', color:'#fff', border:'none', borderRadius:8, padding:'7px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                💳 Cobrar
              </button>
              <button onClick={() => onCharge(reservation)}
                style={{ flex:1, background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, padding:'7px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                ➕ Cargo
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'16px 0', color:'#6b7280' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>🛏️</div>
            <div style={{ fontSize:12 }}>
              {room.status === 'limpieza'      ? 'En proceso de limpieza' :
               room.status === 'mantenimiento' ? 'Fuera de servicio'       : 'Libre y disponible'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Panel principal ──────────────────────────────────────────────────────────
const RoomStatusBoard = () => {
  const [rooms, setRooms]               = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [toast, setToast]               = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [payModal, setPayModal]         = useState(null);
  const [chargeModal, setChargeModal]   = useState(null);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [roomsRes, resRes] = await Promise.all([
        apiFetch('/api/rooms'),
        apiFetch('/api/reservations'),
      ]);
      const roomsData = await roomsRes.json();
      const resData   = await resRes.json();
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setReservations(Array.isArray(resData) ? resData.filter(r => r.status === 'checkin') : []);
    } catch {
      setError('No se pudieron cargar los datos de habitaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Cruzar habitación con su reserva activa
  const getReservationForRoom = room => reservations.find(res => {
    if (!res.room) return false;
    const ids = Array.isArray(res.room)
      ? res.room.map(r => typeof r === 'object' ? r._id : r)
      : [typeof res.room === 'object' ? res.room._id : res.room];
    return ids.includes(room._id);
  }) || null;

  const filtered = filterStatus ? rooms.filter(r => r.status === filterStatus) : rooms;
  const sorted   = [...filtered].sort((a, b) => {
    const order = { ocupada:0, limpieza:1, mantenimiento:2, disponible:3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  const counts = {
    ocupada:      rooms.filter(r => r.status === 'ocupada').length,
    disponible:   rooms.filter(r => r.status === 'disponible').length,
    limpieza:     rooms.filter(r => r.status === 'limpieza').length,
    mantenimiento:rooms.filter(r => r.status === 'mantenimiento').length,
  };
  const saldoPendiente = reservations.reduce(
    (s, r) => s + Math.max(0, (r.pricing?.total || 0) - (r.payment?.amountPaid || 0)), 0
  );

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:'#aaa' }}>
      <div style={{ display:'inline-block', width:36, height:36, border:'4px solid #222', borderTop:'4px solid #0099ff', borderRadius:'50%', animation:'spin 1s linear infinite', marginBottom:16 }} />
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div>Cargando habitaciones...</div>
    </div>
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:24, right:24, background:'#052e16', color:'#22c55e', border:'1px solid #16a34a', borderRadius:10, padding:'12px 20px', fontWeight:700, zIndex:4000, boxShadow:'0 8px 30px rgba(0,0,0,0.5)' }}>
          ✅ {toast}
        </div>
      )}

      {payModal    && <QuickPayModal    reservation={payModal}    onClose={() => setPayModal(null)}    onSuccess={msg => { setPayModal(null);    showToast(msg); load(); }} />}
      {chargeModal && <QuickChargeModal reservation={chargeModal} onClose={() => setChargeModal(null)} onSuccess={msg => { setChargeModal(null); showToast(msg); load(); }} />}

      {/* Cabecera */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <h2 style={{ margin:0, color:'#fff', fontSize:18, fontWeight:700 }}>🛏️ Estado de Habitaciones</h2>
        <button onClick={load} style={{ background:'#1f2937', color:'#9ca3af', border:'1px solid #374151', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13 }}>
          ↺ Actualizar
        </button>
      </div>

      {error && <div style={{ color:'#f87171', marginBottom:14, fontWeight:600 }}>{error}</div>}

      {/* Filtros / resumen */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10, marginBottom:20 }}>
        {[
          { key:'',             label:'Todas',         value:rooms.length,            color:'#9ca3af' },
          { key:'ocupada',      label:'Ocupadas',      value:counts.ocupada,          color:'#ef4444' },
          { key:'disponible',   label:'Disponibles',   value:counts.disponible,       color:'#22c55e' },
          { key:'limpieza',     label:'En limpieza',   value:counts.limpieza,         color:'#a78bfa' },
          { key:'mantenimiento',label:'Mantenimiento', value:counts.mantenimiento,    color:'#fb923c' },
        ].map(c => (
          <button key={c.key} onClick={() => setFilterStatus(c.key)}
            style={{
              background: filterStatus === c.key ? `${c.color}22` : 'rgba(255,255,255,0.04)',
              border:`1.5px solid ${filterStatus === c.key ? c.color+'60' : 'rgba(255,255,255,0.08)'}`,
              borderRadius:10, padding:'10px 12px', cursor:'pointer', textAlign:'left', color:'#fff',
            }}>
            <div style={{ fontSize:20, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{c.label}</div>
          </button>
        ))}
        {saldoPendiente > 0 && (
          <div style={{ background:'rgba(245,158,11,0.1)', border:'1.5px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#fbbf24' }}>{fmt(saldoPendiente)}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>⏳ Saldo pendiente</div>
          </div>
        )}
      </div>

      {/* Grid de tarjetas */}
      {sorted.length === 0 ? (
        <div style={{ color:'#6b7280', textAlign:'center', padding:40 }}>No hay habitaciones para mostrar</div>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
          {sorted.map(room => (
            <RoomCard
              key={room._id}
              room={room}
              reservation={getReservationForRoom(room)}
              onPay={setPayModal}
              onCharge={setChargeModal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomStatusBoard;
