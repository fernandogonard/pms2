// middlewares/maintenanceMiddleware.js
// Middleware para validar operaciones de mantenimiento

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { ROOM_STATES } = require('../services/stateValidationService');
const ErrorHandlingService = require('../services/errorHandlingService');

/**
 * Valida la solicitud de mantenimiento antes de procesarla
 */
exports.validateMaintenance = async (req, res, next) => {
  try {
    const roomId = req.params.id;
    
    // 1. Verificar que existe la habitación
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada'
      });
    }
    
    // Verificar que la habitación no esté ya en mantenimiento
    if (room.status === ROOM_STATES.MANTENIMIENTO) {
      return res.status(409).json({
        success: false,
        message: `La habitación #${room.number} ya está en mantenimiento`,
        currentMaintenance: room.currentMaintenance
      });
    }
    
    // Verificación de ocupación - CRUCIAL para evitar poner en mantenimiento habitaciones ocupadas
    if (room.status === ROOM_STATES.OCUPADA && !req.body.forceIfOccupied) {
      const activeReservation = await Reservation.findOne({
        room: roomId,
        status: 'checkin'
      }).populate('client', 'name');
      
      return res.status(409).json({
        success: false,
        message: `No se puede poner en mantenimiento: La habitación #${room.number} está ocupada actualmente`,
        occupancy: {
          guestName: activeReservation?.client?.name || 'Huésped sin nombre',
          checkIn: activeReservation?.checkIn,
          checkOut: activeReservation?.checkOut
        },
        forceOption: true
      });
    }
    
    // 3. Validar datos de la solicitud
    if (!req.body.reason) {
      return res.status(400).json({
        success: false,
        message: 'El motivo del mantenimiento es requerido'
      });
    }
    
    if (req.body.estimatedDays && 
        (isNaN(req.body.estimatedDays) || req.body.estimatedDays < 1)) {
      return res.status(400).json({
        success: false,
        message: 'El tiempo estimado debe ser un número mayor a 0'
      });
    }
    
    if (req.body.priority && 
        !['normal', 'high', 'urgent'].includes(req.body.priority)) {
      return res.status(400).json({
        success: false,
        message: 'Prioridad inválida. Valores permitidos: normal, high, urgent'
      });
    }
    
    // Si llega aquí, la validación es exitosa
    req.validatedRoom = room;
    next();
    
  } catch (error) {
    console.error('Error en validación de mantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar solicitud de mantenimiento',
      error: error.message
    });
  }
};

/**
 * Verifica y recopila información sobre datos reales del sistema
 */
exports.validateRealData = async (req, res, next) => {
  try {
    // Recopilar estadísticas y datos reales
    const roomCount = await Room.countDocuments();
    
    // Por tipo
    const roomsByType = await Room.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    // Por estado
    const roomsByStatus = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Añadir info al request para uso en controlador
    req.systemStats = {
      roomCount,
      roomsByType: roomsByType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      roomsByStatus: roomsByStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      timestamp: new Date()
    };
    
    next();
    
  } catch (error) {
    console.error('Error validando datos reales:', error);
    next(); // Continuar de todos modos
  }
};

/**
 * Middleware para verificar estado de mantenimiento antes de completarlo
 */
exports.validateMaintenanceCompletion = async (req, res, next) => {
  try {
    const roomId = req.params.id;
    
    // Verificar que existe la habitación
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada'
      });
    }
    
    // Verificar que la habitación está realmente en mantenimiento
    if (room.status !== ROOM_STATES.MANTENIMIENTO) {
      return res.status(409).json({
        success: false,
        message: `La habitación #${room.number} no está en mantenimiento`,
        currentStatus: room.status
      });
    }
    
    // Si llega aquí, la validación es exitosa
    req.validatedRoom = room;
    next();
    
  } catch (error) {
    console.error('Error en validación de finalización de mantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar finalización de mantenimiento',
      error: error.message
    });
  }
};