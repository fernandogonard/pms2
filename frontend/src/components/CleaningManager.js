// components/CleaningManager.js
// Gestión de habitaciones en limpieza

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const CleaningManager = () => {
  const [roomsInCleaning, setRoomsInCleaning] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRooms, setSelectedRooms] = useState([]);

  // Cargar habitaciones en limpieza
  const loadRoomsInCleaning = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/rooms/cleaning');
      const data = await res.json();
      
      if (res.ok) {
        setRoomsInCleaning(data.rooms || []);
      } else {
        setError(data.message || 'Error al cargar habitaciones en limpieza');
      }
    } catch (err) {
      setError('Error de conexión al cargar habitaciones');
      console.error('Error loading cleaning rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  // Marcar habitación individual como limpia
  const markRoomAsClean = async (roomId, roomNumber) => {
    try {
      setError('');
      const res = await apiFetch(`/api/rooms/${roomId}/mark-clean`, {
        method: 'PUT'
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(`Habitación #${roomNumber} marcada como disponible`);
        loadRoomsInCleaning(); // Recargar lista
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Error al marcar habitación como limpia');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error marking room as clean:', err);
    }
  };

  // Marcar múltiples habitaciones como limpias
  const markSelectedRoomsAsClean = async () => {
    if (selectedRooms.length === 0) {
      setError('Selecciona al menos una habitación');
      return;
    }

    try {
      setError('');
      const res = await apiFetch('/api/rooms/mark-clean-bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomIds: selectedRooms })
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(`${data.count} habitaciones marcadas como disponibles`);
        setSelectedRooms([]);
        loadRoomsInCleaning(); // Recargar lista
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Error al marcar habitaciones como limpias');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error marking rooms as clean:', err);
    }
  };

  // Toggle selección de habitación
  const toggleRoomSelection = (roomId) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  // Seleccionar/deseleccionar todas
  const toggleSelectAll = () => {
    if (selectedRooms.length === roomsInCleaning.length) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(roomsInCleaning.map(room => room._id));
    }
  };

  useEffect(() => {
    loadRoomsInCleaning();
  }, []);

  return (
    <div className="cleaning-manager">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>🧹 Gestión de Limpieza</h4>
        <button 
          className="btn btn-outline-primary btn-sm"
          onClick={loadRoomsInCleaning}
          disabled={loading}
        >
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setError('')}
          ></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible" role="alert">
          {success}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setSuccess('')}
          ></button>
        </div>
      )}

      {roomsInCleaning.length === 0 ? (
        <div className="text-center py-4">
          <div className="text-muted">
            ✨ <strong>¡Excelente!</strong> No hay habitaciones pendientes de limpieza
          </div>
        </div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-muted">
              {roomsInCleaning.length} habitación{roomsInCleaning.length !== 1 ? 'es' : ''} en limpieza
            </span>
            
            {roomsInCleaning.length > 1 && (
              <div>
                <button 
                  className="btn btn-outline-secondary btn-sm me-2"
                  onClick={toggleSelectAll}
                >
                  {selectedRooms.length === roomsInCleaning.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
                
                {selectedRooms.length > 0 && (
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={markSelectedRoomsAsClean}
                  >
                    ✅ Marcar {selectedRooms.length} como limpias
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="row">
            {roomsInCleaning.map(room => (
              <div key={room._id} className="col-md-6 col-lg-4 mb-3">
                <div className={`card ${selectedRooms.includes(room._id) ? 'border-primary' : ''}`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="card-title">
                          Habitación #{room.number}
                        </h6>
                        <p className="card-text text-muted mb-2">
                          <small>
                            Tipo: {room.type} | Piso: {room.floor}
                          </small>
                        </p>
                        <span className="badge bg-warning text-dark">
                          🧹 En limpieza
                        </span>
                      </div>
                      
                      {roomsInCleaning.length > 1 && (
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedRooms.includes(room._id)}
                            onChange={() => toggleRoomSelection(room._id)}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3">
                      <button
                        className="btn btn-success btn-sm w-100"
                        onClick={() => markRoomAsClean(room._id, room.number)}
                      >
                        ✅ Marcar como limpia
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CleaningManager;