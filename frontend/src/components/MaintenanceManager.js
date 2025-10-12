// components/MaintenanceManager.js
// Componente para gestionar el mantenimiento y la relocalización de huéspedes

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const MaintenanceManager = () => {
  const [rooms, setRooms] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [maintenanceRooms, setMaintenanceRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [targetRoom, setTargetRoom] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processLoading, setProcessLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [impactData, setImpactData] = useState(null);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocating, setRelocating] = useState(false);

  // Cargar habitaciones al inicio
  useEffect(() => {
    fetchRooms();
  }, []);

  // Cargar todas las habitaciones
  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await apiFetch('/api/rooms');
      const data = await res.json();

      if (!data || !data.data || !data.data.rooms) {
        throw new Error('Formato de respuesta inesperado');
      }

      const allRooms = data.data.rooms;
      setRooms(allRooms);
      
      // Filtrar habitaciones por estado
      setOccupiedRooms(allRooms.filter(room => room.status === 'ocupada'));
      setAvailableRooms(allRooms.filter(room => room.status === 'disponible'));
      
      // Cargar habitaciones en mantenimiento
      fetchMaintenanceRooms();
      
    } catch (err) {
      console.error('Error al cargar habitaciones:', err);
      setError('No se pudieron cargar las habitaciones: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar habitaciones en mantenimiento
  const fetchMaintenanceRooms = async () => {
    try {
      const res = await apiFetch('/api/rooms/maintenance');
      const data = await res.json();
      if (data && data.rooms) {
        setMaintenanceRooms(data.rooms);
      }
    } catch (err) {
      console.error('Error al cargar habitaciones en mantenimiento:', err);
    }
  };

  // Verificar impacto de mantenimiento en una habitación
  const checkMaintenanceImpact = async (roomId) => {
    try {
      setProcessLoading(true);
      setError('');
      setImpactData(null);

      const res = await apiFetch(`/api/rooms/${roomId}/maintenance/impact?days=${estimatedDays}`);
      const data = await res.json();
      
      if (data && data.impact) {
        setImpactData(data.impact);
      }
    } catch (err) {
      setError('Error al verificar impacto: ' + err.message);
    } finally {
      setProcessLoading(false);
    }
  };

  // Iniciar mantenimiento de una habitación
  const startMaintenance = async (forceIfOccupied = false) => {
    try {
      setProcessLoading(true);
      setError('');
      setSuccess('');

      if (!selectedRoom) {
        setError('Debes seleccionar una habitación');
        return;
      }

      if (!reason) {
        setError('Debes especificar un motivo para el mantenimiento');
        return;
      }

      const maintenanceData = {
        reason,
        estimatedDays: parseInt(estimatedDays),
        forceIfOccupied
      };

      const res = await apiFetch(`/api/rooms/${selectedRoom._id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al iniciar mantenimiento');
      }

      setSuccess(`Habitación #${selectedRoom.number} puesta en mantenimiento con éxito`);
      
      // Si hubo relocalización, mostrar detalles
      if (data.relocation || data.relocatedGuests) {
        setSuccess(success + `. Huésped relocalizado a habitación #${data.newRoomNumber || 'alternativa'}`);
      }
      
      // Recargar datos
      fetchRooms();
      setSelectedRoom(null);
      setReason('');
      setEstimatedDays(1);
      setImpactData(null);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessLoading(false);
    }
  };

  // Finalizar mantenimiento
  const completeMaintenance = async (roomId) => {
    try {
      setProcessLoading(true);
      setError('');
      setSuccess('');

      const res = await apiFetch(`/api/rooms/${roomId}/maintenance/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Mantenimiento completado desde panel de administración',
          requiresCleaning: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al completar mantenimiento');
      }

      const roomNumber = maintenanceRooms.find(r => r.id === roomId)?.number || 'desconocida';
      setSuccess(`Mantenimiento de habitación #${roomNumber} finalizado con éxito`);
      
      // Recargar datos
      fetchRooms();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessLoading(false);
    }
  };

  // Mostrar modal para relocalizar huéspedes
  const openRelocateModal = (room) => {
    setSelectedRoom(room);
    setShowRelocateModal(true);
  };

  // Relocalizar huéspedes directamente (sin mantenimiento)
  const relocateGuests = async () => {
    try {
      setRelocating(true);
      setError('');
      setSuccess('');

      if (!selectedRoom) {
        setError('Debes seleccionar una habitación origen');
        return;
      }

      if (!targetRoom) {
        setError('Debes seleccionar una habitación destino');
        return;
      }

      // Usar la API de mantenimiento para forzar la relocalización
      const maintenanceData = {
        reason: `Relocalización manual de huésped de habitación #${selectedRoom.number} a habitación #${targetRoom}`,
        estimatedDays: 1,
        forceIfOccupied: true,
        isTemporaryMaintenance: true // Flag especial para indicar que es solo para relocalizar
      };

      const res = await apiFetch(`/api/rooms/${selectedRoom._id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al relocalizar huésped');
      }

      setSuccess(`Huésped relocalizado con éxito de habitación #${selectedRoom.number} a #${targetRoom}`);
      
      // Cerrar modal y recargar datos
      setShowRelocateModal(false);
      setSelectedRoom(null);
      setTargetRoom('');
      fetchRooms();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setRelocating(false);
    }
  };

  // Estilos comunes
  const styles = {
    container: {
      padding: '24px',
      background: '#191919',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    },
    title: {
      color: '#ffffff',
      fontSize: '24px',
      fontWeight: '600',
      marginBottom: '16px',
      borderBottom: '1px solid #333',
      paddingBottom: '12px'
    },
    section: {
      marginBottom: '24px',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#f0f0f0',
      marginBottom: '12px'
    },
    flexContainer: {
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap'
    },
    card: {
      background: '#222',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #333',
      flex: '1',
      minWidth: '280px'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    },
    roomButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: '12px',
      marginBottom: '8px',
      background: '#333',
      border: 'none',
      borderRadius: '6px',
      color: '#fff',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    selectedRoom: {
      background: '#1d4ed8',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)'
    },
    badge: (status) => {
      const colors = {
        disponible: { bg: '#166534', text: '#dcfce7' },
        ocupada: { bg: '#991b1b', text: '#fee2e2' },
        mantenimiento: { bg: '#854d0e', text: '#fef3c7' },
        limpieza: { bg: '#0369a1', text: '#e0f2fe' }
      };
      const style = colors[status] || { bg: '#525252', text: '#f5f5f5' };
      
      return {
        background: style.bg,
        color: style.text,
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        textTransform: 'uppercase'
      };
    },
    form: {
      padding: '16px',
      background: '#222',
      borderRadius: '8px',
      border: '1px solid #333',
      marginTop: '16px'
    },
    inputGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      color: '#d1d5db',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      background: '#333',
      color: '#fff',
      border: '1px solid #444',
      borderRadius: '6px',
      fontSize: '14px'
    },
    button: (type) => {
      const types = {
        primary: { bg: '#2563eb', hover: '#1d4ed8' },
        success: { bg: '#059669', hover: '#047857' },
        danger: { bg: '#dc2626', hover: '#b91c1c' },
        warning: { bg: '#d97706', hover: '#b45309' },
        secondary: { bg: '#4b5563', hover: '#374151' }
      };
      const style = types[type] || types.secondary;
      
      return {
        background: style.bg,
        color: '#fff',
        border: 'none',
        padding: '10px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      };
    },
    modal: {
      overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      },
      content: {
        background: '#191919',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid #333'
      },
      header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid #333',
        paddingBottom: '12px'
      },
      title: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#f0f0f0',
        margin: 0
      }
    },
    alert: (type) => {
      const types = {
        error: { bg: 'rgba(220, 38, 38, 0.1)', border: '#dc2626', text: '#fca5a5' },
        success: { bg: 'rgba(5, 150, 105, 0.1)', border: '#059669', text: '#6ee7b7' },
        warning: { bg: 'rgba(217, 119, 6, 0.1)', border: '#d97706', text: '#fcd34d' },
        info: { bg: 'rgba(37, 99, 235, 0.1)', border: '#2563eb', text: '#93c5fd' }
      };
      const style = types[type] || types.info;
      
      return {
        padding: '12px 16px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '6px',
        color: style.text,
        fontSize: '14px',
        marginBottom: '16px'
      };
    }
  };

  // Renderizado de modal para relocalizar huéspedes
  const renderRelocateModal = () => {
    if (!showRelocateModal) return null;

    return (
      <div style={styles.modal.overlay}>
        <div style={styles.modal.content}>
          <div style={styles.modal.header}>
            <h3 style={styles.modal.title}>Relocalizar Huésped</h3>
            <button 
              onClick={() => setShowRelocateModal(false)}
              style={{...styles.button('secondary'), padding: '6px 10px'}}
            >
              ✕
            </button>
          </div>
          
          {error && <div style={styles.alert('error')}>{error}</div>}
          {success && <div style={styles.alert('success')}>{success}</div>}
          
          <div style={styles.inputGroup}>
            <div style={styles.label}>Origen: Habitación #{selectedRoom?.number}</div>
            <div style={{...styles.badge('ocupada'), display: 'inline-block'}}>Ocupada</div>
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Destino: Selecciona habitación disponible</label>
            <select 
              style={styles.input}
              value={targetRoom}
              onChange={(e) => setTargetRoom(e.target.value)}
              required
            >
              <option value="">Seleccionar habitación destino...</option>
              {availableRooms.map(room => (
                <option key={room._id} value={room.number}>
                  #{room.number} - {room.type} - Piso {room.floor}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button 
              onClick={() => setShowRelocateModal(false)}
              style={styles.button('secondary')}
              disabled={relocating}
            >
              Cancelar
            </button>
            <button 
              onClick={relocateGuests}
              style={styles.button('primary')}
              disabled={relocating || !targetRoom}
            >
              {relocating ? 'Relocalizando...' : 'Relocalizar Huésped'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🔧 Mantenimiento y Relocalización de Huéspedes</h2>
      
      {error && <div style={styles.alert('error')}>{error}</div>}
      {success && <div style={styles.alert('success')}>{success}</div>}
      
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Relocalización de Huéspedes</h3>
        <p style={{color: '#d1d5db', marginBottom: '16px'}}>
          Permite mover huéspedes de una habitación ocupada a otra disponible sin afectar su reserva.
        </p>
        
        <div style={styles.flexContainer}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h4 style={{color: '#e5e7eb', margin: 0}}>Habitaciones Ocupadas</h4>
              <div style={{...styles.badge('ocupada'), display: 'inline-block'}}>{occupiedRooms.length}</div>
            </div>
            
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {loading ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>Cargando habitaciones...</p>
              ) : occupiedRooms.length === 0 ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>No hay habitaciones ocupadas</p>
              ) : (
                occupiedRooms.map(room => (
                  <div key={room._id} style={{marginBottom: '12px'}}>
                    <button
                      onClick={() => openRelocateModal(room)}
                      style={{
                        ...styles.roomButton,
                        background: '#991b1b'
                      }}
                    >
                      <span>
                        <strong style={{fontSize: '16px'}}>#{room.number}</strong>
                        <div style={{fontSize: '12px', opacity: 0.7}}>{room.type} - Piso {room.floor}</div>
                      </span>
                      <span style={{fontSize: '14px'}}>Relocalizar ➜</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h4 style={{color: '#e5e7eb', margin: 0}}>Habitaciones Disponibles</h4>
              <div style={{...styles.badge('disponible'), display: 'inline-block'}}>{availableRooms.length}</div>
            </div>
            
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {loading ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>Cargando habitaciones...</p>
              ) : availableRooms.length === 0 ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>No hay habitaciones disponibles</p>
              ) : (
                availableRooms.map(room => (
                  <div key={room._id} style={{marginBottom: '8px', padding: '10px', background: '#2a2a2a', borderRadius: '6px'}}>
                    <strong style={{fontSize: '16px'}}>#{room.number}</strong>
                    <div style={{fontSize: '12px', opacity: 0.7}}>{room.type} - Piso {room.floor}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Gestión de Mantenimiento</h3>
        
        <div style={styles.flexContainer}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h4 style={{color: '#e5e7eb', margin: 0}}>Poner Habitación en Mantenimiento</h4>
            </div>
            
            <div style={{marginBottom: '16px'}}>
              <label style={styles.label}>Seleccionar habitación:</label>
              <div style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '16px'}}>
                {loading ? (
                  <p style={{color: '#d1d5db', textAlign: 'center'}}>Cargando habitaciones...</p>
                ) : rooms.length === 0 ? (
                  <p style={{color: '#d1d5db', textAlign: 'center'}}>No hay habitaciones disponibles</p>
                ) : (
                  rooms.map(room => (
                    <button
                      key={room._id}
                      onClick={() => {
                        setSelectedRoom(room);
                        checkMaintenanceImpact(room._id);
                      }}
                      style={{
                        ...styles.roomButton,
                        ...(selectedRoom && selectedRoom._id === room._id ? styles.selectedRoom : {})
                      }}
                    >
                      <span>
                        <strong style={{fontSize: '16px'}}>#{room.number}</strong>
                        <div style={{fontSize: '12px', opacity: 0.7}}>{room.type} - Piso {room.floor}</div>
                      </span>
                      <span style={{...styles.badge(room.status)}}>{room.status}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            
            {selectedRoom && (
              <div style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Motivo de mantenimiento:</label>
                  <input 
                    type="text" 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                    style={styles.input}
                    placeholder="Ej: Reparación de aire acondicionado"
                    required
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Días estimados:</label>
                  <input 
                    type="number" 
                    value={estimatedDays} 
                    onChange={(e) => setEstimatedDays(e.target.value)}
                    style={styles.input}
                    min="1"
                    required
                  />
                </div>
                
                {impactData && (
                  <div style={styles.alert('info')}>
                    <div style={{fontWeight: '600', marginBottom: '8px'}}>Análisis de impacto:</div>
                    <div>• Estado actual: <strong>{impactData.currentState}</strong></div>
                    {impactData.currentlyOccupied && (
                      <div style={{color: '#f87171'}}>• La habitación está ocupada</div>
                    )}
                    {impactData.futureReservationsCount > 0 && (
                      <div style={{color: '#fcd34d'}}>
                        • Afecta a {impactData.futureReservationsCount} reservas futuras
                      </div>
                    )}
                    {impactData.alternativeAvailable ? (
                      <div style={{color: '#6ee7b7'}}>
                        • Hay habitación alternativa disponible: #{impactData.alternativeRoom?.number}
                      </div>
                    ) : (
                      <div style={{color: '#f87171'}}>
                        • No hay habitaciones alternativas disponibles
                      </div>
                    )}
                    <div style={{marginTop: '8px'}}>
                      <strong>Recomendación: </strong> 
                      {impactData.recommendedAction.message}
                    </div>
                  </div>
                )}
                
                <div style={{display: 'flex', gap: '10px', marginTop: '16px'}}>
                  <button 
                    onClick={() => startMaintenance(false)}
                    style={styles.button('primary')}
                    disabled={processLoading || !reason || !selectedRoom}
                  >
                    {processLoading ? 'Procesando...' : 'Iniciar Mantenimiento'}
                  </button>
                  
                  {(impactData?.currentlyOccupied || impactData?.futureReservationsCount > 0) && (
                    <button 
                      onClick={() => startMaintenance(true)}
                      style={styles.button('warning')}
                      disabled={processLoading || !reason || !selectedRoom}
                    >
                      {processLoading ? 'Procesando...' : 'Forzar con Relocalización'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h4 style={{color: '#e5e7eb', margin: 0}}>Habitaciones en Mantenimiento</h4>
              <div style={{...styles.badge('mantenimiento'), display: 'inline-block'}}>{maintenanceRooms.length}</div>
            </div>
            
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {loading ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>Cargando habitaciones...</p>
              ) : maintenanceRooms.length === 0 ? (
                <p style={{color: '#d1d5db', textAlign: 'center'}}>No hay habitaciones en mantenimiento</p>
              ) : (
                maintenanceRooms.map(room => (
                  <div key={room.id} style={{marginBottom: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #333'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                      <strong style={{fontSize: '18px'}}>#{room.number}</strong>
                      <span style={{...styles.badge('mantenimiento')}}>Mantenimiento</span>
                    </div>
                    <div style={{fontSize: '14px', marginBottom: '8px'}}>
                      <strong>Motivo:</strong> {room.currentMaintenance?.reason || 'No especificado'}
                    </div>
                    {room.currentMaintenance?.estimatedEndDate && (
                      <div style={{fontSize: '14px', marginBottom: '12px'}}>
                        <strong>Fin estimado:</strong> {new Date(room.currentMaintenance.estimatedEndDate).toLocaleDateString()}
                      </div>
                    )}
                    <button 
                      onClick={() => completeMaintenance(room.id)}
                      style={styles.button('success')}
                      disabled={processLoading}
                    >
                      Finalizar Mantenimiento
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de relocalización */}
      {renderRelocateModal()}
    </div>
  );
};

export default MaintenanceManager;