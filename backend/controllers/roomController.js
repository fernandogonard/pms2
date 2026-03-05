// Estado real de habitaciones (centralizado)
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ErrorHandlingService = require('../services/errorHandlingService');
const { 
  validateRoomStateTransition, 
  validateRoomBusinessRules,
  getAllowedStates 
} = require('../services/stateValidationService');

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');


// 🆕 GET /api/rooms/status con logging avanzado
exports.getRoomsStatus = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const startTime = Date.now();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const startQuery = req.query.start; // opcional YYYY-MM-DD
    const days = parseInt(req.query.days, 10) || 14;

    // 📝 Log de acceso al estado de habitaciones
    logger.audit.userAction(
      'VIEW_ROOMS_STATUS',
      req.user?.id || 'anonymous',
      'room',
      null,
      { startDate: startQuery, days, ip: req.ip }
    );
    
    // Crear fecha sin problemas de zona horaria
    let startDate;
    if (startQuery) {
      // Crear fecha desde string YYYY-MM-DD sin conversión de zona horaria
      const [year, month, day] = startQuery.split('-').map(Number);
      startDate = new Date(year, month - 1, day); // mes es 0-indexed
    } else {
      startDate = new Date();
    }
    startDate.setHours(0, 0, 0, 0);

    // Obtener habitaciones ordenadas por número
    const rooms = await Room.find().sort({ number: 1 }).lean();
    
    // Obtener reservas activas que intersectan el período
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    
    const reservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      checkOut: { $gt: startDate },
      checkIn: { $lt: endDate }
    }).populate('user').lean();

    // Generar rango de fechas
    const dateRange = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    // Agrupar habitaciones por tipo
    const roomsByType = {};
    rooms.forEach(room => {
      if (!roomsByType[room.type]) {
        roomsByType[room.type] = [];
      }
      roomsByType[room.type].push(room);
    });

    // Calcular reservas virtuales y reales por tipo y fecha
    const virtualReservationsByTypeAndDate = {};
    const realReservationsByRoomAndDate = {};
    const assignments = {};

    reservations.forEach(reservation => {
      assignments[reservation._id] = reservation.room || [];
      
      if (!reservation.checkIn || !reservation.checkOut) return;
      
      const checkIn = reservation.checkIn.toISOString().split('T')[0];
      const checkOut = reservation.checkOut.toISOString().split('T')[0];
      
      // Generar fechas de la reserva (excluyendo checkout)
      const reservationDates = [];
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateRange.includes(dateStr)) {
          reservationDates.push(dateStr);
        }
      }

      // Si tiene habitaciones asignadas, es una reserva real
      if (reservation.room && reservation.room.length > 0) {
        reservation.room.forEach(roomId => {
          reservationDates.forEach(date => {
            if (!realReservationsByRoomAndDate[roomId]) {
              realReservationsByRoomAndDate[roomId] = {};
            }
            realReservationsByRoomAndDate[roomId][date] = reservation;
          });
        });
      } else {
        // Es una reserva virtual
        const cantidad = reservation.cantidad || 1;
        reservationDates.forEach(date => {
          if (!virtualReservationsByTypeAndDate[reservation.tipo]) {
            virtualReservationsByTypeAndDate[reservation.tipo] = {};
          }
          if (!virtualReservationsByTypeAndDate[reservation.tipo][date]) {
            virtualReservationsByTypeAndDate[reservation.tipo][date] = 0;
          }
          virtualReservationsByTypeAndDate[reservation.tipo][date] += cantidad;
        });
      }
    });

    // 🚫 NO SOBREVENTA: Solo mostrar reservas que caben en habitaciones disponibles
    // Recalcular reservas virtuales limitándolas a la capacidad real
    const adjustedVirtualReservations = {};
    Object.keys(virtualReservationsByTypeAndDate).forEach(tipo => {
      const availableRooms = roomsByType[tipo] ? roomsByType[tipo].length : 0;
      adjustedVirtualReservations[tipo] = {};
      
      Object.keys(virtualReservationsByTypeAndDate[tipo]).forEach(date => {
        const virtualCount = virtualReservationsByTypeAndDate[tipo][date];
        
        // Contar habitaciones reales ocupadas de este tipo en esta fecha
        const realOccupied = roomsByType[tipo] ? roomsByType[tipo].filter(room => 
          realReservationsByRoomAndDate[room._id] && 
          realReservationsByRoomAndDate[room._id][date]
        ).length : 0;
        
        // Contar habitaciones en mantenimiento o limpieza (limpieza solo para HOY)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateObj = new Date(date);
        dateObj.setHours(0, 0, 0, 0);
        
        const unavailable = roomsByType[tipo] ? roomsByType[tipo].filter(room => {
          if (room.status === 'mantenimiento') return true;
          if (room.status === 'limpieza' && dateObj.getTime() === today.getTime()) return true;
          return false;
        }).length : 0;
        
        const availableForVirtual = Math.max(0, availableRooms - realOccupied - unavailable);
        
        // Limitar reservas virtuales a la capacidad real disponible
        adjustedVirtualReservations[tipo][date] = Math.min(virtualCount, availableForVirtual);
        
        // Log de advertencia si había sobreventa (no debería ocurrir con validación)
        if (virtualCount > availableForVirtual) {
          logger.security.anomaly(`Sobreventa detectada`, {
            service: 'crm-hotelero',
            endpoint: '/api/rooms/status',
            anomalyType: 'OVERBOOKING_DETECTED',
            roomType: tipo,
            date,
            virtualRequested: virtualCount,
            availableRooms: availableForVirtual,
            severity: 'HIGH'
          });
        }
      });
    });

    // Ajustar lógica para evitar exclusión de habitaciones disponibles
    const roomsWithCalendar = rooms.map(room => {
      const calendar = {};
      dateRange.forEach(date => {
        // PRIORIDAD ABSOLUTA para mantenimiento - afecta todos los días
        if (room.status === 'mantenimiento') {
          calendar[date] = 'mantenimiento';
          logger.info(`Habitación en mantenimiento`, {
            service: 'crm-hotelero',
            roomNumber: room.number,
            status: 'MAINTENANCE',
            date,
            event: 'ROOM_STATUS_CHECK'
          });
          return;
        }
        
        // LIMPIEZA: solo afecta el día ACTUAL, no días futuros
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Crear fecha del calendario sin problemas de zona horaria
        const [year, month, day] = date.split('-').map(Number);
        const currentDate = new Date(year, month - 1, day);
        currentDate.setHours(0, 0, 0, 0);
        
        if (room.status === 'limpieza' && currentDate.getTime() === today.getTime()) {
          calendar[date] = 'limpieza';
          logger.info(`Habitación en limpieza hoy`, {
            service: 'crm-hotelero',
            roomNumber: room.number,
            status: 'CLEANING_TODAY',
            date,
            event: 'ROOM_STATUS_CHECK'
          });
          return;
        } else if (room.status === 'limpieza' && currentDate.getTime() !== today.getTime()) {
          logger.info(`Habitación limpieza diferida - disponible`, {
            service: 'crm-hotelero',
            roomNumber: room.number,
            status: 'CLEANING_NOT_TODAY',
            date,
            available: true,
            event: 'ROOM_STATUS_CHECK'
          });
          // Continuar con la lógica normal para otros días
        }

        // Solo después verificar reservas reales
        if (realReservationsByRoomAndDate[room._id] && realReservationsByRoomAndDate[room._id][date]) {
          calendar[date] = 'ocupada';
          return;
        }

        // Reservas virtuales
        const virtualCount = adjustedVirtualReservations[room.type]?.[date] || 0;
        if (virtualCount > 0) {
          const roomsOfSameType = roomsByType[room.type].sort((a, b) => a.number - b.number);
          const roomIndex = roomsOfSameType.findIndex(r => r._id.toString() === room._id.toString());
          let assignedVirtual = 0;

          for (let i = 0; i < roomsOfSameType.length; i++) {
            const r = roomsOfSameType[i];
            if (realReservationsByRoomAndDate[r._id]?.[date]) continue;
            // Saltear mantenimiento siempre, limpieza solo HOY
            if (r.status === 'mantenimiento') continue;
            if (r.status === 'limpieza' && currentDate.getTime() === today.getTime()) continue;
            if (i < roomIndex) assignedVirtual++;
          }

          if (assignedVirtual < virtualCount) {
            calendar[date] = 'ocupada_virtual';
          } else {
            calendar[date] = 'disponible';
          }
        } else {
          calendar[date] = 'disponible';
        }
      });
      return {
        ...room,
        calendar
      };
    });

    res.json({
      rooms: roomsWithCalendar,
      dateRange,
      assignments,
      summary: {
        virtualReservations: adjustedVirtualReservations,
        realReservations: Object.keys(realReservationsByRoomAndDate).length,
        policy: 'NO_SOBREVENTA'
      }
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
    const rooms = await Room.find();
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
    const { ValidationService } = require('../services/validationService');
    const validation = ValidationService.validateRequired(req.query, ['type', 'checkIn', 'checkOut']);
    
    // Log de entrada con timestamp
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] Consulta disponibilidad NUEVA`, {
      type, checkIn, checkOut, cantidad,
      event: 'ROOM_AVAILABILITY_REQUEST'
    });
    
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Faltan parámetros requeridos',
        missingFields: validation.missing,
        timestamp 
      });
    }
    
    // Validar rango de fechas
    if (!ValidationService.validateDateRange(checkIn, checkOut)) {
      return res.status(400).json({
        message: 'Rango de fechas inválido',
        timestamp
      });
    }

    // Crear fechas usando DateService
    const DateService = require('../services/dateService');
    const checkInDate = DateService.parseDate(checkIn);
    const checkOutDate = DateService.parseDate(checkOut);

    // PASO 1: Obtener TODAS las habitaciones del tipo solicitado
    const allRooms = await Room.find({ type }).sort({ number: 1 }).lean();
    
    logger.info(`[${timestamp}] Habitaciones totales encontradas`, {
      type, count: allRooms.length,
      rooms: allRooms.map(r => `#${r.number}(${r.status})`)
    });

    // PASO 2: Buscar reservas que se solapan
    // Corregir la consulta para detectar correctamente solapamientos
    const overlappingReservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      // La reserva comienza antes o durante el período solicitado
      checkIn: { $lt: checkOutDate },
      // Y termina después del inicio del período solicitado
      checkOut: { $gt: checkInDate }
    }).populate('room').lean();

    logger.info(`[${timestamp}] Reservas solapantes`, { 
      count: overlappingReservations.length,
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString()
    });

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
