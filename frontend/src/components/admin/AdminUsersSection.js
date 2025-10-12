// components/admin/AdminUsersSection.js
// Sección de gestión de usuarios para administradores

import React from 'react';
import UserTable from '../UserTable';

const AdminUsersSection = () => {
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>⚙️ Gestión de Usuarios</h2>
          <p style={subtitleStyle}>Administración de usuarios del sistema y permisos</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          style={newUserButtonStyle}
        >
          <span style={buttonIconStyle}>➕</span>
          Nuevo Usuario
        </button>
      </div>

      {/* Estadísticas de usuarios */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>👨‍💼</div>
          <div>
            <div style={statValueStyle}>12</div>
            <div style={statLabelStyle}>Total Usuarios</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🔑</div>
          <div>
            <div style={statValueStyle}>3</div>
            <div style={statLabelStyle}>Administradores</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>📋</div>
          <div>
            <div style={statValueStyle}>7</div>
            <div style={statLabelStyle}>Recepcionistas</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🟢</div>
          <div>
            <div style={statValueStyle}>9</div>
            <div style={statLabelStyle}>Activos</div>
          </div>
        </div>
      </div>

      {/* Configuración del sistema */}
      <div style={systemConfigStyle}>
        <h3 style={sectionTitleStyle}>🔧 Configuración del Sistema</h3>
        <div style={configGridStyle}>
          <div style={configCardStyle}>
            <div style={configIconStyle}>🔐</div>
            <div style={configContentStyle}>
              <h4 style={configTitleStyle}>Seguridad</h4>
              <p style={configDescStyle}>
                Configuración de políticas de contraseñas, sesiones y autenticación
              </p>
              <button style={configButtonStyle}>Configurar</button>
            </div>
          </div>
          
          <div style={configCardStyle}>
            <div style={configIconStyle}>📧</div>
            <div style={configContentStyle}>
              <h4 style={configTitleStyle}>Notificaciones</h4>
              <p style={configDescStyle}>
                Gestión de emails automáticos y notificaciones del sistema
              </p>
              <button style={configButtonStyle}>Configurar</button>
            </div>
          </div>
          
          <div style={configCardStyle}>
            <div style={configIconStyle}>🎨</div>
            <div style={configContentStyle}>
              <h4 style={configTitleStyle}>Personalización</h4>
              <p style={configDescStyle}>
                Colores, logo y configuración visual del sistema
              </p>
              <button style={configButtonStyle}>Configurar</button>
            </div>
          </div>
          
          <div style={configCardStyle}>
            <div style={configIconStyle}>💾</div>
            <div style={configContentStyle}>
              <h4 style={configTitleStyle}>Backup</h4>
              <p style={configDescStyle}>
                Configuración de copias de seguridad automáticas
              </p>
              <button style={configButtonStyle}>Configurar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div style={tableContainerStyle}>
        <h3 style={sectionTitleStyle}>👥 Usuarios del Sistema</h3>
        <UserTable />
      </div>

      {/* Modal de creación de usuario (placeholder) */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Crear Nuevo Usuario</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={modalCloseStyle}
              >
                ✕
              </button>
            </div>
            <div style={modalBodyStyle}>
              <p style={modalTextStyle}>
                Formulario de creación de usuario será implementado próximamente.
              </p>
              <div style={modalActionsStyle}>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  style={modalCancelStyle}
                >
                  Cancelar
                </button>
                <button style={modalSaveStyle}>
                  Crear Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
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

const newUserButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
};

const buttonIconStyle = {
  fontSize: '16px'
};

const statsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '16px',
  marginBottom: '32px'
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

const systemConfigStyle = {
  marginBottom: '32px'
};

const sectionTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '16px'
};

const configGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '20px'
};

const configCardStyle = {
  display: 'flex',
  gap: '16px',
  padding: '20px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px'
};

const configIconStyle = {
  fontSize: '32px',
  minWidth: '32px'
};

const configContentStyle = {
  flex: 1
};

const configTitleStyle = {
  fontSize: '16px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '8px'
};

const configDescStyle = {
  fontSize: '14px',
  color: '#aaa',
  marginBottom: '12px',
  lineHeight: 1.4
};

const configButtonStyle = {
  padding: '6px 12px',
  background: 'rgba(0, 153, 255, 0.2)',
  border: '1px solid rgba(0, 153, 255, 0.3)',
  borderRadius: '6px',
  color: '#00ccff',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const tableContainerStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  padding: '24px'
};

// Estilos del modal
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalContentStyle = {
  background: '#2d3748',
  borderRadius: '12px',
  width: '500px',
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflow: 'auto'
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
};

const modalTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'white',
  margin: 0
};

const modalCloseStyle = {
  background: 'transparent',
  border: 'none',
  color: '#aaa',
  fontSize: '20px',
  cursor: 'pointer',
  padding: '4px'
};

const modalBodyStyle = {
  padding: '24px'
};

const modalTextStyle = {
  color: '#aaa',
  marginBottom: '24px',
  lineHeight: 1.5
};

const modalActionsStyle = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end'
};

const modalCancelStyle = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  color: '#aaa',
  cursor: 'pointer'
};

const modalSaveStyle = {
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  cursor: 'pointer'
};

export default AdminUsersSection;