// scripts/fixRoomAvailability.js
// Script para corregir problemas de disponibilidad de habitaciones

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const DB_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function fixRoomAvailability() {
  try {
    console.log('🔧 Conectando a la base de datos...');
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB\n');

    console.log('🛠️ SOLUCIONANDO PROBLEMAS DE DISPONIBILIDAD\n');

    // PROBLEMA 1: Habitaciones triples están marcadas como "ocupada" permanentemente
    console.log('1️⃣ Liberando habitaciones triples que están marcadas como ocupadas...');
    
    const tripleRooms = await Room.find({ type: 'triple' });
    console.log(`   Encontradas ${tripleRooms.length} habitaciones triples`);
    
    for (const room of tripleRooms) {
      if (room.status === 'ocupada') {
        // Verificar si realmente hay una reserva activa para esta habitación
        const activeReservation = await Reservation.findOne({
          room: room._id,
          status: { $in: ['checkin'] },
          checkOut: { $gt: new Date() }
        });
        
        if (!activeReservation) {
          // No hay reserva activa, liberar la habitación
          room.status = 'disponible';
          await room.save();
          console.log(`   ✅ Habitación #${room.number} liberada (no tiene reserva activa)`);
        } else {
          console.log(`   ⚠️ Habitación #${room.number} mantiene estado ocupada (tiene reserva activa)`);
        }
      }
    }

    // PROBLEMA 2: Solo hay 1 habitación cuádruple, crear más
    console.log('\n2️⃣ Creando más habitaciones cuádruples...');
    
    const cuadrupleCount = await Room.countDocuments({ type: 'cuadruple' });
    console.log(`   Habitaciones cuádruples existentes: ${cuadrupleCount}`);
    
    if (cuadrupleCount < 5) {
      console.log('   Creando habitaciones cuádruples adicionales...');
      
      // Buscar números de habitación disponibles
      const existingNumbers = await Room.find({}).distinct('number');
      const newRooms = [];
      
      // Crear habitaciones en piso 2 (rango 210-220)
      for (let i = 210; i <= 220; i++) {
        if (!existingNumbers.includes(i) && newRooms.length < 4) {
          newRooms.push({
            number: i,
            floor: 2,
            type: 'cuadruple',
            price: 85,
            status: 'disponible'
          });
        }
      }
      
      for (const roomData of newRooms) {
        const newRoom = await Room.create(roomData);
        console.log(`   ✅ Creada habitación cuádruple #${newRoom.number} - Piso ${newRoom.floor}`);
      }
      
      console.log(`   Total habitaciones cuádruples creadas: ${newRooms.length}`);
    }

    // PROBLEMA 3: Limpiar reservas que ya vencieron pero siguen activas
    console.log('\n3️⃣ Limpiando reservas vencidas...');
    
    const expiredReservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      checkOut: { $lt: new Date() }
    });
    
    console.log(`   Encontradas ${expiredReservations.length} reservas vencidas`);
    
    for (const reservation of expiredReservations) {
      reservation.status = 'checkout';
      await reservation.save();
      
      // Liberar habitaciones asignadas
      if (reservation.room && reservation.room.length > 0) {
        for (const roomId of reservation.room) {
          const room = await Room.findById(roomId);
          if (room && room.status === 'ocupada') {
            room.status = 'disponible';
            await room.save();
            console.log(`   ✅ Habitación #${room.number} liberada de reserva vencida`);
          }
        }
      }
      
      console.log(`   ✅ Reserva ${reservation._id} marcada como checkout`);
    }

    // VERIFICACIÓN FINAL
    console.log('\n📊 VERIFICACIÓN FINAL:\n');
    
    const types = ['triple', 'cuadruple'];
    for (const type of types) {
      const rooms = await Room.find({ type });
      const availableRooms = rooms.filter(r => r.status === 'disponible');
      
      console.log(`${type.toUpperCase()}:`);
      console.log(`   Total: ${rooms.length}`);
      console.log(`   Disponibles: ${availableRooms.length}`);
      console.log(`   Estados: ${rooms.map(r => `#${r.number}:${r.status}`).join(', ')}`);
      console.log('');
    }

    console.log('✅ Corrección de disponibilidad completada\n');

  } catch (error) {
    console.error('❌ Error corrigiendo disponibilidad:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de la base de datos');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixRoomAvailability();
}

module.exports = { fixRoomAvailability };