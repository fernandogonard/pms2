// services/roomAssignmentService.js
// Servicio para asignación automática de habitaciones

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { logger } = require('./loggerService');
const { 
  validateReservationStateTransition, 
  validateReservationBusinessRules 
} = require('./stateValidationService');

/**
 * Asigna habitaciones automáticamente a una reserva
 * @param {Object} reservation - La reserva a la que asignar habitaciones
 * @returns {Promise<Array>} - Array de habitaciones asignadas
 */
async function assignRoomsToReservation(reservation, options = {}) {
  try {
    logger.info(`🏠 Intentando asignar ${reservation.cantidad || 1} habitaciones tipo ${reservation.tipo} para reserva ${reservation._id}`);
    
    // Si ya tiene habitaciones asignadas, no hacer nada
    if (reservation.room && reservation.room.length > 0) {
      logger.info(`   ✅ Reserva ya tiene ${reservation.room.length} habitaciones asignadas`);
      return reservation.room;
    }

    const { session } = options;
    const cantidadNeeded = reservation.cantidad || 1;
    
    // Buscar habitaciones disponibles del tipo correcto
    const roomQuery = Room.find({
      type: reservation.tipo,
      status: 'disponible' // Solo habitaciones disponibles
    });
    if (session) roomQuery.session(session);
    const availableRooms = await roomQuery.sort({ number: 1 }); // Ordenar por número para consistencia

    if (availableRooms.length === 0) {
      logger.info(`   ❌ No hay habitaciones ${reservation.tipo} disponibles para asignar`);
      return [];
    }

    // Verificar que no estén ocupadas por otras reservas en las fechas de esta reserva
    const roomsToAssign = [];
    const checkInDate = new Date(reservation.checkIn);
    const checkOutDate = new Date(reservation.checkOut);

    for (const room of availableRooms) {
      if (roomsToAssign.length >= cantidadNeeded) break;

      // Verificar si esta habitación tiene conflictos con otras reservas
      const conflictQuery = Reservation.findOne({
        _id: { $ne: reservation._id }, // Excluir la reserva actual
        room: room._id,
        status: { $in: ['reservada', 'checkin'] },
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate }
      });
      if (session) conflictQuery.session(session);
      const conflictingReservation = await conflictQuery;

      if (!conflictingReservation) {
        roomsToAssign.push(room._id);
        logger.info(`   ✅ Habitación #${room.number} seleccionada para asignación`);
      } else {
        logger.info(`   ⚠️ Habitación #${room.number} tiene conflicto con reserva ${conflictingReservation._id}`);
      }
    }

    if (roomsToAssign.length < cantidadNeeded) {
      logger.info(`   ⚠️ Solo se pudieron asignar ${roomsToAssign.length} de ${cantidadNeeded} habitaciones solicitadas`);
    }

    // Asignar las habitaciones a la reserva
    if (roomsToAssign.length > 0) {
      reservation.room = roomsToAssign;
      const reservationSaveOptions = session ? { session } : undefined;
      await reservation.save(reservationSaveOptions);

      // Marcar habitaciones como ocupadas si la reserva está en checkin
      if (reservation.status === 'checkin') {
        for (const roomId of roomsToAssign) {
          const updateOptions = session ? { session } : undefined;
          await Room.findByIdAndUpdate(roomId, { status: 'ocupada' }, updateOptions);
          let roomQueryById = Room.findById(roomId);
          if (session) roomQueryById = roomQueryById.session(session);
          const room = await roomQueryById;
          logger.info(`   🔒 Habitación #${room.number} marcada como ocupada`);
        }
      }

      logger.info(`   ✅ Asignadas ${roomsToAssign.length} habitaciones a la reserva`);
    }

    return roomsToAssign;

  } catch (error) {
    logger.error('❌ Error en asignación de habitaciones:', error);
    return [];
  }
}

/**
 * Procesa el check-in asignando habitaciones si no las tiene
 * @param {String} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Reserva actualizada
 */
async function processCheckin(reservationId, options = {}) {
  try {
    const { session } = options;
    const reservationQuery = Reservation.findById(reservationId);
    if (session) reservationQuery.session(session);
    const reservation = await reservationQuery;

    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    logger.info(`🏨 Procesando check-in para reserva ${reservationId}`);

    // Si no tiene habitaciones asignadas, intentar asignar
    if (!reservation.room || reservation.room.length === 0) {
      logger.info('Reserva virtual detectada, asignando habitaciones...');
      await assignRoomsToReservation(reservation, { session });
    }

    // 🔄 Validar transición de estado antes del check-in
    const transitionValidation = validateReservationStateTransition(reservation.status, 'checkin');
    if (!transitionValidation.valid) {
      throw new Error(`Check-in no permitido: ${transitionValidation.message}`);
    }
    
    const businessRulesValidation = validateReservationBusinessRules(reservation, 'checkin');
    if (!businessRulesValidation.valid) {
      throw new Error(`Check-in no permitido: ${businessRulesValidation.message}`);
    }
    
    // Actualizar estado a checkin
    logger.info(`🔄 Reserva ${reservation._id}: ${reservation.status} → checkin`);
    reservation.status = 'checkin';
    const saveOptions = session ? { session } : undefined;
    await reservation.save(saveOptions);

    // Marcar habitaciones como ocupadas
    if (reservation.room && reservation.room.length > 0) {
      for (const roomId of reservation.room) {
        const updateOptions = session ? { session } : undefined;
        await Room.findByIdAndUpdate(roomId, { status: 'ocupada' }, updateOptions);
        let roomQuery = Room.findById(roomId);
        if (session) roomQuery = roomQuery.session(session);
        const room = await roomQuery;
        logger.info(`   🔒 Habitación #${room.number} marcada como ocupada en check-in`);
      }
    }

    const finalQuery = Reservation.findById(reservationId).populate('room client');
    if (session) finalQuery.session(session);
    return await finalQuery;

  } catch (error) {
    logger.error('❌ Error en proceso de check-in:', error);
    throw error;
  }
}

