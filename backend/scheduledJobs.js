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
  // Marca todas las habitaciones ocupadas con tarea de repaso
  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await Room.updateMany(
        { status: 'ocupada', pendingHousekeeping: { $in: [null, 'repaso'] } },
        { pendingHousekeeping: 'repaso', pendingHousekeepingAt: new Date() }
      );
      logger.info(`🧹 Repaso diario programado: ${result.modifiedCount} habitaciones marcadas`);
    } catch (error) {
      logger.error('❌ Error en repaso diario:', error);
    }
  });

  // TAREA 6: LIMPIEZA PROFUNDA CADA 3 NOCHES — 9:05 AM todos los días
  // Marca habitaciones cuyo checkIn fue exactamente hace 3, 6, 9... noches
  cron.schedule('5 9 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeCheckins = await Reservation.find({ status: 'checkin' });
      let markedCount = 0;
      for (const res of activeCheckins) {
        const checkInDate = new Date(res.checkIn);
        checkInDate.setHours(0, 0, 0, 0);
        const nights = Math.round((today - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0 && nights % 3 === 0) {
          for (const roomId of res.room) {
            await Room.findByIdAndUpdate(roomId, {
              pendingHousekeeping: 'limpieza_profunda',
              pendingHousekeepingAt: new Date()
            });
            markedCount++;
          }
        }
      }
      if (markedCount > 0) logger.info(`🧼 Limpieza profunda (3 noches): ${markedCount} habitaciones marcadas`);
    } catch (error) {
      logger.error('❌ Error en limpieza profunda (3 noches):', error);
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