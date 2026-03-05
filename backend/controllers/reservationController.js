// controllers/reservationController.js
// Controlador para gestión de reservas

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const { assignRoomsToReservation, processCheckin, processCheckout } = require('../services/roomAssignmentService');
const BillingService = require('../services/billingService');

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');

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
    // 2. Su fecha de checkout sea ayer o anterior
    // 3. No hayan hecho checkout todavía
    const pendingReservations = await Reservation.find({
      status: 'checkin',
      checkOut: { $lt: today } // Checkout anterior a hoy
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

    logger.performance.requestCompleted(
      'GET_PENDING_CHECKOUTS',
      Date.now() - startTime,
      { count: reservationsWithDelay.length }
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

// 🆕 Crear reserva con logging avanzado
const createReservation = async (req, res) => {
  const startTime = Date.now();
  try {
    const { tipo, cantidad, checkIn, checkOut, nombre, apellido, dni, email, whatsapp } = req.body;
    let user = undefined;
    if (req.user && req.user.userId) {
      user = req.user.userId;
    }

    // 📝 Log del intento de creación de reserva
    logger.audit.userAction(
      'CREATE_RESERVATION_ATTEMPT',
      user || 'anonymous',
      'reservation',
      null,
      { tipo, cantidad, checkIn, checkOut, email, ip: req.ip }
    );
    // Validar fechas
    if (new Date(checkIn) > new Date(checkOut)) {
      return res.status(400).json({ message: 'La fecha de check-in no puede ser posterior a la de check-out.' });
    }
    // Buscar o crear cliente
    let client = await Client.findOne({ $or: [{ dni }, { email }] });
    if (!client) {
      client = await Client.create({ nombre, apellido, dni, email, whatsapp });
    } else {
      // Si existe, actualizar datos básicos si cambiaron
      let updated = false;
      if (client.nombre !== nombre) { client.nombre = nombre; updated = true; }
      if (client.apellido !== apellido) { client.apellido = apellido; updated = true; }
      if (client.whatsapp !== whatsapp) { client.whatsapp = whatsapp; updated = true; }
      if (updated) await client.save();
    }
    // Validar que el tipo no esté vacío
    if (!tipo) {
      return res.status(400).json({ message: 'El tipo de habitación es obligatorio.' });
    }

    // 🚫 VALIDACIÓN ESTRICTA: NO SOBREVENTA
    // Verificar disponibilidad real antes de crear la reserva
    const cantidadSolicitada = cantidad || 1;
    
    // Obtener todas las habitaciones del tipo solicitado que no estén en mantenimiento o limpieza
    const habitacionesDelTipo = await Room.find({
      type: tipo,
      status: { $nin: ['mantenimiento', 'limpieza'] }
    });
    const totalHabitaciones = habitacionesDelTipo.length;
    
    if (totalHabitaciones === 0) {
      return res.status(400).json({ 
        message: `No existen habitaciones del tipo "${tipo}".` 
      });
    }
    
    // Generar rango de fechas de la reserva
    const fechaInicio = new Date(checkIn);
    const fechaFin = new Date(checkOut);
    const fechasReserva = [];
    
    for (let d = new Date(fechaInicio); d < fechaFin; d.setDate(d.getDate() + 1)) {
      fechasReserva.push(d.toISOString().split('T')[0]);
    }
    
    // Para cada fecha, verificar disponibilidad
    for (const fecha of fechasReserva) {
      const fechaObj = new Date(fecha + 'T00:00:00.000Z');
      const fechaSiguiente = new Date(fechaObj);
      fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
      
      // Contar habitaciones ocupadas en esta fecha (reales + virtuales)
      const reservasEnFecha = await Reservation.find({
        tipo: tipo,
        status: { $ne: 'checkout' }, // Excluir reservas que ya hicieron checkout
        checkIn: { $lt: fechaSiguiente },
        checkOut: { $gt: fechaObj }
      });
      
      // Limpiar reservas fantasma (checkout anticipado)
      for (const reserva of reservasEnFecha) {
        if (reserva.status === 'checkin' && new Date(reserva.checkOut) < new Date()) {
          reserva.status = 'checkout';
          await reserva.save();
          
          // Liberar habitaciones si estaban asignadas
          if (reserva.room && reserva.room.length > 0) {
            for (const roomId of reserva.room) {
              const room = await Room.findById(roomId);
              if (room && room.status === 'ocupada') {
                room.status = 'disponible';
                await room.save();
                console.log(`[API] Habitación ${room.number} liberada automáticamente por checkout anticipado`);
              }
            }
          }
          continue; // No contar esta reserva como ocupada
        }
      };
      
      let habitacionesOcupadas = 0;
      
      // Contar reservas que ocupan habitaciones
      reservasEnFecha.forEach(reserva => {
        if (reserva.room && reserva.room.length > 0) {
          // Reserva real - cuenta las habitaciones asignadas
          habitacionesOcupadas += reserva.room.length;
        } else {
          // Reserva virtual - cuenta la cantidad solicitada
          habitacionesOcupadas += (reserva.cantidad || 1);
        }
      });
      
      // NO hay doble conteo - las reservas ya incluyen las habitaciones ocupadas
      const habitacionesDisponibles = totalHabitaciones - habitacionesOcupadas;
      
      if (cantidadSolicitada > habitacionesDisponibles) {
        return res.status(409).json({ 
          message: `No hay suficientes habitaciones ${tipo} disponibles para el ${fecha}. Solicitadas: ${cantidadSolicitada}, Disponibles: ${habitacionesDisponibles}`,
          detalles: {
            fecha,
            tipo,
            totalHabitaciones,
            habitacionesOcupadas,
            habitacionesDisponibles,
            cantidadSolicitada
          }
        });
      }
    }
    
    console.log(`✅ Validación pasada: Creando reserva ${tipo} x${cantidadSolicitada} del ${checkIn} al ${checkOut}`);
    
    // 🆕 CALCULAR PRECIOS AUTOMÁTICAMENTE
    const reservationData = { tipo, cantidad, checkIn, checkOut };
    const pricing = await BillingService.calculateReservationPricing(reservationData);
    
    const reservation = new Reservation({ 
      tipo, 
      cantidad, 
      user, 
      client: client._id, 
      checkIn, 
      checkOut,
      pricing: {
        pricePerNight: pricing.pricePerNight,
        totalNights: pricing.totalNights,
        subtotal: pricing.subtotal,
        taxes: pricing.taxes,
        total: pricing.total,
        currency: pricing.currency
      },
      payment: {
        status: 'pendiente',
        method: 'efectivo',
        amountPaid: 0
      },
      invoice: {
        isPaid: false
      }
    });
    
    await reservation.save();
    console.log(`💰 Precios calculados: $${pricing.total} por ${pricing.totalNights} noches`);
    
    // 🏠 ASIGNACIÓN AUTOMÁTICA: Intentar asignar habitaciones inmediatamente
    console.log('🔄 Intentando asignación automática de habitaciones...');
    await assignRoomsToReservation(reservation);
    
    // Recargar reserva con habitaciones asignadas
    const updatedReservation = await Reservation.findById(reservation._id).populate('room client');
    
    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(wsclient => {
        if (wsclient.readyState === 1) {
          wsclient.send(JSON.stringify({ type: 'reservation_created', reservation: updatedReservation }));
        }
      });
    }

    // 📝 Log de éxito
    const duration = Date.now() - startTime;
    logger.audit.userAction(
      'CREATE_RESERVATION_SUCCESS',
      user || 'anonymous',
      'reservation',
      updatedReservation._id.toString(),
      { 
        tipo, 
        cantidad, 
        checkIn, 
        checkOut, 
        totalPrice: pricing.total,
        roomsAssigned: updatedReservation.room?.length || 0,
        duration
      }
    );

    logger.performance.requestTime(req.method, req.originalUrl, duration, 201, user);
    
    res.status(201).json(updatedReservation);
  } catch (error) {
    // 📝 Log de error
    const duration = Date.now() - startTime;
    logger.error('Error al crear reserva', error, {
      userId: user,
      requestData: { tipo, cantidad, checkIn, checkOut, email },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration
    });

    logger.performance.requestTime(req.method, req.originalUrl, duration, 500, user);

    res.status(500).json({ message: 'Error al crear reserva.', error });
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

    const reservations = await Reservation.find()
      .populate('room', 'number type floor')
      .populate('client', 'nombre apellido email dni whatsapp')
      .populate('user', 'name email role');

    // 📝 Log de performance para queries lentas
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logger.performance.slowOperation('GET_RESERVATIONS_QUERY', duration, {
        reservationCount: reservations.length,
        userId: req.user.id
      });
    }

    logger.performance.requestTime(req.method, req.originalUrl, duration, 200, req.user.id);

    res.json(reservations);
  } catch (error) {
    // 📝 Log de error
    const duration = Date.now() - startTime;
    logger.error('Error al obtener reservas', error, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration
    });

    logger.performance.requestTime(req.method, req.originalUrl, duration, 500, req.user.id);

    res.status(500).json({ message: 'Error al obtener reservas.', error });
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
    
    const { room, checkIn, checkOut } = req.body;
    // Validar solapamiento excepto con la propia reserva
    const overlap = await Reservation.findOne({
      _id: { $ne: req.params.id },
      room,
      $or: [
        { checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }
      ]
    });
    if (overlap) {
      return res.status(409).json({ message: 'La habitación ya está reservada en esas fechas.' });
    }
    const updatedReservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedReservation) return res.status(404).json({ message: 'Error al actualizar reserva.' });
    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_updated', reservation: updatedReservation }));
        }
      });
    }
    res.json(updatedReservation);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar reserva.', error });
  }
};

