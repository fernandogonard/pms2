// Estado real de habitaciones (centralizado)
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ErrorHandlingService = require('../services/errorHandlingService');
const { 
  validateRoomStateTransition, 
  validateRoomBusinessRules,
  getAllowedStates 
} = require('../services/stateValidationService');
const { calculateRoomStates } = require('../services/AvailabilityService');
const RoomCalendar = require('../models/RoomCalendar');
const AvailabilityEngine = require('../services/availabilityEngine');

// ðŸ†• Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');

// GET /api/rooms/types — público, sin auth — usado por el motor de reservas web
exports.getRoomTypes = async (req, res) => {
  try {
    const types = await Room.distinct('type', { status: { $nin: ['mantenimiento'] } });
    res.json(types.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener tipos de habitación' });
  }
};

// ðŸ†• GET /api/rooms/status con logging avanzado
/**
 * GET /api/rooms/status?start=2024-06-15&days=14
 * ÃšNICO endpoint para calendario
 * SINGLE SOURCE OF TRUTH
 */
exports.getRoomsStatus = async (req, res) => {
  try {
    const { start, days = 14 } = req.query;

    // Validar formato de fecha
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({
        error: 'Invalid start date format. Use YYYY-MM-DD'
      });
    }

    const daysInt = Math.min(parseInt(days) || 14, 90); // Max 90 dÃ­as

    // Parsear fechas en UTC
    const startDate = new Date(start + 'T00:00:00Z');
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + daysInt);

    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Cache header: 10 segundos mÃ¡ximo
    res.set('Cache-Control', 'public, max-age=10, must-revalidate');
    res.set('Vary', 'Accept-Encoding');

    const data = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);

    res.json(data);
  } catch (error) {
    logger.error('[RoomsStatus Error]', error);
    res.status(500).json({
      error: 'Failed to fetch availability',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Crear habitaciÃ³n
exports.createRoom = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const { number, floor, type, price, status } = req.body;
  
  // Validar campos requeridos
  ErrorHandlingService.validateRequiredFields(
    req.body, 
    ['number', 'floor', 'type', 'price'], 
    'createRoom'
  );
  
  // Verificar si ya existe
  const exists = await Room.findOne({ number });
  if (exists) {
    throw ErrorHandlingService.createBusinessError(
      'El nÃºmero de habitaciÃ³n ya existe', 
      409
    );
  }
  
  const room = new Room({ number, floor, type, price, status });
  await room.save();
  
  res.status(201).json({
    success: true,
    message: 'HabitaciÃ³n creada exitosamente',
    data: room
  });
});

// Obtener todas las habitaciones
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ number: 1 }).lean();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener habitaciones.', error });
  }
};

// Obtener una habitaciÃ³n por ID
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'HabitaciÃ³n no encontrada.' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener habitaciÃ³n.', error });
  }
};

