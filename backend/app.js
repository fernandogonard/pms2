// app.js
// Configuración principal de Express para el CRM hotelero

const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { setupGlobalErrorHandlers, startPeriodicMetricsLogging } = require('./config/productionLogger');
const { rateLimiterMonitor, startRateLimitMetricsLogging } = require('./config/rateLimiterMonitor');
const { csrfOriginVerification } = require('./middlewares/csrfProtection');
const monitoring = require('./services/monitoringService');

// 🔒 Seguridad avanzada
const advancedSecurity = require('./middlewares/advancedSecurity');
// 📝 Logging profesional Winston (único sistema activo)
const { logger, requestLogger: newRequestLogger, errorLogger } = require('./services/loggerService');

const app = express();

// Configurar manejadores globales de errores y logging avanzado
setupGlobalErrorHandlers();
startPeriodicMetricsLogging();
startRateLimitMetricsLogging();

// Configurar trust proxy para rate limiting
app.set('trust proxy', 1);

// �️ Compresión gzip/brotli — antes de todo para comprimir todas las respuestas
app.use(compression());

// �🔒 SEGURIDAD AVANZADA - Aplicar antes de parsear datos
app.use(advancedSecurity.securityHeaders);
app.use(advancedSecurity.sanitizeInput);

// Middlewares globales
app.use(cookieParser());

// Permitir DELETE/PUT/PATCH con Content-Type: application/json y body vacío.
// Algunos clientes envían cabecera JSON aunque no haya cuerpo, y express.json lanza SyntaxError.
app.use((req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const contentLength = (req.headers['content-length'] || '').trim();
  if (req.method && ['DELETE', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) && contentType.includes('application/json')) {
    if (!contentLength || contentLength === '0') {
      req.body = {};
      req.headers['content-length'] = '0';
    }
  }
  next();
});

app.use(express.json({
  verify: (req, _res, buf) => {
    // Guardar body crudo para verificación de firma de webhooks (MP, etc.)
    req.rawBody = buf.toString('utf8');
  }
}));
// Middleware rápido para forzar cabeceras CORS en respuestas preflight
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With,Cache-Control,expires,Pragma,If-None-Match,If-Modified-Since');
    res.setHeader('Vary', 'Origin');
    return res.sendStatus(204);
  }
  next();
});
// Configurar CORS para permitir credentials y origen controlado
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || 'http://localhost:3000,https://localhost:3000';
const CORS_ALLOW_ALL = CORS_ORIGIN_RAW.trim() === '*';
// En producción nunca permitir wildcard con credentials
if (CORS_ALLOW_ALL && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY] CORS_ORIGIN=* no está permitido en producción con credentials. Usando origins explícitos.');
}
const allowedOrigins = CORS_ALLOW_ALL ? [] : CORS_ORIGIN_RAW.split(',').map(s => s.trim());
const corsOptions = {
  origin: function(origin, callback) {
    // Permitir solicitudes sin origin (curl, Postman, etc.)
    if (!origin) return callback(null, true);
    // Si CORS_ORIGIN=* aceptar cualquier origen (solo en desarrollo)
    if (CORS_ALLOW_ALL && process.env.NODE_ENV !== 'production') return callback(null, true);
    // Normalizar origin: quitar barra final si existe
    const originNorm = origin.replace(/\/$/, '');
    const allowed = allowedOrigins.indexOf(originNorm) !== -1;
    if (allowed) return callback(null, true);
    // Siempre permitir dominios de Vercel (deploy del frontend)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(originNorm)) return callback(null, true);
    // En desarrollo aceptar cualquier localhost
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?\/?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  // Aceptar también encabezados que usan los navegadores/proxies (Pragma, If-None-Match, etc.)
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control', 'expires', 'Pragma', 'If-None-Match', 'If-Modified-Since'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
// Habilitar preflight para todas las rutas
app.options('*', cors(corsOptions));

// Middleware adicional para garantizar que TODAS las respuestas incluyan
// los headers CORS necesarios (útil contra cachés/edge que puedan omitirlos)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  const originNorm = origin.replace(/\/$/, '');
  const isAllowed = CORS_ALLOW_ALL || allowedOrigins.indexOf(originNorm) !== -1 ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(originNorm) ||
    (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?\/?$/.test(origin));
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With,Cache-Control,expires,Pragma,If-None-Match,If-Modified-Since');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 📝 Logging de requests (único middleware, Winston)
app.use(newRequestLogger);
app.use(rateLimiterMonitor.middleware());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL, 'wss:', 'ws:'].filter(Boolean),
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
    }
  }
}));

