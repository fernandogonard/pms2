const cron = require('node-cron');
const { syncRoomStatesWithReservations } = require('./scripts/syncRoomStatesWithReservations');
const { createIndexes } = require('./scripts/createIndexes');
const { cleanupOldReservations } = require('./scripts/cleanupOldReservations');
const { createBackup } = require('./scripts/createBackup');
const { logger } = require('./config/logger');

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

  // Imprimir resumen de tareas programadas
  logger.info('� Sistema de tareas programadas iniciado correctamente');
  logger.info('📋 Resumen de tareas:');
  logger.info('  • Sincronización de habitaciones: Cada 30 minutos');
  logger.info('  • Limpieza de reservas antiguas: Cada domingo a las 3am');
  logger.info('  • Optimización de índices: El día 1 de cada mes a las 2am');
  logger.info('  • Backup de la base de datos: Diario a la 1am');
}

module.exports = {
  initScheduledJobs
};