// config/rateLimiter.js
// Sistema de rate limiting para el CRM hotelero

const rateLimit = require('express-rate-limit');
const { logHelpers } = require('./logger');

// Ajustar el límite de solicitudes para el entorno de desarrollo
const isDevelopment = process.env.NODE_ENV === 'development';
const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === '1';

// Función para crear un rate limiter condicional
const createRateLimiter = (options) => {
  if (isRateLimitDisabled) {
    return (req, res, next) => next(); // Deshabilitar rate limit
  }
  return rateLimit(options);
};

// Rate limiter general para todas las rutas
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 5000 : 1000, // Incrementar límite a 5000 en desarrollo
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

// Ajustar temporalmente el rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Incrementar límite a 20 intentos de login por IP por ventana
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
const roomsLimiter = createRateLimiter({
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
const analyticsLimiter = (() => {
  const env = process.env.NODE_ENV || 'development';
  const baseOptions = {
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
  };

  // En desarrollo, dar más margen para dashboards (10x solicitudes)
  if (env !== 'production') {
    return rateLimit({ ...baseOptions, max: baseOptions.max * 10 });
  }

  return rateLimit(baseOptions);
})();

// Ajustar temporalmente el rate limiter para /api/system/port
const systemPortLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // Incrementar límite a 1000 requests por IP por minuto
  message: {
    error: 'Demasiadas solicitudes al sistema',
    message: 'Has excedido el límite de solicitudes al sistema. Intenta nuevamente en 1 minuto.',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logHelpers.security.rateLimitExceeded(req.ip, 'system-port');
    res.status(429).json({
      error: 'Demasiadas solicitudes al sistema',
      message: 'Has excedido el límite de solicitudes al sistema. Intenta nuevamente en 1 minuto.',
      retryAfter: '1 minuto'
    });
  }
});

// Incrementar límites para endpoints críticos y reducir restricciones
const rateLimiterConfig = {
  '/api/system/port': {
      max: 3000, // Incrementado de 500 a 3000
      windowMs: 15 * 60 * 1000, // 15 minutos
  },
  '/api/stats/rooms': {
      max: 300, // Incrementado de 150 a 300
      windowMs: 15 * 60 * 1000, // 15 minutos
  },
  '/api/reservations': {
      max: 300, // Incrementado de 150 a 300
      windowMs: 15 * 60 * 1000, // 15 minutos
  },
  '/api/rooms': {
      max: 300, // Incrementado de 150 a 300
      windowMs: 15 * 60 * 1000, // 15 minutos
  },
  '/api/reservations/pending-checkouts': {
      max: 300, // Incrementado de 150 a 300
      windowMs: 15 * 60 * 1000, // 15 minutos
  },
};

// Configuración de rate limiting por entorno
const getRateLimiterConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const disable = process.env.DISABLE_RATE_LIMITER === 'true';

  // Middleware que no limita nada
  const noLimit = (req, res, next) => next();

  if (disable) {
    // Si está activada la variable de entorno, deshabilitar todos los limiters
    return {
      general: noLimit,
      login: noLimit,
      register: noLimit,
      reservations: noLimit,
      rooms: noLimit,
      reports: noLimit,
      admin: noLimit,
      createClient: noLimit
    };
  }

  if (env === 'production') {
    // En producción, usar límites estrictos
    return {
      general: generalLimiter || {},
      login: loginLimiter || {},
      register: registerLimiter || {},
      reservations: reservationLimiter || {},
      rooms: roomsLimiter || {},
      reports: reportsLimiter || {},
      admin: adminLimiter || {},
      createClient: createClientLimiter || {}
    };
  } else {
    // En desarrollo, límites MUY permisivos
    const devMultiplier = 100;
    return {
      general: rateLimit({ ...generalLimiter?.options, max: (generalLimiter?.options?.max || 1) * devMultiplier }),
      login: rateLimit({ ...loginLimiter?.options, max: (loginLimiter?.options?.max || 1) * devMultiplier }),
      register: rateLimit({ ...registerLimiter?.options, max: (registerLimiter?.options?.max || 1) * devMultiplier }),
      reservations: rateLimit({ ...reservationLimiter?.options, max: (reservationLimiter?.options?.max || 1) * devMultiplier }),
      rooms: rateLimit({ ...roomsLimiter?.options, max: (roomsLimiter?.options?.max || 1) * devMultiplier }),
      reports: rateLimit({ ...reportsLimiter?.options, max: (reportsLimiter?.options?.max || 1) * devMultiplier }),
      admin: rateLimit({ ...adminLimiter?.options, max: (adminLimiter?.options?.max || 1) * devMultiplier }),
      createClient: rateLimit({ ...createClientLimiter?.options, max: (createClientLimiter?.options?.max || 1) * devMultiplier })
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
  systemPortLimiter, // Exportar el nuevo rate limiter
  getRateLimiterConfig,
  rateLimiterConfig
};