// Asignar una habitación concreta a una reserva (admin/recepcionista)
const assignRoomToReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    let { room } = req.body;

    if (!room) {
      return res.status(400).json({ message: 'Debe indicar room (id) o array de ids en el body.' });
    }
    if (!Array.isArray(room)) room = [room];

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ message: 'Reserva no encontrada.' });

    // Validar cantidad
    const requested = room.length;
    const allowed = reservation.cantidad || 1;
    if (requested > allowed) {
      return res.status(400).json({ message: `Se intentan asignar ${requested} habitaciones pero la reserva solicita ${allowed}.` });
    }

    // Validar y reservar habitaciones
    const roomsToUpdate = [];
    for (const rId of room) {
      const rm = await Room.findById(rId);
      if (!rm) return res.status(404).json({ message: `Habitación ${rId} no encontrada.` });

      if (['mantenimiento', 'limpieza'].includes(rm.status)) {
        return res.status(400).json({ message: `La habitación ${rm.number} no está disponible para asignación (status ${rm.status}).` });
      }

      // Comprobar solapamiento con otras reservas activas para esa habitación
      const overlap = await Reservation.findOne({
        _id: { $ne: reservationId },
        room: rm._id,
        status: { $ne: 'checkout' },
        $or: [
          { checkIn: { $lt: new Date(reservation.checkOut) }, checkOut: { $gt: new Date(reservation.checkIn) } }
        ]
      });
      if (overlap) {
        return res.status(409).json({ message: `La habitación ${rm.number} ya está reservada en esas fechas.` });
      }

      roomsToUpdate.push(rm);
    }

    // Asignar habitaciones en la reserva
    const existingRooms = Array.isArray(reservation.room) ? reservation.room.map(r => r.toString()) : (reservation.room ? [reservation.room.toString()] : []);
    const incomingRooms = room.map(r => r.toString());
    const finalRoomIds = Array.from(new Set([...existingRooms, ...incomingRooms]));

    if (finalRoomIds.length > allowed) {
      return res.status(400).json({ message: `La asignación resultaría en ${finalRoomIds.length} habitaciones pero la reserva solicita ${allowed}.` });
    }

    reservation.room = finalRoomIds;

    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (today >= checkInDate) reservation.status = 'checkin';

    await reservation.save();

    // Marcar nuevas habitaciones como ocupadas (solo las que no estaban ya asignadas)
    const existingSet = new Set(existingRooms);
    for (const rm of roomsToUpdate) {
      if (!existingSet.has(rm._id.toString())) {
        rm.status = 'ocupada';
        await rm.save();
      }
    }

    // En la respuesta, devolver la reserva con relaciones pobladas
    const updatedReservation = await Reservation.findById(reservationId).populate('room client');

    // Emitir evento WebSocket
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
    console.error('assignRoomToReservation error', error);
    return res.status(500).json({ message: 'Error al asignar habitación.', error: (error && error.message) ? error.message : error });
  }
};

