// controllers/maintenanceController.js
// Controlador para gestionar mantenimiento de habitaciones

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const MaintenanceService = require('../services/maintenanceService');
const ErrorHandlingService = require('../services/errorHandlingService');
const { ROOM_STATES } = require('../services/stateValidationService');
const { logger } = require('../config/logger');

/**
 * Inicia mantenimiento en una habitación
 * @route POST /api/rooms/:id/maintenance
 */
exports.startMaintenance = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const roomId = req.params.id;
  const maintenanceData = {
    reason: req.body.reason,
    estimatedDays: req.body.estimatedDays || 1,
    priority: req.body.priority || 'normal',
    forceIfOccupied: req.body.forceIfOccupied === true,
    requestedBy: req.user ? req.user.id : 'sistema'
  };

  // Validación de campos requeridos
  ErrorHandlingService.validateRequiredFields(req.body, ['reason'], 'startMaintenance');

  // Validación de datos
  if (maintenanceData.priority && !['normal', 'high', 'urgent'].includes(maintenanceData.priority)) {
    throw ErrorHandlingService.createBusinessError(
      'Prioridad inválida. Valores permitidos: normal, high, urgent',
      400
    );
  }

  if (maintenanceData.estimatedDays && 
     (isNaN(maintenanceData.estimatedDays) || maintenanceData.estimatedDays < 1)) {
    throw ErrorHandlingService.createBusinessError(
      'El tiempo estimado debe ser un número mayor a 0',
      400
    );
  }

  // VALIDACIÓN CRÍTICA: Verificar si la habitación está ocupada
  const room = await Room.findById(roomId);
  if (!room) {
    throw ErrorHandlingService.createBusinessError('Habitación no encontrada', 404);
  }
  
  // Si está ocupada, rechazar el mantenimiento a menos que se fuerce
  if (room.status === ROOM_STATES.OCUPADA && !maintenanceData.forceIfOccupied) {
    // Buscar la reserva activa para esta habitación
    const activeReservation = await Reservation.findOne({
      room: roomId,
      status: 'checkin'
    }).populate('client', 'name');
    
    return res.status(409).json({
      success: false,
      message: `La habitación #${room.number} está actualmente ocupada. Necesitas relocar al huésped antes de ponerla en mantenimiento.`,
      status: 'occupied',
      details: {
        guestName: activeReservation?.client?.name || 'Huésped sin nombre',
        checkIn: activeReservation?.checkIn,
        checkOut: activeReservation?.checkOut,
        roomNumber: room.number,
        roomId: room._id
      },
      forceOption: true
    });
  }

  // VALIDACIÓN CRÍTICA: Verificar si hay reservas futuras
  const today = new Date();
  const estimatedEndDate = new Date(today);
  estimatedEndDate.setDate(today.getDate() + (maintenanceData.estimatedDays || 1));
  
  const futureReservations = await Reservation.find({
    room: roomId,
    status: 'reservada',
    checkIn: { $lte: estimatedEndDate },
    checkOut: { $gt: today }
  }).populate('client', 'name');
  
  if (futureReservations.length > 0 && !maintenanceData.forceIfOccupied) {
    return res.status(409).json({
      success: false,
      message: `La habitación #${room.number} tiene ${futureReservations.length} reservas futuras afectadas. Necesitas reasignarlas antes de ponerla en mantenimiento.`,
      status: 'future_reservations',
      details: {
        count: futureReservations.length,
        reservations: futureReservations.map(r => ({
          id: r._id,
          clientName: r.client?.name || 'Cliente sin nombre',
          checkIn: r.checkIn,
          checkOut: r.checkOut
        }))
      },
      forceOption: true
    });
  }
  
  // Procesar la solicitud de mantenimiento
  const result = await MaintenanceService.setRoomMaintenance(roomId, maintenanceData);

  // Respuesta dependiendo del resultado
  if (!result.success) {
    // Si hay conflicto con ocupación o reservas, devolver 409 Conflict
    return res.status(409).json({
      success: false,
      message: result.message,
      status: result.status,
      details: result.currentOccupancy || result.affectedReservations
    });
  }

  // Emitir evento WebSocket para actualizar el tablero
  const wss = req.app.get('wss');
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ 
          type: 'room_maintenance_started', 
          room: { 
            id: result.room._id, 
            number: result.room.number,
            previousStatus: result.previousStatus || 'desconocido',
            estimatedEndDate: result.estimatedEndDate
          }
        }));
      }
    });
  }

  // Éxito - 201 Created
  res.status(201).json({
    success: true,
    message: result.message,
    estimatedEndDate: result.room.currentMaintenance?.estimatedEndDate,
    room: {
      id: result.room._id,
      number: result.room.number,
      status: result.room.status,
      maintenanceInfo: result.room.currentMaintenance
    }
  });
});

/**
 * Completa el mantenimiento de una habitación
 * @route PUT /api/rooms/:id/maintenance/complete
 */
