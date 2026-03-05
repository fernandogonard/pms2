// Logger service - Sistema de logging profesional con Winston
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs solo en desarrollo (Railway no tiene FS persistente)
const logsDir = path.join(__dirname, '../logs');
let logsAvailable = false;
if (process.env.NODE_ENV !== 'production') {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logsAvailable = true;
  } catch (e) {
    console.warn('[loggerService] No se pudo crear directorio de logs:', e.message);
  }
}

// Configuración de formatos
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Añadir metadatos si existen
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Añadir stack trace para errores
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Configuración de transports
const transports = [
  // Console transport siempre activo (Railway captura stdout)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    ),
    level: process.env.LOG_LEVEL || 'info'
  })
];

// File transports solo en desarrollo (cuando el filesystem está disponible)
if (logsAvailable) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 5,
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'errors.log'),
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 5,
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'system.log'),
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 10,
      level: 'debug'
    })
  );
}

// Crear logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  exitOnError: false,
  // Manejar excepciones/rechazos: en producción solo Console, en dev también File
  exceptionHandlers: logsAvailable ? [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log'), format: customFormat })
  ] : [new winston.transports.Console({ format: customFormat })],
  rejectionHandlers: logsAvailable ? [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log'), format: customFormat })
  ] : [new winston.transports.Console({ format: customFormat })]
});

// Logger específico para seguridad
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: logsAvailable
    ? [new winston.transports.File({ filename: path.join(logsDir, 'security.log'), maxsize: 10485760, maxFiles: 10 })]
    : [new winston.transports.Console()]
});

// Logger específico para auditoría
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: logsAvailable
    ? [new winston.transports.File({ filename: path.join(logsDir, 'audit.log'), maxsize: 10485760, maxFiles: 20 })]
    : [new winston.transports.Console()]
});

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: logsAvailable
    ? [new winston.transports.File({ filename: path.join(logsDir, 'performance.log'), maxsize: 5242880, maxFiles: 5 })]
    : [new winston.transports.Console()]
});

// Funciones de utilidad para logging estructurado
const loggerService = {
  // Logging general
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, error = null, meta = {}) => {
    const logData = { ...meta };
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    logger.error(message, logData);
  },
  debug: (message, meta = {}) => logger.debug(message, meta),

  // Logging de seguridad
  security: {
    loginAttempt: (email, success, ip, userAgent) => {
      securityLogger.info('Login attempt', {
        type: 'login_attempt',
        email,
        success,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
      });
    },

    loginSuccess: (userId, email, ip, userAgent) => {
      securityLogger.info('Login successful', {
        type: 'login_success',
        userId,
        email,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
      });
    },

    loginFailure: (email, reason, ip, userAgent) => {
      securityLogger.warn('Login failed', {
        type: 'login_failure',
        email,
        reason,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
      });
    },

    suspiciousActivity: (type, details, userId = null, ip = null) => {
      securityLogger.warn('Suspicious activity detected', {
        type: 'suspicious_activity',
        activityType: type,
        details,
        userId,
        ip,
        timestamp: new Date().toISOString()
      });
    },

    rateLimitExceeded: (ip, endpoint, attempts) => {
      securityLogger.warn('Rate limit exceeded', {
        type: 'rate_limit_exceeded',
        ip,
        endpoint,
        attempts,
        timestamp: new Date().toISOString()
      });
    },

    validationError: (endpoint, errors, ip, userId = null) => {
      securityLogger.info('Validation error', {
        type: 'validation_error',
        endpoint,
        errors,
        ip,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Logging de auditoría
  audit: {
    userAction: (action, userId, resourceType, resourceId, details = {}) => {
      auditLogger.info('User action', {
        type: 'user_action',
        action,
        userId,
        resourceType,
        resourceId,
        details,
        timestamp: new Date().toISOString()
      });
    },

    dataChange: (operation, table, recordId, changes, userId) => {
      auditLogger.info('Data change', {
        type: 'data_change',
        operation, // CREATE, UPDATE, DELETE
        table,
        recordId,
        changes,
        userId,
        timestamp: new Date().toISOString()
      });
    },

    systemEvent: (event, details = {}) => {
      auditLogger.info('System event', {
        type: 'system_event',
        event,
        details,
        timestamp: new Date().toISOString()
      });
    },

    adminAction: (action, adminId, targetId, details = {}) => {
      auditLogger.info('Admin action', {
        type: 'admin_action',
        action,
        adminId,
        targetId,
        details,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Logging de performance
  performance: {
    requestTime: (method, url, duration, statusCode, userId = null) => {
      performanceLogger.info('Request performance', {
        type: 'request_performance',
        method,
        url,
        duration,
        statusCode,
        userId,
        timestamp: new Date().toISOString()
      });
    },

    queryTime: (query, duration, collection = null) => {
      performanceLogger.info('Database query performance', {
        type: 'query_performance',
        query: query.substring(0, 200), // Truncar queries largas
        duration,
        collection,
        timestamp: new Date().toISOString()
      });
    },

    slowOperation: (operation, duration, details = {}) => {
      performanceLogger.warn('Slow operation detected', {
        type: 'slow_operation',
        operation,
        duration,
        details,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Logging de WebSocket
  websocket: {
    connection: (socketId, userId = null, ip = null) => {
      logger.info('WebSocket connection established', {
        type: 'websocket_connection',
        socketId,
        userId,
        ip,
        timestamp: new Date().toISOString()
      });
    },

    disconnection: (socketId, reason = null) => {
      logger.info('WebSocket disconnection', {
        type: 'websocket_disconnection',
        socketId,
        reason,
        timestamp: new Date().toISOString()
      });
    },

    message: (event, socketId, userId = null, data = {}) => {
      logger.debug('WebSocket message', {
        type: 'websocket_message',
        event,
        socketId,
        userId,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Middleware para logging automático de requests HTTP
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Capturar la respuesta original
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log de performance para requests lentos
    if (duration > 1000) {
      loggerService.performance.slowOperation('HTTP Request', duration, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      });
    }

    // Log de request normal
    loggerService.performance.requestTime(
      req.method,
      req.originalUrl,
      duration,
      res.statusCode,
      req.user?.id
    );

    return originalSend.call(this, data);
  };

  next();
};

// Middleware para logging de errores
const errorLogger = (error, req, res, next) => {
  loggerService.error('Unhandled error in request', error, {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next(error);
};

module.exports = {
  logger: loggerService,
  requestLogger,
  errorLogger,
  winston: logger // Para casos especiales
};