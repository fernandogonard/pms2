// components/admin/AdminBillingSection.js
// Sección de gestión de facturación para administradores

import React, { useEffect, useState } from 'react';
import useBackendReady from '../../hooks/useBackendReady';
import PricingManager from '../PricingManager';
import FinancialDashboard from '../FinancialDashboard';
import { apiFetch } from '../../utils/api';
import useSessionGuard from '../../hooks/useSessionGuard';

const DEFAULT_BILLING_STATS = { revenue: 0, growth: null, invoices: 0, pending: 0 };

const AdminBillingSection = () => {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [quickStats, setQuickStats] = useState(DEFAULT_BILLING_STATS);
  const [error, setError] = useState('');
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();
  const { backendReady, backendLoading, backendError } = useBackendReady();

  useEffect(() => {
    let cancelled = false;
    const loadQuickStats = async () => {
      try {
        const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        const [summaryRes, invoicesRes] = await Promise.all([
          apiFetch(`/api/billing/summary?startDate=${startDate}&endDate=${endDate}`),
          apiFetch('/api/billing/invoices/pending')
        ]);
        const summaryData = await summaryRes.json();
        const invoicesData = await invoicesRes.json();
        const revenue = summaryRes.ok && summaryData?.data?.summary?.totalRevenue ? summaryData.data.summary.totalRevenue : 0;
        const invoices = Array.isArray(invoicesData?.data) ? invoicesData.data.length : 0;
        const pending = Array.isArray(invoicesData?.data) ? invoicesData.data.filter(inv => inv.pending > 0).length : 0;
        if (cancelled) return;
        setQuickStats({ revenue, growth: null, invoices, pending });
        setError('');
      } catch (err) {
        if (cancelled) return;
        setQuickStats(DEFAULT_BILLING_STATS);
        if (!sessionExpired) {
          setError('No se pudieron cargar los datos de facturación.');
        }
      }
    };
    if (!canFetch || !backendReady) {
      if (!authLoading && !backendLoading) {
        setQuickStats(DEFAULT_BILLING_STATS);
        setError(sessionExpired ? 'Tu sesión expiró. Inicia sesión nuevamente para ver la facturación.' : 'Esperando una sesión válida o backend...');
      }
      return;
    }
    setError('');
    loadQuickStats();
    return () => {
      cancelled = true;
    };
  }, [canFetch, sessionExpired, authLoading, backendReady, backendLoading]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Financiero', icon: '📊' },
    { id: 'pricing', label: 'Gestión de Precios', icon: '💰' },
    { id: 'invoices', label: 'Facturas', icon: '🧾' },
    { id: 'payments', label: 'Pagos', icon: '💳' }
  ];
  // Cerrar correctamente el array tabs
  // (Se añadió el punto y coma al final del array)
  
  if (backendLoading) {
    return <div style={{textAlign:'center',marginTop:40}}><b>Conectando con backend...</b></div>;
  }
  if (backendError) {
    return <div style={{textAlign:'center',marginTop:40,color:'#ef4444'}}><b>{backendError}</b></div>;
  }
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>💰 Sistema de Facturación</h2>
          <p style={subtitleStyle}>Gestión completa de precios, pagos y facturación</p>
        </div>
      </div>
    );
  };

      <div style={statsRowStyle}>

      {/* Estadísticas financieras rápidas */}
      {/* (Eliminado div extra que causaba error de sintaxis) */}
        <div style={statCardStyle}>
          <div style={statIconStyle}>💵</div>
          <div>
            <div style={statValueStyle}>${quickStats.revenue?.toLocaleString() || 0}</div>
            <div style={statLabelStyle}>Ingresos del Mes</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>📈</div>
          <div>
            <div style={statValueStyle}>{quickStats.growth !== null ? `${quickStats.growth}%` : '--'}</div>
            <div style={statLabelStyle}>Crecimiento</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🧾</div>
          <div>
            <div style={statValueStyle}>{quickStats.invoices}</div>
            <div style={statLabelStyle}>Facturas Emitidas</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⚠️</div>
          <div>
            <div style={statValueStyle}>{quickStats.pending}</div>
            <div style={statLabelStyle}>Pendientes de Pago</div>
          </div>
        </div>
      </div>

      {/* Navegación por tabs */}
      <div style={tabsContainerStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab.id ? activeTabStyle : {})
            }}
          >
            <span style={tabIconStyle}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido según tab activo */}
      <div style={contentContainerStyle}>
        {activeTab === 'dashboard' && (
          <div style={tabContentStyle}>
            <FinancialDashboard />
          </div>
        )}
        
        {activeTab === 'pricing' && (
          <div style={tabContentStyle}>
            <PricingManager />
          </div>
        )}
        
        {activeTab === 'invoices' && (
          <div style={tabContentStyle}>
            <div style={comingSoonStyle}>
              <span style={comingSoonIconStyle}>🧾</span>
              <h3 style={comingSoonTitleStyle}>Gestión de Facturas</h3>
              <p style={comingSoonTextStyle}>
                Sistema completo de facturación con generación PDF, 
                seguimiento de pagos y recordatorios automáticos.
              </p>
              <div style={comingSoonBadgeStyle}>Próximamente</div>
            </div>
          </div>
        )}
        
        {activeTab === 'payments' && (
          <div style={tabContentStyle}>
            <div style={comingSoonStyle}>
              <span style={comingSoonIconStyle}>💳</span>
              <h3 style={comingSoonTitleStyle}>Procesamiento de Pagos</h3>
              <p style={comingSoonTextStyle}>
                Integración con pasarelas de pago, procesamiento automático 
                y conciliación bancaria.
              </p>
              <div style={comingSoonBadgeStyle}>Próximamente</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
const containerStyle = {
  padding: '24px',
  maxWidth: '1400px'
};

const headerStyle = {
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

const tabsContainerStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  paddingBottom: '16px'
};

const tabButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const activeTabStyle = {
  background: 'rgba(0, 153, 255, 0.2)',
  color: '#00ccff',
  boxShadow: '0 2px 8px rgba(0, 153, 255, 0.3)'
};

const tabIconStyle = {
  fontSize: '16px'
};

const contentContainerStyle = {
  minHeight: '500px'
};

const tabContentStyle = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
  minHeight: '500px'
};

const comingSoonStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 40px',
  textAlign: 'center'
};

const comingSoonIconStyle = {
  fontSize: '64px',
  marginBottom: '24px',
  opacity: 0.6
};

const comingSoonTitleStyle = {
  fontSize: '24px',
  fontWeight: '600',
  color: 'white',
  marginBottom: '16px'
};

const comingSoonTextStyle = {
  fontSize: '16px',
  color: '#aaa',
  lineHeight: 1.6,
  maxWidth: '500px',
  marginBottom: '24px'
};

const comingSoonBadgeStyle = {
  padding: '8px 16px',
  background: 'rgba(0, 153, 255, 0.2)',
  color: '#00ccff',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const errorBannerStyle = {
  background: '#dc2626',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '10px',
  marginBottom: '16px',
  fontWeight: 600
};

export default AdminBillingSection;