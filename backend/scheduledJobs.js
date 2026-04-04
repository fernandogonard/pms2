const cron = require('node-cron');
const { syncRoomStatesWithReservations } = require('./scripts/syncRoomStatesWithReservations');
const { createIndexes } = require('./scripts/createIndexes');
const { cleanupOldReservations } = require('./scripts/cleanupOldReservations');
const { createBackup } = require('./scripts/createBackup');
const { logger } = require('./config/logger');
const Room = require('./models/Room');
const Reservation = require('./models/Reservation');

/**
 * Inicializa todas las tareas programadas del sistema
 * Incluye:
 * - Sincronización de estados de habitaciones (cada 30 minutos)
 * - Limpieza de reservas antiguas (cada domingo a las 3am)
 * - Optimización de índices de la BD (día 1 de cada mes a las 2am)
 */
function initScheduledJobs() {
  logger.info('🚀 Iniciando sistema de tareas programadas...');
  
  // TAREA 1: Sincronización automática de estados cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('🔄 Iniciando sincronización automática de estados de habitaciones');
      await syncRoomStatesWithReservations();
      logger.info('✅ Sincronización automática completada');
    } catch (error) {
      logger.error('❌ Error en la sincronización automática:', error);
    }
  });
  
  // TAREA 2: Limpieza de reservas antiguas - cada semana (domingo a las 3am)
  cron.schedule('0 3 * * 0', async () => {
    try {
      logger.info('🧹 Iniciando limpieza semanal de reservas antiguas');
      await cleanupOldReservations();
      logger.info('✅ Limpieza de reservas antiguas completada');
    } catch (error) {
      logger.error('❌ Error en limpieza de reservas:', error);
    }
  });
  
  // TAREA 3: Optimización de índices - cada mes (día 1 a las 2am)
  cron.schedule('0 2 1 * *', async () => {
    try {
      logger.info('🛠️ Iniciando optimización mensual de índices de la BD');
      await createIndexes();
      logger.info('✅ Optimización de índices completada');
    } catch (error) {
      logger.error('❌ Error en optimización de índices:', error);
    }
  });
  
  // TAREA 4: Backup automático - cada día a la 1am
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('💾 Iniciando backup diario de la base de datos');
      const result = await createBackup();
      if (result.success) {
        logger.info(`✅ Backup completado: ${result.file} (${result.size} MB)`);
      } else {
        logger.error(`❌ Error en backup diario: ${result.error}`);
      }
    } catch (error) {
      logger.error('❌ Error en backup diario:', error);
    }
  });

  // TAREA 5: REPASO DIARIO — 9:00 AM todos los días
  // Marca habitaciones ocupadas que no tienen tarea pendiente (o solo repaso)
  // Respeta habitaciones que ya fueron limpiadas hoy
  cron.schedule('0 9 * * *', async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const result = await Room.updateMany(
        {
          status: 'ocupada',
          pendingHousekeeping: { $in: [null, 'repaso'] },
          $or: [
            { lastCleaning: { $lt: todayStart } },
            { lastCleaning: null }
          ]
        },
        { pendingHousekeeping: 'repaso', pendingHousekeepingAt: new Date() }
      );
      logger.info(`🧹 Repaso diario programado: ${result.modifiedCount} habitaciones marcadas`);
    } catch (error) {
      logger.error('❌ Error en repaso diario:', error);
    }
  });

  // TAREA 6: LIMPIEZA PROFUNDA — 9:05 AM todos los días
  // Usa lastCleaning para determinar si han pasado 3+ días sin limpieza profunda
  // También marca si el checkIn lleva múltiplo de 3 noches
  cron.schedule('5 9 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      let markedCount = 0;

      // Método 1: Por lastCleaning — si hace 3+ días que no se limpia, forzar profunda
      const staleRooms = await Room.find({
        status: 'ocupada',
        $or: [
          { lastCleaning: { $lte: threeDaysAgo } },
          { lastCleaning: null }
        ]
      });
      for (const room of staleRooms) {
        await Room.findByIdAndUpdate(room._id, {
          pendingHousekeeping: 'limpieza_profunda',
          pendingHousekeepingAt: new Date()
        });
        markedCount++;
      }

      // Método 2: Por noches de estancia (múltiplo de 3 desde checkIn)
      const activeCheckins = await Reservation.find({ status: 'checkin' });
      for (const res of activeCheckins) {
        const checkInDate = new Date(res.checkIn);
        checkInDate.setHours(0, 0, 0, 0);
        const nights = Math.round((today - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0 && nights % 3 === 0) {
          const roomIds = Array.isArray(res.room) ? res.room : [res.room];
          for (const roomId of roomIds) {
            await Room.findByIdAndUpdate(roomId, {
              pendingHousekeeping: 'limpieza_profunda',
              pendingHousekeepingAt: new Date()
            });
            markedCount++;
          }
        }
      }
      if (markedCount > 0) logger.info(`🧼 Limpieza profunda: ${markedCount} habitaciones marcadas`);
    } catch (error) {
      logger.error('❌ Error en limpieza profunda:', error);
    }
  });

  // Imprimir resumen de tareas programadas
  logger.info('📋 Sistema de tareas programadas iniciado correctamente');
  logger.info('📋 Resumen de tareas:');
  logger.info('  • Sincronización de habitaciones: Cada 30 minutos');
  logger.info('  • Limpieza de reservas antiguas: Cada domingo a las 3am');
  logger.info('  • Optimización de índices: El día 1 de cada mes a las 2am');
  logger.info('  • Backup de la base de datos: Diario a la 1am');
  logger.info('  • Repaso diario: 9:00 AM (habitaciones ocupadas)');
  logger.info('  • Limpieza profunda (3 noches): 9:05 AM (checkins c/ múltiplo de 3)');
}

module.exports = {
  initScheduledJobs
};