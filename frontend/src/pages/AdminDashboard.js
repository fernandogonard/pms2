import React, { useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import AdminSidebar from '../components/AdminSidebar';
import { useAuth } from '../contexts/AuthContext';

// Importar secciones modulares
import AdminDashboardSection from '../components/admin/AdminDashboardSection';
import AdminReservationsSection from '../components/admin/AdminReservationsSection';
import AdminRoomsSection from '../components/admin/AdminRoomsSection';
import AdminClientsSection from '../components/admin/AdminClientsSection';
import AdminBillingSection from '../components/admin/AdminBillingSection';
import AdminReportsSection from '../components/admin/AdminReportsSection';
import AdminUsersSection from '../components/admin/AdminUsersSection';
import AdvancedDashboard from '../components/AdvancedDashboard';
import PendingCheckouts from '../components/PendingCheckouts';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Función para limpiar reservas fantasma
  const handleCleanupGhostReservations = async () => {
    if (!window.confirm('¿Está seguro de que desea limpiar las reservas fantasma? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reservations/cleanup-ghost', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Limpieza completada. ${result.deleted} reservas fantasma eliminadas.`);
        window.location.reload();
      } else {
        throw new Error('Error al limpiar reservas fantasma');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al limpiar reservas fantasma');
    } finally {
      setLoading(false);
    }
  };

  // Renderizar sección activa basada en el estado (IDs en español para coincidir con sidebar)
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboardSection />;
      case 'analytics':
        return <AdvancedDashboard />;
      case 'pending-checkouts':
        return <PendingCheckouts />;
      case 'reservas':
        return <AdminReservationsSection />;
      case 'habitaciones':
        return <AdminRoomsSection />;
      case 'clientes':
        return <AdminClientsSection />;
      case 'facturacion':
        return <AdminBillingSection />;
      case 'reportes':
        return <AdminReportsSection />;
      case 'usuarios':
        return <AdminUsersSection />;
      default:
        return <AdminDashboardSection />;
    }
  };

  return (
    <AdminLayout>
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: '#0f0f0f',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        {/* Sidebar fijo a la izquierda */}
        <AdminSidebar 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
        />
        
        {/* Contenido principal */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          marginLeft: 0 // Sin margin para evitar superposición
        }}>
          {/* Header compacto con información del usuario */}
          {user && user.role === 'admin' && (
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              padding: '16px 24px',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0, // No se comprime
              gap: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ 
                  margin: 0, 
                  color: '#fff', 
                  fontSize: '24px', 
                  fontWeight: '700',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  Panel de Administración
                </h1>
                <p style={{ 
                  margin: '4px 0 0 0', 
                  color: '#bbb', 
                  fontSize: '14px' 
                }}>
                  Bienvenido, {user.email || user.username}
                </p>
              </div>
              
              <button 
                onClick={handleCleanupGhostReservations}
                disabled={loading}
                style={{
                  background: loading ? '#555' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 8px rgba(5, 150, 105, 0.3)',
                  transition: 'all 0.3s ease',
                  opacity: loading ? 0.7 : 1,
                  whiteSpace: 'nowrap'
                }}
              >
{loading ? 'Limpiando...' : 'Limpiar Reservas'}
              </button>
            </div>
          )}
          
          {/* Contenido principal con scroll */}
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#0f0f0f',
            position: 'relative'
          }}>
            {renderActiveSection()}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
