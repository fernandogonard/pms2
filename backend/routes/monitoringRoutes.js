// routes/monitoringRoutes.js
// Rutas para monitoreo del sistema - Rate limiting y métricas
// Solo accesible para administradores

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { adminLimiter } = require('../config/rateLimiter');
const { rateLimiterMonitor } = require('../config/rateLimiterMonitor');
const { productionLoggerConfig } = require('../config/productionLogger');

// Middleware: solo admins pueden ver métricas
router.use(adminLimiter);
router.use(protect);
router.use(authorize('admin'));

// GET /api/monitoring/rate-limit - Métricas de rate limiting
router.get('/rate-limit', (req, res) => {
  try {
    const metrics = rateLimiterMonitor.getMetrics();
    
    productionLoggerConfig.logBusinessEvent('RATE_LIMIT_METRICS_ACCESSED', {
      accessedBy: req.user.id,
      metricsRequested: 'rate-limit'
    }, req.user.id, 'info');

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas de rate limiting',
      error: error.message
    });
  }
});

// GET /api/monitoring/system - Métricas del sistema
router.get('/system', (req, res) => {
  try {
    const systemMetrics = productionLoggerConfig.logSystemMetrics();
    
    productionLoggerConfig.logBusinessEvent('SYSTEM_METRICS_ACCESSED', {
      accessedBy: req.user.id,
      metricsRequested: 'system'
    }, req.user.id, 'info');

    res.json({
      success: true,
      data: systemMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas del sistema',
      error: error.message
    });
  }
});

// POST /api/monitoring/reset-rate-limit - Reset métricas de rate limiting
router.post('/reset-rate-limit', (req, res) => {
  try {
    const oldMetrics = rateLimiterMonitor.getMetrics();
    rateLimiterMonitor.resetMetrics();
    
    productionLoggerConfig.logBusinessEvent('RATE_LIMIT_METRICS_MANUAL_RESET', {
      resetBy: req.user.id,
      previousMetrics: oldMetrics.summary
    }, req.user.id, 'warn');

    res.json({
      success: true,
      message: 'Métricas de rate limiting reseteadas',
      previousData: oldMetrics.summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reseteando métricas',
      error: error.message
    });
  }
});

// GET /api/monitoring/health - Health check avanzado
router.get('/health', (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.version,
      rateLimiting: {
        active: true,
        metrics: rateLimiterMonitor.getMetrics().summary
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        metricsEnabled: process.env.ENABLE_METRICS_LOGGING === 'true'
      }
    };

    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en health check',
      error: error.message
    });
  }
});

module.exports = router;