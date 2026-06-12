const cron = require('node-cron');
const { syncRoomStatesWithReservations } = require('./scripts/syncRoomStatesWithReservations');
const { createIndexes } = require('./scripts/createIndexes');
const { cleanupOldReservations } = require('./scripts/cleanupOldReservations');
const { createBackup } = require('./scripts/createBackup');
const { logger } = require('./config/logger');
const Room = require('./models/Room');
const Reservation = require('./models/Reservation');
const Client = require('./models/Client');
const CheckoutService = require('./services/CheckoutService');

/**
 * Inicializa todas las tareas programadas del sistema
 * Incluye:
 * - Sincronización de estados de habitaciones (cada 30 minutos)
 * - Limpieza de reservas antiguas (cada domingo a las 3am)
 * - Optimización de índices de la BD (día 1 de cada mes a las 2am)
 * - NUEVO: Marcado de checkouts a las 7 AM
 * - NUEVO: Limpieza de flags de checkout a las 23:30 PM
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
  // ADVERTENCIA: En Railway el filesystem es efímero — los backups se pierden en cada redeploy.
  // Para backups persistentes usa MongoDB Atlas Backup (gratis en M0) o configura un Railway Volume.
  // Este backup sirve como copia de seguridad temporal para el día de trabajo.
  cron.schedule('0 1 * * *', async () => {
    try {
      // Solo ejecutar backup local si NO estamos en Railway producción sin volumen
      // En producción confiar en Atlas Backup. En dev/staging, hacer backup local.
      if (process.env.NODE_ENV === 'production' && !process.env.BACKUP_ENABLED) {
        logger.info('💾 Backup local omitido en producción (usar Atlas Backup). Set BACKUP_ENABLED=true para forzar.');
        return;
      }
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

  // TAREA 7: RECORDATORIO CHECK-IN — 10:00 AM todos los días
  // Envía email a clientes con check-in programado para mañana
  cron.schedule('0 10 * * *', async () => {
    try {
      const emailService = require('./services/emailService');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const reservations = await Reservation.find({
        checkIn: { $gte: tomorrow, $lt: dayAfter },
        status: { $in: ['confirmada', 'pendiente'] }
      }).populate('client', 'nombre apellido email');

      let sent = 0;
      for (const res of reservations) {
        if (res.client?.email) {
          await emailService.sendCheckinReminder({ reservation: res, client: res.client });
          sent++;
        }
      }
      if (sent > 0) logger.info(`📧 Recordatorios check-in enviados: ${sent}`);
    } catch (error) {
      logger.error('❌ Error enviando recordatorios check-in:', error);
    }
  });

  // ─── NUEVAS TAREAS: GESTIÓN DE CHECKOUTS ───────────────────────────────────

  // TAREA 8: MARCAR CHECKOUTS HOY — 7:00 AM todos los días
  // A las 7 AM, busca todas las reservas con checkout hoy y las marca con checkoutToday=true
  // Así la UI puede mostrar anticipadamente las habitaciones que se irán hoy
  // Requisito del usuario: "a las 7 am del dia del check out ya deveria mostrarce"
  cron.schedule('0 7 * * *', async () => {
    try {
      logger.info('🌅 [CHECKOUT] Iniciando marcado de checkouts para hoy (7 AM)...');
      const result = await CheckoutService.markRoomsWithCheckoutToday();
      logger.info(`✅ [CHECKOUT] ${result.marked} habitaciones marcadas con checkout hoy`);
    } catch (error) {
      logger.error('❌ [CHECKOUT] Error marcando checkouts del día:', error);
    }
  });

  // TAREA 9: LIMPIAR FLAGS DE CHECKOUT — 23:30 PM todos los días
  // Al final del día, limpia el flag checkoutToday para preparar el siguiente día
  cron.schedule('30 23 * * *', async () => {
    try {
      logger.info('🌙 [CHECKOUT] Limpiando flags de checkout (23:30)...');
      const result = await CheckoutService.clearCheckoutTodayFlag();
      logger.info(`✅ [CHECKOUT] ${result.cleared} flags de checkout limpiados`);
    } catch (error) {
      logger.error('❌ [CHECKOUT] Error limpiando flags de checkout:', error);
    }
  });

  // ─── RESUMEN DE TAREAS ───────────────────────────────────────────────────────

  // Imprimir resumen de tareas programadas
  logger.info('📋 Sistema de tareas programadas iniciado correctamente');
  logger.info('📋 Resumen de tareas:');
  logger.info('  • Sincronización de habitaciones: Cada 30 minutos');
  logger.info('  • Limpieza de reservas antiguas: Cada domingo a las 3am');
  logger.info('  • Optimización de índices: El día 1 de cada mes a las 2am');
  logger.info('  • Backup de la base de datos: Diario a la 1am');
  logger.info('  • Repaso diario: 9:00 AM (habitaciones ocupadas)');
  logger.info('  • Limpieza profunda (3 noches): 9:05 AM (checkins c/ múltiplo de 3)');
  logger.info('  • Recordatorio check-in: 10:00 AM (reservas de mañana)');
  logger.info('  • 🆕 [CHECKOUT] Marcar checkouts: 7:00 AM (visibilidad anticipada)');
  logger.info('  • 🆕 [CHECKOUT] Limpiar flags: 23:30 PM (preparar siguiente día)');
}

module.exports = {
  initScheduledJobs
};