exports.completeMaintenance = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const roomId = req.params.id;
  const completionData = {
    notes: req.body.notes || '',
    completedBy: req.user ? req.user.id : 'sistema',
    requiresCleaning: req.body.requiresCleaning !== false  // Por defecto requiere limpieza
  };

  // Procesar la finalización de mantenimiento
  const result = await MaintenanceService.completeMaintenance(roomId, completionData);

  // Emitir evento WebSocket para actualizar el tablero
  const wss = req.app.get('wss');
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ 
          type: 'room_maintenance_completed', 
          room: { 
            id: result.room._id, 
            number: result.room.number,
            status: result.room.status
          }
        }));
      }
    });
  }

  // Éxito
  res.json({
    success: true,
    message: result.message,
    room: {
      id: result.room._id,
      number: result.room.number,
      status: result.room.status,
      requiresCleaning: completionData.requiresCleaning
    }
  });
});

/**
 * Obtiene todas las habitaciones en mantenimiento
 * @route GET /api/rooms/maintenance
 */
exports.getRoomsInMaintenance = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const rooms = await MaintenanceService.getRoomsInMaintenance();
  
  res.json({
    success: true,
    count: rooms.length,
    rooms: rooms.map(room => ({
      id: room._id,
      number: room.number,
      type: room.type,
      floor: room.floor,
      currentMaintenance: room.currentMaintenance
    }))
  });
});

/**
 * Obtiene el historial de mantenimiento de una habitación
 * @route GET /api/rooms/:id/maintenance/history
 */
exports.getMaintenanceHistory = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const roomId = req.params.id;
  
  const room = await Room.findById(roomId);
  if (!room) {
    throw ErrorHandlingService.createBusinessError('Habitación no encontrada', 404);
  }
  
  const maintenanceHistory = room.maintenanceHistory || [];
  
  res.json({
    success: true,
    roomNumber: room.number,
    count: maintenanceHistory.length,
    history: maintenanceHistory
  });
});

/**
 * Verifica el impacto de poner una habitación en mantenimiento (simulación)
 * @route GET /api/rooms/:id/maintenance/impact
 */
exports.checkMaintenanceImpact = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const roomId = req.params.id;
  const estimatedDays = parseInt(req.query.days || '1', 10);
  
  // 1. Verificar existencia de la habitación
  const room = await Room.findById(roomId);
  if (!room) {
    throw ErrorHandlingService.createBusinessError('Habitación no encontrada', 404);
  }
  
  // 2. Verificar si la habitación está ocupada
  let currentOccupancy = null;
  if (room.status === ROOM_STATES.OCUPADA) {
    const activeReservation = await Reservation.findOne({
      room: roomId,
      status: 'checkin'
    }).populate('client');
    
    if (activeReservation) {
      currentOccupancy = {
        reservationId: activeReservation._id,
        guestName: activeReservation.client?.name,
        checkIn: activeReservation.checkIn,
        checkOut: activeReservation.checkOut
      };
    }
  }
  
  // 3. Buscar reservas futuras que se verían afectadas
  const maintenanceEndDate = new Date();
  maintenanceEndDate.setDate(maintenanceEndDate.getDate() + estimatedDays);
  
  const futureReservations = await MaintenanceService.findFutureReservations(
    roomId, 
    maintenanceEndDate
  );
  
  // 4. Verificar disponibilidad de habitaciones alternativas
  const alternativeRoom = await MaintenanceService.findAlternativeRoom(room);
  
  // 5. Generar respuesta con análisis de impacto
  res.json({
    success: true,
    room: {
      id: room._id,
      number: room.number,
      status: room.status,
      type: room.type
    },
    impact: {
      currentlyOccupied: room.status === ROOM_STATES.OCUPADA,
      occupancyDetails: currentOccupancy,
      futureReservationsCount: futureReservations.length,
      futureReservations: futureReservations.map(r => ({
        id: r._id,
        clientName: r.client?.name,
        checkIn: r.checkIn,
        checkOut: r.checkOut
      })),
      alternativeAvailable: alternativeRoom !== null,
      alternativeRoom: alternativeRoom ? {
        id: alternativeRoom._id,
        number: alternativeRoom.number,
        type: alternativeRoom.type
      } : null,
      recommendedAction: this.getRecommendedAction(room, currentOccupancy, futureReservations, alternativeRoom),
      estimatedEndDate: maintenanceEndDate
    }
  });
});

/**
 * Determina la acción recomendada para mantenimiento
 * @private
 */
exports.getRecommendedAction = (room, currentOccupancy, futureReservations, alternativeRoom) => {
  if (room.status === ROOM_STATES.MANTENIMIENTO) {
    return {
      action: 'CONTINUE',
      message: 'La habitación ya está en mantenimiento'
    };
  }
  
  if (room.status === ROOM_STATES.OCUPADA && !alternativeRoom) {
    return {
      action: 'DEFER',
      message: 'La habitación está ocupada y no hay alternativas disponibles'
    };
  }
  
  if (room.status === ROOM_STATES.OCUPADA && alternativeRoom) {
    return {
      action: 'RELOCATE',
      message: 'Reubicar al huésped actual a la habitación ' + alternativeRoom.number
    };
  }
  
  if (futureReservations.length > 0 && !alternativeRoom) {
    return {
      action: 'SHORT_MAINTENANCE',
      message: 'Limitar el mantenimiento para no afectar reservas futuras'
    };
  }
  
  return {
    action: 'PROCEED',
    message: 'Se puede proceder con el mantenimiento sin impacto significativo'
  };
};