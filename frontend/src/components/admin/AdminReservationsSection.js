// components/admin/AdminReservationsSection.js
// Sección de gestión de reservas para administradores

import React from 'react';
import ReservationTable from '../ReservationTable';
import AdvancedReservationModal from '../AdvancedReservationModal';
import { apiFetch } from '../../utils/api';
import useSessionGuard from '../../hooks/useSessionGuard';

const DEFAULT_RES_STATS = { reservationsToday: 0, checkins: 0, checkouts: 0, pending: 0, loading: true };

const AdminReservationsSection = () => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [stats, setStats] = React.useState(DEFAULT_RES_STATS);
  const [error, setError] = React.useState('');
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  React.useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const res = await apiFetch('/api/reservations');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

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
        const pending = list.filter(r => r.status === 'reservada').length;

        if (cancelled) return;
        setStats({ reservationsToday, checkins, checkouts, pending, loading: false });
        setError('');
      } catch (error) {
        if (cancelled) return;
        setStats(prev => ({ ...prev, loading: false }));
        if (!sessionExpired) {
          setError('No se pudieron cargar las estadísticas de reservas.');
        }
      }
    };

    if (!canFetch) {
      if (!authLoading) {
        setStats(prev => ({ ...prev, ...DEFAULT_RES_STATS, loading: false }));
        setError(sessionExpired ? 'Tu sesión expiró. Refresca para volver a ver las reservas.' : 'Esperando una sesión válida...');
      }
      return;
    }

    setError('');
    loadStats();

    return () => {
      cancelled = true;
    };
  }, [canFetch, sessionExpired, authLoading]);

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

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

      {/* Estadísticas rápidas */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconStyle}>📊</div>
          <div>
            <div style={statValueStyle}>{stats.reservationsToday}</div>
            <div style={statLabelStyle}>Reservas Hoy</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>✅</div>
          <div>
            <div style={statValueStyle}>{stats.checkins}</div>
            <div style={statLabelStyle}>Check-ins</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>🚪</div>
          <div>
            <div style={statValueStyle}>{stats.checkouts}</div>
            <div style={statLabelStyle}>Check-outs</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle}>⏳</div>
          <div>
            <div style={statValueStyle}>{stats.pending}</div>
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

const errorBannerStyle = {
  background: '#dc2626',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '10px',
  marginBottom: '16px',
  fontWeight: 600
};

export default AdminReservationsSection;