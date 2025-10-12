// controllers/cleaningController.js
// Controlador para la gestión del proceso de limpieza de habitaciones

const Room = require('../models/Room');
const { logger } = require('../config/logger');
const { markRoomAsClean, markRoomsAsClean, getRoomsInCleaning } = require('../services/roomAssignmentService');
const { validateRoomStateTransition } = require('../services/stateValidationService');

/**
 * @route   GET /api/rooms/cleaning
 * @desc    Obtener habitaciones en estado de limpieza
 * @access  Private (Recepcionista, Limpieza)
 */
exports.getRoomsInCleaning = async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'limpieza' }).sort({ number: 1 });
    
    res.json({
      success: true,
      message: `Se encontraron ${rooms.length} habitaciones en limpieza`,
      rooms
    });
  } catch (error) {
    logger.error('Error obteniendo habitaciones en limpieza:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener habitaciones en limpieza',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/rooms/:id/clean
 * @desc    Marcar una habitación como limpia (cambiar de "limpieza" a "disponible")
 * @access  Private (Recepcionista, Limpieza)
 */
exports.markRoomAsClean = async (req, res) => {
  try {
    const roomId = req.params.id;
    
    // Verificar que la habitación existe
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Habitación no encontrada'
      });
    }
    
    // Verificar que la habitación está en estado de limpieza
    if (room.status !== 'limpieza') {
      return res.status(400).json({
        success: false,
        message: `La habitación #${room.number} no está en estado de limpieza actualmente`,
        currentStatus: room.status
      });
    }
    
    // Marcar como limpia (disponible)
    room.status = 'disponible';
    room.lastCleaned = new Date();
    await room.save();
    
    // Notificar por WebSocket
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
              previousStatus: 'limpieza'
            }
          }));
        }
      });
    }
    
    logger.info(`Habitación #${room.number} marcada como disponible después de limpieza`);
    
    res.json({
      success: true,
      message: `Habitación #${room.number} marcada como disponible`,
      room
    });
  } catch (error) {
    logger.error('Error marcando habitación como limpia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar habitación como limpia',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/rooms/clean-bulk
 * @desc    Marcar varias habitaciones como limpias de una vez
 * @access  Private (Recepcionista, Limpieza)
 */
exports.markRoomsAsClean = async (req, res) => {
  try {
    const { roomIds } = req.body;
    
    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de IDs de habitaciones'
      });
    }
    
    // Verificar todas las habitaciones antes de proceder
    const rooms = await Room.find({ _id: { $in: roomIds } });
    
    // Filtrar solo las que están en limpieza
    const validRooms = rooms.filter(room => room.status === 'limpieza');
    
    if (validRooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ninguna de las habitaciones especificadas está en estado de limpieza'
      });
    }
    
    // Procesar solo las habitaciones válidas
    const results = [];
    for (const room of validRooms) {
      room.status = 'disponible';
      room.lastCleaned = new Date();
      await room.save();
      results.push(room);
      
      // Notificar por WebSocket
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
                previousStatus: 'limpieza'
              }
            }));
          }
        });
      }
    }
    
    logger.info(`${results.length} habitaciones marcadas como disponibles después de limpieza`);
    
    res.json({
      success: true,
      message: `Se marcaron ${results.length} habitaciones como disponibles`,
      rooms: results,
      skipped: roomIds.length - results.length
    });
  } catch (error) {
    logger.error('Error marcando habitaciones como limpias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar habitaciones como limpias',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/rooms/cleaning/stats
 * @desc    Obtener estadísticas del estado de limpieza
 * @access  Private (Recepcionista, Limpieza, Admin)
 */
exports.getCleaningStats = async (req, res) => {
  try {
    // Contar habitaciones por estado
    const statusCounts = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Formatear resultados
    const stats = {
      total: 0,
      disponible: 0,
      ocupada: 0,
      limpieza: 0,
      mantenimiento: 0
    };
    
    statusCounts.forEach(status => {
      stats[status._id] = status.count;
      stats.total += status.count;
    });
    
    // Habitaciones limpias en las últimas 24 horas
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentlyCleanedCount = await Room.countDocuments({
      lastCleaned: { $gt: oneDayAgo }
    });
    
    stats.recentlyCleanedCount = recentlyCleanedCount;
    stats.cleaningPercentage = stats.limpieza > 0 ? 
      Math.round((recentlyCleanedCount / stats.total) * 100) : 0;
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de limpieza:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de limpieza',
      error: error.message
    });
  }
};