/**
 * Procesa el check-out liberando habitaciones
 * @param {String} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Reserva actualizada
 */
async function processCheckout(reservationId, options = {}) {
  try {
    const { session } = options;
    const reservationQuery = Reservation.findById(reservationId);
    if (session) reservationQuery.session(session);
    const reservation = await reservationQuery;

    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    logger.info(`🚪 Procesando check-out para reserva ${reservationId}`);

    // 🔄 Validar transición de estado ANTES de tocar habitaciones
    const transitionValidation = validateReservationStateTransition(reservation.status, 'checkout');
    if (!transitionValidation.valid) {
      throw new Error(`Check-out no permitido: ${transitionValidation.message}`);
    }
    
    const businessRulesValidation = validateReservationBusinessRules(reservation, 'checkout');
    if (!businessRulesValidation.valid) {
      throw new Error(`Check-out no permitido: ${businessRulesValidation.message}`);
    }

    // Actualizar estado a checkout PRIMERO (si falla, rooms intactas)
    logger.info(`🔄 Reserva ${reservation._id}: ${reservation.status} → checkout`);
    reservation.status = 'checkout';
    const saveOptions = session ? { session } : undefined;
    await reservation.save(saveOptions);

    // 🧹 WORKFLOW COMPLETO: checkout → limpieza → disponible (solo si save exitoso)
    if (reservation.room && reservation.room.length > 0) {
      for (const roomId of reservation.room) {
        const updateOptions = session ? { session } : undefined;
        await Room.findByIdAndUpdate(roomId, {
          status: 'limpieza',
          pendingHousekeeping: 'limpieza_checkout',
          pendingHousekeepingAt: new Date()
        }, updateOptions);
        let roomQuery = Room.findById(roomId);
        if (session) roomQuery = roomQuery.session(session);
        const room = await roomQuery;
        logger.info(`   🧹 Habitación #${room.number} marcada para LIMPIEZA en check-out`);
      }
    }

    const finalQuery = Reservation.findById(reservationId).populate('room client');
    if (session) finalQuery.session(session);
    return await finalQuery;

  } catch (error) {
    logger.error('❌ Error en proceso de check-out:', error);
    throw error;
  }
}

/**
 * Marca una habitación como disponible después de la limpieza
 * @param {String} roomId - ID de la habitación
 * @returns {Promise<Object>} - Habitación actualizada
 */
async function markRoomAsClean(roomId) {
  try {
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Habitación no encontrada');
    }

    if (room.status !== 'limpieza') {
      throw new Error(`La habitación #${room.number} debe estar en estado 'limpieza' para marcarla como disponible`);
    }

    room.status = 'disponible';
    room.lastCleaning = new Date();
    room.pendingHousekeeping = null;
    room.pendingHousekeepingAt = null;
    await room.save();

    logger.info(`✨ Habitación #${room.number} marcada como DISPONIBLE después de limpieza`);
    return room;

  } catch (error) {
    logger.error('❌ Error marcando habitación como limpia:', error);
    throw error;
  }
}

/**
 * Marca múltiples habitaciones como disponibles después de la limpieza
 * @param {Array<String>} roomIds - IDs de las habitaciones
 * @returns {Promise<Array>} - Habitaciones actualizadas
 */
async function markRoomsAsClean(roomIds) {
  try {
    const results = [];
    for (const roomId of roomIds) {
      const room = await markRoomAsClean(roomId);
      results.push(room);
    }
    return results;
  } catch (error) {
    logger.error('❌ Error marcando habitaciones como limpias:', error);
    throw error;
  }
}

/**
 * Obtiene todas las habitaciones en estado de limpieza
 * @returns {Promise<Array>} - Habitaciones en limpieza
 */
async function getRoomsInCleaning() {
  try {
    const rooms = await Room.find({ status: 'limpieza' }).sort({ number: 1 });
    return rooms;
  } catch (error) {
    logger.error('❌ Error obteniendo habitaciones en limpieza:', error);
    throw error;
  }
}

module.exports = {
  assignRoomsToReservation,
  processCheckin,
  processCheckout,
  markRoomAsClean,
  markRoomsAsClean,
  getRoomsInCleaning
};