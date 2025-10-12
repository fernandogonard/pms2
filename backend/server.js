// server.js
// Arranque del servidor y conexión a la base de datos

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const WebSocket = require('ws');
const { logger, logHelpers } = require('./config/logger');
const { initScheduledJobs } = require('./scheduledJobs');

dotenv.config({ path: './config/.env' });

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';


const http = require('http');

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    logHelpers.system.dbConnected();
    
    // Iniciar tareas programadas (sincronización automática de estados)
    initScheduledJobs();
    logger.info('🔄 Sistema de sincronización automática activado');
    // Crear servidor HTTP y WebSocket
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ 
      server, 
      path: '/ws',
      clientTracking: true,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024 // 1MB max
    });
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
  const urlLib = require('url');
  const jwt = require('jsonwebtoken');

    // Almacenar clientes conectados
    wss.on('connection', (ws, req) => {
      try {
        const remote = req.socket.remoteAddress;
        const origin = req.headers.origin || req.headers.host || '<no-origin>';
        const parsed = urlLib.parse(req.url, true);
        const query = parsed.query || {};
        // token puede venir como ?token=... en la URL del WS
        const token = query.token || (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
          log('info', `Rechazando WS sin token from=${remote} origin=${origin}`);
          try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
          return;
        }

        let decoded = null;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
          // attach user info for later use
          ws.user = decoded;
        } catch (err) {
          log('info', `Token inválido en WS from=${remote} origin=${origin} err=${err && err.message}`);
          try { ws.close(1008, 'Unauthorized'); } catch(e) { ws.terminate && ws.terminate(); }
          return;
        }

        const url = req.url;
        const wsUserId = decoded && (decoded.userId || decoded.id) ? (decoded.userId || decoded.id) : '<no-id>';
        log('info', `Cliente WebSocket conectado from=${remote} user=${wsUserId} origin=${origin} url=${url}`);
        ws.send(JSON.stringify({ type: 'test', message: 'Conexión WebSocket exitosa desde backend' }));

        // protocolo de latido: marcar vivo y responder a pings de aplicación
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (msg) => {
          // Log ligero de mensajes entrantes para diagnóstico
          try {
            const s = msg.toString();
            log('debug', `WS message from=${remote} user=${wsUserId} len=${s.length} data=${s.slice(0,200)}`);
            // intentar parsear JSON para protocolo de ping/pong
            try {
              const j = JSON.parse(s);
              if (j && j.type === 'ping') {
                // responder pong de aplicación
                try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
              }
            } catch (e) {
              // no JSON, ignorar
            }
          } catch (e) {}
        });

        ws.on('close', (code, reason) => {
          log('info', `Cliente WebSocket desconectado from=${remote} user=${wsUserId} code=${code} reason=${reason && reason.toString ? reason.toString() : reason}`);
        });

        ws.on('error', (err) => {
          log('error', `Error en conexión WS from=${remote}:`, err && err.message ? err.message : err);
        });
      } catch (err) {
        log('error', 'Error manejando nueva conexión WebSocket:', err);
      }
    });

    // Manejo de errores en WebSocket
    wss.on('error', err => {
      log('error', 'Error en el servidor WebSocket:', err);
    });

    // Heartbeat: ping a clientes y terminar conexiones muertas cada 30s
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          try { ws.terminate(); } catch (e) {}
          return;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch (e) {}
      });
    }, 30000);

    // Limpiar interval al cerrar servidor
    server.on('close', () => clearInterval(interval));


    // Exponer instancia para emitir eventos desde controladores
    app.set('wss', wss);

    // Intentar escuchar en PORT; si está en uso, intentar puertos siguientes hasta un máximo
    // Definir rango de puertos para intentar
    const PORT_RANGE = process.env.PORT_RANGE || '5000-5010';
    const [minPort, maxPort] = PORT_RANGE.split('-').map(Number);
    const maxAttempts = maxPort ? (maxPort - minPort + 1) : 10;
    
    // Función para verificar si un puerto está disponible
    async function isPortAvailable(port) {
      return new Promise(resolve => {
        const net = require('net');
        const tester = net.createServer()
          .once('error', () => resolve(false))
          .once('listening', () => {
            tester.close(() => resolve(true));
          })
          .listen(port);
      });
    }

    // Intentar iniciar en puertos secuencialmente
    let attempt = 0;
    let currentPort = Number(PORT);
    
    const tryListen = async () => {
      attempt++;
      
      // Verificar si el puerto está disponible antes de intentar escuchar
      const portAvailable = await isPortAvailable(currentPort);
      
      if (portAvailable) {
        server.listen(currentPort, () => {
          logHelpers.system.startup(currentPort, process.env.NODE_ENV || 'development');
          logger.info(`WebSocket activo en ws://localhost:${currentPort}/ws`);
          
          // Guardar el puerto seleccionado en un archivo y en la configuración de la app
          try {
            const fs = require('fs');
            fs.writeFileSync('./port.txt', currentPort.toString());
            // Establecer el puerto en la configuración de la app para que otros componentes lo puedan usar
            app.set('port', currentPort);
            logger.info(`Puerto activo guardado en port.txt y configuración: ${currentPort}`);
          } catch (err) {
            logger.warn(`No se pudo guardar el puerto en archivo: ${err.message}`);
          }
        });
      } else {
        const msg = `Puerto ${currentPort} en uso. Intentando puerto ${currentPort + 1} (intento ${attempt} de ${maxAttempts})`;
        logger.warn(msg);
        
        if (attempt >= maxAttempts) {
          logger.error(`No se pudo arrancar el servidor tras ${maxAttempts} intentos.`);
          process.exit(1);
        }
        
        currentPort++;
        // Esperar un momento antes de reintentar
        setTimeout(() => {
          tryListen();
        }, 300);
      }
    };

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        const msg = `Puerto ${currentPort} en uso a pesar de verificación previa. Intentando puerto ${currentPort + 1}`;
        logger.warn(msg);
        
        if (attempt >= maxAttempts) {
          logger.error(`No se pudo arrancar el servidor tras ${maxAttempts} intentos.`);
          process.exit(1);
        }
        
        currentPort++;
        // Esperar un momento antes de reintentar
        setTimeout(() => {
          tryListen();
        }, 300);
      } else {
        logger.error('Error al intentar levantar servidor:', err);
        process.exit(1);
      }
    });

    // Primera tentativa
    tryListen();
  })
  .catch((err) => {
    logHelpers.system.dbError(err);
  });
