const cron = require('node-cron');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { createIndexes } = require('./createIndexes');
const { cleanupOldReservations } = require('./cleanupOldReservations');
const { syncRoomStatesWithReservations } = require('../services/roomService');

dotenv.config({ path: './config/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

// Función para conectar a MongoDB (si no está conectado)
async function ensureDbConnection() {
  if (mongoose.connection.readyState !== 1) {
    console.log('🏨 Conectando a la base de datos para tareas programadas...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');
    return true;
  }
  return false;
}

// Función principal para iniciar las tareas programadas
async function startScheduledTasks() {
  const newConnection = await ensureDbConnection();
  
  console.log('🕒 Iniciando tareas programadas de mantenimiento...');
  
  // TAREA 1: Sincronización de estados de habitaciones - cada hora
  cron.schedule('0 * * * *', async () => {
    console.log(`\n[${new Date().toLocaleString()}] Ejecutando sincronización de estados de habitaciones...`);
    try {
      await syncRoomStatesWithReservations();
      console.log('✅ Sincronización de estados de habitaciones completada');
    } catch (error) {
      console.error('❌ Error en sincronización de habitaciones:', error);
    }
  });
  
  // TAREA 2: Limpieza de reservas antiguas - cada semana (domingo a las 3am)
  cron.schedule('0 3 * * 0', async () => {
    console.log(`\n[${new Date().toLocaleString()}] Ejecutando limpieza de reservas antiguas...`);
    try {
      await cleanupOldReservations();
      console.log('✅ Limpieza de reservas antiguas completada');
    } catch (error) {
      console.error('❌ Error en limpieza de reservas:', error);
    }
  });
  
  // TAREA 3: Optimización de índices - cada mes (día 1 a las 2am)
  cron.schedule('0 2 1 * *', async () => {
    console.log(`\n[${new Date().toLocaleString()}] Ejecutando optimización de índices...`);
    try {
      await createIndexes();
      console.log('✅ Optimización de índices completada');
    } catch (error) {
      console.error('❌ Error en optimización de índices:', error);
    }
  });
  
  console.log('✅ Tareas programadas iniciadas correctamente');
  console.log('📋 Resumen de tareas:');
  console.log('  • Sincronización de habitaciones: Cada hora');
  console.log('  • Limpieza de reservas antiguas: Cada domingo a las 3am');
  console.log('  • Optimización de índices: El día 1 de cada mes a las 2am');
  
  // Mantener el script en ejecución si se inició como un proceso independiente
  if (require.main === module) {
    console.log('\n⚠️ Manteniendo el proceso activo para tareas programadas...');
    console.log('   Para detener, presione Ctrl+C');
    
    // Evitar que el proceso termine
    process.stdin.resume();
    
    // Manejar la terminación del proceso
    process.on('SIGINT', async () => {
      console.log('\n🛑 Deteniendo tareas programadas...');
      
      // Desconectar de MongoDB si creamos la conexión
      if (newConnection && mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB');
      }
      
      process.exit(0);
    });
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  startScheduledTasks();
}

module.exports = { startScheduledTasks };