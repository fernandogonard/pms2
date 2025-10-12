// components/admin/AdminReservationsSection.js
// Sección de gestión de reservas para administradores

import React from 'react';
import ReservationTable from '../ReservationTable';
import AdvancedReservationModal from '../AdvancedReservationModal';

const AdminReservationsSection = () => {
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>📅 Gestión de Reservas</h2>
          <p style={subtitleStyle}>Administración completa de reservaciones</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={newReservationButtonStyle}
        >
          <span style={buttonIconStyle}>➕</span>
          Nueva Reserva
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>📊</div>
          <div>
            <div style={statValueStyle}>24</div>
            <div style={statLabelStyle}>Reservas Hoy</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>✅</div>
          <div>
            <div style={statValueStyle}>8</div>
            <div style={statLabelStyle}>Check-ins</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🚪</div>
          <div>
            <div style={statValueStyle}>6</div>
            <div style={statLabelStyle}>Check-outs</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⏳</div>
          <div>
            <div style={statValueStyle}>12</div>
            <div style={statLabelStyle}>Pendientes</div>
          </div>
        </div>
      </div>

      {/* Tabla de reservas */}
      <div style={tableContainerStyle}>
        <ReservationTable />
      </div>

      {/* Modal de nueva reserva */}
      {modalOpen && (
        <AdvancedReservationModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

// Estilos
const containerStyle = {
  padding: '24px',
  maxWidth: '1400px'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
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

const newReservationButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #0099ff, #004c99)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(0, 153, 255, 0.3)'
};

const buttonIconStyle = {
  fontSize: '16px'
};

const statsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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

const tableContainerStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden'
};

export default AdminReservationsSection;