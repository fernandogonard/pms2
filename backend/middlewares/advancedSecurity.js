// Enhanced security middleware - migrado del otro PMS
const helmet = require('helmet');
const { logger } = require('../services/loggerService');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');

// Configuración de seguridad robusta
const securityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        process.env.FRONTEND_URL
      ].filter(Boolean);
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  }
};

// Middleware de sanitización avanzada
const advancedSanitization = (req, res, next) => {
  // mongoSanitize y xssClean ya se aplican en sanitizeInput antes de este middleware.
  // Aquí solo se realiza limpieza de strings propia.
  if (req.body && typeof req.body === 'object') {
    const cleanObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          cleanObject(obj[key]);
        }
      }
    };
    cleanObject(req.body);
  }
  next();
};

// Rate limiting avanzado por usuario
const createUserBasedLimiter = (windowMs = 60 * 1000, maxRequests = 30) => {
  const userAttempts = new Map();

  return (req, res, next) => {
    const identifier = req.user?.id || req.ip;
    const now = Date.now();

    let attempt = userAttempts.get(identifier);
    if (!attempt || now > attempt.resetTime) {
      // Limpiar entradas expiradas periódicamente para evitar memory leak
      if (userAttempts.size > 10000) {
        for (const [key, val] of userAttempts) {
          if (now > val.resetTime) userAttempts.delete(key);
        }
      }
      attempt = { count: 0, resetTime: now + windowMs };
      userAttempts.set(identifier, attempt);
    }

    attempt.count += 1;

    if (attempt.count > maxRequests) {
      securityLogger('USER_RATE_LIMIT', { identifier, maxRequests }, req);
      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Por favor, espera antes de intentar nuevamente',
        retryAfter: Math.ceil((attempt.resetTime - now) / 1000)
      });
    }

    next();
  };
};

// Logging de seguridad
const securityLogger = (event, details, req) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.email || 'anonymous',
    details
  };
  
  logger.info(`[SECURITY ${event}]`, logEntry);
  
  // En producción, enviar a servicio de logging
  if (process.env.NODE_ENV === 'production') {
    // Ejemplo: enviar a Sentry, LogRocket, etc.
  }
};

// Middleware de detección de anomalías
const anomalyDetection = (req, res, next) => {
  const anomalies = [];
  
  // Detectar patrones sospechosos
  if (req.body) {
    const bodyStr = JSON.stringify(req.body);
    
    // SQL injection patterns
    if (/(\bunion\b|\bselect\b|\bdrop\b|\binsert\b)/i.test(bodyStr)) {
      anomalies.push('Possible SQL injection');
    }
    
    // XSS patterns
    if (/<script|javascript:|onclick=/i.test(bodyStr)) {
      anomalies.push('Possible XSS attempt');
    }
    
    // Excessive payload size
    if (bodyStr.length > 100000) {
      anomalies.push('Excessive payload size');
    }
  }
  
  // Frecuencia de requests anormal
  const userKey = req.user?.id || req.ip;
  const requestCount = global.requestCounts?.get(userKey) || 0;
  if (requestCount > 100) { // 100 requests en ventana
    anomalies.push('High request frequency');
  }
  
  if (anomalies.length > 0) {
    securityLogger('ANOMALY_DETECTED', { anomalies, url: req.url }, req);
    
    // En casos críticos, bloquear
    if (anomalies.includes('Possible SQL injection')) {
      return res.status(403).json({
        error: 'Solicitud bloqueada por razones de seguridad'
      });
    }
  }
  
  next();
};

// Middleware de headers de seguridad
const securityHeaders = helmet(securityConfig.helmet);

// Middleware de sanitización de entrada
const sanitizeInput = (req, res, next) => {
  // Aplicar sanitización de MongoDB
  mongoSanitize()(req, res, () => {
    // Aplicar limpieza XSS
    xssClean()(req, res, () => {
      // Aplicar sanitización avanzada personalizada
      advancedSanitization(req, res, next);
    });
  });
};

// Rate limiting por usuario
const rateLimitByUser = createUserBasedLimiter(60 * 1000, 120);

module.exports = {
  securityConfig,
  securityHeaders,
  sanitizeInput,
  rateLimitByUser,
  advancedSanitization,
  createUserBasedLimiter,
  securityLogger,
  anomalyDetection
};