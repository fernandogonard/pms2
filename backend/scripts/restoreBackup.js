const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Modelos
const Room = require('../models/Room');
const User = require('../models/User');
const Client = require('../models/Client');
const Reservation = require('../models/Reservation');

dotenv.config({ path: './config/.env' });

// Configuración
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const BACKUP_DIR = path.resolve(__dirname, '../backups');

// Crear interfaz de lectura
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para preguntar con promesa
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function restoreBackup(backupFile = null) {
  try {
    // Si no hay un archivo especificado, mostrar lista de backups disponibles
    if (!backupFile) {
      // Verificar que exista el directorio y tenga archivos
      if (!fs.existsSync(BACKUP_DIR)) {
        console.error('❌ No se encontró el directorio de backups.');
        return { success: false, error: 'Directorio de backups no encontrado' };
      }

      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('backup_json_'))
        .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtime.getTime() - 
                         fs.statSync(path.join(BACKUP_DIR, a)).mtime.getTime());

      if (backups.length === 0) {
        console.error('❌ No hay archivos de backup disponibles.');
        return { success: false, error: 'No hay archivos de backup' };
      }

      console.log(`📋 Backups disponibles (${backups.length}):`);
      backups.forEach((file, index) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const fileDate = new Date(stats.mtime).toLocaleString();
        console.log(`${index + 1}. ${file} (${fileSizeMB} MB) - ${fileDate}`);
      });

      // Solicitar selección de archivo
      const selection = await question('\nSeleccione el número del backup a restaurar (Ctrl+C para cancelar): ');
      const index = parseInt(selection) - 1;
      
      if (isNaN(index) || index < 0 || index >= backups.length) {
        console.error('❌ Selección inválida.');
        return { success: false, error: 'Selección inválida' };
      }
      
      backupFile = path.join(BACKUP_DIR, backups[index]);
    } else if (!fs.existsSync(backupFile)) {
      console.error(`❌ El archivo ${backupFile} no existe.`);
      return { success: false, error: 'Archivo de backup no encontrado' };
    }

    // Confirmar restauración
    console.log(`\n⚠️ ¡ADVERTENCIA! La restauración sobrescribirá la base de datos actual.`);
    const confirm = await question('¿Está seguro de que desea continuar? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Operación cancelada por el usuario.');
      return { success: false, error: 'Operación cancelada' };
      rl.close();
    }
    
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
    
    // Leer archivo de backup
    console.log(`\n🔄 Cargando datos del backup ${path.basename(backupFile)}...`);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Verificar que el backup tiene la estructura correcta
    if (!backupData.metadata || !backupData.rooms || !backupData.users || 
        !backupData.clients || !backupData.reservations) {
      throw new Error('El archivo de backup no tiene la estructura esperada');
    }
    
    // Mostrar estadísticas del backup
    console.log('� Estadísticas del backup a restaurar:');
    console.log(`  • Habitaciones: ${backupData.rooms.length}`);
    console.log(`  • Usuarios: ${backupData.users.length}`);
    console.log(`  • Clientes: ${backupData.clients.length}`);
    console.log(`  • Reservaciones: ${backupData.reservations.length}`);
    
    // Confirmar estadísticas
    const confirmStats = await question('\n¿Continuar con la restauración? (y/N): ');
    if (confirmStats.toLowerCase() !== 'y') {
      console.log('❌ Operación cancelada por el usuario.');
      return { success: false, error: 'Operación cancelada' };
      rl.close();
    }
    
    // PROCESO DE RESTAURACIÓN
    console.log('\n🗑️ Eliminando datos actuales...');
    
    // Eliminar datos existentes
    await Room.deleteMany({});
    await User.deleteMany({});
    await Client.deleteMany({});
    await Reservation.deleteMany({});
    
    console.log('📥 Restaurando datos...');
    
    // Restaurar datos
    await Room.insertMany(backupData.rooms);
    await User.insertMany(backupData.users);
    await Client.insertMany(backupData.clients);
    await Reservation.insertMany(backupData.reservations);
    
    // Verificar la restauración
    const roomCount = await Room.countDocuments();
    const userCount = await User.countDocuments();
    const clientCount = await Client.countDocuments();
    const reservationCount = await Reservation.countDocuments();
    
    console.log('\n✅ Restauración completada. Verificación:');
    console.log(`  • Habitaciones: ${roomCount} de ${backupData.rooms.length} restauradas`);
    console.log(`  • Usuarios: ${userCount} de ${backupData.users.length} restaurados`);
    console.log(`  • Clientes: ${clientCount} de ${backupData.clients.length} restaurados`);
    console.log(`  • Reservaciones: ${reservationCount} de ${backupData.reservations.length} restauradas`);
    
    return {
      success: true,
      file: backupFile,
      stats: {
        rooms: roomCount,
        users: userCount,
        clients: clientCount,
        reservations: reservationCount
      }
    };
  } catch (error) {
    console.error('❌ Error restaurando backup:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    rl.close();
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
  // Verificar si se pasa un archivo como argumento
  const specifiedFile = process.argv[2] ? 
    path.resolve(process.argv[2]) : null;
  
  restoreBackup(specifiedFile).finally(() => {
    console.log('🔌 Proceso de restauración finalizado');
    process.exit(0);
  });
}

module.exports = { restoreBackup };