// components/admin/AdminReportsSection.js
// Sección de reportes y analytics para administradores

import React from 'react';
import { apiFetch } from '../../utils/api';
import ReportDownload from '../ReportDownload';

const AdminReportsSection = () => {
  const [selectedPeriod, setSelectedPeriod] = React.useState('month');
  const [kpis, setKpis] = React.useState(null);

  React.useEffect(() => {
    const rangeMap = { week: '7d', month: '30d', quarter: '90d', year: '90d', custom: '30d' };
    const range = rangeMap[selectedPeriod] || '30d';
    apiFetch(`/api/analytics/kpis?range=${range}`)
      .then(r => r.json())
      .then(data => { if (data && typeof data.avgOccupancy !== 'undefined') setKpis(data); })
      .catch(() => {});
  }, [selectedPeriod]);

  const fmt = (val, decimals = 1) =>
    val !== null && val !== undefined ? Number(val).toFixed(decimals) : '—';
  const fmtPct = (val) => val >= 0 ? `+${fmt(val)}%` : `${fmt(val)}%`;

  const reportTypes = [
    {
      id: 'occupancy',
      title: 'Reporte de Ocupación',
      description: 'Estadísticas detalladas de ocupación por período',
      icon: '📊',
      color: '#0099ff'
    },
    {
      id: 'financial',
      title: 'Reporte Financiero',
      description: 'Ingresos, gastos y análisis de rentabilidad',
      icon: '💰',
      color: '#10b981'
    },
    {
      id: 'guests',
      title: 'Reporte de Huéspedes',
      description: 'Análisis de clientes y patrones de reserva',
      icon: '👥',
      color: '#8b5cf6'
    },
    {
      id: 'rooms',
      title: 'Reporte de Habitaciones',
      description: 'Estado y rendimiento por habitación',
      icon: '🛏️',
      color: '#f59e0b'
    }
  ];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>📊 Reportes y Analytics</h2>
          <p style={subtitleStyle}>Análisis detallado del rendimiento hotelero</p>
        </div>
        
        <div style={periodSelectorStyle}>
          <label style={periodLabelStyle}>Período:</label>
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={periodSelectStyle}
          >
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="quarter">Este trimestre</option>
            <option value="year">Este año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      </div>

      {/* KPIs principales */}
      <div style={kpiRowStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiIconStyle}>📈</div>
          <div>
            <div style={kpiValueStyle}>{kpis ? `${fmt(kpis.avgOccupancy)}%` : '—'}</div>
            <div style={kpiLabelStyle}>Tasa de Ocupación</div>
            <div style={kpiChangeStyle}>{kpis ? fmtPct(kpis.occupancyChange) + ' vs período anterior' : '...'}</div>
          </div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiIconStyle}>💵</div>
          <div>
            <div style={kpiValueStyle}>{kpis ? `$${fmt(kpis.adr, 0)}` : '—'}</div>
            <div style={kpiLabelStyle}>ADR Promedio</div>
            <div style={kpiChangeStyle}>{kpis ? fmtPct(kpis.adrChange) + ' vs período anterior' : '...'}</div>
          </div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiIconStyle}>📊</div>
          <div>
            <div style={kpiValueStyle}>{kpis ? `$${fmt(kpis.revpar, 0)}` : '—'}</div>
            <div style={kpiLabelStyle}>RevPAR</div>
            <div style={kpiChangeStyle}>{kpis ? fmtPct(kpis.revparChange) + ' vs período anterior' : '...'}</div>
          </div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiIconStyle}>💰</div>
          <div>
            <div style={kpiValueStyle}>{kpis ? `$${Math.round(kpis.totalRevenue || 0).toLocaleString('es-AR')}` : '—'}</div>
            <div style={kpiLabelStyle}>Ingresos Totales</div>
            <div style={kpiChangeStyle}>{kpis ? fmtPct(kpis.revenueChange) + ' vs período anterior' : '...'}</div>
          </div>
        </div>
      </div>

      {/* Tipos de reportes */}
      <div style={reportsGridStyle}>
        {reportTypes.map((report) => (
          <div key={report.id} style={reportCardStyle}>
            <div 
              style={{
                ...reportIconStyle,
                background: `linear-gradient(135deg, ${report.color}20, ${report.color}10)`
              }}
            >
              <span style={{ fontSize: '32px' }}>{report.icon}</span>
            </div>
            <div style={reportContentStyle}>
              <h3 style={reportTitleStyle}>{report.title}</h3>
              <p style={reportDescStyle}>{report.description}</p>
              <div style={reportActionsStyle}>
                <button 
                  style={{
                    ...reportButtonStyle,
                    background: `linear-gradient(135deg, ${report.color}, ${report.color}dd)`
                  }}
                >
                  📄 Generar PDF
                </button>
                <button style={reportButtonSecondaryStyle}>
                  📊 Ver Online
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Componente de descarga de reportes existente */}
      <div style={legacyReportStyle}>
        <h3 style={sectionTitleStyle}>🔧 Herramientas de Reporte Legacy</h3>
        <div style={legacyContainerStyle}>
          <ReportDownload />
        </div>
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

const periodSelectorStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px'
};

const periodLabelStyle = {
  color: 'white',
  fontSize: '14px',
  fontWeight: '500'
};

const periodSelectStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: 'white',
  padding: '8px 12px',
  fontSize: '14px',
  cursor: 'pointer'
};

const kpiRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '20px',
  marginBottom: '32px'
};

const kpiCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  padding: '24px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px'
};

const kpiIconStyle = {
  fontSize: '40px',
  minWidth: '40px'
};

const kpiValueStyle = {
  fontSize: '28px',
  fontWeight: '700',
  color: 'white',
  marginBottom: '4px'
};

const kpiLabelStyle = {
  fontSize: '14px',
  color: '#aaa',
  marginBottom: '4px'
};

const kpiChangeStyle = {
  fontSize: '12px',
  color: '#10b981',
  fontWeight: '500'
};

const reportsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
  gap: '24px',
  marginBottom: '40px'
};

const reportCardStyle = {
  display: 'flex',
  gap: '20px',
  padding: '24px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
  transition: 'all 0.2s ease'
};

const reportIconStyle = {
  width: '80px',
  height: '80px',
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '80px'
};

const reportContentStyle = {
  flex: 1
};

const reportTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '8px'
};

const reportDescStyle = {
  fontSize: '14px',
  color: '#aaa',
  marginBottom: '16px',
  lineHeight: 1.5
};

const reportActionsStyle = {
  display: 'flex',
  gap: '12px'
};

const reportButtonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const reportButtonSecondaryStyle = {
  padding: '8px 16px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  background: 'transparent',
  color: 'rgba(255, 255, 255, 0.8)',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const legacyReportStyle = {
  marginTop: '40px'
};

const sectionTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '16px'
};

const legacyContainerStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  padding: '24px'
};

export default AdminReportsSection;