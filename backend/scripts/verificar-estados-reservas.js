// scripts/verificar-estados-reservas.js
// Script para verificar y corregir estados de reservas

require('dotenv').config();
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

const verificarEstados = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero');
    console.log('✅ Conectado a MongoDB');

    // Obtener todas las reservas activas
    const reservas = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] }
    }).populate('room');

    console.log(`\n📋 Encontradas ${reservas.length} reservas activas:`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const reserva of reservas) {
      const checkInDate = new Date(reserva.checkIn);
      checkInDate.setHours(0, 0, 0, 0);
      
      console.log(`\n🏨 Reserva ${reserva._id}:`);
      console.log(`   Tipo: ${reserva.tipo} x${reserva.cantidad}`);
      console.log(`   Check-in: ${reserva.checkIn?.toISOString().slice(0,10)}`);
      console.log(`   Check-out: ${reserva.checkOut?.toISOString().slice(0,10)}`);
      console.log(`   Estado actual: ${reserva.status}`);
      console.log(`   Habitaciones asignadas: ${reserva.room?.length || 0}`);
      
      if (reserva.room && reserva.room.length > 0) {
        const habitaciones = reserva.room.map(r => `#${r.number}`).join(', ');
        console.log(`   Habitaciones: ${habitaciones}`);
      }

      // Verificar si debería estar en check-in
      if (hoy >= checkInDate && reserva.status === 'reservada') {
        console.log(`   🔄 Actualizando a check-in (fecha llegada alcanzada)`);
        reserva.status = 'checkin';
        await reserva.save();
        console.log(`   ✅ Estado actualizado a 'checkin'`);
      } else if (hoy >= checkInDate && reserva.status === 'checkin') {
        console.log(`   ✅ Ya está en check-in correctamente`);
      } else if (hoy < checkInDate && reserva.status === 'checkin') {
        console.log(`   ⚠️ WARNING: En check-in pero fecha aún no llegó`);
      } else {
        console.log(`   📅 Reserva futura, estado correcto`);
      }
    }

    // Verificar específicamente las reservas de hoy
    const reservasHoy = reservas.filter(r => {
      const checkIn = new Date(r.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(r.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      return hoy >= checkIn && hoy < checkOut;
    });

    console.log(`\n🎯 RESERVAS ACTIVAS HOY (${hoy.toISOString().slice(0,10)}):`);
    for (const reserva of reservasHoy) {
      console.log(`   - ID: ${reserva._id}`);
      console.log(`     Estado: ${reserva.status} ${reserva.status === 'checkin' ? '✅' : '❌'}`);
      console.log(`     Habitaciones: ${reserva.room?.map(r => `#${r.number}`).join(', ') || 'Ninguna'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Desconectado de MongoDB');
  }
};

// Ejecutar script
verificarEstados();