// Actualizar habitaciÃ³n
exports.updateRoom = async (req, res) => {
  try {
    // Obtener habitaciÃ³n actual
    const currentRoom = await Room.findById(req.params.id);
    if (!currentRoom) {
      return res.status(404).json({ message: 'HabitaciÃ³n no encontrada.' });
    }

    // ðŸ”„ VALIDACIÃ“N DE TRANSICIÃ“N DE ESTADO
    if (req.body.status && req.body.status !== currentRoom.status) {
      // Validar transiciÃ³n de estado
      const transitionValidation = validateRoomStateTransition(currentRoom.status, req.body.status);
      if (!transitionValidation.valid) {
        return res.status(400).json({ 
          message: 'TransiciÃ³n de estado invÃ¡lida',
          error: transitionValidation.message,
          currentState: currentRoom.status,
          requestedState: req.body.status
        });
      }

      // Validar reglas de negocio
      const businessRulesValidation = validateRoomBusinessRules(currentRoom, req.body.status);
      if (!businessRulesValidation.valid) {
        return res.status(400).json({ 
          message: 'Reglas de negocio violated',
          error: businessRulesValidation.message,
          currentState: currentRoom.status,
          requestedState: req.body.status
        });
      }

      logger.audit.dataChange(`Cambio de estado de habitaciÃ³n`, {
        service: 'crm-hotelero',
        roomNumber: currentRoom.number,
        previousStatus: currentRoom.status,
        newStatus: req.body.status,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        event: 'ROOM_STATUS_UPDATE'
      });
    }

    // Proceder con la actualizaciÃ³n
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // Emitir evento WebSocket si hay cambio de estado
    if (req.body.status && req.body.status !== currentRoom.status) {
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ 
              type: 'room_state_changed', 
              room: { 
                id: room._id, 
                number: room.number, 
                status: room.status,
                previousStatus: currentRoom.status
              }
            }));
          }
        });
      }
    }

    res.json({
      message: 'HabitaciÃ³n actualizada exitosamente',
      room
    });
  } catch (error) {
    logger.error('Error actualizando habitaciÃ³n', {
      service: 'crm-hotelero',
      error: error.message,
      stack: error.stack,
      roomId: req.params.id,
      userId: req.user?.id,
      event: 'ROOM_UPDATE_ERROR'
    });
    res.status(500).json({ message: 'Error al actualizar habitaciÃ³n.', error: error.message });
  }
};

// Eliminar habitaciÃ³n
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: 'HabitaciÃ³n no encontrada.' });
    res.json({ message: 'HabitaciÃ³n eliminada.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar habitaciÃ³n.', error });
  }
};

