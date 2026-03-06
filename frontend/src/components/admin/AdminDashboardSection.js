// components/admin/AdminDashboardSection.js
// Sección principal del dashboard con estadísticas y resumen — datos reales

import React, { useEffect, useState } from 'react';
import AdminStats from '../AdminStats';
import { apiFetch } from '../../utils/api';

const AdminDashboardSection = ({ onSectionChange }) => {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const goTo = (section) => onSectionChange && onSectionChange(section);

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, resRes] = await Promise.all([
          apiFetch('/api/rooms'),
          apiFetch('/api/reservations'),
        ]);
        const rData = await rRes.json();
        const resData = await resRes.json();
        setRooms(Array.isArray(rData) ? rData : []);
        setReservations(Array.isArray(resData) ? resData : []);
      } catch (e) {
        console.error('Error cargando alertas:', e);
      } finally {
        setLoadingAlerts(false);
      }
    };
    load();
  }, []);

  // ── Alertas reales ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const roomsInMaintenance = rooms.filter(r => r.status === 'mantenimiento');
  const roomsInCleaning    = rooms.filter(r => r.status === 'limpieza');

  const unpaidReservations = reservations.filter(r =>
    r.payment && r.payment.status !== 'pagado' && r.status !== 'cancelada'
  );

  const todayCheckins = reservations.filter(r =>
    r.checkIn && r.checkIn.slice(0, 10) === today && r.status === 'reservada'
  );
  const todayCheckouts = reservations.filter(r =>
    r.checkOut && r.checkOut.slice(0, 10) === today && r.status === 'checkin'
  );
  const todayActiveReservations = reservations.filter(r => {
    if (!r.checkIn || !r.checkOut) return false;
    return r.checkIn.slice(0, 10) <= today && r.checkOut.slice(0, 10) >= today;
  });

  // Construir lista de alertas dinámicas
  const alerts = [];
  if (roomsInMaintenance.length > 0) {
    alerts.push({
      icon: '⚠️',
      title: `${roomsInMaintenance.length} habitación${roomsInMaintenance.length > 1 ? 'es' : ''} en mantenimiento`,
      detail: roomsInMaintenance.map(r => `Hab. ${r.number}`).join(', ')
    });
  }
  if (roomsInCleaning.length > 0) {
    alerts.push({
      icon: '🧹',
      title: `${roomsInCleaning.length} habitación${roomsInCleaning.length > 1 ? 'es' : ''} en limpieza`,
      detail: roomsInCleaning.map(r => `Hab. ${r.number}`).join(', ')
    });
  }
  if (unpaidReservations.length > 0) {
    alerts.push({
      icon: '💰',
      title: `${unpaidReservations.length} factura${unpaidReservations.length > 1 ? 's' : ''} pendiente${unpaidReservations.length > 1 ? 's' : ''} de pago`,
      detail: 'Hoy'
    });
  }
  if (todayCheckins.length > 0) {
    alerts.push({
      icon: '📅',
      title: `${todayCheckins.length} check-in${todayCheckins.length > 1 ? 's' : ''} programado${todayCheckins.length > 1 ? 's' : ''} para hoy`,
      detail: 'Pendientes de ingreso'
    });
  }
  if (alerts.length === 0 && !loadingAlerts) {
    alerts.push({ icon: '✅', title: 'Sin alertas pendientes', detail: 'Todo en orden' });
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>📊 Dashboard Ejecutivo</h2>
        <p style={subtitleStyle}>Resumen general del sistema hotelero</p>
      </div>

      {/* Estadísticas principales */}
      <div style={statsContainerStyle}>
        <AdminStats />
      </div>

      {/* Acciones rápidas */}
      <div style={quickActionsStyle}>
        <h3 style={sectionTitleStyle}>⚡ Acciones Rápidas</h3>
        <div style={actionsGridStyle}>
          <button style={actionButtonStyle} onClick={() => goTo('reservas')}>
            <span style={actionIconStyle}>➕</span>
            <div>
              <div style={actionTitleStyle}>Nueva Reserva</div>
              <div style={actionDescStyle}>Crear reserva rápida</div>
            </div>
          </button>
          <button style={actionButtonStyle} onClick={() => goTo('reservas')}>
            <span style={actionIconStyle}>✅</span>
            <div>
              <div style={actionTitleStyle}>Check-in Rápido</div>
              <div style={actionDescStyle}>Registrar llegada</div>
            </div>
          </button>
          <button style={actionButtonStyle} onClick={() => goTo('pending-checkouts')}>
            <span style={actionIconStyle}>🚪</span>
            <div>
              <div style={actionTitleStyle}>Check-out</div>
              <div style={actionDescStyle}>Procesar salida</div>
            </div>
          </button>
          <button style={actionButtonStyle} onClick={() => goTo('reportes')}>
            <span style={actionIconStyle}>📊</span>
            <div>
              <div style={actionTitleStyle}>Reporte Diario</div>
              <div style={actionDescStyle}>Ver estadísticas</div>
            </div>
          </button>
        </div>
      </div>

      {/* Vista previa del calendario — datos reales */}
      <div style={calendarPreviewStyle}>
        <h3 style={sectionTitleStyle}>📅 Ocupación de Habitaciones</h3>
        <div style={calendarTeaserStyle}>
          <p style={calendarMessageStyle}>
            Para ver el calendario completo de ocupación, ve a la sección&nbsp;
            <strong style={{ color: '#00ccff' }}>Habitaciones</strong>&nbsp;y selecciona la pestaña&nbsp;
            <strong style={{ color: '#00ccff' }}>Calendario</strong>
          </p>
          <div style={previewStatsStyle}>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>📅</span>
              <div>
                <div style={previewStatValueStyle}>{loadingAlerts ? '—' : todayActiveReservations.length}</div>
                <div style={previewStatLabelStyle}>Reservas Activas Hoy</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🔄</span>
              <div>
                <div style={previewStatValueStyle}>{loadingAlerts ? '—' : todayCheckins.length}</div>
                <div style={previewStatLabelStyle}>Check-ins Hoy</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🚪</span>
              <div>
                <div style={previewStatValueStyle}>{loadingAlerts ? '—' : todayCheckouts.length}</div>
                <div style={previewStatLabelStyle}>Check-outs Hoy</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas y notificaciones — datos reales */}
      <div style={alertsContainerStyle}>
        <h3 style={sectionTitleStyle}>🔔 Alertas del Sistema</h3>
        <div style={alertsListStyle}>
          {loadingAlerts ? (
            <div style={{ color: '#888', padding: 16 }}>Cargando alertas...</div>
          ) : alerts.map((alert, i) => (
            <div key={i} style={alertItemStyle}>
              <span style={alertIconStyle}>{alert.icon}</span>
              <div>
                <div style={alertTitleStyle}>{alert.title}</div>
                <div style={alertTimeStyle}>{alert.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Estilos
const containerStyle = {
  padding: '24px',
  maxWidth: '1200px'
};

const headerStyle = {
  marginBottom: '32px'
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

const statsContainerStyle = {
  marginBottom: '32px'
};

const quickActionsStyle = {
  marginBottom: '32px'
};

const sectionTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '16px'
};

const actionsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '16px'
};

const actionButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  color: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  textAlign: 'left'
};

const actionIconStyle = {
  fontSize: '24px',
  minWidth: '24px'
};

const actionTitleStyle = {
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '4px'
};

const actionDescStyle = {
  fontSize: '12px',
  color: '#aaa'
};

const alertsContainerStyle = {
  marginBottom: '32px'
};

const alertsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const alertItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px'
};

const alertIconStyle = {
  fontSize: '20px',
  minWidth: '20px'
};

const alertTitleStyle = {
  fontSize: '14px',
  fontWeight: '500',
  color: 'white',
  marginBottom: '4px'
};

const alertTimeStyle = {
  fontSize: '12px',
  color: '#aaa'
};

const calendarPreviewStyle = {
  marginBottom: '32px'
};

const calendarTeaserStyle = {
  padding: '20px',
  background: 'rgba(0, 153, 255, 0.1)',
  border: '1px solid rgba(0, 153, 255, 0.3)',
  borderRadius: '12px'
};

const calendarMessageStyle = {
  fontSize: '14px',
  color: '#ccc',
  marginBottom: '16px',
  lineHeight: '1.5'
};

const previewStatsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px'
};

const previewStatStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '8px'
};

const previewStatIconStyle = {
  fontSize: '20px',
  minWidth: '20px'
};

const previewStatValueStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#00ccff',
  marginBottom: '2px'
};

const previewStatLabelStyle = {
  fontSize: '11px',
  color: '#aaa',
  textTransform: 'uppercase'
};

export default AdminDashboardSection;