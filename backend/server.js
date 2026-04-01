// server.js
// Arranque del servidor y conexión a la base de datos

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const http = require('http');
const { logger, logHelpers } = require('./config/logger');
const { initScheduledJobs } = require('./scheduledJobs');
const wsManager = require('./utils/wsManager');

// Cargar variables de entorno desde .env en la raíz del backend
dotenv.config({ path: './.env' });

const PORT = 5000; // Puerto fijo
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    logHelpers.system.dbConnected();

    // Iniciar tareas programadas (sincronización automática de estados)
    initScheduledJobs();
    logger.info('🔄 Sistema de sincronización automática activado');

    // Crear servidor HTTP
    const server = http.createServer(app);

    // Inicializar WebSocket Manager (único punto de gestión WS)
    wsManager.init(server);

    // Puerto fijo 5000
    server.listen(PORT, () => {
      logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
      logger.info(`🔌 WebSocket disponible en ws://localhost:${PORT}/ws`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} recibido. Cerrando servidor...`);

      server.close(() => {
        logger.info('Servidor HTTP cerrado');
      });

      wsManager.closeAll && wsManager.closeAll();

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
  })
  .catch((err) => {
    logHelpers.system.dbError(err);
  });
