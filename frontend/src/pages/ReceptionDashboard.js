// pages/ReceptionDashboard.js
// Dashboard principal para el recepcionista
import React from 'react';
import ReceptionLayout from '../layouts/ReceptionLayout';
import ReceptionReservations from '../components/ReceptionReservations';
import RoomStatusBoard from '../components/RoomStatusBoard';
import RoomCalendar from '../components/RoomCalendar';
import CleaningManager from '../components/CleaningManager';
import PendingCheckouts from '../components/PendingCheckouts';

const ReceptionDashboard = () => {
  return (
    <ReceptionLayout>
      <div style={{
        background: '#18191A',
        color: '#fff',
        minHeight: '100vh',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: '32px 0',
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Recepcionista</h1>
        
        {/* Sección prioritaria: Checkouts pendientes */}
        <div style={{ marginBottom: 32 }}>
          <PendingCheckouts />
        </div>

        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: 32 }}>
          <div style={{ background: '#222', borderRadius: 16, boxShadow: '0 2px 12px #0002', padding: 24, flex: 1 }}>
            <ReceptionReservations />
          </div>
          <div style={{ background: '#222', borderRadius: 16, boxShadow: '0 2px 12px #0002', padding: 24, flex: 1 }}>
            <RoomStatusBoard />
          </div>
          <div style={{ background: '#222', borderRadius: 16, boxShadow: '0 2px 12px #0002', padding: 24, flex: 1 }}>
            <CleaningManager />
          </div>
        </div>
        <div style={{ background: '#222', borderRadius: 16, boxShadow: '0 2px 12px #0002', padding: 24, marginBottom: 32 }}>
          <RoomCalendar />
        </div>
      </div>
    </ReceptionLayout>
  );
};

export default ReceptionDashboard;
