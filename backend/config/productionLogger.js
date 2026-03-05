// config/productionLogger.js
// Configuración adicional de logs para producción y debugging avanzado
// Mejora técnica para monitoreo detallado

const { logger, logHelpers } = require('./logger');
const os = require('os');

// Configuración específica para producción
const productionLoggerConfig = {
  // Métricas del sistema
  logSystemMetrics: () => {
    const metrics = {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      system: {
        uptime: Math.round(process.uptime()),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      timestamp: new Date().toISOString()
    };

    logger.info('System metrics', {
      ...metrics,
      event: 'SYSTEM_METRICS'
    });

    return metrics;
  },

  // Logs de performance de queries de BD
  logDatabaseQuery: (operation, collection, query, executionTime, resultCount) => {
    const logLevel = executionTime > 1000 ? 'warn' : 'debug';
    
    logger.log(logLevel, 'Database query executed', {
      operation,
      collection,
      query: JSON.stringify(query),
      executionTime: `${executionTime}ms`,
      resultCount,
      event: 'DB_QUERY_PERFORMANCE'
    });

    // Si la query es lenta (>1s), logear como warning
    if (executionTime > 1000) {
      logger.warn('Slow database query detected', {
        operation,
        collection,
        executionTime: `${executionTime}ms`,
        event: 'DB_SLOW_QUERY'
      });
    }
  },

  // Logs detallados de errores con contexto
  logDetailedError: (error, req, additionalContext = {}) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode || 500,
      timestamp: new Date().toISOString(),
      ...additionalContext
    };

    if (req) {
      errorDetails.request = {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        body: req.body,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null
      };
    }

    logger.error('Detailed error information', {
      ...errorDetails,
      event: 'DETAILED_ERROR'
    });

    return errorDetails;
  },

  // Logs de eventos de negocio críticos
  logBusinessEvent: (eventType, data, userId, severity = 'info') => {
    logger.log(severity, `Business event: ${eventType}`, {
      eventType,
      data,
      userId,
      timestamp: new Date().toISOString(),
      event: 'BUSINESS_EVENT'
    });
  },

  // Logs de sesiones de usuario
  logUserSession: (action, userId, sessionData) => {
    logger.info(`User session ${action}`, {
      userId,
      action,
      sessionData,
      timestamp: new Date().toISOString(),
      event: 'USER_SESSION'
    });
  },

  // Logs de integraciones externas
  logExternalIntegration: (service, action, success, responseTime, error = null) => {
    const logLevel = success ? 'info' : 'error';
    
    logger.log(logLevel, `External integration: ${service}`, {
      service,
      action,
      success,
      responseTime: `${responseTime}ms`,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
      event: 'EXTERNAL_INTEGRATION'
    });
  }
};

// Middleware avanzado para debugging en producción
const advancedRequestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Añadir ID único a la request
  req.requestId = requestId;
  
  // Log inicial con más detalles
  logger.debug('Request initiated', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: req.user ? req.user.id : null,
    query: Object.keys(req.query).length > 0 ? req.query : null,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    event: 'REQUEST_INITIATED'
  });

  // Override de res.json para logging detallado
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - start;
    const responseSize = JSON.stringify(data).length;
    
    logger.debug('Request completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseSize: `${responseSize} bytes`,
      userId: req.user ? req.user.id : null,
      event: 'REQUEST_COMPLETED'
    });

    // Log de performance si es lenta (>2s)
    if (responseTime > 2000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        event: 'SLOW_REQUEST'
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

// Configurar logs periódicos de métricas (cada 5 minutos en producción)
const startPeriodicMetricsLogging = () => {
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      try {
        productionLoggerConfig.logSystemMetrics();
      } catch (error) {
        logger.error('Error logging system metrics', {
          error: error.message,
          event: 'METRICS_ERROR'
        });
      }
    }, 5 * 60 * 1000); // 5 minutos

    logger.info('Periodic metrics logging started', {
      interval: '5 minutes',
      event: 'METRICS_LOGGING_STARTED'
    });
  }
};

// Manejador global de errores no capturados con contexto adicional
const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    // IMPORTANTE: NO hacer process.exit() — deja el servidor vivo en Railway
    // Solo err fatales de red/binding deben matar el proceso (manejados en server.js)
    logger.error('Uncaught Exception (servidor continúa)', {
      error: error.message,
      stack: error.stack,
      pid: process.pid,
      uptime: process.uptime(),
      event: 'UNCAUGHT_EXCEPTION'
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason ? reason.toString() : 'Unknown',
      pid: process.pid,
      event: 'UNHANDLED_REJECTION'
    });
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully', {
      event: 'GRACEFUL_SHUTDOWN'
    });
    productionLoggerConfig.logSystemMetrics();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully', {
      event: 'GRACEFUL_SHUTDOWN'
    });
    productionLoggerConfig.logSystemMetrics();
  });
};

module.exports = {
  productionLoggerConfig,
  advancedRequestLogger,
  startPeriodicMetricsLogging,
  setupGlobalErrorHandlers
};