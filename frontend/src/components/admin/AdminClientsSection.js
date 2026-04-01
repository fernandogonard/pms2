// components/admin/AdminClientsSection.js
// Sección de gestión de clientes para administradores

import React from 'react';
import { apiFetch } from '../../utils/api';
import ClientTable from '../ClientTable';

const AdminClientsSection = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [clientStats, setClientStats] = React.useState({
    total: 0, nuevos: 0
  });

  React.useEffect(() => {
    apiFetch('/api/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const ahora = new Date();
          const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
          const nuevos = data.filter(c => c.createdAt && new Date(c.createdAt) >= primerDiaMes).length;
          setClientStats({ total: data.length, nuevos });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>👥 Gestión de Clientes</h2>
          <p style={subtitleStyle}>Administración completa de huéspedes y clientes</p>
        </div>
        <button style={newClientButtonStyle}>
          <span style={buttonIconStyle}>➕</span>
          Nuevo Cliente
        </button>
      </div>

      {/* Estadísticas de clientes */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>👤</div>
          <div>
            <div style={statValueStyle}>{clientStats.total.toLocaleString('es-AR')}</div>
            <div style={statLabelStyle}>Total Clientes</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🆕</div>
          <div>
            <div style={statValueStyle}>{clientStats.nuevos}</div>
            <div style={statLabelStyle}>Nuevos Este Mes</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⭐</div>
          <div>
            <div style={statValueStyle}>—</div>
            <div style={statLabelStyle}>VIP</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🔄</div>
          <div>
            <div style={statValueStyle}>—</div>
            <div style={statLabelStyle}>Repetidores</div>
          </div>
        </div>
      </div>

      {/* Herramientas de búsqueda y filtros */}
      <div style={searchContainerStyle}>
        <div style={searchBoxStyle}>
          <span style={searchIconStyle}>🔍</span>
          <input
            type="text"
            placeholder="Buscar cliente por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <div style={filtersStyle}>
          <select style={filterSelectStyle}>
            <option value="">Todos los tipos</option>
            <option value="regular">Regulares</option>
            <option value="vip">VIP</option>
            <option value="empresa">Empresariales</option>
          </select>
          <select style={filterSelectStyle}>
            <option value="">Todas las fechas</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="year">Último año</option>
          </select>
        </div>
      </div>

      {/* Tabla de clientes */}
      <div style={tableContainerStyle}>
        <ClientTable searchTerm={searchTerm} />
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

const newClientButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #10b981, #047857)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
};

const buttonIconStyle = {
  fontSize: '16px'
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

const searchContainerStyle = {
  display: 'flex',
  gap: '16px',
  marginBottom: '24px',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const searchBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  padding: '0 16px',
  flex: 1,
  minWidth: '300px'
};

const searchIconStyle = {
  fontSize: '16px',
  marginRight: '12px',
  color: '#aaa'
};

const searchInputStyle = {
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: '14px',
  padding: '12px 0',
  flex: 1,
  outline: 'none'
};

const filtersStyle = {
  display: 'flex',
  gap: '12px'
};

const filterSelectStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: 'white',
  padding: '12px 16px',
  fontSize: '14px',
  cursor: 'pointer'
};

const tableContainerStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden'
};

export default AdminClientsSection;