// GET /api/rooms/available?type=doble&checkIn=2025-09-26&checkOut=2025-09-30
exports.getAvailableRooms = async (req, res) => {
  try {
    // Headers de no-cache forzado
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { type, checkIn, checkOut, cantidad } = req.query;
    
    // Validar parámetros requeridos usando ValidationService
    const { ValidationService } = require('../services/validationService');
    const validation = ValidationService.validateRequired(req.query, ['type', 'checkIn', 'checkOut']);
    
    // Log de entrada con timestamp
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] Consulta disponibilidad NUEVA`, {
      type, checkIn, checkOut, cantidad,
      event: 'ROOM_AVAILABILITY_REQUEST'
    });
    
    // PASO 0: Validar parÃ¡metros de entrada
    if (!type || !checkIn || !checkOut) {
      const errorMessage = 'Faltan parÃ¡metros obligatorios: type, checkIn o checkOut';
      logger.error(`[${timestamp}] Error en parÃ¡metros de entrada`, {
        type, checkIn, checkOut
      });
      return res.status(400).json({
        message: errorMessage,
        timestamp
      });
    }

    // Validar que checkOut sea mayor que checkIn
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkInDate >= checkOutDate) {
      const errorMessage = 'La fecha de checkOut debe ser mayor que la de checkIn';
      logger.error(`[${timestamp}] Error en validaciÃ³n de fechas`, {
        checkIn: checkInDate,
        checkOut: checkOutDate
      });
      return res.status(400).json({
        message: errorMessage,
        timestamp
      });
    }

    logger.info(`[${timestamp}] ParÃ¡metros recibidos`, {
      type, checkIn, checkOut, cantidad
    });

    // PASO 1: Obtener TODAS las habitaciones del tipo solicitado
    let allRooms;
    try {
      allRooms = await Room.find({ type }).sort({ number: 1 }).lean();
      if (!allRooms || allRooms.length === 0) {
        logger.warn(`[${timestamp}] No se encontraron habitaciones para el tipo solicitado`, { type });
      }
    } catch (error) {
      logger.error(`[${timestamp}] Error al obtener habitaciones`, {
        error: error.message,
        stack: error.stack
      });
      return res.status(500).json({
        message: 'Error al obtener habitaciones.',
        error: error.message,
        timestamp
      });
    }

    // Validar que las habitaciones tengan datos consistentes
    if (!allRooms || !Array.isArray(allRooms)) {
      const errorMessage = 'Error al obtener habitaciones del tipo solicitado';
      logger.error(`[${timestamp}] Error en datos de habitaciones`, {
        type,
        allRooms
      });
      return res.status(500).json({
        message: errorMessage,
        timestamp
      });
    }

    // PASO 2: Buscar reservas que se solapan
    let overlappingReservations;
    try {
      overlappingReservations = await Reservation.find({
        status: { $in: ['reservada', 'checkin'] },
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate }
      }).populate('room').lean();
    } catch (error) {
      logger.error(`[${timestamp}] Error al obtener reservas`, {
        error: error.message,
        stack: error.stack
      });
      return res.status(500).json({
        message: 'Error al obtener reservas.',
        error: error.message,
        timestamp
      });
    }

    logger.info(`[${timestamp}] Reservas solapantes encontradas`, {
      count: overlappingReservations.length,
      reservations: overlappingReservations.map(r => ({
        id: r._id,
        checkIn: r.checkIn,
        checkOut: r.checkOut
      }))
    });

    // Validar reservas solapantes
    if (!overlappingReservations || !Array.isArray(overlappingReservations)) {
      const errorMessage = 'Error al obtener reservas solapantes';
      logger.error(`[${timestamp}] Error en datos de reservas`, {
        overlappingReservations
      });
      return res.status(500).json({
        message: errorMessage,
        timestamp
      });
    }

    // PASO 3: Procesar ocupaciones
    const occupiedRoomIds = new Set();
    let virtualReservationsCount = 0;

    overlappingReservations.forEach(reservation => {
      // Verificar si la reserva realmente se solapa con la fecha especÃ­fica solicitada
      const reservationStart = new Date(reservation.checkIn);
      const reservationEnd = new Date(reservation.checkOut);
      
      // Verificar si la fecha solicitada se solapa con esta reserva
      // Una fecha no se solapa si:
      // 1. La fecha de salida de la reserva es igual a la fecha de entrada solicitada (el cliente sale ese dÃ­a)
      // 2. La fecha de entrada de la reserva es igual a la fecha de salida solicitada (el cliente entra ese dÃ­a)
      const isCheckoutDay = reservationEnd.getTime() === checkInDate.getTime();
      const isCheckinDay = reservationStart.getTime() === checkOutDate.getTime();
      
      if (isCheckoutDay || isCheckinDay) {
        // Esta reserva no afecta realmente a la disponibilidad para esta fecha especÃ­fica
        logger.debug(`[${timestamp}] Reserva no afecta disponibilidad`, {
          id: reservation._id,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          reason: isCheckoutDay ? 'Es dÃ­a de checkout' : 'Es dÃ­a de checkin'
        });
        return; // Skip this reservation
      }

      logger.debug(`[${timestamp}] Procesando reserva`, {
        id: reservation._id,
        tipo: reservation.tipo,
        cantidad: reservation.cantidad,
        roomsAssigned: reservation.room?.length || 0,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut
      });

      if (reservation.room && reservation.room.length > 0) {
        // Reserva con habitaciones asignadas
        reservation.room.forEach(roomObj => {
          occupiedRoomIds.add(roomObj._id.toString());
          logger.debug(`[${timestamp}] HabitaciÃ³n ocupada por reserva`, { 
            roomNumber: roomObj.number,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut
          });
        });
      } else if (reservation.tipo === type) {
        // Reserva virtual del mismo tipo
        virtualReservationsCount += reservation.cantidad || 1;
        logger.debug(`[${timestamp}] Reserva virtual`, { 
          type: reservation.tipo, 
          cantidad: reservation.cantidad || 1,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut
        });
      }
    });

    // PASO 4: Filtrar habitaciones realmente disponibles
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const availableRooms = allRooms.filter(room => {
      // Excluir mantenimiento siempre
      if (room.status === 'mantenimiento') {
        logger.debug(`[${timestamp}] Excluida: mantenimiento`, { roomNumber: room.number });
        return false;
      }
      
      // Excluir limpieza SOLO si el check-in es HOY
      if (room.status === 'limpieza' && checkInDate.getTime() === today.getTime()) {
        logger.debug(`[${timestamp}] Excluida: limpieza HOY`, { roomNumber: room.number });
        return false;
      }
      
      // Excluir ocupadas por estado
      if (room.status === 'ocupada') {
        logger.debug(`[${timestamp}] Excluida: estado ocupada`, { roomNumber: room.number });
        return false;
      }
      
      // Excluir ocupadas por reservas
      if (occupiedRoomIds.has(room._id.toString())) {
        logger.debug(`[${timestamp}] Excluida: reserva real`, { roomNumber: room.number });
        return false;
      }
      
      logger.debug(`[${timestamp}] Disponible`, { roomNumber: room.number });
      return true;
    });

    // PASO 5: Calcular disponibilidad final
    const physicallyAvailable = availableRooms.length;
    
    // Siempre mostrar habitaciones fÃ­sicamente disponibles
    const reallyAvailable = Math.max(0, physicallyAvailable - virtualReservationsCount);

    logger.info(`[${timestamp}] CÃ¡lculo final`, {
      type,
      totalRooms: allRooms.length,
      physicallyAvailable,
      virtualReservationsCount,
      reallyAvailable,
      occupiedByReservations: occupiedRoomIds.size,
      checkInDateInfo: `${checkInDate.getDate()}-${checkInDate.getMonth()+1}-${checkInDate.getFullYear()}`
    });

    // PASO 6: Validar cantidad solicitada
    if (cantidad && reallyAvailable < parseInt(cantidad, 10)) {
      const errorMessage = `No hay suficientes habitaciones ${type} disponibles para ${checkIn}. Solicitadas: ${cantidad}, Disponibles: ${reallyAvailable}`;
      
      logger.warn(`[${timestamp}] Insuficientes habitaciones`, {
        requested: parseInt(cantidad, 10),
        available: reallyAvailable,
        type
      });
      
      return res.status(409).json({
        message: errorMessage,
        disponibles: reallyAvailable,
        timestamp,
        debug: {
          total_habitaciones: allRooms.length,
          fisicamente_disponibles: physicallyAvailable,
          reservas_virtuales: virtualReservationsCount,
          habitaciones_ocupadas_por_reservas: occupiedRoomIds.size,
          detalle_habitaciones: allRooms.map(r => ({
            numero: r.number,
            estado: r.status,
            ocupada_por_reserva: occupiedRoomIds.has(r._id.toString())
          }))
        }
      });
    }

    // PASO 7: Respuesta exitosa
    const candidates = availableRooms.slice(0, reallyAvailable);
    
    logger.info(`[${timestamp}] Respuesta exitosa`, {
      type,
      disponibles: reallyAvailable,
      candidatesCount: candidates.length
    });

    // AÃ±adir logs adicionales para depuraciÃ³n
    logger.info(`[${timestamp}] Iniciando getAvailableRooms`, {
      query: req.query,
      event: 'START_GET_AVAILABLE_ROOMS'
    });

    // ...existing code...

    logger.info(`[${timestamp}] Finalizando getAvailableRooms`, {
      type,
      disponibles: reallyAvailable,
      event: 'END_GET_AVAILABLE_ROOMS'
    });

    res.json({
      type,
      disponibles: reallyAvailable,
      candidates,
      timestamp,
      debug: {
        total_habitaciones: allRooms.length,
        fisicamente_disponibles: physicallyAvailable,
        reservas_virtuales: virtualReservationsCount,
        habitaciones_ocupadas_por_reservas: occupiedRoomIds.size,
        algoritmo_version: "2.0_corregido"
      }
    });

  } catch (error) {
    const timestamp = new Date().toISOString();
    logger.error(`[${timestamp}] Error en getAvailableRooms`, {
      error: error.message,
      stack: error.stack,
      params: { type: req.query.type, checkIn: req.query.checkIn, checkOut: req.query.checkOut }
    });
    
    res.status(500).json({ 
      message: 'Error al consultar habitaciones disponibles.', 
      error: error.message,
      timestamp
    });
  }
};

// ðŸ§¹ GESTIÃ“N DE LIMPIEZA - Nuevos endpoints para workflow completo

const { markRoomAsClean, markRoomsAsClean, getRoomsInCleaning } = require('../services/roomAssignmentService');

// GET /api/rooms/cleaning - Obtener habitaciones en limpieza
exports.getRoomsInCleaning = async (req, res) => {
  try {
    const rooms = await getRoomsInCleaning();
    res.json({
      message: `Se encontraron ${rooms.length} habitaciones en limpieza`,
      rooms,
      count: rooms.length
    });
  } catch (error) {
    logger.error('Error obteniendo habitaciones en limpieza:', error);
    res.status(500).json({ 
      message: 'Error al obtener habitaciones en limpieza', 
      error: error.message 
    });
  }
};

// PUT /api/rooms/:id/mark-clean - Marcar habitaciÃ³n como disponible despuÃ©s de limpieza
exports.markRoomAsClean = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    // ðŸ” Validar estado actual antes de proceder
    const currentRoom = await Room.findById(roomId);
    if (!currentRoom) {
      return res.status(404).json({ message: 'HabitaciÃ³n no encontrada' });
    }
    
    // Validar transiciÃ³n limpieza â†’ disponible
    const transitionValidation = validateRoomStateTransition(currentRoom.status, 'disponible');
    if (!transitionValidation.valid) {
      return res.status(400).json({ 
        message: 'No se puede marcar como limpia',
        error: transitionValidation.message,
        currentState: currentRoom.status
      });
    }
    
    const room = await markRoomAsClean(roomId);
    
    // Emitir evento WebSocket para actualizar calendario
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: 'room_cleaned', 
            room: { id: room._id, number: room.number, status: room.status }
          }));
        }
      });
    }
    
    res.json({
      message: `HabitaciÃ³n #${room.number} marcada como disponible`,
      room
    });
  } catch (error) {
    logger.error('Error marcando habitaciÃ³n como limpia:', error);
    res.status(400).json({ 
      message: error.message || 'Error al marcar habitaciÃ³n como limpia'
    });
  }
};

