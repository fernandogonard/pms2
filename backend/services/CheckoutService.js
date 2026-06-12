// services/CheckoutService.js
// Servicio para gestionar checkouts diarios y transiciones de estado

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { logger } = require('./loggerService');
const { BUSINESS_CONFIG, HOUSEKEEPING_CONFIG } = require('../constants/businessConstants');

/**
 * Marca las habitaciones con checkout HOY (a partir de las 7 AM)
 * Se ejecuta automáticamente cada mañana a las 7:00 AM
 */
async function markRoomsWithCheckoutToday() {
  try {
    logger.info('🌅 Iniciando marcado de checkouts para hoy...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Buscar todas las reservas activas con checkout hoy
    const checkoutsToday = await Reservation.find({
      status: 'checkin',
      checkOut: {
        $gte: today,
        $lt: tomorrow
      }
    })
      .populate('room', '_id number')
      .populate('client', 'nombre apellido')
      .lean();

    logger.info(`📋 Se encontraron ${checkoutsToday.length} checkouts para hoy`);

    const checkoutTime = new Date(today);
    const [hours, minutes] = BUSINESS_CONFIG.CHECKOUT_TIME.split(':');
    checkoutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    let updatedCount = 0;

    for (const reservation of checkoutsToday) {
      if (!reservation.room || reservation.room.length === 0) {
        logger.warn(`⚠️ Reserva ${reservation._id} no tiene habitaciones asociadas`);
        continue;
      }

      for (const room of reservation.room) {
        const roomId = room._id || room;

        // Actualizar datos de checkout
        const update = {
          checkoutToday: true,
          checkoutInfo: {
            reservationId: reservation._id,
            guestName: `${reservation.client?.nombre || ''} ${reservation.client?.apellido || ''}`.trim(),
            checkoutTime: checkoutTime.toISOString(),
            checkoutDate: today.toISOString().split('T')[0],
            nightsStayed: Math.ceil(
              (new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24)
            ),
            totalAmount: reservation.pricing?.total || 0,
            amountPaid: reservation.payment?.amountPaid || 0,
            isPaid: (reservation.payment?.amountPaid || 0) >= (reservation.pricing?.total || 0),
            daysOverdue: 0
          }
        };

        await Room.findByIdAndUpdate(roomId, update);
        updatedCount++;

        logger.info(`✅ Hab. #${room.number || roomId}: checkout marcado para hoy`);
      }
    }

    logger.info(`🎯 ${updatedCount} habitaciones marcadas con checkout hoy`);
    return { success: true, marked: updatedCount };

  } catch (error) {
    logger.error('❌ Error marcando checkouts del día:', error);
    throw error;
  }
}

/**
 * Limpia el flag checkoutToday al final del día (después de las 23:00)
 * Se ejecuta automáticamente cada noche
 */
async function clearCheckoutTodayFlag() {
  try {
    logger.info('🌙 Limpiando flags de checkout...');

    const result = await Room.updateMany(
      { checkoutToday: true },
      {
        checkoutToday: false,
        checkoutInfo: null
      }
    );

    logger.info(`🧹 ${result.modifiedCount} habitaciones limpiadas`);
    return { success: true, cleared: result.modifiedCount };

  } catch (error) {
    logger.error('❌ Error limpiando flags de checkout:', error);
    throw error;
  }
}

/**
 * Obtiene todas las habitaciones con checkout hoy
 */
async function getCheckoutsToday() {
  try {
    const rooms = await Room.find({
      checkoutToday: true,
      status: 'ocupada'
    })
      .lean()
      .sort({ number: 1 });

    return rooms;

  } catch (error) {
    logger.error('❌ Error obteniendo checkouts hoy:', error);
    throw error;
  }
}

/**
 * Asigna limpieza a una habitación
 * @param {String} roomId - ID de la habitación
 * @param {String} assignedTo - Nombre/ID del limpiador
 * @param {String} housekeepingType - Tipo de limpieza (repaso, limpieza_profunda, limpieza_checkout)
 */
async function assignCleaning(roomId, assignedTo, housekeepingType = 'limpieza_checkout') {
  try {
    const room = await Room.findById(roomId);

    if (!room) {
      throw new Error('Habitación no encontrada');
    }

    const cleaningConfig = HOUSEKEEPING_CONFIG[housekeepingType];
    const duration = cleaningConfig?.duration || 40;

    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 60000);

    const update = {
      pendingHousekeeping: housekeepingType,
      pendingHousekeepingAt: now,
      housekeepingAssignment: {
        assignedTo,
        assignedAt: now,
        estimatedDurationMinutes: duration,
        status: 'asignada'
      }
    };

    const updated = await Room.findByIdAndUpdate(roomId, update, { new: true });

    logger.info(`📌 Limpieza asignada a Hab. #${room.number} (${cleaningConfig.label})`);
    logger.info(`   Asignado a: ${assignedTo}, Duración: ${duration} min`);

    return updated;

  } catch (error) {
    logger.error('❌ Error asignando limpieza:', error);
    throw error;
  }
}

