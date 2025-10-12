// scripts/liberar-room107.js
// Script para liberar la habitación 107 y ponerla en limpieza

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const liberarRoom107 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero');
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar habitación 107
    const room107 = await Room.findOne({ number: 107 });
    
    if (!room107) {
      console.log('❌ Habitación 107 no encontrada');
      return;
    }

    console.log('🏨 Habitación 107 encontrada:');
    console.log(`   ID: ${room107._id}`);
    console.log(`   Estado actual: ${room107.status}`);

    // 2. Buscar todas las reservas que incluyen la habitación 107
    const reservasConRoom107 = await Reservation.find({
      room: room107._id,
      status: { $in: ['reservada', 'checkin'] }
    });

    console.log(`\n🔍 Encontradas ${reservasConRoom107.length} reservas con habitación 107:`);
    
    for (const reserva of reservasConRoom107) {
      console.log(`   - Reserva ${reserva._id}: ${reserva.tipo} x${reserva.cantidad}`);
      console.log(`     Fechas: ${reserva.checkIn?.toISOString().slice(0,10)} → ${reserva.checkOut?.toISOString().slice(0,10)}`);
      console.log(`     Habitaciones actuales: ${reserva.room?.length || 0}`);
      
      // Remover habitación 107 de la reserva
      if (reserva.room && reserva.room.length > 0) {
        reserva.room = reserva.room.filter(roomId => roomId.toString() !== room107._id.toString());
        await reserva.save();
        console.log(`     ✅ Habitación 107 removida. Habitaciones restantes: ${reserva.room.length}`);
      }
    }

    // 3. Poner habitación 107 en limpieza
    console.log(`\n🧹 Cambiando habitación 107 a estado 'limpieza'...`);
    room107.status = 'limpieza';
    await room107.save();
    console.log('✅ Habitación 107 ahora está en LIMPIEZA');

    // 4. Verificación final
    const room107Updated = await Room.findOne({ number: 107 });
    const reservasRestantes = await Reservation.find({
      room: room107._id,
      status: { $in: ['reservada', 'checkin'] }
    });

    console.log('\n📊 ESTADO FINAL:');
    console.log(`   Habitación 107 estado: ${room107Updated.status}`);
    console.log(`   Reservas que aún la incluyen: ${reservasRestantes.length}`);
    
    if (reservasRestantes.length === 0) {
      console.log('✅ SUCCESS: Habitación 107 completamente liberada y en limpieza');
    } else {
      console.log('⚠️ WARNING: Aún hay reservas que incluyen la habitación 107');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Desconectado de MongoDB');
  }
};

// Ejecutar script
liberarRoom107();