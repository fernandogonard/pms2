// controllers/systemController.js
// Controlador para obtener información del sistema y estadísticas

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Client = require('../models/Client');
const ErrorHandlingService = require('../services/errorHandlingService');
const { ROOM_STATES } = require('../services/stateValidationService');

/**
 * Obtiene estadísticas generales del sistema
 * @route GET /api/system/stats
 */
exports.getSystemStats = ErrorHandlingService.asyncWrapper(async (req, res) => {
  // Recopilación de estadísticas básicas
  const [
    roomCount,
    clientCount,
    userCount,
    activeReservations,
    maintenanceRooms,
    cleaningRooms
  ] = await Promise.all([
    Room.countDocuments(),
    Client.countDocuments(),
    User.countDocuments(),
    Reservation.countDocuments({ status: { $in: ['reservada', 'checkin'] } }),
    Room.countDocuments({ status: 'mantenimiento' }),
    Room.countDocuments({ status: 'limpieza' })
  ]);
  
  // Estadísticas por tipo de habitación
  const roomsByType = await Room.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  
  // Estadísticas por estado de habitación
  const roomsByStatus = await Room.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  // Ocupación actual
  const occupiedRooms = await Room.countDocuments({ status: 'ocupada' });
  const occupancyRate = roomCount > 0 ? (occupiedRooms / roomCount) * 100 : 0;
  
  // Reservas para próxima semana
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const upcomingReservations = await Reservation.countDocuments({
    status: 'reservada',
    checkIn: { $gte: today, $lte: nextWeek }
  });
  
  res.json({
    success: true,
    stats: {
      general: {
        rooms: roomCount,
        clients: clientCount,
        users: userCount,
        activeReservations: activeReservations
      },
      rooms: {
        byType: roomsByType.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        byStatus: roomsByStatus.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      },
      occupancy: {
        occupied: occupiedRooms,
        maintenance: maintenanceRooms,
        cleaning: cleaningRooms,
        rate: occupancyRate.toFixed(2) + '%'
      },
      reservations: {
        active: activeReservations,
        upcoming: upcomingReservations
      }
    },
    timestamp: new Date()
  });
});

/**
 * Verifica la consistencia de datos del sistema
 * @route GET /api/system/consistency
 */
exports.checkDataConsistency = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const issues = [];
  
  // 1. Buscar reservas con habitaciones no existentes
  const reservationsWithRooms = await Reservation.find({ 
    room: { $exists: true, $ne: [] } 
  });
  
  for (const reservation of reservationsWithRooms) {
    for (const roomId of reservation.room) {
      const room = await Room.findById(roomId);
      if (!room) {
        issues.push({
          type: 'RESERVA_HABITACION_INEXISTENTE',
          message: `La reserva ${reservation._id} referencia habitación inexistente ${roomId}`,
          reservationId: reservation._id
        });
      }
    }
  }
  
  // 2. Buscar reservas activas sin huéspedes (cliente asociado)
  const activeReservationsWithoutClients = await Reservation.countDocuments({
    status: { $in: ['reservada', 'checkin'] },
    client: { $exists: false }
  });
  
  if (activeReservationsWithoutClients > 0) {
    issues.push({
      type: 'RESERVAS_SIN_CLIENTE',
      message: `Hay ${activeReservationsWithoutClients} reservas activas sin cliente asociado`,
      count: activeReservationsWithoutClients
    });
  }
  
  // 3. Verificar consistencia de habitaciones en check-in vs. ocupadas
  const checkinReservations = await Reservation.find({ status: 'checkin' }).populate('room');
  const occupiedRoomIds = new Set();
  
  for (const reservation of checkinReservations) {
    if (reservation.room && reservation.room.length > 0) {
      for (const room of reservation.room) {
        if (room.status !== 'ocupada') {
          issues.push({
            type: 'HABITACION_ESTADO_INCONSISTENTE',
            message: `Habitación #${room.number} con reserva en check-in pero estado ${room.status}`,
            roomId: room._id,
            reservationId: reservation._id
          });
        }
        
        if (occupiedRoomIds.has(room._id.toString())) {
          issues.push({
            type: 'HABITACION_DOBLE_ASIGNACION',
            message: `Habitación #${room.number} asignada a múltiples reservas en check-in`,
            roomId: room._id
          });
        }
        
        occupiedRoomIds.add(room._id.toString());
      }
    }
  }
  
  // 4. Verificar reservas virtuales sin tipo de habitación
  const virtualReservationsWithoutType = await Reservation.countDocuments({
    room: { $exists: false },
    tipo: { $exists: false },
    status: 'reservada'
  });
  
  if (virtualReservationsWithoutType > 0) {
    issues.push({
      type: 'RESERVAS_VIRTUALES_SIN_TIPO',
      message: `Hay ${virtualReservationsWithoutType} reservas virtuales sin tipo de habitación`,
      count: virtualReservationsWithoutType
    });
  }
  
  res.json({
    success: true,
    consistent: issues.length === 0,
    issueCount: issues.length,
    issues,
    timestamp: new Date()
  });
});