/**
 * Marca una limpieza como en progreso
 */
async function startCleaning(roomId) {
  try {
    const now = new Date();

    const updated = await Room.findByIdAndUpdate(
      roomId,
      {
        status: 'limpieza',
        'housekeepingAssignment.status': 'en_progreso',
        'housekeepingAssignment.startTime': now
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Habitación no encontrada');
    }

    logger.info(`🧹 Limpieza iniciada - Hab. #${updated.number}`);
    return updated;

  } catch (error) {
    logger.error('❌ Error iniciando limpieza:', error);
    throw error;
  }
}

/**
 * Marca una limpieza como completada
 */
async function completeCleaning(roomId, notes = '') {
  try {
    const now = new Date();

    const updated = await Room.findByIdAndUpdate(
      roomId,
      {
        status: 'disponible',
        pendingHousekeeping: null,
        pendingHousekeepingAt: null,
        lastCleaning: now,
        checkoutToday: false,
        'housekeepingAssignment.status': 'completada',
        'housekeepingAssignment.endTime': now,
        'housekeepingAssignment.notes': notes
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Habitación no encontrada');
    }

    logger.info(`✨ Limpieza completada - Hab. #${updated.number}`);
    return updated;

  } catch (error) {
    logger.error('❌ Error completando limpieza:', error);
    throw error;
  }
}

/**
 * Cancela una limpieza asignada
 */
async function cancelCleaning(roomId, reason = '') {
  try {
    const updated = await Room.findByIdAndUpdate(
      roomId,
      {
        pendingHousekeeping: null,
        pendingHousekeepingAt: null,
        'housekeepingAssignment.status': 'cancelada',
        'housekeepingAssignment.notes': reason
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Habitación no encontrada');
    }

    logger.info(`❌ Limpieza cancelada - Hab. #${updated.number}`);
    return updated;

  } catch (error) {
    logger.error('❌ Error cancelando limpieza:', error);
    throw error;
  }
}

/**
 * Obtiene todas las limpiezas pendientes (filtrable por estado)
 */
async function getPendingCleanings(status = null) {
  try {
    const query = {
      status: 'limpieza'
    };

    if (status && status !== 'todos') {
      query['housekeepingAssignment.status'] = status;
    }

    const rooms = await Room.find(query)
      .sort({ 'housekeepingAssignment.assignedAt': 1 })
      .lean();

    return rooms;

  } catch (error) {
    logger.error('❌ Error obteniendo limpiezas pendientes:', error);
    throw error;
  }
}

module.exports = {
  markRoomsWithCheckoutToday,
  clearCheckoutTodayFlag,
  getCheckoutsToday,
  assignCleaning,
  startCleaning,
  completeCleaning,
  cancelCleaning,
  getPendingCleanings
};
