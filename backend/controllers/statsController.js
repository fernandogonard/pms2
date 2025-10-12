// controllers/statsController.js
// Controlador para estadísticas del sistema

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ErrorHandlingService = require('../services/errorHandlingService');
const { ROOM_STATES } = require('../services/stateValidationService');
const { logger } = require('../config/logger');

/**
 * Obtiene estadísticas actuales de habitaciones
 * @route GET /api/stats/rooms
 */
exports.getRoomStats = ErrorHandlingService.asyncWrapper(async (req, res) => {
    // Añadir cabeceras CORS específicas para evitar problemas con cabeceras personalizadas
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // No permitir caché
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // Obtener todas las habitaciones con proyección optimizada
    const rooms = await Room.find({}, { 
      _id: 1, 
      number: 1, 
      status: 1, 
      type: 1 
    });
    
    // Obtener fecha actual para verificación usando DateService
    const DateService = require('../services/dateService');
    const today = DateService.today();
    
    // Obtener reservas activas con check-in (ocupadas - verde) con proyección optimizada
    const activeReservations = await Reservation.find({
        status: 'checkin',
        checkOut: { $gt: today }
    }, { 
        room: 1,
        status: 1,
        checkIn: 1,
        checkOut: 1
    }).lean();
    
    // Obtener reservas para hoy sin check-in (por ingresar - negro) con proyección optimizada
    const pendingReservations = await Reservation.find({
        status: 'reservada',
        checkIn: { $lte: today },
        checkOut: { $gt: today }
    }, { 
        room: 1,
        status: 1,
        checkIn: 1,
        checkOut: 1
    }).lean();
    
    // Crear un conjunto de IDs de habitaciones con reservas activas
    const occupiedRoomIds = new Set();
    activeReservations.forEach(reservation => {
        if (reservation.room && reservation.room.length > 0) {
            reservation.room.forEach(roomId => {
                occupiedRoomIds.add(roomId.toString());
            });
        }
    });
    
    // Crear un conjunto de IDs de habitaciones con reservas pendientes
    const pendingRoomIds = new Set();
    pendingReservations.forEach(reservation => {
        if (reservation.room && reservation.room.length > 0) {
            reservation.room.forEach(roomId => {
                pendingRoomIds.add(roomId.toString());
            });
        }
    });
    
    // Contar habitaciones por estado
    const stats = {
        total: rooms.length,
        disponibles: 0,
        ocupadas: 0,
        limpieza: 0,
        mantenimiento: 0,
        porIngresar: pendingRoomIds.size
    };
    
    // Contar por estado real (considerando reservas activas)
    rooms.forEach(room => {
        // Verificar si la habitación tiene una reserva activa con check-in
        const isOccupiedByReservation = occupiedRoomIds.has(room._id.toString());
        // Verificar si la habitación tiene una reserva pendiente de check-in
        const isPendingCheckIn = pendingRoomIds.has(room._id.toString());
        
        if (isOccupiedByReservation) {
            // Si tiene reserva activa, está ocupada independientemente de su estado en la base de datos
            stats.ocupadas++;
        } else if (isPendingCheckIn) {
            // Si tiene reserva pendiente de check-in, ya está contada en porIngresar
            // No la contamos en otro estado
        } else {
            // Si no tiene reserva activa, usar el estado de la base de datos
            switch (room.status) {
                case ROOM_STATES.DISPONIBLE:
                    stats.disponibles++;
                    break;
                case ROOM_STATES.OCUPADA:
                    stats.ocupadas++;
                    break;
                case ROOM_STATES.LIMPIEZA:
                    stats.limpieza++;
                    break;
                case ROOM_STATES.MANTENIMIENTO:
                    stats.mantenimiento++;
                    break;
                default:
                    // Otros estados posibles
                    stats.disponibles++; // Por defecto, contar como disponible
                    break;
            }
        }
    });
    
    // Registrar la generación de estadísticas
    logger.info(`Estadísticas de habitaciones generadas: ${JSON.stringify(stats)}`, {
        action: 'ROOM_STATS_GENERATED',
        timestamp: new Date().toISOString(),
        roomsWithActiveReservations: occupiedRoomIds.size,
        roomsWithPendingCheckIn: pendingRoomIds.size
    });
    
    // Responder con estadísticas
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        stats,
        debug: {
            roomsWithActiveReservations: occupiedRoomIds.size,
            roomsWithPendingCheckIn: pendingRoomIds.size,
            totalRooms: rooms.length,
            activeReservations: activeReservations.length,
            pendingReservations: pendingReservations.length
        }
    });
});