// Desasignar habitaciones de una reserva (admin/recepcionista)
const unassignRoomsFromReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    let { rooms } = req.body;
    
    console.log(`[API] unassignRoomsFromReservation called for reservation ${reservationId}`);
    
    const reservation = await Reservation.findById(reservationId).populate('room');
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada.' });
    }
    
    console.log(`[API] Reserva actual tiene ${reservation.room ? reservation.room.length : 0} habitaciones asignadas`);
    
    if (!reservation.room || reservation.room.length === 0) {
      return res.status(400).json({ message: 'La reserva no tiene habitaciones asignadas para desasignar.' });
    }
    
    if (!rooms || rooms.length === 0) {
      rooms = reservation.room.map(r => r._id.toString());
      console.log(`[API] Desasignando TODAS las habitaciones: [${rooms.join(', ')}]`);
    } else {
      console.log(`[API] Desasignando habitaciones específicas: [${rooms.join(', ')}]`);
    }
    
    const assignedRoomIds = reservation.room.map(r => r._id.toString());
    const invalidRooms = rooms.filter(roomId => !assignedRoomIds.includes(roomId));
    
    if (invalidRooms.length > 0) {
      return res.status(400).json({ 
        message: `Las siguientes habitaciones no están asignadas a esta reserva: ${invalidRooms.join(', ')}` 
      });
    }
    
    const remainingRooms = assignedRoomIds.filter(roomId => !rooms.includes(roomId));
    reservation.room = remainingRooms;
    
    if (remainingRooms.length === 0) {
      console.log(`[API] Todas las habitaciones desasignadas - convirtiendo a reserva virtual`);
      reservation.status = 'reservada';
    }
    
    await reservation.save();
    
    for (const roomId of rooms) {
      try {
        const room = await Room.findById(roomId);
        if (room && room.status === 'ocupada') {
          room.status = 'disponible';
          await room.save();
          console.log(`[API] Habitación ${room.number} marcada como disponible`);
        }
      } catch (error) {
        console.error(`[API] Error actualizando habitación ${roomId}:`, error);
      }
    }
    
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
    console.error('unassignRoomsFromReservation error', error);
    res.status(500).json({ message: 'Error al desasignar habitaciones.', error: error.message });
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
            room.status = 'disponible';
            await room.save();
            console.log(`[API] Habitación ${room.number} liberada tras eliminar reserva`);
          }
        } catch (error) {
          console.error(`[API] Error liberando habitación ${roomId}:`, error);
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
        // Marcar como checkout
        reserva.status = 'checkout';
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
                room.status = 'disponible';
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
      logger.performance.operation('Limpieza de reservas fantasma completada', {
        service: 'crm-hotelero',
        operation: 'CLEANUP_GHOST_RESERVATIONS',
        duration,
        cleanedCount: cleaned,
        totalFound: ghostReservations.length,
        adminId: req.user?.id,
        success: true
      });
      
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

// Check-in con asignación automática
const checkinReservation = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🏨 Iniciando check-in para reserva ${id}`);
    
    const reservation = await processCheckin(id);
    
    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_checkin', reservation }));
        }
      });
    }
    
    res.json({
      message: 'Check-in procesado exitosamente',
      reservation
    });
  } catch (error) {
    console.error('❌ Error en check-in:', error);
    res.status(500).json({ message: 'Error al procesar check-in', error: error.message });
  }
};

// Check-out con liberación de habitaciones
const checkoutReservation = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚪 Iniciando check-out para reserva ${id}`);
    
    const reservation = await processCheckout(id);
    
    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'reservation_checkout', reservation }));
        }
      });
    }
    
    res.json({
      message: 'Check-out procesado exitosamente',
      reservation
    });
  } catch (error) {
    console.error('❌ Error en check-out:', error);
    res.status(500).json({ message: 'Error al procesar check-out', error: error.message });
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