// PUT /api/rooms/:id/complete-task - Completar repaso o limpieza profunda (mid-stay)
exports.completeHousekeeping = async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Habitación no encontrada' });

    if (!room.pendingHousekeeping) {
      return res.status(400).json({ message: 'No hay tarea de housekeeping pendiente para esta habitación' });
    }

    const taskLabel = room.pendingHousekeeping === 'repaso'
      ? 'Repaso'
      : room.pendingHousekeeping === 'limpieza_profunda'
        ? 'Limpieza profunda'
        : 'Limpieza checkout';

    // limpieza_checkout → disponible (la habitación queda libre)
    // repaso / limpieza_profunda → vuelve a ocupada (el huésped sigue)
    const newStatus = room.pendingHousekeeping === 'limpieza_checkout' ? 'disponible' : 'ocupada';

    room.status = newStatus;
    room.pendingHousekeeping = null;
    room.pendingHousekeepingAt = null;
    room.lastCleaning = new Date();
    await room.save();

    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'room_task_completed', room: { id: room._id, number: room.number, status: room.status } }));
        }
      });
    }

    res.json({ message: `${taskLabel} completado. Habitación #${room.number} → ${newStatus}`, room });
  } catch (error) {
    logger.error('Error completando tarea housekeeping:', error);
    res.status(500).json({ message: error.message || 'Error al completar tarea' });
  }
};