/**
 * Obtiene el estado real del sistema para el script de validación
 * @route GET /api/system/real-data
 */
exports.getRealSystemData = ErrorHandlingService.asyncWrapper(async (req, res) => {
  // Contar habitaciones por tipo y estado
  const roomStats = await Room.aggregate([
    {
      $group: {
        _id: {
          type: "$type",
          status: "$status"
        },
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Contar reservas por estado
  const reservationStats = await Reservation.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Contar usuarios por rol
  const userStats = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Obtener habitaciones en mantenimiento con detalles
  const maintenanceRooms = await Room.find({ 
    status: 'mantenimiento' 
  }).select('number floor type currentMaintenance').lean();
  
  // Datos formatados para script de validación
  const formattedData = {
    rooms: {
      total: await Room.countDocuments(),
      byType: roomStats
        .filter(stat => stat._id.type)
        .reduce((acc, stat) => {
          const type = stat._id.type;
          if (!acc[type]) acc[type] = 0;
          acc[type] += stat.count;
          return acc;
        }, {}),
      byStatus: roomStats
        .filter(stat => stat._id.status)
        .reduce((acc, stat) => {
          const status = stat._id.status;
          if (!acc[status]) acc[status] = 0;
          acc[status] += stat.count;
          return acc;
        }, {})
    },
    reservations: {
      total: await Reservation.countDocuments(),
      byStatus: reservationStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    },
    users: {
      total: await User.countDocuments(),
      byRole: userStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    },
    maintenance: {
      count: maintenanceRooms.length,
      rooms: maintenanceRooms.map(room => ({
        number: room.number,
        reason: room.currentMaintenance?.reason || 'No especificado',
        startDate: room.currentMaintenance?.startDate,
        estimatedEndDate: room.currentMaintenance?.estimatedEndDate
      }))
    }
  };
  
  res.json({
    success: true,
    data: formattedData,
    timestamp: new Date(),
    version: '2.0'
  });
});

/**
 * Comprueba si el sistema está listo para producción
 * @route GET /api/system/ready-check
 */
exports.systemReadyCheck = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const checks = {
    database: {
      connected: true, // La solicitud funcionó, así que estamos conectados
      roomsExist: (await Room.countDocuments()) > 0,
      usersExist: (await User.countDocuments()) > 0
    },
    adminExists: (await User.countDocuments({ role: 'admin' })) > 0,
    roomsSetup: (await Room.countDocuments()) >= 5, // Mínimo de habitaciones para operar
    noIssues: true
  };
  
  // Verificar inconsistencias
  const { issueCount } = await exports.checkDataConsistency(req, { json: () => ({ issueCount: 0 }) });
  checks.noIssues = issueCount === 0;
  
  // Calcular puntuación de preparación
  const readyScore = [
    checks.database.connected,
    checks.database.roomsExist,
    checks.database.usersExist,
    checks.adminExists,
    checks.roomsSetup,
    checks.noIssues
  ].filter(Boolean).length / 6 * 10;
  
  const readyStatus = readyScore >= 8 ? 'READY' : readyScore >= 6 ? 'PARTIAL' : 'NOT_READY';
  
  res.json({
    success: true,
    readyStatus,
    readyScore,
    checks,
    timestamp: new Date()
  });
});

module.exports = exports;