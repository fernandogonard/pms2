// components/admin/AdminDashboardSection.js
// Sección principal del dashboard con estadísticas y resumen

import React from 'react';
import AdminStats from '../AdminStats';

const AdminDashboardSection = () => {
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
          <button style={actionButtonStyle}>
            <span style={actionIconStyle}>➕</span>
            <div>
              <div style={actionTitleStyle}>Nueva Reserva</div>
              <div style={actionDescStyle}>Crear reserva rápida</div>
            </div>
          </button>
          <button style={actionButtonStyle}>
            <span style={actionIconStyle}>✅</span>
            <div>
              <div style={actionTitleStyle}>Check-in Rápido</div>
              <div style={actionDescStyle}>Registrar llegada</div>
            </div>
          </button>
          <button style={actionButtonStyle}>
            <span style={actionIconStyle}>🚪</span>
            <div>
              <div style={actionTitleStyle}>Check-out</div>
              <div style={actionDescStyle}>Procesar salida</div>
            </div>
          </button>
          <button style={actionButtonStyle}>
            <span style={actionIconStyle}>📊</span>
            <div>
              <div style={actionTitleStyle}>Reporte Diario</div>
              <div style={actionDescStyle}>Ver estadísticas</div>
            </div>
          </button>
        </div>
      </div>

      {/* Vista previa del calendario */}
      <div style={calendarPreviewStyle}>
        <h3 style={sectionTitleStyle}>📅 Ocupación de Habitaciones</h3>
        <div style={calendarTeaserStyle}>
          <p style={calendarMessageStyle}>
            Para ver el calendario completo de ocupación, ve a la sección 
            <strong style={{ color: '#00ccff', margin: '0 4px' }}>Habitaciones</strong> 
            y selecciona la pestaña
            <strong style={{ color: '#00ccff', margin: '0 4px' }}>Calendario</strong>
          </p>
          <div style={previewStatsStyle}>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>📅</span>
              <div>
                <div style={previewStatValueStyle}>12</div>
                <div style={previewStatLabelStyle}>Reservas Hoy</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🔄</span>
              <div>
                <div style={previewStatValueStyle}>5</div>
                <div style={previewStatLabelStyle}>Check-ins</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🚪</span>
              <div>
                <div style={previewStatValueStyle}>3</div>
                <div style={previewStatLabelStyle}>Check-outs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas y notificaciones */}
      <div style={alertsContainerStyle}>
        <h3 style={sectionTitleStyle}>🔔 Alertas del Sistema</h3>
        <div style={alertsListStyle}>
          <div style={alertItemStyle}>
            <span style={alertIconStyle}>⚠️</span>
            <div>
              <div style={alertTitleStyle}>Habitación 102 en mantenimiento</div>
              <div style={alertTimeStyle}>Hace 2 horas</div>
            </div>
          </div>
          <div style={alertItemStyle}>
            <span style={alertIconStyle}>💰</span>
            <div>
              <div style={alertTitleStyle}>5 facturas pendientes de pago</div>
              <div style={alertTimeStyle}>Hoy</div>
            </div>
          </div>
          <div style={alertItemStyle}>
            <span style={alertIconStyle}>📅</span>
            <div>
              <div style={alertTitleStyle}>Check-in programado en 1 hora</div>
              <div style={alertTimeStyle}>Reserva #12345</div>
            </div>
          </div>
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