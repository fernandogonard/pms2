// components/admin/AdminDashboardSection.js
// Sección principal del dashboard con estadísticas y resumen

import React, { useEffect, useState } from 'react';
import AdminStats from '../AdminStats';
import { apiFetch } from '../../utils/api';
import useSessionGuard from '../../hooks/useSessionGuard';

const DEFAULT_DASHBOARD_STATS = { reservationsToday: 0, checkins: 0, checkouts: 0 };

const AdminDashboardSection = () => {
  const [quickStats, setQuickStats] = useState(DEFAULT_DASHBOARD_STATS);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [res, roomsRes, pendingRes] = await Promise.all([
          apiFetch('/api/reservations'),
          apiFetch('/api/rooms'),
          apiFetch('/api/reservations/pending-checkouts')
        ]);

        const data = await res.json();
        const roomsData = await roomsRes.json();
        const pendingData = await pendingRes.json();

        const list = Array.isArray(data) ? data : [];
        const rooms = Array.isArray(roomsData) ? roomsData : [];
        const pendingList = Array.isArray(pendingData?.reservations) ? pendingData.reservations : [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        const toDate = (value) => value ? new Date(value) : null;

        const reservationsToday = list.filter(r => {
          const checkIn = toDate(r.checkIn);
          const checkOut = toDate(r.checkOut);
          if (!checkIn || !checkOut) return false;
          return checkIn <= today && checkOut > today;
        }).length;

        const checkins = list.filter(r => r.status === 'checkin' && sameDay(toDate(r.checkIn), today)).length;
        const checkouts = list.filter(r => r.status === 'checkout' && sameDay(toDate(r.checkOut), today)).length;

        if (cancelled) return;
        setQuickStats({ reservationsToday, checkins, checkouts });

        // Alertas dinámicas
        const maintenanceRooms = rooms.filter(r => r.status === 'mantenimiento');
        const cleaningRooms = rooms.filter(r => r.status === 'limpieza');
        const alertsList = [];

        if (maintenanceRooms.length > 0) {
          alertsList.push({
            icon: '⚠️',
            title: `${maintenanceRooms.length} habitación(es) en mantenimiento`,
            subtitle: maintenanceRooms.slice(0, 3).map(r => `#${r.number}`).join(', ')
          });
        }

        if (cleaningRooms.length > 0) {
          alertsList.push({
            icon: '🧹',
            title: `${cleaningRooms.length} habitación(es) en limpieza`,
            subtitle: cleaningRooms.slice(0, 3).map(r => `#${r.number}`).join(', ')
          });
        }

        if (pendingList.length > 0) {
          alertsList.push({
            icon: '🚪',
            title: `${pendingList.length} check-out(s) pendientes`,
            subtitle: pendingList[0]?.client ? `${pendingList[0].client.nombre || ''} ${pendingList[0].client.apellido || ''}`.trim() : 'Revisar listado'
          });
        }

        setAlerts(alertsList);
        setError('');
      } catch (error) {
        if (cancelled) return;
        setQuickStats(DEFAULT_DASHBOARD_STATS);
        setAlerts([]);
        if (!sessionExpired) {
          setError('No se pudo cargar el resumen del dashboard.');
        }
      }
    };

    if (!canFetch) {
      if (!authLoading) {
        setQuickStats(DEFAULT_DASHBOARD_STATS);
        setAlerts([]);
        setError(sessionExpired ? 'Tu sesión expiró. Refresca e inicia sesión de nuevo.' : 'Esperando una sesión válida...');
      }
      return;
    }

    setError('');
    load();

    return () => {
      cancelled = true;
    };
  }, [canFetch, sessionExpired, authLoading]);
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>📊 Dashboard Ejecutivo</h2>
        <p style={subtitleStyle}>Resumen general del sistema hotelero</p>
      </div>

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

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
                <div style={previewStatValueStyle}>{quickStats.reservationsToday}</div>
                <div style={previewStatLabelStyle}>Reservas Hoy</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🔄</span>
              <div>
                <div style={previewStatValueStyle}>{quickStats.checkins}</div>
                <div style={previewStatLabelStyle}>Check-ins</div>
              </div>
            </div>
            <div style={previewStatStyle}>
              <span style={previewStatIconStyle}>🚪</span>
              <div>
                <div style={previewStatValueStyle}>{quickStats.checkouts}</div>
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
          {alerts.length === 0 && (
            <div style={{ color: '#aaa', padding: 12 }}>Sin alertas activas</div>
          )}
          {alerts.map((alert, idx) => (
            <div key={idx} style={alertItemStyle}>
              <span style={alertIconStyle}>{alert.icon}</span>
              <div>
                <div style={alertTitleStyle}>{alert.title}</div>
                {alert.subtitle && <div style={alertTimeStyle}>{alert.subtitle}</div>}
              </div>
            </div>
          ))}
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

const errorBannerStyle = {
  background: '#dc2626',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '10px',
  marginBottom: '16px',
  fontWeight: 600
};

export default AdminDashboardSection;