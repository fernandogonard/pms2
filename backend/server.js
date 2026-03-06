// server.js
// Arranque del servidor y conexión a la base de datos

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const WebSocket = require('ws');
const http = require('http');
const { logger, logHelpers } = require('./config/logger');
const { initScheduledJobs } = require('./scheduledJobs');

dotenv.config({ path: './config/.env' });

// Railway asigna PORT como variable de entorno — DEBE escucharse inmediatamente
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

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
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    logHelpers.system.dbConnected();

    // Auto-seed: crear RoomTypes si no existen (necesarios para facturación)
    try {
      const RoomType = require('./models/RoomType');
      const count = await RoomType.countDocuments();
      if (count === 0) {
        const ROOM_TYPES_DATA = [
          { name: 'doble',     basePrice: 8500,  currency: 'ARS', capacity: 2, description: 'Habitación doble', isActive: true },
          { name: 'triple',    basePrice: 11500, currency: 'ARS', capacity: 3, description: 'Habitación triple', isActive: true },
          { name: 'cuadruple', basePrice: 15000, currency: 'ARS', capacity: 4, description: 'Habitación cuádruple', isActive: true },
        ];
        await RoomType.insertMany(ROOM_TYPES_DATA);
        logger.info('✅ RoomTypes sembrados automáticamente (doble, triple, cuadruple)');
      }
    } catch (seedErr) {
      logger.warn('⚠️  Auto-seed de RoomTypes falló (no crítico):', seedErr.message);
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

    const urlLib = require('url');
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
    wss.on('connection', (ws, req) => {
      try {
        const remote = req.socket.remoteAddress;
        const origin = req.headers.origin || req.headers.host || '<no-origin>';
        const parsed = urlLib.parse(req.url, true);
        const query = parsed.query || {};
        const token = query.token || (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
          log('info', `Rechazando WS sin token from=${remote} origin=${origin}`);
          try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
          return;
        }

        let decoded = null;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
          ws.user = decoded;
        } catch (err) {
          log('info', `Token inválido en WS from=${remote} origin=${origin} err=${err && err.message}`);
          try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
          return;
        }

        const wsUserId = decoded && (decoded.userId || decoded.id) ? (decoded.userId || decoded.id) : '<no-id>';
        log('info', `Cliente WebSocket conectado from=${remote} user=${wsUserId} origin=${origin}`);
        ws.send(JSON.stringify({ type: 'test', message: 'Conexión WebSocket exitosa desde backend' }));

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (msg) => {
          try {
            const s = msg.toString();
            log('debug', `WS message from=${remote} user=${wsUserId} len=${s.length}`);
            try {
              const j = JSON.parse(s);
              if (j && j.type === 'ping') {
                try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
              }
            } catch (e) {}
          } catch (e) {}
        });

        ws.on('close', (code, reason) => {
          log('info', `WS desconectado from=${remote} user=${wsUserId} code=${code}`);
        });

        ws.on('error', (err) => {
          log('error', `Error WS from=${remote}:`, err && err.message ? err.message : err);
        });
      } catch (err) {
        log('error', 'Error manejando conexión WebSocket:', err);
      }
    });

    wss.on('error', err => {
      log('error', 'Error en servidor WebSocket:', err);
    });

    // Heartbeat: terminar conexiones muertas cada 30s
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} return; }
        ws.isAlive = false;
        try { ws.ping(); } catch (e) {}
      });
    }, 30000);

    server.on('close', () => clearInterval(interval));

    // Exponer instancia para emitir eventos desde controladores
    app.set('wss', wss);
    app.set('port', PORT);
    logger.info(`✅ WebSocket activo en ws://0.0.0.0:${PORT}/ws`);
  })
  .catch((err) => {
    logHelpers.system.dbError(err);
    logger.error('❌ No se pudo conectar a MongoDB. El servidor HTTP sigue activo pero las rutas de DB fallarán.');
  });
