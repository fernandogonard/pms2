// components/AdminSidebar.js
// Sidebar con navegación por secciones para el panel de administración

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminSidebar = ({ activeSection, onSectionChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'pending-checkouts', label: 'Checkouts Pendientes', icon: '🚪' },
    { id: 'reservas', label: 'Reservas', icon: '📅' },
    { id: 'habitaciones', label: 'Habitaciones', icon: '🛏️' },
    { id: 'housekeeping', label: 'Housekeeping', icon: '🧹' },
    { id: 'mantenimiento', label: 'Mantenimiento', icon: '🔧' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'facturacion', label: 'Facturación', icon: '💰' },
    { id: 'reportes', label: 'Reportes', icon: '📋' },
    { id: 'auditoria', label: 'Auditoría', icon: '📜' },
    { id: 'usuarios', label: 'Usuarios', icon: '⚙️' }
  ];

  return (
    <div style={{
      ...sidebarStyle,
      width: collapsed ? '70px' : '240px'
    }}>
      {/* Header del Sidebar */}
      <div style={sidebarHeaderStyle}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={collapseButtonStyle}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? '▶️' : '◀️'}
        </button>
        {!collapsed && (
          <span style={sidebarTitleStyle}>Administración</span>
        )}
      </div>

      {/* Navegación */}
      <nav style={navigationStyle}>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            style={{
              ...sectionButtonStyle,
              ...(activeSection === section.id ? activeSectionStyle : {}),
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '12px' : '12px 16px'
            }}
            title={collapsed ? section.label : ''}
            onMouseEnter={(e) => {
              if (activeSection !== section.id) {
                e.target.style.backgroundColor = 'rgba(0, 153, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== section.id) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span style={sectionIconStyle}>{section.icon}</span>
            {!collapsed && (
              <span style={sectionLabelStyle}>{section.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer del Sidebar */}
      {!collapsed && (
        <div style={sidebarFooterStyle}>
          <div style={footerTextStyle}>
            <div style={footerTitleStyle}>MiHotel CRM</div>
            <div style={footerVersionStyle}>v1.0.0</div>
          </div>
          <LogoutButton />
        </div>
      )}
    </div>
  );
};

const LogoutButton = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <button onClick={handleLogout} style={logoutBtnStyle} title="Cerrar sesión">
      🚪 Cerrar sesión
    </button>
  );
};

// Estilos
const sidebarStyle = {
  position: 'relative', // Cambiado de fixed a relative para funcionar en flex layout
  top: 0, // Sin offset por navbar
  left: 0,
  height: '100vh', // Altura completa de viewport
  background: 'linear-gradient(180deg, #2d3748 0%, #1a202c 100%)',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  transition: 'width 0.3s ease',
  zIndex: 999,
  boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)',
  flexShrink: 0 // No se comprime en flex layout
};

const sidebarHeaderStyle = {
  padding: '16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px'
};

const collapseButtonStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  color: 'white',
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  transition: 'background 0.2s ease'
};

const sidebarTitleStyle = {
  color: 'white',
  fontSize: '16px',
  fontWeight: '600'
};

const navigationStyle = {
  flex: 1,
  padding: '16px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const sectionButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '0 12px',
  border: 'none',
  background: 'transparent',
  color: 'rgba(255, 255, 255, 0.8)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease',
  textAlign: 'left'
};

const activeSectionStyle = {
  background: 'rgba(0, 153, 255, 0.2)',
  color: '#00ccff',
  boxShadow: '0 2px 8px rgba(0, 153, 255, 0.3)'
};

const sectionIconStyle = {
  fontSize: '18px',
  minWidth: '18px'
};

const sectionLabelStyle = {
  whiteSpace: 'nowrap'
};

const sidebarFooterStyle = {
  padding: '16px',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
};

const footerTextStyle = {
  textAlign: 'center'
};

const footerTitleStyle = {
  color: 'white',
  fontSize: '12px',
  fontWeight: '600',
  marginBottom: '4px'
};

const footerVersionStyle = {
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: '10px'
};

const logoutBtnStyle = {
  marginTop: 12,
  width: '100%',
  padding: '8px 12px',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14
};

export default AdminSidebar;