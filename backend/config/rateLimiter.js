// config/rateLimiter.js
// Sistema de rate limiting para el CRM hotelero

const rateLimit = require('express-rate-limit');
const { logHelpers } = require('./logger');

// Rate limiter general para todas las rutas
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP',
    message: 'Has excedido el límite de solicitudes. Intenta nuevamente en 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'general');
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP',
      message: 'Has excedido el límite de solicitudes. Intenta nuevamente en 15 minutos.',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter estricto para login (prevenir ataques de fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP por ventana
  message: {
    error: 'Demasiados intentos de login',
    message: 'Has excedido el límite de intentos de login. Intenta nuevamente en 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // no contar requests exitosos
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'login');
    logHelpers.security.bruteForce(req.ip, req.rateLimit.current);
    res.status(429).json({
      error: 'Demasiados intentos de login',
      message: 'Has excedido el límite de intentos de login. Intenta nuevamente en 15 minutos.',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter para registro de usuarios
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP por hora
  message: {
    error: 'Demasiados registros desde esta IP',
    message: 'Has excedido el límite de registros por hora. Intenta nuevamente más tarde.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'register');
    res.status(429).json({
      error: 'Demasiados registros desde esta IP',
      message: 'Has excedido el límite de registros por hora. Intenta nuevamente más tarde.',
      retryAfter: '1 hora'
    });
  }
});

// Rate limiter para APIs de reservaciones (más permisivo)
const reservationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: {
    error: 'Demasiadas solicitudes de reservación',
    message: 'Has excedido el límite de solicitudes para reservaciones. Intenta nuevamente en 5 minutos.',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'reservations');
    res.status(429).json({
      error: 'Demasiadas solicitudes de reservación',
      message: 'Has excedido el límite de solicitudes para reservaciones. Intenta nuevamente en 5 minutos.',
      retryAfter: '5 minutos'
    });
  }
});

// Rate limiter para consultas de habitaciones
const roomsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 requests por IP por minuto
  message: {
    error: 'Demasiadas consultas de habitaciones',
    message: 'Has excedido el límite de consultas de habitaciones. Intenta nuevamente en 1 minuto.',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'rooms');
    res.status(429).json({
      error: 'Demasiadas consultas de habitaciones',
      message: 'Has excedido el límite de consultas de habitaciones. Intenta nuevamente en 1 minuto.',
      retryAfter: '1 minuto'
    });
  }
});

// Rate limiter para reportes (más restrictivo)
const reportsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // máximo 20 reportes por IP por ventana
  message: {
    error: 'Demasiadas solicitudes de reportes',
    message: 'Has excedido el límite de generación de reportes. Intenta nuevamente en 10 minutos.',  
    retryAfter: '10 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'reports');
    res.status(429).json({
      error: 'Demasiadas solicitudes de reportes',
      message: 'Has excedido el límite de generación de reportes. Intenta nuevamente en 10 minutos.',
      retryAfter: '10 minutos'
    });
  }
});

// Rate limiter para APIs administrativas (muy restrictivo)
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // máximo 50 requests por IP por ventana
  message: {
    error: 'Demasiadas solicitudes administrativas',
    message: 'Has excedido el límite de operaciones administrativas. Intenta nuevamente en 5 minutos.',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'admin');
    res.status(429).json({
      error: 'Demasiadas solicitudes administrativas',
      message: 'Has excedido el límite de operaciones administrativas. Intenta nuevamente en 5 minutos.',
      retryAfter: '5 minutos'
    });
  }
});

// Rate limiter para creación de clientes
const createClientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // máximo 30 clientes nuevos por IP por ventana
  message: {
    error: 'Demasiadas creaciones de clientes',
    message: 'Has excedido el límite de creación de clientes. Intenta nuevamente en 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'create-client');
    res.status(429).json({
      error: 'Demasiadas creaciones de clientes',
      message: 'Has excedido el límite de creación de clientes. Intenta nuevamente en 15 minutos.',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter para analytics (consultas intensivas)
const analyticsLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 30, // máximo 30 consultas de analytics por IP por ventana
  message: {
    error: 'Demasiadas consultas de analytics',
    message: 'Has excedido el límite de consultas de analytics. Intenta nuevamente en 2 minutos.',
    retryAfter: '2 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'analytics');
    res.status(429).json({
      error: 'Demasiadas consultas de analytics',
      message: 'Has excedido el límite de consultas de analytics. Intenta nuevamente en 2 minutos.',
      retryAfter: '2 minutos'
    });
  }
});

// Configuración de rate limiting por entorno
const getRateLimiterConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // En producción, usar límites estrictos
    return {
      general: generalLimiter,
      login: loginLimiter,
      register: registerLimiter,
      reservations: reservationLimiter,
      rooms: roomsLimiter,
      reports: reportsLimiter,
      admin: adminLimiter,
      createClient: createClientLimiter
    };
  } else {
    // En desarrollo, límites más permisivos
    const devMultiplier = 10;
    
    return {
      general: rateLimit({ ...generalLimiter.options, max: generalLimiter.options.max * devMultiplier }),
      login: rateLimit({ ...loginLimiter.options, max: loginLimiter.options.max * devMultiplier }),
      register: rateLimit({ ...registerLimiter.options, max: registerLimiter.options.max * devMultiplier }),
      reservations: rateLimit({ ...reservationLimiter.options, max: reservationLimiter.options.max * devMultiplier }),
      rooms: rateLimit({ ...roomsLimiter.options, max: roomsLimiter.options.max * devMultiplier }),
      reports: rateLimit({ ...reportsLimiter.options, max: reportsLimiter.options.max * devMultiplier }),
      admin: rateLimit({ ...adminLimiter.options, max: adminLimiter.options.max * devMultiplier }),
      createClient: rateLimit({ ...createClientLimiter.options, max: createClientLimiter.options.max * devMultiplier })
    };
  }
};

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  reservationLimiter,
  roomsLimiter,
  reportsLimiter,
  adminLimiter,
  createClientLimiter,
  analyticsLimiter,
  getRateLimiterConfig
};