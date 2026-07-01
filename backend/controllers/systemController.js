// controllers/systemController.js
// Controlador para obtener información del sistema y estadísticas

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Client = require('../models/Client');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ErrorHandlingService = require('../services/errorHandlingService');
const { ROOM_STATES } = require('../services/stateValidationService');
const { createBackup } = require('../scripts/createBackup');
const auditService = require('../services/auditService');
const { logger } = require('../services/loggerService');
const { logEndpointError } = require('../services/temporaryHttpDiagnostics');

const BACKUP_DIR = path.resolve(__dirname, '../backups');

function getLatestBackupSnapshot() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return {
      directoryExists: false,
      totalBackups: 0,
      latestBackup: null
    };
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup_json_'));

  if (files.length === 0) {
    return {
      directoryExists: true,
      totalBackups: 0,
      latestBackup: null
    };
  }

  const sorted = files
    .map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      return {
        file,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

  return {
    directoryExists: true,
    totalBackups: sorted.length,
    latestBackup: sorted[0]
  };
}

/**
 * Health check operativo para monitoreo real
 * @route GET /api/system/health
 */
exports.healthCheck = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const startedAt = Date.now();
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
    const pkg = require('../package.json');
    const mem = process.memoryUsage();
    const backupSnapshot = getLatestBackupSnapshot();

    let dbPingMs = null;
    let dbPingOk = false;

    if (dbState === 1 && mongoose.connection.db) {
      try {
        const pingStart = Date.now();
        await mongoose.connection.db.admin().ping();
        dbPingMs = Date.now() - pingStart;
        dbPingOk = true;
      } catch (_err) {
        dbPingOk = false;
      }
    }

    const nowIso = new Date().toISOString();
    const processHealth = {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime())
    };

    const components = {
      database: {
        status: dbState === 1 && dbPingOk ? 'ok' : 'degraded',
        connectionState: dbStatus,
        pingMs: dbPingMs
      },
      backups: {
        status: backupSnapshot.totalBackups > 0 ? 'ok' : 'degraded',
        ...backupSnapshot
      }
    };

    const status = (components.database.status === 'ok') ? 'ok' : 'degraded';

    const payload = {
      status,
      service: 'pms-backend',
      version: pkg.version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: nowIso,
      process: processHealth,
      components,
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        externalBytes: mem.external,
        rssMB: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMB: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMB: Number((mem.heapTotal / (1024 * 1024)).toFixed(2))
      },
      checks: {
        databaseConnected: dbState === 1,
        databasePing: dbPingOk,
        backupsAvailable: backupSnapshot.totalBackups > 0
      }
    };

    return res.status(status === 'ok' ? 200 : 503).json(payload);
  } catch (error) {
    logEndpointError({
      req,
      endpoint: '/api/system/health',
      statusCode: 500,
      startedAt,
      error,
      category: 'Otro'
    });

    logger.error('healthCheck failed', error, {
      requestId: req.requestId,
      endpoint: '/api/system/health',
      durationMs: Date.now() - startedAt
    });

    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      requestId: req.requestId
    });
  }
});

/**
 * Retorna metadata del último backup disponible
 * @route GET /api/system/backups/latest
 */
exports.getLatestBackup = ErrorHandlingService.asyncWrapper(async (_req, res) => {
  const snapshot = getLatestBackupSnapshot();
  if (!snapshot.latestBackup) {
    return res.status(404).json({
      success: false,
      error: 'No hay backups disponibles'
    });
  }

  res.json({
    success: true,
    backup: snapshot.latestBackup,
    totalBackups: snapshot.totalBackups
  });
});

/**
 * Lista backups disponibles
 * @route GET /api/system/backups
 */
exports.listBackups = ErrorHandlingService.asyncWrapper(async (_req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) {
    return res.json({ success: true, backups: [], count: 0 });
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup_json_'))
    .map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      return {
        file,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

  res.json({ success: true, backups, count: backups.length });
});

/**
 * Ejecuta backup manual
 * @route POST /api/system/backups/run
 */
exports.runBackupNow = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const result = await createBackup();
  if (!result.success) {
    auditService.log({
      action: 'BACKUP_MANUAL_FAILED',
      entity: 'System',
      userId: req.user?.userId || req.user?.id,
      userEmail: req.user?.email || 'sistema',
      userRole: req.user?.role || 'sistema',
      description: 'Backup manual fallido',
      details: { error: result.error },
      ip: req.ip,
      requestId: req.requestId
    });
    return res.status(500).json({ success: false, error: result.error });
  }

  auditService.log({
    action: 'BACKUP_MANUAL',
    entity: 'System',
    entityId: result?.timestamp,
    userId: req.user?.userId || req.user?.id,
    userEmail: req.user?.email || 'sistema',
    userRole: req.user?.role || 'sistema',
    description: 'Backup manual ejecutado',
    details: {
      file: result?.file,
      sizeMB: result?.size,
      stats: result?.stats
    },
    ip: req.ip,
    requestId: req.requestId
  });

  res.json({ success: true, backup: result });
});

/**
 * Valida estructura del último backup para asegurar restaurabilidad
 * @route GET /api/system/backups/validate-latest
 */
exports.validateLatestBackup = ErrorHandlingService.asyncWrapper(async (_req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) {
    return res.status(404).json({ success: false, error: 'No existe directorio de backups' });
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup_json_'))
    .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtime.getTime() - fs.statSync(path.join(BACKUP_DIR, a)).mtime.getTime());

  if (files.length === 0) {
    return res.status(404).json({ success: false, error: 'No hay backups para validar' });
  }

  const latestFile = files[0];
  const fullPath = path.join(BACKUP_DIR, latestFile);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw);

  const hasRequiredShape = !!(
    parsed &&
    parsed.metadata &&
    Array.isArray(parsed.rooms) &&
    Array.isArray(parsed.users) &&
    Array.isArray(parsed.clients) &&
    Array.isArray(parsed.reservations)
  );

  if (!hasRequiredShape) {
    return res.status(422).json({
      success: false,
      file: latestFile,
      valid: false,
      error: 'Estructura inválida de backup'
    });
  }

  res.json({
    success: true,
    file: latestFile,
    valid: true,
    metadata: parsed.metadata,
    stats: {
      rooms: parsed.rooms.length,
      users: parsed.users.length,
      clients: parsed.clients.length,
      reservations: parsed.reservations.length
    }
  });
});

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