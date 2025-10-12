// routes/systemRoutes.js
// Rutas para información y estadísticas del sistema

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { adminLimiter } = require('../config/rateLimiter');
const { validateRealData } = require('../middlewares/maintenanceMiddleware');
const { logger } = require('../config/logger');

// Estadísticas del sistema - Solo admin/recepcionista
router.get('/stats', adminLimiter, protect, authorize('admin', 'recepcionista'), systemController.getSystemStats);

// Verificación de consistencia de datos - Solo admin
router.get('/consistency', adminLimiter, protect, authorize('admin'), systemController.checkDataConsistency);

// Datos reales para script de validación - Solo admin
router.get('/real-data', adminLimiter, protect, authorize('admin'), validateRealData, systemController.getRealSystemData);

// Verificación de sistema listo para producción - Acceso público para CI/CD
router.get('/ready-check', systemController.systemReadyCheck);

/**
 * @route GET /api/system/port
 * @desc Obtiene el puerto actual del servidor
 * @access Public
 */
router.get('/port', (req, res) => {
  try {
    // Intentar obtener el puerto directamente de la configuración del servidor
    const port = req.app.get('port') || process.env.PORT || 5002;
    
    // Guardar el puerto en un archivo para que esté disponible entre reinicios
    const portFile = path.join(__dirname, '../port.txt');
    try {
      fs.writeFileSync(portFile, port.toString(), 'utf8');
    } catch (writeError) {
      logger.warn('No se pudo guardar el puerto en port.txt:', writeError);
    }
    
    // Determinar el protocolo basado en la solicitud
    const protocol = req.protocol === 'https' ? 'wss' : 'ws';
    const host = req.hostname || 'localhost';
    
    // Construir la URL para WebSocket con el puerto actual y protocolo adecuado
    const wsUrl = `${protocol}://${host}:${port}/ws`;
    
    return res.json({ 
      success: true, 
      port: parseInt(port),
      wsEndpoint: wsUrl,
      server: {
        host: host,
        protocol: req.protocol,
        wsProtocol: protocol
      }
    });
  } catch (error) {
    logger.error('Error obteniendo información del puerto:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener información del puerto',
      error: error.message 
    });
  }
});

/**
 * @route GET /api/system/status
 * @desc Comprueba el estado del servidor y servicios
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Comprobar la conexión a MongoDB
    const dbStatus = mongoose.connection.readyState === 1 
      ? 'connected' 
      : 'disconnected';
    
    // Comprobar el WebSocket Server
    const wss = req.app.get('wss');
    const wsStatus = wss ? 'active' : 'inactive';
    const wsClients = wss ? wss.clients.size : 0;
    
    // Información del sistema
    const status = {
      server: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      websocket: {
        status: wsStatus,
        clients: wsClients,
        endpoint: `ws://localhost:${process.env.PORT || 5001}/ws`
      },
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error obteniendo estado del sistema:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estado del sistema',
      error: error.message 
    });
  }
});

module.exports = router;