// config/securityConfig.js
// Configuración de seguridad avanzada enterprise

const helmet = require('helmet');
const DOMPurify = require('isomorphic-dompurify');

// Headers de seguridad enterprise
const getSecurityHeaders = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.DOMAIN || 'localhost';
  
  return helmet({
    // Content Security Policy estricta
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Solo para desarrollo, remover en producción
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          ...(isProduction ? [] : ["'unsafe-eval'"])
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        connectSrc: [
          "'self'",
          `ws://${domain}:5000`,
          `wss://${domain}:5000`,
          `http://${domain}:5000`,
          `https://${domain}:5000`
        ],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"]
      },
      reportOnly: !isProduction
    },

    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },

    // Permissions Policy
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        camera: ["'none'"],
        microphone: ["'none'"],
        payment: ["'none'"],
        usb: ["'none'"],
        accelerometer: ["'none'"],
        gyroscope: ["'none'"],
        magnetometer: ["'none'"]
      }
    },

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: false, // Para compatibilidad con CDNs

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  });
};

// Sanitización de inputs avanzada
const sanitizeInput = (input, type = 'general') => {
  if (!input || typeof input !== 'string') return input;

  switch (type) {
    case 'html':
      return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
    
    case 'sql':
      return input.replace(/['";\\]/g, '');
    
    case 'filename':
      return input.replace(/[^a-zA-Z0-9._-]/g, '');
    
    case 'email':
      return input.toLowerCase().trim();
    
    case 'general':
    default:
      return DOMPurify.sanitize(input.trim(), {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
  }
};

// Middleware de sanitización
const sanitizationMiddleware = (req, res, next) => {
  // Sanitizar body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeInput(value, key === 'email' ? 'email' : 'general');
      }
    }
  }

  // Sanitizar query params
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeInput(value);
      }
    }
  }

  next();
};

// Detección de patrones maliciosos
const securityPatterns = [
  /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)/gi,
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /eval\s*\(/gi,
  /__proto__|constructor|prototype/gi
];

const maliciousInputDetection = (req, res, next) => {
  const checkForMalicious = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of securityPatterns) {
          if (pattern.test(value)) {
            const { logHelpers } = require('./logger');
            logHelpers.security.maliciousRequest(req.ip, path + key, value);
            return res.status(400).json({
              success: false,
              message: 'Input contiene patrones no permitidos',
              error: 'MALICIOUS_INPUT_DETECTED'
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForMalicious(value, `${path}${key}.`);
        if (result) return result;
      }
    }
    return null;
  };

  if (req.body) {
    const maliciousCheck = checkForMalicious(req.body);
    if (maliciousCheck) return maliciousCheck;
  }

  if (req.query) {
    const maliciousCheck = checkForMalicious(req.query);
    if (maliciousCheck) return maliciousCheck;
  }

  next();
};

module.exports = {
  getSecurityHeaders,
  sanitizeInput,
  sanitizationMiddleware,
  maliciousInputDetection
};