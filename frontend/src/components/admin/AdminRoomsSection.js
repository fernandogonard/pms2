// components/admin/AdminRoomsSection.js
// Sección de gestión de habitaciones para administradores

import React, { useState, useEffect, useCallback } from 'react';
import RoomTable from '../RoomTable';
import { useWebSocket } from '../../hooks/useWebSocket';
import { apiFetch } from '../../utils/api';
import useSessionGuard from '../../hooks/useSessionGuard';
import { RoomCalendar } from '../RoomCalendar';
import CleaningManager from '../CleaningManager';
import MaintenanceManager from '../MaintenanceManager';

const INITIAL_ROOM_STATS = {
  disponibles: 0,
  ocupadas: 0,
  limpieza: 0,
  mantenimiento: 0,
  porIngresar: 0,
  loading: true,
  timestamp: null
};

const ROOM_WS_EVENTS = new Set([
  'room_state_changed',
  'room_cleaned',
  'room_maintenance_started',
  'room_maintenance_completed',
  'guest_relocated'
]);

const AdminRoomsSection = () => {
  const [activeTab, setActiveTab] = useState('table');
  const [roomStats, setRoomStats] = useState(INITIAL_ROOM_STATS);
  const [error, setError] = useState('');
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  const fetchRoomStats = useCallback(async () => {
    if (!canFetch) return;
    setRoomStats(prev => ({ ...prev, loading: true }));
    try {
      const res = await apiFetch('/api/stats/rooms', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data?.success || !data.stats) {
        throw new Error(data?.message || 'No se pudieron cargar las estadísticas de habitaciones.');
      }

      setRoomStats({
        disponibles: data.stats.disponibles || 0,
        ocupadas: data.stats.ocupadas || 0,
        limpieza: data.stats.limpieza || 0,
        mantenimiento: data.stats.mantenimiento || 0,
        porIngresar: data.stats.porIngresar || 0,
        loading: false,
        timestamp: data.timestamp || Date.now()
      });
      setError('');
    } catch (fetchError) {
      setRoomStats(prev => ({ ...prev, loading: false }));
      if (!sessionExpired) {
        setError(fetchError.message || 'No se pudieron cargar las estadísticas de habitaciones.');
      }
    }
  }, [canFetch, sessionExpired]);

  useEffect(() => {
    if (!canFetch) {
      if (!authLoading) {
        setRoomStats({ ...INITIAL_ROOM_STATS, loading: false });
        setError(sessionExpired ? 'Tu sesión expiró. Refresca para ver el estado de las habitaciones.' : 'Esperando una sesión válida...');
      }
      return;
    }

    setError('');
    fetchRoomStats();
  }, [canFetch, sessionExpired, authLoading, fetchRoomStats]);

  useEffect(() => {
    if (!canFetch) return undefined;
    const interval = setInterval(fetchRoomStats, 60000);
    return () => clearInterval(interval);
  }, [canFetch, fetchRoomStats]);

  useWebSocket({
    enabled: canFetch,
    onMessage: (payload) => {
      if (!payload?.type || !ROOM_WS_EVENTS.has(payload.type)) {
        return false;
      }
      fetchRoomStats();
      return true;
    }
  });

  const tabs = [
    { id: 'table', label: 'Lista de Habitaciones', icon: '📋' },
    { id: 'calendar', label: 'Calendario', icon: '📅' },
    { id: 'cleaning', label: 'Gestión de Limpieza', icon: '🧹' },
    { id: 'maintenance', label: 'Mantenimiento y Relocalización', icon: '🔧' }
  ];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>🛏️ Gestión de Habitaciones</h2>
          <p style={subtitleStyle}>
            Control completo del inventario de habitaciones
            {roomStats.timestamp && (
              <span style={updateTimeStyle}>
                • Actualizado: {new Date(roomStats.timestamp).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

      {/* Estadísticas rápidas */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🟢</div>
          <div>
            <div style={statValueStyle}>
              {roomStats.loading ? "..." : roomStats.disponibles}
            </div>
            <div style={statLabelStyle}>Disponibles</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🔴</div>
          <div>
            <div style={statValueStyle}>
              {roomStats.loading ? "..." : roomStats.ocupadas}
            </div>
            <div style={statLabelStyle}>Ocupadas</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⚫</div>
          <div>
            <div style={statValueStyle}>
              {roomStats.loading ? "..." : roomStats.porIngresar}
            </div>
            <div style={statLabelStyle}>Por Ingresar</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🧹</div>
          <div>
            <div style={statValueStyle}>
              {roomStats.loading ? "..." : roomStats.limpieza}
            </div>
            <div style={statLabelStyle}>En Limpieza</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🔧</div>
          <div>
            <div style={statValueStyle}>
              {roomStats.loading ? "..." : roomStats.mantenimiento}
            </div>
            <div style={statLabelStyle}>Mantenimiento</div>
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
        {activeTab === 'table' && (
          <div style={tabContentStyle}>
            <RoomTable />
          </div>
        )}
        
        {activeTab === 'calendar' && (
          <div style={tabContentStyle}>
            <RoomCalendar />
          </div>
        )}
        
        {activeTab === 'cleaning' && (
          <div style={tabContentStyle}>
            <CleaningManager />
          </div>
        )}
        
        {activeTab === 'maintenance' && (
          <div style={tabContentStyle}>
            <MaintenanceManager />
          </div>
        )}
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
  overflow: 'hidden'
};

const updateTimeStyle = {
  fontSize: '12px',
  color: '#8a8a8a',
  marginLeft: '10px',
  fontStyle: 'italic'
};

const errorBannerStyle = {
  background: '#dc2626',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '10px',
  marginBottom: '16px',
  fontWeight: 600
};

export default AdminRoomsSection;