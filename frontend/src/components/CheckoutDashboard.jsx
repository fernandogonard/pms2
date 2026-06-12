// src/components/CheckoutDashboard.jsx
// Dashboard de checkouts del día con asignación de limpieza

import React, { useState, useEffect } from 'react';
import { HOUSEKEEPING_CONFIG } from '../constants/businessConstants';
import '../styles/CheckoutDashboard.css';

const CheckoutDashboard = () => {
  const [checkouts, setCheckouts] = useState([]);
  const [loadingCheckouts, setLoadingCheckouts] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    assignedTo: '',
    housekeepingType: 'limpieza_checkout'
  });
  const [staffList, setStaffList] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cargar checkouts del día
  useEffect(() => {
    loadCheckouts();
    // Recargar cada 15 segundos para mostrar cambios en tiempo real
    const interval = setInterval(loadCheckouts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Cargar lista de limpiadores
  useEffect(() => {
    loadStaffList();
  }, []);

  const loadCheckouts = async () => {
    try {
      setLoadingCheckouts(true);
      const response = await fetch('/api/cleaning/checkouts/today', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCheckouts(data.data || []);
        setError(null);
      } else {
        setError('Error cargando checkouts');
      }
    } catch (err) {
      setError('Error conectando con el servidor');
      console.error(err);
    } finally {
      setLoadingCheckouts(false);
    }
  };

  const loadStaffList = async () => {
    try {
      // Por ahora, lista hardcodeada. En producción, traer del servidor
      setStaffList([
        { id: '1', name: 'María' },
        { id: '2', name: 'Juan' },
        { id: '3', name: 'Rosa' },
        { id: '4', name: 'Carlos' }
      ]);
    } catch (err) {
      console.error('Error cargando limpiadores:', err);
    }
  };

  const openAssignmentModal = (room) => {
    setSelectedRoom(room);
    setAssignmentForm({
      assignedTo: '',
      housekeepingType: 'limpieza_checkout'
    });
    setShowAssignmentModal(true);
  };

  const handleAssignCleaning = async () => {
    if (!assignmentForm.assignedTo) {
      setError('Debe seleccionar un limpiador');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/cleaning/${selectedRoom._id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          assignedTo: assignmentForm.assignedTo,
          housekeepingType: assignmentForm.housekeepingType
        })
      });

      if (response.ok) {
        setSuccess('✅ Limpieza asignada correctamente');
        setShowAssignmentModal(false);
        await loadCheckouts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const error = await response.json();
        setError(error.message || 'Error asignando limpieza');
      }
    } catch (err) {
      setError('Error en la solicitud');
      console.error(err);
    }
  };

  const handleStartCleaning = async (roomId) => {
    try {
      const response = await fetch(`/api/cleaning/${roomId}/start`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSuccess('🧹 Limpieza iniciada');
        await loadCheckouts();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Error iniciando limpieza');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteCleaning = async (roomId) => {
    try {
      const response = await fetch(`/api/cleaning/${roomId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: '' })
      });

      if (response.ok) {
        setSuccess('✨ Limpieza completada - Habitación disponible');
        await loadCheckouts();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Error completando limpieza');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (assignment) => {
    if (!assignment || !assignment.status) return '❌ Sin asignar';

    const statusMap = {
      'no_asignada': '❌ Sin asignar',
      'asignada': '📌 Asignada',
      'en_progreso': '🧹 En progreso',
      'completada': '✨ Completada',
      'cancelada': '❌ Cancelada'
    };

    return statusMap[assignment.status] || assignment.status;
  };

  const getCleaningTypeConfig = (type) => {
    return HOUSEKEEPING_CONFIG[type] || HOUSEKEEPING_CONFIG.limpieza_checkout;
  };

  if (loadingCheckouts) {
    return <div className="checkout-dashboard loading">⏳ Cargando checkouts...</div>;
  }

  return (
    <div className="checkout-dashboard">
      <div className="dashboard-header">
        <h1>📅 Checkouts de Hoy</h1>
        <div className="header-stats">
          <span className="stat">
            <strong>Total:</strong> {checkouts.length} habitaciones
          </span>
          <span className="stat">
            <strong>Sin asignar:</strong> {
              checkouts.filter(r => !r.housekeepingAssignment?.status || r.housekeepingAssignment.status === 'no_asignada').length
            }
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
          <button className="close-btn" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {checkouts.length === 0 ? (
        <div className="empty-state">
          ✅ No hay checkouts registrados para hoy
        </div>
      ) : (
        <div className="checkout-grid">
          {checkouts.map((room) => {
            const assignment = room.housekeepingAssignment;
            const config = assignment?.estimatedDurationMinutes ? 
              getCleaningTypeConfig(room.pendingHousekeeping) : null;

            return (
              <div key={room._id} className="checkout-card">
                <div className="card-header">
                  <div className="room-number">Hab. #{room.number}</div>
                  <div className="payment-status">
                    {room.checkoutInfo?.isPaid ? (
                      <span className="paid">✅ Pagada</span>
                    ) : (
                      <span className="unpaid">⚠️ PENDIENTE: ${room.checkoutInfo?.totalAmount - (room.checkoutInfo?.amountPaid || 0) || 0}</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="guest-info">
                    <p><strong>Huésped:</strong> {room.checkoutInfo?.guestName || 'N/A'}</p>
                    <p><strong>Noches:</strong> {room.checkoutInfo?.nightsStayed || 0}</p>
                    <p><strong>Total:</strong> ${room.checkoutInfo?.totalAmount || 0}</p>
                  </div>

                  <div className="assignment-status">
                    <p>
                      <strong>Estado:</strong> {getStatusBadge(assignment)}
                    </p>
                    {assignment?.assignedTo && (
                      <p><strong>Asignado a:</strong> {assignment.assignedTo}</p>
                    )}
                    {assignment?.estimatedDurationMinutes && (
                      <div
                        className="cleaning-type"
                        style={{
                          backgroundColor: config?.bgColor,
                          borderColor: config?.borderColor,
                          color: config?.color
                        }}
                      >
                        {config?.label} ({config?.duration} min)
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  {!assignment?.status || assignment.status === 'no_asignada' ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => openAssignmentModal(room)}
                    >
                      📌 Asignar limpieza
                    </button>
                  ) : assignment.status === 'asignada' ? (
                    <button
                      className="btn btn-warning"
                      onClick={() => handleStartCleaning(room._id)}
                    >
                      🧹 Iniciar limpieza
                    </button>
                  ) : assignment.status === 'en_progreso' ? (
                    <button
                      className="btn btn-success"
                      onClick={() => handleCompleteCleaning(room._id)}
                    >
                      ✨ Completar limpieza
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de asignación */}
      {showAssignmentModal && selectedRoom && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Asignar limpieza - Hab. #{selectedRoom.number}</h2>
              <button className="close-btn" onClick={() => setShowAssignmentModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Limpiador:</label>
                <select
                  value={assignmentForm.assignedTo}
                  onChange={(e) => setAssignmentForm({
                    ...assignmentForm,
                    assignedTo: e.target.value
                  })}
                >
                  <option value="">Seleccionar limpiador...</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tipo de limpieza:</label>
                <select
                  value={assignmentForm.housekeepingType}
                  onChange={(e) => setAssignmentForm({
                    ...assignmentForm,
                    housekeepingType: e.target.value
                  })}
                >
                  <option value="limpieza_checkout">🏃 Checkout limpieza (40 min)</option>
                  <option value="limpieza_profunda">🧼 Limpieza profunda (25 min)</option>
                  <option value="repaso">🧹 Repaso rápido (20 min)</option>
                </select>
              </div>

              {selectedRoom.checkoutInfo && (
                <div className="checkout-preview">
                  <strong>Información del checkout:</strong>
                  <p>Huésped: {selectedRoom.checkoutInfo.guestName}</p>
                  <p>Noches: {selectedRoom.checkoutInfo.nightsStayed}</p>
                  <p>
                    Pago: ${selectedRoom.checkoutInfo.amountPaid} / ${selectedRoom.checkoutInfo.totalAmount}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAssignmentModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAssignCleaning}
              >
                ✅ Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutDashboard;
