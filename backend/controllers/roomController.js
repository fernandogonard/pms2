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

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');


// 🆕 GET /api/rooms/status con logging avanzado
exports.getRoomsStatus = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const startTime = Date.now();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const startQuery = req.query.start; // opcional YYYY-MM-DD
  const days = parseInt(req.query.days, 10) || 14;

  let startDate;
  if (startQuery) {
    const [year, month, day] = startQuery.split('-').map(Number);
    startDate = new Date(year, month - 1, day);
  } else {
    startDate = new Date();
  }
  startDate.setHours(0, 0, 0, 0);

  const rooms = await Room.find().sort({ number: 1 }).lean();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const reservations = await Reservation.find({
    status: { $in: ['reservada', 'checkin'] },
    checkOut: { $gt: startDate },
    checkIn: { $lt: endDate }
  }).populate('user').lean();

  const roomStates = calculateRoomStates(rooms, reservations, startDate, days);

  res.json({
    rooms: roomStates,
    timestamp: Date.now() - startTime
  });
});

// Crear habitación
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
      'El número de habitación ya existe', 
      409
    );
  }
  
  const room = new Room({ number, floor, type, price, status });
  await room.save();
  
  res.status(201).json({
    success: true,
    message: 'Habitación creada exitosamente',
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

// Obtener una habitación por ID
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Habitación no encontrada.' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener habitación.', error });
  }
};

// Actualizar habitación
exports.updateRoom = async (req, res) => {
  try {
    // Obtener habitación actual
    const currentRoom = await Room.findById(req.params.id);
    if (!currentRoom) {
      return res.status(404).json({ message: 'Habitación no encontrada.' });
    }

    // 🔄 VALIDACIÓN DE TRANSICIÓN DE ESTADO
    if (req.body.status && req.body.status !== currentRoom.status) {
      // Validar transición de estado
      const transitionValidation = validateRoomStateTransition(currentRoom.status, req.body.status);
      if (!transitionValidation.valid) {
        return res.status(400).json({ 
          message: 'Transición de estado inválida',
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

      logger.audit.dataChange(`Cambio de estado de habitación`, {
        service: 'crm-hotelero',
        roomNumber: currentRoom.number,
        previousStatus: currentRoom.status,
        newStatus: req.body.status,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        event: 'ROOM_STATUS_UPDATE'
      });
    }

    // Proceder con la actualización
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
      message: 'Habitación actualizada exitosamente',
      room
    });
  } catch (error) {
    logger.error('Error actualizando habitación', {
      service: 'crm-hotelero',
      error: error.message,
      stack: error.stack,
      roomId: req.params.id,
      userId: req.user?.id,
      event: 'ROOM_UPDATE_ERROR'
    });
    res.status(500).json({ message: 'Error al actualizar habitación.', error: error.message });
  }
};

// Eliminar habitación
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: 'Habitación no encontrada.' });
    res.json({ message: 'Habitación eliminada.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar habitación.', error });
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
    const { validateRequiredFields, ValidationService } = require('../services/validationService');
    const validation = validateRequiredFields(req.query, ['type', 'checkIn', 'checkOut']);
    
    // Log de entrada con timestamp
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] Consulta disponibilidad NUEVA`, {
      type, checkIn, checkOut, cantidad,
      event: 'ROOM_AVAILABILITY_REQUEST'
    });
    
    // PASO 0: Validar parámetros de entrada
    if (!type || !checkIn || !checkOut) {
      const errorMessage = 'Faltan parámetros obligatorios: type, checkIn o checkOut';
      logger.error(`[${timestamp}] Error en parámetros de entrada`, {
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
      logger.error(`[${timestamp}] Error en validación de fechas`, {
        checkIn: checkInDate,
        checkOut: checkOutDate
      });
      return res.status(400).json({
        message: errorMessage,
        timestamp
      });
    }

    logger.info(`[${timestamp}] Parámetros recibidos`, {
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
      // Verificar si la reserva realmente se solapa con la fecha específica solicitada
      const reservationStart = new Date(reservation.checkIn);
      const reservationEnd = new Date(reservation.checkOut);
      
      // Verificar si la fecha solicitada se solapa con esta reserva
      // Una fecha no se solapa si:
      // 1. La fecha de salida de la reserva es igual a la fecha de entrada solicitada (el cliente sale ese día)
      // 2. La fecha de entrada de la reserva es igual a la fecha de salida solicitada (el cliente entra ese día)
      const isCheckoutDay = reservationEnd.getTime() === checkInDate.getTime();
      const isCheckinDay = reservationStart.getTime() === checkOutDate.getTime();
      
      if (isCheckoutDay || isCheckinDay) {
        // Esta reserva no afecta realmente a la disponibilidad para esta fecha específica
        logger.debug(`[${timestamp}] Reserva no afecta disponibilidad`, {
          id: reservation._id,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          reason: isCheckoutDay ? 'Es día de checkout' : 'Es día de checkin'
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
          logger.debug(`[${timestamp}] Habitación ocupada por reserva`, { 
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
    
    // Siempre mostrar habitaciones físicamente disponibles
    const reallyAvailable = Math.max(0, physicallyAvailable - virtualReservationsCount);

    logger.info(`[${timestamp}] Cálculo final`, {
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

    // Añadir logs adicionales para depuración
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

// 🧹 GESTIÓN DE LIMPIEZA - Nuevos endpoints para workflow completo

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
    console.error('Error obteniendo habitaciones en limpieza:', error);
    res.status(500).json({ 
      message: 'Error al obtener habitaciones en limpieza', 
      error: error.message 
    });
  }
};

// PUT /api/rooms/:id/mark-clean - Marcar habitación como disponible después de limpieza
exports.markRoomAsClean = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    // 🔍 Validar estado actual antes de proceder
    const currentRoom = await Room.findById(roomId);
    if (!currentRoom) {
      return res.status(404).json({ message: 'Habitación no encontrada' });
    }
    
    // Validar transición limpieza → disponible
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
      message: `Habitación #${room.number} marcada como disponible`,
      room
    });
  } catch (error) {
    console.error('Error marcando habitación como limpia:', error);
    res.status(400).json({ 
      message: error.message || 'Error al marcar habitación como limpia'
    });
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
    
    // Emitir evento WebSocket para cada habitación
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
    console.error('Error marcando habitaciones como limpias:', error);
    res.status(400).json({ 
      message: error.message || 'Error al marcar habitaciones como limpias'
    });
  }
};

// GET /api/rooms/:id/allowed-states - Obtener estados permitidos para una habitación
exports.getRoomAllowedStates = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Habitación no encontrada' });
    }
    
    const allowedStates = getAllowedStates(room.status, 'room');
    
    res.json({
      currentState: room.status,
      allowedStates,
      roomNumber: room.number
    });
  } catch (error) {
    console.error('Error obteniendo estados permitidos:', error);
    res.status(500).json({ 
      message: 'Error al obtener estados permitidos', 
      error: error.message 
    });
  }
};

// Automatización de estados de habitaciones
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

    console.log('Estados de habitaciones actualizados automáticamente.');
  } catch (error) {
    console.error('Error actualizando estados de habitaciones:', error);
  }
};

// Actualizar lógica para calcular estados diarios
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
