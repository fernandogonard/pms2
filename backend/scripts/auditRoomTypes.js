// scripts/auditRoomTypes.js
// Script para auditar tipos de habitaciones y disponibilidad

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const DB_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function auditRoomTypes() {
  try {
    console.log('🔧 Conectando a la base de datos...');
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB\n');

    const checkInDate = new Date('2025-10-06');
    const checkOutDate = new Date('2025-10-08');

    console.log(`📅 Consultando disponibilidad para: ${checkInDate.toISOString().split('T')[0]} → ${checkOutDate.toISOString().split('T')[0]}\n`);

    // Auditar cada tipo de habitación
    const types = ['simple', 'doble', 'triple', 'cuadruple', 'suite'];
    
    for (const type of types) {
      console.log(`🏨 === AUDITORÍA HABITACIONES ${type.toUpperCase()} ===\n`);
      
      // 1. Contar habitaciones totales
      const totalRooms = await Room.find({ type }).sort({ number: 1 }).lean();
      console.log(`📊 Total habitaciones ${type}: ${totalRooms.length}`);
      
      if (totalRooms.length === 0) {
        console.log(`❌ NO HAY HABITACIONES DEL TIPO ${type.toUpperCase()}`);
        console.log(`💡 Necesitas crear habitaciones de este tipo\n`);
        continue;
      }
      
      // Mostrar todas las habitaciones
      console.log(`📋 Lista de habitaciones:`);
      totalRooms.forEach(room => {
        console.log(`   #${room.number} - Piso ${room.floor} - Estado: ${room.status} - Precio: $${room.price}`);
      });
      
      // 2. Buscar reservas que se solapan
      const overlappingReservations = await Reservation.find({
        tipo: type,
        status: { $in: ['reservada', 'checkin'] },
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate }
      }).populate('room').lean();
      
      console.log(`\n📅 Reservas solapantes del tipo ${type}: ${overlappingReservations.length}`);
      
      if (overlappingReservations.length > 0) {
        overlappingReservations.forEach(reservation => {
          console.log(`   📝 Reserva: ${reservation._id}`);
          console.log(`      Tipo: ${reservation.tipo}, Cantidad: ${reservation.cantidad || 1}`);
          console.log(`      Fechas: ${reservation.checkIn.toISOString().split('T')[0]} → ${reservation.checkOut.toISOString().split('T')[0]}`);
          console.log(`      Estado: ${reservation.status}`);
          if (reservation.room && reservation.room.length > 0) {
            console.log(`      Habitaciones asignadas: ${reservation.room.map(r => `#${r.number}`).join(', ')}`);
          } else {
            console.log(`      Reserva virtual (sin habitación asignada)`);
          }
          console.log('');
        });
      }
      
      // 3. Calcular disponibilidad usando la misma lógica del controlador
      let occupiedCount = 0;
      const occupiedRoomIds = new Set();
      
      overlappingReservations.forEach(reservation => {
        if (reservation.room && reservation.room.length > 0) {
          // Reserva real - contar habitaciones asignadas
          reservation.room.forEach(room => {
            if (room.type === type) {
              occupiedRoomIds.add(room._id.toString());
            }
          });
          occupiedCount += reservation.room.filter(r => r.type === type).length;
        } else {
          // Reserva virtual - contar cantidad solicitada
          occupiedCount += reservation.cantidad || 1;
        }
      });
      
      // Filtrar habitaciones no disponibles por estado
      const availableRooms = totalRooms.filter(room => {
        if (room.status === 'mantenimiento' || room.status === 'limpieza') return false;
        if (occupiedRoomIds.has(room._id.toString())) return false;
        return true;
      });
      
      const reallyAvailable = Math.max(0, availableRooms.length - (occupiedCount - occupiedRoomIds.size));
      
      console.log(`\n📊 CÁLCULO DE DISPONIBILIDAD:`);
      console.log(`   Total habitaciones del tipo: ${totalRooms.length}`);
      console.log(`   Habitaciones en mantenimiento/limpieza: ${totalRooms.length - totalRooms.filter(r => r.status !== 'mantenimiento' && r.status !== 'limpieza').length}`);
      console.log(`   Habitaciones con reservas reales: ${occupiedRoomIds.size}`);
      console.log(`   Reservas virtuales bloqueando: ${occupiedCount - occupiedRoomIds.size}`);
      console.log(`   Habitaciones físicamente disponibles: ${availableRooms.length}`);
      console.log(`   🎯 DISPONIBLES PARA RESERVA: ${reallyAvailable}`);
      
      if (reallyAvailable === 0) {
        console.log(`\n❌ PROBLEMA: No hay habitaciones ${type} disponibles`);
        if (totalRooms.length === 0) {
          console.log(`   • Causa: No existen habitaciones del tipo ${type}`);
        } else if (availableRooms.length === 0) {
          console.log(`   • Causa: Todas están ocupadas, en mantenimiento o limpieza`);
        } else if (occupiedCount > availableRooms.length) {
          console.log(`   • Causa: Hay más reservas (${occupiedCount}) que habitaciones disponibles (${availableRooms.length})`);
        }
      } else {
        console.log(`\n✅ OK: ${reallyAvailable} habitaciones ${type} disponibles para las fechas solicitadas`);
      }
      
      console.log(`\n${'='.repeat(60)}\n`);
    }

    // Resumen final
    console.log(`📋 RESUMEN GENERAL:`);
    for (const type of types) {
      const count = await Room.countDocuments({ type });
      console.log(`   ${type}: ${count} habitaciones`);
    }

  } catch (error) {
    console.error('❌ Error en auditoría:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  auditRoomTypes();
}

module.exports = { auditRoomTypes };