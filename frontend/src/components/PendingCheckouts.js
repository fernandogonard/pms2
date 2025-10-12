// components/PendingCheckouts.js
// Componente para mostrar y gestionar reservas con checkout pendiente
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const PendingCheckouts = () => {
  const [pendingReservations, setPendingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingCheckout, setProcessingCheckout] = useState({});

  // Cargar reservas con checkout pendiente
  const fetchPendingCheckouts = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/reservations/pending-checkouts');
      const data = await response.json();
      
      if (data.success) {
        setPendingReservations(data.reservations || []);
      } else {
        setError(data.message || 'Error al cargar reservas pendientes');
      }
    } catch (err) {
      setError('Error de conexión al cargar reservas pendientes');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Procesar checkout de una reserva
  const handleCheckout = async (reservationId) => {
    try {
      setProcessingCheckout(prev => ({ ...prev, [reservationId]: true }));
      setError('');

      const response = await apiFetch(`/api/reservations/${reservationId}/checkout`, {
        method: 'PUT'
      });

      const data = await response.json();

      if (response.ok) {
        // Actualizar la lista removiendo la reserva procesada
        setPendingReservations(prev => 
          prev.filter(reservation => reservation._id !== reservationId)
        );
        
        // Mostrar mensaje de éxito temporal
        setError(`✅ Check-out procesado exitosamente para la reserva`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError(data.message || 'Error al procesar check-out');
      }
    } catch (err) {
      setError('Error de conexión al procesar check-out');
      console.error('Error:', err);
    } finally {
      setProcessingCheckout(prev => ({ ...prev, [reservationId]: false }));
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchPendingCheckouts();
  }, []);

  const containerStyle = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    color: '#fff'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#222',
    borderRadius: 8,
    overflow: 'hidden'
  };

  const thStyle = {
    background: '#333',
    color: '#fff',
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '1px solid #444'
  };

  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #333',
    color: '#e0e0e0'
  };

  const buttonStyle = {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.2s'
  };

  const refreshButtonStyle = {
    background: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 500,
    marginBottom: 16
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <h3>🔄 Cargando reservas con checkout pendiente...</h3>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3>📅 Reservas con Check-out Pendiente ({pendingReservations.length})</h3>
        <button 
          onClick={fetchPendingCheckouts} 
          style={refreshButtonStyle}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && (
        <div style={{ 
          background: error.includes('✅') ? '#22c55e' : '#dc3545', 
          color: '#fff', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: 16,
          fontWeight: 500 
        }}>
          {error}
        </div>
      )}

      {pendingReservations.length === 0 ? (
        <div style={{ 
          background: '#22c55e', 
          color: '#fff', 
          padding: 16, 
          borderRadius: 8, 
          textAlign: 'center',
          fontWeight: 500 
        }}>
          ✅ No hay reservas con checkout pendiente. ¡Todas las habitaciones están al día!
        </div>
      ) : (
        <>
          <div style={{ 
            background: '#f59e0b', 
            color: '#000', 
            padding: 12, 
            borderRadius: 6, 
            marginBottom: 16,
            fontWeight: 500 
          }}>
            ⚠️ Las siguientes reservas deberían haber hecho checkout pero siguen activas. 
            Puede procesar el checkout manualmente o extender la reserva si el huésped se queda más días.
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Habitación</th>
                <th style={thStyle}>Huésped</th>
                <th style={thStyle}>Check-in</th>
                <th style={thStyle}>Check-out Esperado</th>
                <th style={thStyle}>Días de Retraso</th>
                <th style={thStyle}>Contacto</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingReservations.map(reservation => (
                <tr key={reservation._id}>
                  <td style={tdStyle}>
                    <strong>#{reservation.room?.number || 'Sin asignar'}</strong>
                    <br />
                    <small style={{ color: '#999' }}>
                      {reservation.room?.type || reservation.tipo}
                    </small>
                  </td>
                  <td style={tdStyle}>
                    <strong>
                      {reservation.client ? 
                        `${reservation.client.nombre} ${reservation.client.apellido}` : 
                        reservation.name || 'Sin nombre'
                      }
                    </strong>
                    {reservation.client?.dni && (
                      <>
                        <br />
                        <small style={{ color: '#999' }}>DNI: {reservation.client.dni}</small>
                      </>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {new Date(reservation.checkIn).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    <strong style={{ color: '#dc3545' }}>
                      {reservation.expectedCheckout}
                    </strong>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ 
                      background: reservation.daysOverdue > 3 ? '#dc3545' : '#f59e0b',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      fontSize: 12
                    }}>
                      {reservation.daysOverdue} día{reservation.daysOverdue !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {reservation.client?.email && (
                      <div style={{ fontSize: 12 }}>
                        📧 {reservation.client.email}
                      </div>
                    )}
                    {reservation.client?.whatsapp && (
                      <div style={{ fontSize: 12 }}>
                        📱 {reservation.client.whatsapp}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleCheckout(reservation._id)}
                      disabled={processingCheckout[reservation._id]}
                      style={{
                        ...buttonStyle,
                        opacity: processingCheckout[reservation._id] ? 0.6 : 1,
                        cursor: processingCheckout[reservation._id] ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {processingCheckout[reservation._id] ? '⏳ Procesando...' : '🚪 Check-out'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#333', 
            borderRadius: 6,
            fontSize: 14,
            color: '#ccc'
          }}>
            💡 <strong>Consejos:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li>Si el huésped se queda más días, extienda la reserva en lugar de hacer checkout</li>
              <li>El checkout libera inmediatamente la habitación para nuevas reservas</li>
              <li>Los días de retraso se calculan desde la fecha original de checkout</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default PendingCheckouts;