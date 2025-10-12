const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { subMonths } = require('date-fns');
const Reservation = require('../models/Reservation');

dotenv.config({ path: './config/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const RETENTION_MONTHS = 12; // Mantener reservas de hasta 1 año de antigüedad

async function cleanupOldReservations() {
  try {
    // Verificar si ya hay una conexión activa de mongoose
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      console.log('🏨 Conectando a la base de datos...');
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Conectado a MongoDB');
    } else {
      console.log('✅ Usando conexión MongoDB existente');
    }

    // Calcular la fecha límite (reservas anteriores a esta fecha serán archivadas)
    const cutoffDate = subMonths(new Date(), RETENTION_MONTHS);
    
    console.log(`🧹 Buscando reservas anteriores a ${cutoffDate.toISOString().split('T')[0]}...`);
    
    // Contar reservas antiguas
    const oldReservationsCount = await Reservation.countDocuments({
      checkOut: { $lt: cutoffDate },
      status: 'completada'
    });
    
    if (oldReservationsCount === 0) {
      console.log('✅ No hay reservas antiguas para archivar');
      return;
    }
    
    console.log(`🔍 Se encontraron ${oldReservationsCount} reservas antiguas completadas`);
    
    // OPCIÓN 1: Eliminación directa (descomentar si se desea eliminar)
    /*
    console.log('🗑️ Eliminando reservas antiguas...');
    const deleteResult = await Reservation.deleteMany({
      checkOut: { $lt: cutoffDate },
      status: 'completada'
    });
    console.log(`✅ Se eliminaron ${deleteResult.deletedCount} reservas antiguas`);
    */
    
    // OPCIÓN 2: Archivado (cambia estado a 'archivada')
    console.log('📦 Archivando reservas antiguas...');
    const updateResult = await Reservation.updateMany(
      {
        checkOut: { $lt: cutoffDate },
        status: 'completada'
      },
      {
        $set: { status: 'archivada' }
      }
    );
    
    console.log(`✅ Se archivaron ${updateResult.modifiedCount} reservas antiguas`);
    
    // Opcional: Crear estadísticas antes de la limpieza
    
  } catch (error) {
    console.error('❌ Error en la limpieza de reservas:', error);
  } finally {
    // Solo desconectar si la conexión se creó en esta función
    if (require.main === module && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Desconectado de MongoDB');
    } else {
      console.log('✓ Manteniendo conexión a la base de datos');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  cleanupOldReservations();
}

module.exports = { cleanupOldReservations };