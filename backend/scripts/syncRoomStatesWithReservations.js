/**
 * Script para sincronizar estados de habitaciones con reservas activas
 * 
 * Este script corrige automáticamente los estados de las habitaciones basándose en las reservas activas:
 * - Marca como 'ocupada' las habitaciones con reservas activas en check-in
 * - Mantiene el estado físico actual para habitaciones sin reservas activas
 */

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { ROOM_STATUS } = require('../constants/businessConstants');

// Configuración de la base de datos
const dotenv = require('dotenv');
dotenv.config({ path: './config/.env' });
const DB_URL = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function syncRoomStatesWithReservations() {
  try {
    // Verificar si ya hay una conexión activa de mongoose
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      console.log('🏨 Conectando a la base de datos...');
      await mongoose.connect(DB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Conectado a MongoDB');
    } else {
      console.log('✅ Usando conexión MongoDB existente');
    }

    // Obtener fecha actual usando DateService
    const DateService = require('../services/dateService');
    const today = DateService.today();

    // PASO 1: Obtener todas las habitaciones
    console.log('📋 Obteniendo habitaciones...');
    const allRooms = await Room.find().sort({ number: 1 });
    console.log(`📊 Total de habitaciones: ${allRooms.length}`);

    // PASO 2: Obtener todas las reservas con check-in activo
    console.log('🔍 Buscando reservas con check-in activo...');
    const activeCheckins = await Reservation.find({
      status: 'checkin',
      checkOut: { $gt: today }
    });
    console.log(`📝 Reservas con check-in activo: ${activeCheckins.length}`);

    // PASO 3: Crear un mapa de habitaciones ocupadas por reservas activas
    const occupiedRoomIds = new Set();
    activeCheckins.forEach(reservation => {
      if (reservation.room && reservation.room.length > 0) {
        reservation.room.forEach(roomId => {
          occupiedRoomIds.add(roomId.toString());
        });
      }
    });
    console.log(`🔑 Habitaciones ocupadas por reservas activas: ${occupiedRoomIds.size}`);

    // PASO 4: Actualizar estados de habitaciones
    let updatedCount = 0;
    const updates = {
      markedAsOccupied: 0,
      alreadyOccupied: 0,
      noStateChange: 0
    };

    for (const room of allRooms) {
      const roomId = room._id.toString();
      const isOccupiedByReservation = occupiedRoomIds.has(roomId);
      
      if (isOccupiedByReservation && room.status !== ROOM_STATUS.OCUPADA) {
        // Caso 1: Habitación con check-in activo pero no marcada como ocupada
        console.log(`🔄 Habitación #${room.number} (${room.status}) → ocupada (por reserva activa)`);
        room.status = ROOM_STATUS.OCUPADA;
        await room.save();
        updatedCount++;
        updates.markedAsOccupied++;
      } else if (isOccupiedByReservation && room.status === ROOM_STATUS.OCUPADA) {
        // Caso 2: Habitación ya está correctamente marcada como ocupada
        updates.alreadyOccupied++;
      } else if (!isOccupiedByReservation && room.status === ROOM_STATUS.OCUPADA) {
        // Caso 3: Habitación marcada como ocupada pero sin reserva activa
        // No cambiamos su estado automáticamente por si es una ocupación manual
        console.log(`⚠️ Habitación #${room.number} está marcada como ocupada pero no tiene reserva activa`);
        updates.noStateChange++;
      }
    }

    // PASO 5: Resumen de cambios
    console.log('\n📊 Resumen de sincronización:');
    console.log(`✅ Total habitaciones actualizadas: ${updatedCount}`);
    console.log(`🔄 Habitaciones marcadas como ocupadas: ${updates.markedAsOccupied}`);
    console.log(`✓ Habitaciones ya correctamente marcadas: ${updates.alreadyOccupied}`);
    console.log(`⚠️ Habitaciones ocupadas sin reserva activa: ${updates.noStateChange}`);

  } catch (error) {
    console.error('❌ Error en el proceso:', error);
  } finally {
    // Si se ejecutó como script independiente, cerrar conexión
    // Si se ejecutó desde otro módulo (como scheduledJobs.js), mantener la conexión abierta
    if (require.main === module && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Desconectado de la base de datos');
    } else {
      console.log('\n✓ Manteniendo conexión a la base de datos (llamado desde otro módulo)');
    }
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  console.log('🚀 Iniciando sincronización de estados de habitaciones...\n');
  syncRoomStatesWithReservations();
}

module.exports = { syncRoomStatesWithReservations };