// 🔒 Sistema de rate limiting avanzado
const { generalLimiter } = require('./config/rateLimiter');
app.use(generalLimiter);
app.use(advancedSecurity.rateLimitByUser);
app.use(advancedSecurity.anomalyDetection);

// �️ CSRF: verificación de Origin para requests mutantes (defense-in-depth)
app.use(csrfOriginVerification);

// �📊 Documentación Swagger/OpenAPI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'CRM Hotelero — API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1a202c; }',
  swaggerOptions: { persistAuthorization: true }
}));

// Rutas de autenticación
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Rutas de usuarios
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Rutas de reservas
const reservationRoutes = require('./routes/reservationRoutes');
app.use('/api/reservations', reservationRoutes);

// Rutas de habitaciones
const roomRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomRoutes);

// Rutas de relocalización de huéspedes
const relocationRoutes = require('./routes/relocationRoutes');
app.use('/api', relocationRoutes);

// Rutas de estadísticas
const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);

// Rutas de reportes avanzados
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);

// Rutas de monitoreo del sistema
const monitoringRoutes = require('./routes/monitoringRoutes');
app.use('/api/monitoring', monitoringRoutes);

// Rutas de clientes/huespedes
const clientRoutes = require('./routes/clientRoutes');
app.use('/api/clients', clientRoutes);

// 🆕 Rutas de facturación y pagos
const billingRoutes = require('./routes/billingRoutes');
app.use('/api/billing', billingRoutes);

// 🆕 Rutas de información del sistema y datos reales
const systemRoutes = require('./routes/systemRoutes');
app.use('/api/system', systemRoutes);

// 🆕 Rutas de gestión de limpieza
const cleaningRoutes = require('./routes/cleaningRoutes');
app.use('/api/cleaning', cleaningRoutes);

// 📊 Rutas de analytics avanzados
const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/analytics', analyticsRoutes);

// 📜 Rutas de auditoría (solo admin)
const auditRoutes = require('./routes/auditRoutes');
app.use('/api/audit', auditRoutes);

// 💳 Rutas de pagos Mercado Pago
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// Ruta de health check pública
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'CRM Hotelero API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    docs: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

// Health check (para Railway/monitoring)
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;
  const mem = process.memoryUsage();
  const pkg = require('./package.json');
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: pkg.version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    db: { state: ['disconnected','connected','connecting','disconnecting'][dbState] || 'unknown' },
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB'
    },
    timestamp: new Date().toISOString()
  });
});

// 📋 Endpoint de manifest.json SIN autenticación (para PWA)
// Fallback si Vercel no sirve el archivo estático correctamente
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    "short_name": "Hotel DIVA",
    "name": "Hotel DIVA - Sistema de Gestión Hotelera",
    "icons": [
      {
        "src": "/favicon.ico",
        "sizes": "64x64 32x32 24x24 16x16",
        "type": "image/x-icon"
      },
      {
        "src": "/icons/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ],
    "id": "/",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#0088cc",
    "background_color": "#121212",
    "description": "Sistema de gestión hotelera para Hotel DIVA",
    "orientation": "any"
  });
});

// Endpoint de robots.txt SIN autenticación
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('User-agent: *\nDisallow: /api/\nAllow: /\n');
});

// Inicializar monitoreo (Sentry si SENTRY_DSN está configurado, sino no-op)
monitoring.init(app);

// Middlewares de manejo de errores (deben ir al final)
const { 
  globalErrorHandler, 
  notFoundHandler, 
  jsonErrorHandler, 
  requestTimeoutHandler 
} = require('./middlewares/errorMiddleware');

// Middleware para timeout de requests
app.use(requestTimeoutHandler);

// Middleware para JSON malformado
app.use(jsonErrorHandler);

// Middleware para rutas no encontradas (404) - ANTES del error handler global
app.use(notFoundHandler);

// 📝 Middleware de logging de errores
app.use(errorLogger);

// 📡 Middleware de monitoreo — captura excepciones antes del handler global
app.use(monitoring.errorMiddleware());

// Middleware global de manejo de errores - DEBE SER EL ÚLTIMO
app.use(globalErrorHandler);

module.exports = app;