// PUT /api/rooms/mark-clean-bulk - Marcar múltiples habitaciones como disponibles
exports.markRoomsAsClean = async (req, res) => {
  try {
    const { roomIds } = req.body;
    
    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({ 
        message: 'Se requiere un array de roomIds' 
      });
    }
    
    const rooms = await markRoomsAsClean(roomIds);
    
    // Emitir evento WebSocket para cada habitaciÃ³n
    const wss = req.app.get('wss');
    if (wss) {
      rooms.forEach(room => {
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ 
              type: 'room_cleaned', 
              room: { id: room._id, number: room.number, status: room.status }
            }));
          }
        });
      });
    }
    
    res.json({
      message: `Se marcaron ${rooms.length} habitaciones como disponibles`,
      rooms,
      count: rooms.length
    });
  } catch (error) {
    logger.error('Error marcando habitaciones como limpias:', error);
    res.status(400).json({ 
      message: error.message || 'Error al marcar habitaciones como limpias'
    });
  }
};

// PUT /api/rooms/:id/set-status - Cambio manual de estado (admin + recepcionista)
exports.setRoomStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['disponible', 'limpieza', 'mantenimiento', 'ocupada'];
    if (!status || !ALLOWED.includes(status)) {
      return res.status(400).json({ message: `Estado inválido. Valores permitidos: ${ALLOWED.join(', ')}` });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Habitación no encontrada' });
    const prev = room.status;
    room.status = status;
    if (status === 'disponible') {
      room.lastCleaning = new Date();
      room.pendingHousekeeping = null;
      room.pendingHousekeepingAt = null;
    }
    await room.save();
    const wss = req.app.get('wss');
    if (wss) wss.clients.forEach(c => {
      if (c.readyState === 1) c.send(JSON.stringify({ type: 'room_state_changed', room: { id: room._id, number: room.number, status: room.status, previousStatus: prev } }));
    });
    res.json({ message: `Habitación #${room.number}: ${prev} → ${status}`, room });
  } catch (error) {
    res.status(500).json({ message: 'Error cambiando estado', error: error.message });
  }
};

