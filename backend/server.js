// server.js
// Arranque del servidor y conexión a la base de datos

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const app = require('./app');
const WebSocket = require('ws');
const http = require('http');
const { logger, logHelpers } = require('./config/logger');
const { initScheduledJobs } = require('./scheduledJobs');
const { cleanupLoggerResources } = require('./config/productionLogger');
const { rateLimiterMonitor } = require('./config/rateLimiterMonitor');
const User = require('./models/User');

dotenv.config({ path: './config/.env' });

// ─── Validación de variables de entorno requeridas ────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
if (process.env.NODE_ENV === 'production') {
  REQUIRED_ENV.push('MONGO_URI', 'CORS_ORIGIN', 'FRONTEND_URL', 'BACKEND_URL');
}
// Advertir sobre secretos placeholder (no bloquear en dev, sí en prod)
const PLACEHOLDER_SECRETS = ['your-super-secure-jwt-secret-here', 'CAMBIAR_POR_SECRET_SEGURO_MINIMO_64_CHARS'];
if (process.env.NODE_ENV === 'production') {
  if (PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET)) {
    console.error('❌ FATAL: JWT_SECRET tiene valor placeholder. Configura un secreto real en producción.');
    process.exit(1);
  }
  if (PLACEHOLDER_SECRETS.includes(process.env.JWT_REFRESH_SECRET)) {
    console.error('❌ FATAL: JWT_REFRESH_SECRET tiene valor placeholder. Configura un secreto real en producción.');
    process.exit(1);
  }
}
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ FATAL: Variables de entorno requeridas no definidas: ${missing.join(', ')}`);
  console.error('   Configure estas variables antes de iniciar el servidor.');
  process.exit(1);
}

// Railway asigna PORT como variable de entorno — DEBE escucharse inmediatamente
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const AUTO_SEED_ADMIN = process.env.AUTO_SEED_ADMIN !== '0';
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@hotel.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Admin';

// ─── Crear servidor HTTP y WebSocket ANTES de conectar a MongoDB ──────────────
// Railway verifica que el puerto responda dentro de segundos del arranque.
// Si el listen está dentro del .then() de mongoose y la DB tarda, Railway cancela.
const server = http.createServer(app);

// Arrancar a escuchar inmediatamente en el puerto asignado por Railway
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Servidor HTTP escuchando en 0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
});

server.on('error', (err) => {
  logger.error('Error fatal al iniciar servidor HTTP:', err);
  process.exit(1);
});

// ─── Conectar a MongoDB de forma asíncrona ────────────────────────────────────
// Opciones optimizadas para MongoDB Atlas (connection pool, timeouts, retry)
const MONGO_OPTIONS = {
  maxPoolSize: 10,           // Máximo de conexiones simultáneas
  serverSelectionTimeoutMS: 10000,  // Timeout de selección de servidor Atlas
  socketTimeoutMS: 45000,   // Timeout de socket
  connectTimeoutMS: 10000,  // Timeout de conexión inicial
  heartbeatFrequencyMS: 10000,
};

mongoose.connect(MONGO_URI, MONGO_OPTIONS)
  .then(async () => {
    if (logHelpers.system && typeof logHelpers.system.dbConnected === 'function') {
      logHelpers.system.dbConnected();
    } else {
      logger.info('MongoDB conectado exitosamente');
    }

    // Detectar soporte de transacciones (replica set vs standalone)
    try {
      const testSession = await mongoose.startSession();
      testSession.startTransaction();
      await mongoose.connection.db.collection('_txtest').findOne({}, { session: testSession });
      await testSession.commitTransaction();
      testSession.endSession();
      app.set('txSupported', true);
      logger.info('✅ Transacciones MongoDB: soportadas (Replica Set)');
    } catch {
      app.set('txSupported', false);
      logger.warn('⚠️  Transacciones MongoDB: NO disponibles (standalone). Operando sin ACID.');
    }

    // Auto-seed: crear RoomTypes si no existen (necesarios para facturación)
    try {
      const RoomType = require('./models/RoomType');
      // Sincronizar RoomTypes con Room.price en cada arranque
      const Room = require('./models/Room');
      const ROOM_TYPES_SEED = [
        { name: 'doble',     capacity: 2, description: 'Habitación doble' },
        { name: 'triple',    capacity: 3, description: 'Habitación triple' },
        { name: 'cuadruple', capacity: 4, description: 'Habitación cuádruple' },
        { name: 'suite',     capacity: 2, description: 'Suite de lujo' },
      ];
      for (const seed of ROOM_TYPES_SEED) {
        const roomSample = await Room.findOne({ type: seed.name }).sort({ price: -1 });
        const basePrice = roomSample ? roomSample.price : 0;
        if (basePrice > 0) {
          await RoomType.findOneAndUpdate(
            { name: seed.name },
            { ...seed, basePrice, currency: 'ARS', isActive: true },
            { upsert: true, new: true }
          );
        }
      }
      logger.info('✅ RoomTypes sincronizados con Room.price');
    } catch (seedErr) {
      logger.warn('⚠️  Auto-seed de RoomTypes falló (no crítico):', seedErr.message);
    }

    // Asegurar una cuenta admin funcional para acceso al CRM.
    // Si ya existe, se actualiza la contraseña a un valor conocido para evitar bloqueos por hashes viejos.
    if (AUTO_SEED_ADMIN) {
      try {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
        const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

        if (existingAdmin) {
          existingAdmin.name = ADMIN_NAME;
          existingAdmin.role = 'admin';
          existingAdmin.password = hashedPassword;
          await existingAdmin.save();
          logger.info('✅ Cuenta admin sincronizada con credenciales conocidas', { email: ADMIN_EMAIL });
        } else {
          await User.create({
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            password: hashedPassword,
            role: 'admin'
          });
          logger.info('✅ Cuenta admin creada automáticamente', { email: ADMIN_EMAIL });
        }
      } catch (adminSeedErr) {
        logger.warn('⚠️  No se pudo sincronizar la cuenta admin automática:', adminSeedErr.message);
      }
    }

    // Iniciar tareas programadas (sincronización automática de estados)
    initScheduledJobs();
    logger.info('🔄 Sistema de sincronización automática activado');

    // ─── Configurar WebSocket sobre el server ya escuchando ──────────────────
    const wss = new WebSocket.Server({ 
      server, 
      path: '/ws',
      clientTracking: true,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024 // 1MB max
    });

    const jwt = require('jsonwebtoken');

    // Logger con niveles controlados por WS_LOG_LEVEL (debug|info|warn|error)
    const LOG_LEVEL = (process.env.WS_LOG_LEVEL || 'warn').toLowerCase();
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    function log(level, ...args) {
      try {
        if (levelPriority[level] >= levelPriority[LOG_LEVEL]) {
          const ts = new Date().toISOString();
          if (level === 'error') console.error(`[WS ${level.toUpperCase()} ${ts}]`, ...args);
          else console.log(`[WS ${level.toUpperCase()} ${ts}]`, ...args);
        }
      } catch (e) { console.log('[WS LOG ERROR]', e); }
    }

    // Almacenar clientes conectados
    // CRIT7: Conexión WebSocket acepta auth por primer mensaje JSON (no por query string)
    wss.on('connection', (ws, req) => {
      try {
        const remote = req.socket.remoteAddress;
        const origin = req.headers.origin || req.headers.host || '<no-origin>';
        
        // Permitir auth por header (upgrade request) O por primer mensaje
        const authHeader = req.headers && req.headers.authorization;
        const headerToken = authHeader ? authHeader.split(' ')[1] : null;

        let decoded = null;
        let wsUserId = '<pending-auth>';
        let authTimeout = null;

        // Si viene token en header, autenticar inmediatamente
        if (headerToken) {
          try {
            decoded = jwt.verify(headerToken, process.env.JWT_SECRET);
            ws.user = decoded;
            wsUserId = decoded.userId || decoded.id || '<no-id>';
            ws.isAuthenticated = true;
            log('info', `Cliente WebSocket autenticado por header from=${remote} user=${wsUserId}`);
            ws.send(JSON.stringify({ type: 'auth_ok' }));
          } catch (err) {
            log('info', `Token header inválido en WS from=${remote} err=${err && err.message}`);
            try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
            return;
          }
        } else {
          // Sin token en header: esperar mensaje { type: 'auth', token: '...' }
          ws.isAuthenticated = false;
          ws.send(JSON.stringify({ type: 'test', message: 'Conexión WebSocket establecida, enviar auth' }));

          // Timeout: si no autentica en 10s, cerrar
          authTimeout = setTimeout(() => {
            if (!ws.isAuthenticated) {
              log('info', `WS auth timeout from=${remote}`);
              try { ws.close(1008, 'Auth timeout'); } catch(e) { ws.terminate && ws.terminate(); }
            }
          }, 10000);
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (msg) => {
          try {
            const s = msg.toString();
            log('debug', `WS message from=${remote} user=${wsUserId} len=${s.length}`);
            try {
              const j = JSON.parse(s);

              // Mensaje de autenticación (CRIT7)
              if (j && j.type === 'auth' && j.token && !ws.isAuthenticated) {
                try {
                  decoded = jwt.verify(j.token, process.env.JWT_SECRET);
                  ws.user = decoded;
                  wsUserId = decoded.userId || decoded.id || '<no-id>';
                  ws.isAuthenticated = true;
                  if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }
                  log('info', `Cliente WebSocket autenticado por mensaje from=${remote} user=${wsUserId}`);
                  ws.send(JSON.stringify({ type: 'auth_ok' }));
                } catch (authErr) {
                  log('info', `Token inválido en WS auth msg from=${remote} err=${authErr && authErr.message}`);
                  ws.send(JSON.stringify({ type: 'auth_error', message: 'Token inválido' }));
                  try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
                }
                return;
              }

              // Rechazar mensajes de clientes no autenticados (excepto ping)
              if (!ws.isAuthenticated && j.type !== 'ping') {
                return; // Silenciosamente ignorar
              }

              if (j && j.type === 'ping') {
                try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
              }
            } catch (e) {}
          } catch (e) {}
        });

        ws.on('close', (code, reason) => {
          if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }
          log('info', `WS desconectado from=${remote} user=${wsUserId} code=${code}`);
        });

        ws.on('error', (err) => {
          if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }
          log('error', `Error WS from=${remote}:`, err && err.message ? err.message : err);
        });
      } catch (err) {
        log('error', 'Error manejando conexión WebSocket:', err);
      }
    });

    wss.on('error', err => {
      log('error', 'Error en servidor WebSocket:', err);
    });

    // Heartbeat: enviar ping JSON + ping WS cada 25s para mantener viva la conexión en Railway
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} return; }
        ws.isAlive = false;
        try { ws.ping(); } catch (e) {}
        // Enviar también un ping a nivel de aplicación (JSON) porque
        // algunos proxies (Railway) solo cuentan tráfico de datos, no frames ping/pong
        try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); } catch (e) {}
      });
    }, 25000);

    server.on('close', () => clearInterval(interval));

    // Exponer instancia para emitir eventos desde controladores
    app.set('wss', wss);
    app.set('port', PORT);
    logger.info(`✅ WebSocket activo en ws://0.0.0.0:${PORT}/ws`);
  })
  .catch((err) => {
    if (logHelpers.system && typeof logHelpers.system.dbError === 'function') {
      logHelpers.system.dbError(err);
    }
    logger.error('Detalle de error MongoDB al conectar', {
      name: err && err.name,
      message: err && err.message,
      code: err && err.code,
      errno: err && err.errno
    });
    logger.error('❌ No se pudo conectar a MongoDB. El servidor HTTP sigue activo pero las rutas de DB fallarán.');
  });

// Reconexión automática en caso de pérdida de conexión (atlas puede desconectar idle)
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB desconectado. Mongoose intentará reconectar automáticamente...');
});
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconectado exitosamente.');
});
mongoose.connection.on('error', (err) => {
  logger.error('Error de conexión MongoDB', {
    name: err && err.name,
    message: err && err.message,
    code: err && err.code,
    errno: err && err.errno
  });
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} recibido. Cerrando servidor...`);

  try {
    cleanupLoggerResources();
    rateLimiterMonitor.cleanup();
  } catch (err) {
    logger.warn('Error limpiando recursos de logging/rate limiter', err);
  }

  server.close(() => {
    logger.info('Servidor HTTP cerrado');
  });

  try {
    await mongoose.connection.close();
    logger.info('Conexión MongoDB cerrada');
  } catch (err) {
    logger.error('Error cerrando MongoDB', err);
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
