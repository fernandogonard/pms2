const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { format } = require('date-fns');

// Modelos
const Room = require('../models/Room');
const User = require('../models/User');
const Client = require('../models/Client');
const Reservation = require('../models/Reservation');

dotenv.config({ path: './config/.env' });

// Configuración
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const BACKUP_DIR = path.resolve(__dirname, '../backups');

async function createBackup() {
  // Asegurarse que el directorio de backups existe
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Directorio de backups creado: ${BACKUP_DIR}`);
  }

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
    
    // Fecha y nombre del archivo de backup
    const now = new Date();
    const timestamp = format(now, 'yyyyMMdd-HHmmss');
    const backupFile = path.join(BACKUP_DIR, `backup_json_${timestamp}.json`);
    
    console.log(`🔄 Iniciando backup de la base de datos...`);
    
    // Recuperar datos de cada colección
    console.log('📑 Recuperando datos de colecciones...');
    const backup = {
      metadata: {
        createdAt: now,
        version: '1.0',
        collections: ['rooms', 'users', 'clients', 'reservations']
      },
      rooms: await Room.find({}).lean(),
      users: await User.find({}).lean(),
      clients: await Client.find({}).lean(),
      reservations: await Reservation.find({}).lean()
    };
    
    // Escribir a archivo
    console.log('� Guardando backup...');
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    // Verificar que el archivo se creó
    if (fs.existsSync(backupFile)) {
      const stats = fs.statSync(backupFile);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Backup completado: ${backupFile} (${fileSizeMB} MB)`);
      
      // Estadísticas del backup
      console.log('\n📊 Estadísticas del backup:');
      console.log(`  • Habitaciones: ${backup.rooms.length}`);
      console.log(`  • Usuarios: ${backup.users.length}`);
      console.log(`  • Clientes: ${backup.clients.length}`);
      console.log(`  • Reservaciones: ${backup.reservations.length}`);
      
      // Listar archivos de backup
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('backup_'))
        .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtime.getTime() - 
                         fs.statSync(path.join(BACKUP_DIR, a)).mtime.getTime());
      
      console.log(`\n📋 Backups disponibles (${backups.length}):`);
      backups.forEach((file, index) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const fileDate = format(stats.mtime, 'dd/MM/yyyy HH:mm:ss');
        console.log(`${index + 1}. ${file} (${fileSizeMB} MB) - ${fileDate}`);
      });
      
      return {
        success: true,
        file: backupFile,
        size: fileSizeMB,
        timestamp: timestamp,
        stats: {
          rooms: backup.rooms.length,
          users: backup.users.length,
          clients: backup.clients.length,
          reservations: backup.reservations.length
        }
      };
    } else {
      throw new Error('No se encontró el archivo de backup después de la ejecución');
    }
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    
    return {
      success: false,
      error: error.message
    };
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
  createBackup().finally(() => {
    console.log('🔌 Proceso de backup finalizado');
  });
}

module.exports = { createBackup };