// GET /api/rooms/:id/allowed-states - Obtener estados permitidos para una habitación
exports.getRoomAllowedStates = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'HabitaciÃ³n no encontrada' });
    }
    
    const allowedStates = getAllowedStates(room.status, 'room');
    
    res.json({
      currentState: room.status,
      allowedStates,
      roomNumber: room.number
    });
  } catch (error) {
    logger.error('Error obteniendo estados permitidos:', error);
    res.status(500).json({ 
      message: 'Error al obtener estados permitidos', 
      error: error.message 
    });
  }
};

// AutomatizaciÃ³n de estados de habitaciones
exports.updateRoomStates = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await Reservation.find({
      $or: [
        { checkIn: { $lte: today }, checkOut: { $gte: today } },
        { checkOut: { $lt: today }, status: 'checkin' }
      ]
    }).populate('room');

    for (const reservation of reservations) {
      for (const roomId of reservation.room) {
        const room = await Room.findById(roomId);
        if (!room) continue;

        if (reservation.checkOut < today && reservation.status === 'checkin') {
          room.status = 'disponible';
          reservation.status = 'checkout';
          await reservation.save();
        } else if (reservation.checkIn <= today && reservation.checkOut >= today) {
          room.status = 'ocupada';
        }

        await room.save();
      }
    }

    logger.info('Estados de habitaciones actualizados automÃ¡ticamente.');
  } catch (error) {
    logger.error('Error actualizando estados de habitaciones:', error);
  }
};

// Actualizar lÃ³gica para calcular estados diarios
exports.updateRoomCalendar = async (reservation) => {
  const { room, checkIn, checkOut, status } = reservation;

  const dates = [];
  let currentDate = new Date(checkIn);
  while (currentDate <= checkOut) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const date of dates) {
    await RoomCalendar.updateOne(
      { room, date },
      { room, date, status, reservation: reservation._id },
      { upsert: true }
    );
  }
};

exports.getRoomStatus = async (req, res) => {
  try {
    const { start = new Date().toISOString().split('T')[0], days = 14 } = req.query;
    const status = await AvailabilityEngine.getRoomStatus(start, parseInt(days));
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
