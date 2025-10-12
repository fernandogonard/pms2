// scripts/assignRoomsToExistingReservations.js
// Script para asignar habitaciones a reservas existentes que son virtuales

const mongoose = require('mongoose');
const { assignRoomsToReservation } = require('../services/roomAssignmentService');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');

const DB_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function assignRoomsToExistingReservations() {
  try {
    console.log('🔧 Conectando a la base de datos...');
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB\n');

    console.log('🏠 ASIGNANDO HABITACIONES A RESERVAS VIRTUALES EXISTENTES\n');

    // Buscar todas las reservas que no tienen habitaciones asignadas (virtuales)
    const virtualReservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      $or: [
        { room: { $exists: false } },
        { room: { $size: 0 } },
        { room: null }
      ]
    }).populate('client');

    console.log(`📊 Encontradas ${virtualReservations.length} reservas virtuales para procesar\n`);

    if (virtualReservations.length === 0) {
      console.log('✅ No hay reservas virtuales que procesar');
      return;
    }

    let processed = 0;
    let assigned = 0;

    for (const reservation of virtualReservations) {
      console.log(`\n🔄 Procesando reserva ${reservation._id}:`);
      console.log(`   Cliente: ${reservation.client?.nombre} ${reservation.client?.apellido}`);
      console.log(`   Tipo: ${reservation.tipo}, Cantidad: ${reservation.cantidad || 1}`);
      console.log(`   Fechas: ${reservation.checkIn.toISOString().split('T')[0]} → ${reservation.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Estado: ${reservation.status}`);

      // Intentar asignar habitaciones
      const assignedRooms = await assignRoomsToReservation(reservation);
      
      if (assignedRooms.length > 0) {
        // Verificar las habitaciones asignadas
        const roomDetails = await Room.find({ _id: { $in: assignedRooms } });
        console.log(`   ✅ ASIGNADAS: ${roomDetails.map(r => `#${r.number}`).join(', ')}`);
        assigned++;
      } else {
        console.log(`   ❌ NO SE PUDIERON ASIGNAR HABITACIONES (sin disponibilidad)`);
      }
      
      processed++;
    }

    console.log(`\n📊 RESUMEN DE ASIGNACIÓN:`);
    console.log(`   Reservas procesadas: ${processed}`);
    console.log(`   Reservas con habitaciones asignadas: ${assigned}`);
    console.log(`   Reservas que siguen virtuales: ${processed - assigned}`);

    // Verificar estado final
    console.log(`\n🔍 VERIFICACIÓN FINAL:`);
    
    const stillVirtual = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      $or: [
        { room: { $exists: false } },
        { room: { $size: 0 } },
        { room: null }
      ]
    });

    const withRooms = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      room: { $exists: true, $not: { $size: 0 } }
    }).populate('room');

    console.log(`   Reservas virtuales restantes: ${stillVirtual.length}`);
    console.log(`   Reservas con habitaciones asignadas: ${withRooms.length}`);

    if (withRooms.length > 0) {
      console.log(`\n🏨 HABITACIONES ASIGNADAS:`);
      withRooms.forEach(res => {
        const roomNumbers = res.room.map(r => `#${r.number}`).join(', ');
        console.log(`   Reserva ${res._id}: ${res.tipo} → ${roomNumbers}`);
      });
    }

    console.log('\n✅ Proceso de asignación completado');

  } catch (error) {
    console.error('❌ Error en asignación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  assignRoomsToExistingReservations();
}

module.exports = { assignRoomsToExistingReservations };