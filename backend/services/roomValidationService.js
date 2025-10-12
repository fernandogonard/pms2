/**
 * Servicio para validación avanzada de habitaciones y su estado
 * Centraliza toda la lógica de verificación de disponibilidad y cambios de estado
 */

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const stateValidationService = require('./stateValidationService');
const { ROOM_STATES } = stateValidationService;

/**
 * Verifica si una habitación está disponible en un rango de fechas
 * @param {ObjectId|string} roomId - ID de la habitación
 * @param {Date} checkIn - Fecha de inicio
 * @param {Date} checkOut - Fecha de fin
 * @returns {Promise<boolean>} - True si está disponible
 */
const isRoomAvailable = async (roomId, checkIn, checkOut) => {
  // Verificar estado actual de la habitación
  const room = await Room.findById(roomId);
  if (!room || room.status !== 'disponible') {
    return false;
  }
  
  // Verificar reservas existentes en el rango de fechas
  const overlappingReservations = await Reservation.countDocuments({
    room: { $in: [roomId] },
    status: { $in: ['reservada', 'checkin'] },
    $or: [
      { 
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
      }
    ]
  });
  
  return overlappingReservations === 0;
};

/**
 * Verifica si una habitación está ocupada actualmente
 * @param {ObjectId|string} roomId - ID de la habitación
 * @returns {Promise<boolean>} - True si está ocupada
 */
const isRoomOccupied = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room) return false;
  
  // Verificar estado directo
  if (room.status === 'ocupada') return true;
  
  // Verificar si hay reservas en check-in
  const activeReservations = await Reservation.countDocuments({
    room: { $in: [roomId] },
    status: 'checkin'
  });
  
  return activeReservations > 0;
};

/**
 * Encuentra las reservas futuras para una habitación
 * @param {ObjectId|string} roomId - ID de la habitación
 * @param {Date} fromDate - Fecha desde la cual buscar
 * @returns {Promise<Array>} - Lista de reservas futuras
 */
const findFutureReservations = async (roomId, fromDate = new Date()) => {
  return await Reservation.find({
    room: { $in: [roomId] },
    status: 'reservada',
    checkIn: { $gt: fromDate }
  }).populate('client');
};

/**
 * Verifica si es posible cambiar el estado de una habitación
 * @param {ObjectId|string} roomId - ID de la habitación
 * @param {string} targetState - Estado objetivo
 * @returns {Promise<Object>} - Resultado de la validación
 */
const canChangeRoomState = async (roomId, targetState) => {
  const room = await Room.findById(roomId);
  if (!room) {
    return { 
      valid: false, 
      message: 'Habitación no encontrada'
    };
  }
  
  // Verificar transición de estado permitida
  const stateTransitionValid = stateValidationService.validateTransition(
    room.status, targetState
  );
  
  if (!stateTransitionValid.valid) {
    return stateTransitionValid;
  }
  
  // Verificaciones específicas según el estado objetivo
  if (targetState === ROOM_STATES.MAINTENANCE) {
    // Verificar ocupación para mantenimiento
    const isOccupied = await isRoomOccupied(roomId);
    if (isOccupied) {
      return {
        valid: false,
        requiresForce: true,
        message: 'La habitación está ocupada y requiere relocalización de huéspedes'
      };
    }
    
    // Verificar reservas futuras
    const futureReservations = await findFutureReservations(roomId);
    if (futureReservations.length > 0) {
      return {
        valid: false,
        requiresReschedule: true,
        futureReservations,
        message: `La habitación tiene ${futureReservations.length} reservas futuras que necesitan ser reubicadas`
      };
    }
  }
  
  return { valid: true };
};

/**
 * Verifica el impacto de un cambio de estado en una habitación
 * @param {ObjectId|string} roomId - ID de la habitación
 * @param {string} targetState - Estado objetivo
 * @param {Date} startDate - Fecha de inicio del cambio
 * @param {Date} endDate - Fecha de fin del cambio (opcional)
 */
const checkRoomStateChangeImpact = async (roomId, targetState, startDate = new Date(), endDate = null) => {
  const room = await Room.findById(roomId);
  if (!room) {
    return {
      canProceed: false,
      message: 'Habitación no encontrada'
    };
  }
  
  const impact = {
    currentState: room.status,
    targetState,
    currentlyOccupied: false,
    futureReservationsCount: 0,
    futureReservations: [],
    alternativeAvailable: false,
    alternativeRoom: null,
    recommendedAction: {
      action: 'proceed',
      message: 'Se puede cambiar el estado sin problemas'
    }
  };
  
  // Verificar si está ocupada
  impact.currentlyOccupied = await isRoomOccupied(roomId);
  
  // Buscar reservas futuras afectadas
  impact.futureReservations = await findFutureReservations(roomId, startDate);
  impact.futureReservationsCount = impact.futureReservations.length;
  
  // Verificar alternativas disponibles del mismo tipo
  if (impact.currentlyOccupied || impact.futureReservationsCount > 0) {
    const alternativeRooms = await Room.find({
      _id: { $ne: roomId },
      type: room.type,
      status: 'disponible'
    });
    
    if (alternativeRooms.length > 0) {
      impact.alternativeAvailable = true;
      impact.alternativeRoom = alternativeRooms[0];
    }
    
    // Determinar acción recomendada
    if (impact.currentlyOccupied) {
      if (impact.alternativeAvailable) {
        impact.recommendedAction = {
          action: 'relocate',
          message: 'Se recomienda relocalizar a los huéspedes actuales a otra habitación'
        };
      } else {
        impact.recommendedAction = {
          action: 'abort',
          message: 'No hay habitaciones alternativas disponibles para relocalizar a los huéspedes'
        };
      }
    } else if (impact.futureReservationsCount > 0) {
      if (impact.alternativeAvailable) {
        impact.recommendedAction = {
          action: 'reschedule',
          message: `Se recomienda reubicar las ${impact.futureReservationsCount} reservas futuras`
        };
      } else {
        impact.recommendedAction = {
          action: 'warn',
          message: `No hay habitaciones alternativas para las ${impact.futureReservationsCount} reservas futuras`
        };
      }
    }
  }
  
  return {
    canProceed: !impact.currentlyOccupied,
    requiresForce: impact.currentlyOccupied,
    impact
  };
};

module.exports = {
  isRoomAvailable,
  isRoomOccupied,
  findFutureReservations,
  canChangeRoomState,
  checkRoomStateChangeImpact
};