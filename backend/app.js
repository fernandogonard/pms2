// app.js
// Configuración principal de Express para el CRM hotelero

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { requestLogger } = require('./config/logger');
const { advancedRequestLogger, setupGlobalErrorHandlers, startPeriodicMetricsLogging } = require('./config/productionLogger');
const { rateLimiterMonitor, startRateLimitMetricsLogging } = require('./config/rateLimiterMonitor');

// 🔒 Nuevo sistema de seguridad avanzado
const advancedSecurity = require('./middlewares/advancedSecurity');
// 📝 Nuevo sistema de logging profesional
const { logger, requestLogger: newRequestLogger, errorLogger } = require('./services/loggerService');

const app = express();

// Configurar manejadores globales de errores y logging avanzado
setupGlobalErrorHandlers();
startPeriodicMetricsLogging();
startRateLimitMetricsLogging();

// Configurar trust proxy para rate limiting
app.set('trust proxy', 1);

// 🔒 SEGURIDAD AVANZADA - Aplicar antes de parsear datos
app.use(advancedSecurity.securityHeaders);
app.use(advancedSecurity.sanitizeInput);

// Middlewares globales
app.use(express.json());
// Configurar CORS para permitir credentials y origen controlado
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://localhost:3000').split(',').map(s => s.trim());
const corsOptions = {
  origin: function(origin, callback) {
    // permitir solicitudes desde herramientas como curl/postman sin origin
    if (!origin) {
      console.log('[CORS] Sin origin (herramienta) - permitiendo');
      return callback(null, true);
    }
    // Normalizar origin: quitar barra final si existe
    const originNorm = origin.replace(/\/$/, '');
    const allowed = allowedOrigins.indexOf(originNorm) !== -1;
    console.log(`[CORS] Origin=${origin} normalized=${originNorm} allowed=${allowed}`);
    if (allowed) return callback(null, true);
    // En desarrollo aceptar cualquier localhost explícito (incluye puerto y slash opcional)
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?\/?$/.test(origin)) {
      console.log(`[CORS] DEV: permitiendo origin localhost dinámico: ${origin}`);
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
// Habilitar preflight para todas las rutas
app.options('*', cors(corsOptions));

// Logging avanzado de requests (antes de las rutas)
app.use(requestLogger);
app.use(advancedRequestLogger);
app.use(newRequestLogger); // 📝 Nuevo sistema de logging
app.use(rateLimiterMonitor.middleware());
// Middleware adicional para garantizar cabeceras CORS necesarias (por seguridad explicita)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = allowedOrigins.indexOf(origin) !== -1 || (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin));
  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    console.log(`[CORS] Añadidas cabeceras CORS para origin=${origin}`);
  }
  next();
});
app.use(morgan('dev'));
app.use(helmet());

// 🔒 Sistema de rate limiting avanzado
const { generalLimiter } = require('./config/rateLimiter');
app.use(generalLimiter);
app.use(advancedSecurity.rateLimitByUser);
app.use(advancedSecurity.anomalyDetection);

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

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('CRM Hotelero API funcionando');
});

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

// Middleware global de manejo de errores - DEBE SER EL ÚLTIMO
app.use(globalErrorHandler);

module.exports = app;