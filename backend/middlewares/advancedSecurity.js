// Enhanced security middleware - migrado del otro PMS
const helmet = require('helmet');
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
  // Sanitizar NoSQL injection
  mongoSanitize();
  
  // Limpiar XSS
  xssClean();
  
  // Validaciones adicionales
  if (req.body) {
    // Remover propiedades peligrosas
    delete req.body.__proto__;
    delete req.body.constructor;
    
    // Limpiar strings recursivamente
    const cleanObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanObject(obj[key]);
        }
      }
    };
    
    cleanObject(req.body);
  }
  
  next();
};

// Rate limiting avanzado por usuario
const createUserBasedLimiter = (windowMs, maxRequests) => {
  const userAttempts = new Map();
  
  return (req, res, next) => {
    const identifier = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!userAttempts.has(identifier)) {
      userAttempts.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userAttempt = userAttempts.get(identifier);
    
    if (now > userAttempt.resetTime) {
      userAttempt.count = 1;
      userAttempt.resetTime = now + windowMs;
      return next();
    }
    
    if (userAttempt.count >= maxRequests) {
      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Por favor, espera antes de intentar nuevamente',
        retryAfter: Math.ceil((userAttempt.resetTime - now) / 1000)
      });
    }
    
    userAttempt.count++;
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
  
  console.log(`[SECURITY ${event}]`, logEntry);
  
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
const rateLimitByUser = createUserBasedLimiter();

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