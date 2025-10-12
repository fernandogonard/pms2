// components/Navbar.js
// Navbar profesional para el CRM hotelero con navegación completa

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determinar navegación basada en el rol
  const getNavItems = () => {
    const commonItems = [
      { path: '/', label: 'Inicio', icon: '🏠' }
    ];

    if (user?.role === 'admin') {
      return [
        { path: '/admin', label: 'Dashboard', icon: '📊' },
        { path: '/admin/reservas', label: 'Reservas', icon: '📅' },
        { path: '/admin/habitaciones', label: 'Habitaciones', icon: '🛏️' },
        { path: '/admin/clientes', label: 'Clientes', icon: '👥' },
        { path: '/admin/facturacion', label: 'Facturación', icon: '💰' },
        { path: '/admin/reportes', label: 'Reportes', icon: '📊' },
        { path: '/admin/usuarios', label: 'Usuarios', icon: '⚙️' }
      ];
    } else if (user?.role === 'recepcionista') {
      return [
        { path: '/recepcion', label: 'Dashboard', icon: '📊' },
        { path: '/recepcion/reservas', label: 'Reservas', icon: '📅' },
        { path: '/recepcion/habitaciones', label: 'Habitaciones', icon: '🛏️' },
        { path: '/recepcion/clientes', label: 'Clientes', icon: '👥' },
        { path: '/recepcion/facturacion', label: 'Facturación', icon: '💰' }
      ];
    }

    return commonItems;
  };

  const navItems = getNavItems();
  const currentPath = location.pathname;

  // Si no hay usuario, no mostrar navbar
  if (!user) return null;

  return (
    <>
      <nav style={navbarStyle}>
        {/* Logo y Marca */}
        <div style={logoSectionStyle}>
          <div style={logoStyle}>
            🏨
          </div>
          <div style={brandTextStyle}>
            <div style={brandNameStyle}>MiHotel CRM</div>
            <div style={brandSubtitleStyle}>Sistema de Gestión Hotelera</div>
          </div>
        </div>

        {/* Navegación Principal */}
        <div style={navigationStyle}>
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              style={{
                ...navItemStyle,
                ...(currentPath === item.path ? navItemActiveStyle : {})
              }}
              onMouseEnter={(e) => {
                if (currentPath !== item.path) {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPath !== item.path) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={navIconStyle}>{item.icon}</span>
              <span style={navLabelStyle}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Información del Usuario */}
        <div style={userSectionStyle}>
          {/* Notificaciones (placeholder) */}
          <button style={notificationButtonStyle}>
            <span style={notificationIconStyle}>🔔</span>
            <span style={notificationBadgeStyle}>3</span>
          </button>

          {/* Usuario Dropdown */}
          <div style={userDropdownContainerStyle}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              style={userButtonStyle}
            >
              <div style={userAvatarStyle}>
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={userInfoStyle}>
                <div style={userNameStyle}>
                  {user.email?.split('@')[0] || 'Usuario'}
                </div>
                <div style={userRoleStyle}>
                  {user.role === 'admin' ? 'Administrador' : 
                   user.role === 'recepcionista' ? 'Recepcionista' : 'Usuario'}
                </div>
              </div>
              <span style={dropdownArrowStyle}>
                {showUserDropdown ? '▲' : '▼'}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div style={dropdownMenuStyle}>
                <button style={dropdownItemStyle}>
                  <span style={dropdownIconStyle}>👤</span>
                  Mi Perfil
                </button>
                <button style={dropdownItemStyle}>
                  <span style={dropdownIconStyle}>⚙️</span>
                  Configuración
                </button>
                <div style={dropdownDividerStyle}></div>
                <button 
                  onClick={handleLogout}
                  style={{...dropdownItemStyle, ...logoutItemStyle}}
                >
                  <span style={dropdownIconStyle}>🚪</span>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Espaciador para evitar que el contenido se superponga */}
      <div style={{ height: '70px' }}></div>
    </>
  );
};

// Estilos del Navbar
const navbarStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '70px',
  background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  zIndex: 1000,
  fontFamily: 'Inter, Arial, sans-serif'
};

const logoSectionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minWidth: '250px'
};

const logoStyle = {
  fontSize: '32px',
  background: 'rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px solid rgba(255, 255, 255, 0.2)'
};

const brandTextStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const brandNameStyle = {
  fontSize: '18px',
  fontWeight: '700',
  letterSpacing: '0.5px'
};

const brandSubtitleStyle = {
  fontSize: '12px',
  opacity: 0.8,
  fontWeight: '400'
};

const navigationStyle = {
  display: 'flex',
  gap: '8px',
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center'
};

const navItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  background: 'transparent',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease'
};

const navItemActiveStyle = {
  background: 'rgba(255, 255, 255, 0.2)',
  boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)'
};

const navIconStyle = {
  fontSize: '16px'
};

const navLabelStyle = {
  whiteSpace: 'nowrap'
};

const userSectionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  minWidth: '250px',
  justifyContent: 'flex-end'
};

const notificationButtonStyle = {
  position: 'relative',
  background: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  color: 'white',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const notificationIconStyle = {
  fontSize: '18px'
};

const notificationBadgeStyle = {
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  background: '#ff4757',
  color: 'white',
  fontSize: '10px',
  fontWeight: 'bold',
  padding: '2px 6px',
  borderRadius: '10px',
  minWidth: '16px',
  textAlign: 'center'
};

const userDropdownContainerStyle = {
  position: 'relative'
};

const userButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  background: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const userAvatarStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '16px'
};

const userInfoStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
};

const userNameStyle = {
  fontSize: '14px',
  fontWeight: '600'
};

const userRoleStyle = {
  fontSize: '12px',
  opacity: 0.8
};

const dropdownArrowStyle = {
  fontSize: '12px',
  opacity: 0.8
};

const dropdownMenuStyle = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '8px',
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  minWidth: '200px',
  zIndex: 1001
};

const dropdownItemStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  border: 'none',
  background: 'transparent',
  color: '#333',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background 0.2s ease',
  textAlign: 'left'
};

const dropdownIconStyle = {
  fontSize: '16px'
};

const dropdownDividerStyle = {
  height: '1px',
  background: 'rgba(0, 0, 0, 0.1)',
  margin: '4px 0'
};

const logoutItemStyle = {
  color: '#e74c3c'
};

export default Navbar;