// config/logger.js
// Sistema de logging profesional para el CRM hotelero

const winston = require('winston');
const path = require('path');

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Configuración de formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Configuración para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = ' ' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// Crear el logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'crm-hotelero' },
  transports: [
    // Errores en archivo separado
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Todos los logs en combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Logs de aplicación (info y superior)
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ],
});

// En desarrollo, también mostrar logs en consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Funciones helper para diferentes tipos de logs
const logHelpers = {
  // Logs de autenticación
  auth: {
    login: (userId, ip, userAgent) => logger.info('Login exitoso', {
      userId,
      ip,
      userAgent,
      event: 'AUTH_LOGIN'
    }),
    
    loginFailed: (email, ip, reason) => logger.warn('Intento de login fallido', {
      email,
      ip,
      reason,
      event: 'AUTH_LOGIN_FAILED'
    }),
    
    logout: (userId, ip) => logger.info('Logout', {
      userId,
      ip,
      event: 'AUTH_LOGOUT'
    }),
    
    tokenExpired: (userId) => logger.warn('Token expirado', {
      userId,
      event: 'AUTH_TOKEN_EXPIRED'
    })
  },

  // Logs de reservaciones
  reservation: {
    created: (reservationId, userId, roomId, checkIn, checkOut) => logger.info('Reservación creada', {
      reservationId,
      userId,
      roomId,
      checkIn,
      checkOut,
      event: 'RESERVATION_CREATED'
    }),
    
    updated: (reservationId, userId, changes) => logger.info('Reservación actualizada', {
      reservationId,
      userId,
      changes,
      event: 'RESERVATION_UPDATED'
    }),
    
    cancelled: (reservationId, userId, reason) => logger.info('Reservación cancelada', {
      reservationId,
      userId,
      reason,
      event: 'RESERVATION_CANCELLED'
    }),
    
    checkIn: (reservationId, roomId, userId) => logger.info('Check-in realizado', {
      reservationId,
      roomId,
      userId,
      event: 'RESERVATION_CHECKIN'
    }),
    
    checkOut: (reservationId, roomId, userId) => logger.info('Check-out realizado', {
      reservationId,
      roomId,
      userId,
      event: 'RESERVATION_CHECKOUT'
    })
  },

  // Logs de habitaciones
  room: {
    availabilityCheck: (type, dateRange, found) => logger.debug('Consulta de disponibilidad', {
      type,
      dateRange,
      found,
      event: 'ROOM_AVAILABILITY_CHECK'
    }),
    
    statusChanged: (roomId, oldStatus, newStatus, userId) => logger.info('Estado de habitación cambiado', {
      roomId,
      oldStatus,
      newStatus,
      userId,
      event: 'ROOM_STATUS_CHANGED'
    }),
    
    maintenanceScheduled: (roomId, userId, scheduledDate) => logger.info('Mantenimiento programado', {
      roomId,
      userId,
      scheduledDate,
      event: 'ROOM_MAINTENANCE_SCHEDULED'
    })
  },

  // Logs de clientes
  client: {
    created: (clientId, userId) => logger.info('Cliente creado', {
      clientId,
      userId,
      event: 'CLIENT_CREATED'
    }),
    
    updated: (clientId, userId, changes) => logger.info('Cliente actualizado', {
      clientId,
      userId,
      changes,
      event: 'CLIENT_UPDATED'
    }),
    
    deleted: (clientId, userId) => logger.warn('Cliente eliminado', {
      clientId,
      userId,
      event: 'CLIENT_DELETED'
    })
  },

  // Logs de sistema
  system: {
    startup: (port, environment) => logger.info('Servidor iniciado', {
      port,
      environment,
      event: 'SYSTEM_STARTUP'
    }),
    
    shutdown: () => logger.info('Servidor detenido', {
      event: 'SYSTEM_SHUTDOWN'
    }),
    
    dbConnected: () => logger.info('Conectado a base de datos', {
      event: 'DB_CONNECTED'
    }),
    
    dbDisconnected: () => logger.warn('Desconectado de base de datos', {
      event: 'DB_DISCONNECTED'
    }),
    
    dbError: (error) => logger.error('Error de base de datos', {
      error: error.message,
      stack: error.stack,
      event: 'DB_ERROR'
    })
  },

  // Logs de API
  api: {
    request: (method, url, ip, userAgent, userId) => logger.debug('API Request', {
      method,
      url,
      ip,
      userAgent,
      userId,
      event: 'API_REQUEST'
    }),
    
    response: (method, url, statusCode, responseTime, userId) => logger.debug('API Response', {
      method,
      url,
      statusCode,
      responseTime,
      userId,
      event: 'API_RESPONSE'
    }),
    
    error: (method, url, error, userId) => logger.error('API Error', {
      method,
      url,
      error: error.message,
      stack: error.stack,
      userId,
      event: 'API_ERROR'
    })
  },

  // Logs de seguridad
  security: {
    bruteForce: (ip, attemptCount) => logger.warn('Posible ataque de fuerza bruta', {
      ip,
      attemptCount,
      event: 'SECURITY_BRUTE_FORCE'
    }),
    
    invalidToken: (token, ip) => logger.warn('Token inválido detectado', {
      token: token.substring(0, 10) + '...',
      ip,
      event: 'SECURITY_INVALID_TOKEN'
    }),
    
    unauthorized: (userId, resource, action) => logger.warn('Acceso no autorizado', {
      userId,
      resource,
      action,
      event: 'SECURITY_UNAUTHORIZED'
    }),
    
    rateLimitExceeded: (ip, endpoint) => logger.warn('Límite de rate excedido', {
      ip,
      endpoint,
      event: 'SECURITY_RATE_LIMIT'
    })
  }
};

// Middleware para logging de requests
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const userId = req.user ? req.user.id : null;
  
  // Log de request
  logHelpers.api.request(
    req.method,
    req.originalUrl,
    req.ip,
    req.get('User-Agent'),
    userId
  );
  
  // Override del res.end para capturar la respuesta
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - start;
    logHelpers.api.response(
      req.method,
      req.originalUrl,
      res.statusCode,
      responseTime + 'ms',
      userId
    );
    return originalSend.call(this, data);
  };
  
  next();
};

// Manejador de errores no capturados
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'exceptions.log'),
    maxsize: 5242880,
    maxFiles: 2
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'rejections.log'),
    maxsize: 5242880,
    maxFiles: 2
  })
);

module.exports = {
  logger,
  logHelpers,
  requestLogger
};