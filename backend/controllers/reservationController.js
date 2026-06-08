// controllers/reservationController.js
// Controlador para gestión de reservas

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const { assignRoomsToReservation, processCheckin, processCheckout } = require('../services/roomAssignmentService');
const BillingService = require('../services/billingService');
const ReservationService = require('../services/ReservationService');
const AvailabilityEngine = require('../services/availabilityEngine');
const wsManager = require('../utils/wsManager');
const notificationService = require('../services/notificationService');

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');
const lockService = require('../services/lockService');
const auditService = require('../services/auditService');

/**
 * Obtiene las reservas con checkout pendiente (que deberían haber terminado pero siguen activas)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getPendingCheckouts = async (req, res) => {
  const startTime = Date.now();
  try {
    // Obtener la fecha de hoy y ayer
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Log de la consulta
    logger.info('Buscando reservas con checkout pendiente', {
      today: today.toISOString().slice(0, 10),
      yesterday: yesterday.toISOString().slice(0, 10),
      user: req.user?.userId
    });

    // Buscar reservas que:
    // 1. Estén en estado 'checkin' (huésped ya hizo check-in)
    // 2. Su fecha de checkout sea hoy o anterior
    // 3. No hayan hecho checkout todavía
    const pendingReservations = await Reservation.find({
      status: 'checkin',
      checkOut: { $lte: today } // Checkout hoy o anterior
    })
    .populate('client', 'nombre apellido email dni')
    .populate('room', 'number type floor')
    .sort({ checkOut: 1 })
    .lean();

    // Calcular días de retraso para cada reserva
    const reservationsWithDelay = pendingReservations.map(reservation => {
      const checkoutDate = new Date(reservation.checkOut);
      const diffTime = today.getTime() - checkoutDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...reservation,
        daysOverdue: diffDays,
        expectedCheckout: checkoutDate.toISOString().slice(0, 10)
      };
    });

    const duration = Date.now() - startTime;
    logger.performance.requestTime(
      req.method,
      req.originalUrl,
      duration,
      200,
      req.user?.userId
    );

    res.json({
      success: true,
      count: reservationsWithDelay.length,
      reservations: reservationsWithDelay,
      message: reservationsWithDelay.length > 0 
        ? `${reservationsWithDelay.length} reservas con checkout pendiente encontradas`
        : 'No hay reservas con checkout pendiente'
    });

  } catch (error) {
    logger.error('Error obteniendo reservas con checkout pendiente:', {
      error: error.message,
      stack: error.stack,
      user: req.user?.userId,
      duration: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      message: 'Error al obtener reservas con checkout pendiente',
      error: error.message
    });
  }
};

// Crear reserva — delega toda la lógica de negocio a ReservationService
const createReservation = async (req, res) => {
  const txSupported = req.app.get('txSupported');
  const session = await mongoose.startSession();
  if (txSupported) session.startTransaction();
  const startTime = Date.now();
  const { tipo, cantidad, checkIn, checkOut } = req.body;
  const lockKey = `reservation-type:${tipo || 'unknown'}`;

  let user = undefined;
  if (req.user && req.user.userId) {
    user = req.user.userId;
  }
  if (user && !mongoose.Types.ObjectId.isValid(user)) {
    user = undefined;
  }

  logger.audit.userAction(
    'CREATE_RESERVATION_ATTEMPT',
    user || 'anonymous',
    'reservation',
    null,
    { tipo, cantidad, checkIn, checkOut, email: req.body.email, ip: req.ip }
  );

  try {
    let result;
    await lockService.withLock(lockKey, 15000, async () => {
      const isStaff = req.user?.role && ['admin', 'recepcionista'].includes(req.user.role);

      result = await ReservationService.createReservation(req.body, {
        session: txSupported ? session : undefined,
        userId: user,
        isStaff
      });

      // Broadcast WebSocket
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(wsclient => {
          if (wsclient.readyState === 1) {
            wsclient.send(JSON.stringify({ type: 'reservation_created', reservation: result }));
          }
        });
      }

      if (txSupported) await session.commitTransaction();
    });

    const duration = Date.now() - startTime;
    logger.audit.userAction(
      'CREATE_RESERVATION_SUCCESS',
      user || 'anonymous',
      'reservation',
      result?._id?.toString(),
      { tipo, cantidad, checkIn, checkOut, totalPrice: result?.pricing?.total, roomsAssigned: result?.room?.length || 0, duration }
    );
    logger.performance.requestTime(req.method, req.originalUrl, duration, 201, user);

    // Email confirmación — no bloquea la respuesta
    setImmediate(async () => {
      try {
        const emailService = require('../services/emailService');
        const Reservation = require('../models/Reservation');
        const populated = await Reservation.findById(result._id).populate('client', 'nombre apellido email');
        if (populated?.client?.email) {
          await emailService.sendReservationConfirmation({ reservation: populated, client: populated.client });
        }
      } catch (e) { logger.warn('Error enviando email confirmación reserva:', e.message); }
    });

    return res.status(201).json(result);
  } catch (error) {
    if (txSupported) await session.abortTransaction().catch(() => {});

    if (error && error.name === 'LockBusyError') {
      logger.warn('createReservation lock busy', { tipo, userId: user, ip: req.ip });
      return res.status(423).json({ message: 'Otra operación está creando una reserva del mismo tipo. Intenta nuevamente en unos segundos.' });
    }

    const duration = Date.now() - startTime;
    logger.error('Error al crear reserva', error, {
      userId: user,
      requestData: { tipo, cantidad, checkIn, checkOut, email: req.body.email },
      ip: req.ip,
      duration
    });

    const statusCode = error.statusCode || 500;
    const payload = { message: error.message || 'Error al crear reserva.' };
    if (error.details) payload.details = error.details;

    logger.performance.requestTime(req.method, req.originalUrl, duration, statusCode, user);
    return res.status(statusCode).json(payload);
  } finally {
    session.endSession();
  }
};

// 🆕 Obtener todas las reservas con logging avanzado (admin y recepcionista)
const getReservations = async (req, res) => {
  const startTime = Date.now();
  try {
    // 📝 Log de acceso a reservas
    logger.audit.userAction(
      'VIEW_ALL_RESERVATIONS',
      req.user.id,
      'reservation',
      null,
      { role: req.user.role, ip: req.ip }
    );

    // Paginación + filtros
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Filtro por status
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    // Filtro por rango de fechas
    if (req.query.from) {
      filter.checkIn = { ...filter.checkIn, $gte: new Date(req.query.from + 'T00:00:00Z') };
    }
    if (req.query.to) {
      filter.checkOut = { ...filter.checkOut, $lte: new Date(req.query.to + 'T23:59:59Z') };
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('room', 'number type floor')
        .populate('client', 'nombre apellido email dni whatsapp')
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter)
    ]);

    // Log de performance para queries lentas
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logger.performance.slowOperation('GET_RESERVATIONS_QUERY', duration, {
        reservationCount: reservations.length,
        userId: req.user.id
      });
    }

    logger.performance.requestTime(req.method, req.originalUrl, duration, 200, req.user.id);

    res.json({
      success: true,
      data: reservations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error al obtener reservas', error, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration
    });

    logger.performance.requestTime(req.method, req.originalUrl, duration, 500, req.user.id);

    res.status(500).json({ success: false, message: 'Error al obtener reservas.' });
  }
};

// Obtener reservas del usuario logueado (cliente)
const getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.user.userId })
      .populate('room', 'number type floor')
      .populate('client', 'nombre apellido email dni whatsapp');
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tus reservas.', error });
  }
};

// Actualizar reserva (admin, recepcionista, cliente)
const updateReservation = async (req, res) => {
  try {
    // 🔐 VALIDACIÓN DE AUTORIZACIÓN
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }
    
    // Verificar permisos: admin/recepcionista o propietario de la reserva
    const isAdminOrReceptionist = ['admin', 'recepcionista'].includes(req.user.role);
    const isOwner = reservation.user && reservation.user.toString() === req.user.userId;
    
    if (!isAdminOrReceptionist && !isOwner) {
      return res.status(403).json({ 
        message: 'No tienes permisos para modificar esta reserva.' 
      });
    }

    // 🔒 WHITELIST de campos editables — nunca pasar req.body directo
    const ALLOWED_FIELDS = ['checkIn', 'checkOut', 'notas', 'nombre', 'apellido', 'dni', 'email', 'whatsapp'];
    const ADMIN_FIELDS = ['tipo', 'cantidad']; // solo admin/recepcionista
    const updates = {};

    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (isAdminOrReceptionist) {
      for (const field of ADMIN_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
    }

    // Validar fechas si se modifican
    const newCheckIn = updates.checkIn ? new Date(updates.checkIn) : new Date(reservation.checkIn);
    const newCheckOut = updates.checkOut ? new Date(updates.checkOut) : new Date(reservation.checkOut);
    if (newCheckOut <= newCheckIn) {
      return res.status(400).json({ message: 'La fecha de check-out debe ser posterior al check-in.' });
    }

    // No permitir cambiar estado/pricing/payment vía este endpoint
    // (usar checkin/checkout/payment endpoints dedicados)

    // Validar solapamiento si la reserva tiene habitaciones asignadas
    if (reservation.room && reservation.room.length > 0 && (updates.checkIn || updates.checkOut)) {
      for (const roomId of reservation.room) {
        const overlap = await Reservation.findOne({
          _id: { $ne: req.params.id },
          room: roomId,
          status: { $nin: ['checkout', 'cancelada'] },
          checkIn: { $lt: newCheckOut },
          checkOut: { $gt: newCheckIn }
        });
        if (overlap) {
          return res.status(409).json({ message: 'La habitación ya está reservada en esas fechas.' });
        }
      }
    }

    // Aplicar updates con $set (nunca overwrite completo)
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('room client');

    if (!updatedReservation) return res.status(404).json({ message: 'Error al actualizar reserva.' });

    // Recalcular pricing si se cambiaron fechas o tipo
    let finalReservation = updatedReservation;
    if (updates.checkIn || updates.checkOut || updates.tipo || updates.cantidad) {
      try {
        finalReservation = await BillingService.updateReservationPricing(updatedReservation._id);
        // Repoblar refs perdidas en el save de pricing
        finalReservation = await Reservation.findById(finalReservation._id).populate('room client');
      } catch (pricingErr) {
        logger.warn('No se pudo recalcular pricing tras update:', pricingErr.message);
      }
    }

    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_updated', reservation: finalReservation }));
        }
      });
    }
    res.json(finalReservation);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar reserva.', error: error.message });
  }
};

// Asignar una habitación concreta a una reserva (admin/recepcionista) — ACID + locks
const assignRoomToReservation = async (req, res) => {
  const reservationId = req.params.id;
  let { room } = req.body;
  const replace = req.body?.replace === true;
  if (!room) {
    return res.status(400).json({ message: 'Debe indicar room (id) o array de ids en el body.' });
  }
  if (!Array.isArray(room)) room = [room];

  // Lockear por room_id (ordenados para evitar deadlocks)
  const sortedRoomIds = [...room].map(r => r.toString()).sort();
  const lockKeys = sortedRoomIds.map(id => `room:${id}`);
  const acquiredLocks = [];
  const session = await mongoose.startSession();
  const txSupported = req.app.get('txSupported');

  try {
    // Adquirir locks para todas las habitaciones
    for (const lockKey of lockKeys) {
      const owner = `${process.pid}-${require('crypto').randomUUID()}`;
      const lock = await lockService.acquireLock(lockKey, 5000, owner);
      if (!lock) {
        // Liberar locks ya adquiridos
        for (const acquired of acquiredLocks) {
          await lockService.releaseLock(acquired.key, acquired.owner).catch(() => {});
        }
        return res.status(423).json({ message: 'Otra operación está modificando una de las habitaciones. Intenta en unos segundos.' });
      }
      acquiredLocks.push({ key: lockKey, owner });
    }

    // Iniciar transacción DESPUÉS de adquirir locks (si el RS lo soporta)
    if (txSupported) session.startTransaction();

    const reservation = await Reservation.findById(reservationId).session(session);
    if (!reservation) {
      if (txSupported) await session.abortTransaction().catch(() => {});
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    const requested = room.length;
    const allowed = reservation.cantidad || 1;
    if (requested > allowed) {
      if (txSupported) await session.abortTransaction().catch(() => {});
      return res.status(400).json({ message: `Se intentan asignar ${requested} habitaciones pero la reserva solicita ${allowed}.` });
    }

    const roomsToUpdate = [];
    for (const rId of room) {
      const rm = await Room.findById(rId).session(session);
      if (!rm) {
        if (txSupported) await session.abortTransaction().catch(() => {});
        return res.status(404).json({ message: `Habitación ${rId} no encontrada.` });
      }

      if (['mantenimiento', 'limpieza'].includes(rm.status)) {
        if (txSupported) await session.abortTransaction().catch(() => {});
        return res.status(400).json({ message: `La habitación ${rm.number} no está disponible para asignación (status ${rm.status}).` });
      }

      const overlap = await Reservation.findOne({
        _id: { $ne: reservationId },
        room: rm._id,
        status: { $nin: ['checkout', 'cancelada'] },
        $or: [
          { checkIn: { $lt: new Date(reservation.checkOut) }, checkOut: { $gt: new Date(reservation.checkIn) } }
        ]
      }).session(session);
      if (overlap) {
        if (txSupported) await session.abortTransaction().catch(() => {});
        return res.status(409).json({ message: `La habitación ${rm.number} ya está reservada en esas fechas.` });
      }

      roomsToUpdate.push(rm);
    }

    const existingRooms = Array.isArray(reservation.room) ? reservation.room.map(r => r.toString()) : (reservation.room ? [reservation.room.toString()] : []);
    const incomingRooms = room.map(r => r.toString());
    const finalRoomIds = replace
      ? Array.from(new Set(incomingRooms))
      : Array.from(new Set([...existingRooms, ...incomingRooms]));

    const roomsToRelease = existingRooms.filter(id => !finalRoomIds.includes(id));

    if (finalRoomIds.length > allowed) {
      if (txSupported) await session.abortTransaction().catch(() => {});
      return res.status(400).json({ message: `La asignación resultaría en ${finalRoomIds.length} habitaciones pero la reserva solicita ${allowed}.` });
    }

    reservation.room = finalRoomIds;

    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (today >= checkInDate) reservation.status = 'checkin';

    await reservation.save({ session });

    const existingSet = new Set(existingRooms);
    for (const rm of roomsToUpdate) {
      if (!existingSet.has(rm._id.toString())) {
        rm.status = 'ocupada';
        await rm.save({ session });
      }
    }

    // En modo reemplazo liberar habitaciones removidas de la reserva.
    if (roomsToRelease.length > 0) {
      for (const releasedId of roomsToRelease) {
        const releasedRoom = await Room.findById(releasedId).session(session);
        if (!releasedRoom) continue;

        if (releasedRoom.status === 'ocupada') {
          if (reservation.status === 'checkin') {
            releasedRoom.status = 'limpieza';
            releasedRoom.pendingHousekeeping = 'limpieza_checkout';
            releasedRoom.pendingHousekeepingAt = new Date();
          } else {
            releasedRoom.status = 'disponible';
            releasedRoom.pendingHousekeeping = null;
            releasedRoom.pendingHousekeepingAt = null;
          }
          await releasedRoom.save({ session });
        }
      }
    }

    if (txSupported) await session.commitTransaction();

    // Lectura final y WebSocket fuera de la transacción
    const updatedReservation = await Reservation.findById(reservationId).populate('room client');

    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_updated', reservation: updatedReservation }));
        }
      });
    }

    return res.status(200).json(updatedReservation);
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    logger.error('assignRoomToReservation error', error);
    return res.status(500).json({ message: 'Error al asignar habitación.', error: (error && error.message) ? error.message : error });
  } finally {
    session.endSession();
    // Siempre liberar todos los locks adquiridos
    for (const acquired of acquiredLocks) {
      await lockService.releaseLock(acquired.key, acquired.owner).catch(() => {});
    }
  }
};

// Desasignar habitaciones de una reserva (admin/recepcionista) — ACID + locks
const unassignRoomsFromReservation = async (req, res) => {
  const reservationId = req.params.id;
  let { rooms } = req.body;
  const acquiredLocks = [];
  const session = await mongoose.startSession();

  try {
    logger.info(`[API] unassignRoomsFromReservation called for reservation ${reservationId}`);

    // Lectura previa fuera de transacción para determinar qué habitaciones lockear
    const reservationPreCheck = await Reservation.findById(reservationId).populate('room');
    if (!reservationPreCheck) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    if (!reservationPreCheck.room || reservationPreCheck.room.length === 0) {
      return res.status(400).json({ message: 'La reserva no tiene habitaciones asignadas para desasignar.' });
    }

    if (!rooms || rooms.length === 0) {
      rooms = reservationPreCheck.room.map(r => r._id.toString());
      logger.info(`[API] Desasignando TODAS las habitaciones: [${rooms.join(', ')}]`);
    } else {
      logger.info(`[API] Desasignando habitaciones específicas: [${rooms.join(', ')}]`);
    }

    // Validar que las habitaciones pertenecen a la reserva (pre-check)
    const assignedRoomIds = reservationPreCheck.room.map(r => r._id.toString());
    const invalidRooms = rooms.filter(roomId => !assignedRoomIds.includes(roomId));
    if (invalidRooms.length > 0) {
      return res.status(400).json({
        message: `Las siguientes habitaciones no están asignadas a esta reserva: ${invalidRooms.join(', ')}`
      });
    }

    // Adquirir locks por room_id (ordenados para evitar deadlocks)
    const sortedRoomIds = [...rooms].map(r => r.toString()).sort();
    for (const roomId of sortedRoomIds) {
      const lockKey = `room:${roomId}`;
      const owner = `${process.pid}-${require('crypto').randomUUID()}`;
      const lock = await lockService.acquireLock(lockKey, 5000, owner);
      if (!lock) {
        for (const acquired of acquiredLocks) {
          await lockService.releaseLock(acquired.key, acquired.owner).catch(() => {});
        }
        return res.status(423).json({ message: 'Otra operación está modificando una de las habitaciones. Intenta en unos segundos.' });
      }
      acquiredLocks.push({ key: lockKey, owner });
    }

    // Iniciar transacción DESPUÉS de adquirir locks (si el RS lo soporta)
    const txSupported2 = req.app.get('txSupported');
    if (txSupported2) session.startTransaction();

    // Re-leer reserva DENTRO de la transacción para consistencia
    const reservation = await Reservation.findById(reservationId).populate('room').session(session);
    if (!reservation) {
      if (txSupported2) await session.abortTransaction().catch(() => {});
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }

    const assignedIds = reservation.room.map(r => r._id.toString());
    const remainingRooms = assignedIds.filter(roomId => !rooms.includes(roomId));

    // Guardar status original ANTES de mutarlo (para decidir limpieza vs disponible)
    const originalStatus = reservation.status;
    reservation.room = remainingRooms;

    if (remainingRooms.length === 0) {
      logger.info(`[API] Todas las habitaciones desasignadas - convirtiendo a reserva virtual`);
      reservation.status = 'reservada';
    }

    await reservation.save({ session });

    for (const roomId of rooms) {
      const room = await Room.findById(roomId).session(session);
      if (room && room.status === 'ocupada') {
        // Usar status ORIGINAL para decidir workflow correcto
        if (originalStatus === 'checkin') {
          room.status = 'limpieza';
          room.pendingHousekeeping = 'limpieza_checkout';
          room.pendingHousekeepingAt = new Date();
        } else {
          room.status = 'disponible';
        }
        await room.save({ session });
        logger.info(`[API] Habitación ${room.number} → ${room.status}`);
      }
    }

    if (txSupported2) await session.commitTransaction();

    // WebSocket y respuesta fuera de la transacción
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'reservation_unassigned',
            reservation: reservation,
            unassignedRooms: rooms
          }));
        }
      });
    }

    res.json({
      message: `Se desasignaron ${rooms.length} habitación(es) de la reserva.`,
      reservation: await Reservation.findById(reservationId).populate('room client'),
      unassignedRooms: rooms,
      remainingRooms: remainingRooms.length
    });

  } catch (error) {
    if (txSupported2) await session.abortTransaction().catch(() => {});
    logger.error('unassignRoomsFromReservation error', error);
    res.status(500).json({ message: 'Error al desasignar habitaciones.', error: error.message });
  } finally {
    session.endSession();
    for (const acquired of acquiredLocks) {
      await lockService.releaseLock(acquired.key, acquired.owner).catch(() => {});
    }
  }
};

// Eliminar reserva (solo admin o recepcionista)
const deleteReservation = async (req, res) => {
  try {
    // 🔐 VALIDACIÓN DE AUTORIZACIÓN
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }
    
    // Verificar permisos: admin/recepcionista o propietario de la reserva
    const isAdminOrReceptionist = ['admin', 'recepcionista'].includes(req.user.role);
    const isOwner = reservation.user && reservation.user.toString() === req.user.userId;
    
    if (!isAdminOrReceptionist && !isOwner) {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar esta reserva.' 
      });
    }
    
    // Proceder con la eliminación
    const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!deletedReservation) return res.status(404).json({ message: 'Error al eliminar reserva.' });
    
    if (deletedReservation.room && deletedReservation.room.length > 0) {
      for (const roomId of deletedReservation.room) {
        try {
          const room = await Room.findById(roomId);
          if (room && room.status === 'ocupada') {
            // Si la reserva estaba en checkin, la habitación necesita limpieza
            if (deletedReservation.status === 'checkin') {
              room.status = 'limpieza';
              room.pendingHousekeeping = 'limpieza_checkout';
              room.pendingHousekeepingAt = new Date();
            } else {
              room.status = 'disponible';
            }
            await room.save();
            logger.info(`[API] Habitación ${room.number} → ${room.status} tras eliminar reserva`);
          }
        } catch (error) {
          logger.error(`[API] Error liberando habitación ${roomId}:`, error);
        }
      }
    }
    
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_deleted', reservationId: req.params.id }));
        }
      });
    }
    res.json({ message: 'Reserva eliminada.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar reserva.', error });
  }
};

// Función para generar combinaciones de habitaciones
function generarCombinacionesHabitaciones(habitaciones, pasajeros) {
  const resultados = [];

  function backtrack(combinacion, inicio, sumaActual) {
    if (sumaActual === pasajeros) {
      resultados.push([...combinacion]);
      return;
    }
    if (sumaActual > pasajeros) {
      return;
    }

    for (let i = inicio; i < habitaciones.length; i++) {
      combinacion.push(habitaciones[i]);
      backtrack(combinacion, i + 1, sumaActual + habitaciones[i].capacidad);
      combinacion.pop();
    }
  }

  backtrack([], 0, 0);
  return resultados;
}

// Función para optimizar la selección de combinaciones
function optimizarCombinacion(combinaciones) {
  if (!combinaciones || combinaciones.length === 0) return [];

  combinaciones.sort((a, b) => a.length - b.length);

  combinaciones.sort((a, b) => {
    if (a.length === b.length) {
      const capacidadA = a.reduce((sum, hab) => sum + hab.capacidad, 0);
      const capacidadB = b.reduce((sum, hab) => sum + hab.capacidad, 0);
      return capacidadA - capacidadB;
    }
    return 0;
  });

  return combinaciones[0];
}

// Función para limpiar reservas fantasma
  const cleanupGhostReservations = async (req, res) => {
    const startTime = Date.now();
    try {
      const now = new Date();
      
      logger.audit.adminAction('Limpieza de reservas fantasma iniciada', {
        service: 'crm-hotelero',
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        action: 'CLEANUP_GHOST_RESERVATIONS',
        timestamp: new Date().toISOString()
      });
      
      // Buscar reservas que deberían haber hecho checkout
      const ghostReservations = await Reservation.find({
        status: { $in: ['checkin', 'reservada'] },
        checkOut: { $lt: now }
      });

      logger.info('Reservas fantasma encontradas', {
        service: 'crm-hotelero',
        count: ghostReservations.length,
        event: 'GHOST_RESERVATIONS_FOUND'
      });
      
      let cleaned = 0;
      for (const reserva of ghostReservations) {
        // No-shows (reservada sin checkin) → cancelada
        // Overstays (checkin pasado de checkout) → checkout
        if (reserva.status === 'reservada') {
          reserva.status = 'cancelada';
        } else {
          reserva.status = 'checkout';
        }
        await reserva.save();
        
        // Liberar habitaciones si estaban asignadas
        if (reserva.room && reserva.room.length > 0) {
          for (const roomId of reserva.room) {
            const room = await Room.findById(roomId);
            if (room) {
              // Verificar si hay otras reservas activas para esta habitación
              const activeReservations = await Reservation.find({
                room: roomId,
                status: { $in: ['checkin', 'reservada'] },
                checkOut: { $gt: now }
              });
              
              if (activeReservations.length === 0) {
                // Si estaba ocupada por checkin, necesita limpieza
                if (room.status === 'ocupada') {
                  room.status = 'limpieza';
                  room.pendingHousekeeping = 'limpieza_checkout';
                  room.pendingHousekeepingAt = new Date();
                } else {
                  room.status = 'disponible';
                }
                await room.save();
                logger.info('Habitación liberada de reserva fantasma', {
                  service: 'crm-hotelero',
                  roomNumber: room.number,
                  roomId: room._id,
                  event: 'ROOM_RELEASED_FROM_GHOST'
                });
              } else {
                logger.info('Habitación sigue ocupada por otras reservas', {
                  service: 'crm-hotelero',
                  roomNumber: room.number,
                  roomId: room._id,
                  activeReservations: activeReservations.length,
                  event: 'ROOM_STILL_OCCUPIED'
                });
              }
            }
          }
        }
        cleaned++;
      }
      
      const duration = Date.now() - startTime;
      logger.performance.requestTime(
        req.method,
        req.originalUrl,
        duration,
        200,
        req.user?.id
      );
      
      res.json({
        success: true,
        message: `Se limpiaron ${cleaned} reservas fantasma`,
        deleted: cleaned
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error al limpiar reservas fantasma', {
        service: 'crm-hotelero',
        error: error.message,
        stack: error.stack,
        duration,
        adminId: req.user?.id,
        event: 'GHOST_CLEANUP_ERROR'
      });
      
      res.status(500).json({ 
        success: false,
        message: 'Error al limpiar reservas fantasma', 
        error: error.message 
      });
    }
  };

// Check-in con asignación automática (ACID transacción + lock distribuido)
const checkinReservation = async (req, res) => {
  const { id } = req.params;
  const txSupported = req.app.get('txSupported');
  const session = await mongoose.startSession();
  if (txSupported) session.startTransaction();

  try {
    let reservation;
    await lockService.withLock(`reservation:${id}`, 10000, async () => {
      logger.info(`🏨 Iniciando check-in para reserva ${id}`);
      reservation = await processCheckin(id, { session: txSupported ? session : undefined });
      if (txSupported) await session.commitTransaction();
    });

    // Emitir evento WebSocket (fuera de la transacción)
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_checkin', reservation }));
        }
      });
    }

    auditService.log({
      action: 'CHECKIN_REALIZADO',
      entity: 'Reservation',
      entityId: id,
      userId: req.user?._id || req.user?.id,
      userEmail: req.user?.email || 'sistema',
      userRole: req.user?.role || 'sistema',
      description: `Check-in realizado en reserva ${String(id).slice(-6).toUpperCase()}`,
      ip: req.ip
    });
    res.json({
      message: 'Check-in procesado exitosamente',
      reservation
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    if (error.name === 'LockBusyError') {
      return res.status(423).json({ message: 'Otra operación está procesando esta reserva. Intenta en unos segundos.' });
    }
    logger.error('❌ Error en check-in:', error);
    res.status(500).json({ message: 'Error al procesar check-in', error: error.message });
  } finally {
    session.endSession();
  }
};

// Check-out con liberación de habitaciones
const checkoutReservation = async (req, res) => {
  const { id } = req.params;
  const txSupported = req.app.get('txSupported');
  const session = await mongoose.startSession();
  if (txSupported) session.startTransaction();

  try {
    let reservation;
    await lockService.withLock(`reservation:${id}`, 10000, async () => {
      logger.info(`🚪 Iniciando check-out para reserva ${id}`);
      reservation = await processCheckout(id, { session: txSupported ? session : undefined });
      if (txSupported) await session.commitTransaction();
    });

    // Emitir evento WebSocket (fuera de la transacción)
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_checkout', reservation }));
        }
      });
    }

    // Email agradecimiento checkout — no bloquea la respuesta
    setImmediate(async () => {
      try {
        const emailService = require('../services/emailService');
        const Reservation = require('../models/Reservation');
        const populated = await Reservation.findById(id).populate('client', 'nombre apellido email');
        if (populated?.client?.email) {
          await emailService.sendCheckoutThankYou({ reservation: populated, client: populated.client });
        }
      } catch (e) { logger.warn('Error enviando email checkout:', e.message); }
    });

    auditService.log({
      action: 'CHECKOUT_REALIZADO',
      entity: 'Reservation',
      entityId: id,
      userId: req.user?._id || req.user?.id,
      userEmail: req.user?.email || 'sistema',
      userRole: req.user?.role || 'sistema',
      description: `Check-out realizado en reserva ${String(id).slice(-6).toUpperCase()}`,
      ip: req.ip
    });
    res.json({
      message: 'Check-out procesado exitosamente',
      reservation
    });
  } catch (error) {
    if (txSupported) await session.abortTransaction().catch(() => {});
    if (error.name === 'LockBusyError') {
      return res.status(423).json({ message: 'Otra operación está procesando esta reserva. Intenta en unos segundos.' });
    }
    logger.error('❌ Error en check-out:', error);
    res.status(500).json({ message: 'Error al procesar check-out', error: error.message });
  } finally {
    session.endSession();
  }
};

// Exportar todas las funciones
module.exports = {
  createReservation,
  getReservations,
  getMyReservations,
  updateReservation,
  assignRoomToReservation,
  unassignRoomsFromReservation,
  deleteReservation,
  cleanupGhostReservations,
  optimizarCombinacion,
  generarCombinacionesHabitaciones,
  checkinReservation,
  checkoutReservation,
  getPendingCheckouts
};
