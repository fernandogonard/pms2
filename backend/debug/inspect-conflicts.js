// debug/inspect-conflicts.js
// Script para inspeccionar conflictos de reservas y solapamientos

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-crm');
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function inspectReservation(reservationId) {
  console.log(`\n🔍 INSPECCIONANDO RESERVA: ${reservationId}`);
  console.log('='.repeat(60));
  
  try {
    const reservation = await Reservation.findById(reservationId).populate('room client');
    
    if (!reservation) {
      console.log('❌ Reserva no encontrada');
      return;
    }
    
    console.log('📋 DATOS DE LA RESERVA:');
    console.log(`   ID: ${reservation._id}`);
    console.log(`   Tipo: ${reservation.tipo}`);
    console.log(`   Cantidad: ${reservation.cantidad || 1}`);
    console.log(`   Check-in: ${reservation.checkIn}`);
    console.log(`   Check-out: ${reservation.checkOut}`);
    console.log(`   Status: ${reservation.status}`);
    console.log(`   Cliente: ${reservation.client ? `${reservation.client.nombre} ${reservation.client.apellido}` : 'Sin cliente'}`);
    
    if (reservation.room && reservation.room.length > 0) {
      console.log(`   Habitaciones asignadas (${reservation.room.length}):`);
      reservation.room.forEach(room => {
        console.log(`     - ${room.number} (${room.type}) - Estado: ${room.status}`);
      });
    } else {
      console.log('   🟡 RESERVA VIRTUAL (sin habitaciones asignadas)');
    }
    
    // Buscar solapamientos con esta reserva
    console.log('\n🔍 BUSCANDO SOLAPAMIENTOS:');
    
    if (reservation.room && reservation.room.length > 0) {
      for (const room of reservation.room) {
        const overlaps = await Reservation.find({
          _id: { $ne: reservation._id },
          room: room._id,
          $or: [
            { 
              checkIn: { $lt: new Date(reservation.checkOut) }, 
              checkOut: { $gt: new Date(reservation.checkIn) } 
            }
          ]
        }).populate('client');
        
        if (overlaps.length > 0) {
          console.log(`   ⚠️ CONFLICTO en habitación ${room.number}:`);
          overlaps.forEach(overlap => {
            console.log(`     - Reserva ${overlap._id} (${overlap.checkIn} - ${overlap.checkOut})`);
            console.log(`       Cliente: ${overlap.client ? `${overlap.client.nombre} ${overlap.client.apellido}` : 'Sin cliente'}`);
          });
        } else {
          console.log(`   ✅ Sin conflictos en habitación ${room.number}`);
        }
      }
    }
    
    return reservation;
    
  } catch (error) {
    console.error('❌ Error inspeccionando reserva:', error);
  }
}

async function findAllConflicts() {
  console.log('\n🔍 BUSCANDO TODOS LOS CONFLICTOS EN EL SISTEMA');
  console.log('='.repeat(60));
  
  try {
    const reservations = await Reservation.find({ room: { $exists: true, $ne: [] } }).populate('room client');
    
    const conflicts = [];
    
    for (let i = 0; i < reservations.length; i++) {
      const res1 = reservations[i];
      
      if (!res1.room || res1.room.length === 0) continue;
      
      for (const room of res1.room) {
        for (let j = i + 1; j < reservations.length; j++) {
          const res2 = reservations[j];
          
          if (!res2.room || res2.room.length === 0) continue;
          
          // Verificar si comparten habitación
          const shareRoom = res2.room.some(r => r._id.toString() === room._id.toString());
          
          if (shareRoom) {
            // Verificar solapamiento de fechas
            const overlap = (
              new Date(res1.checkIn) < new Date(res2.checkOut) &&
              new Date(res1.checkOut) > new Date(res2.checkIn)
            );
            
            if (overlap) {
              conflicts.push({
                room: room.number,
                roomType: room.type,
                reservation1: {
                  id: res1._id,
                  checkIn: res1.checkIn,
                  checkOut: res1.checkOut,
                  client: res1.client ? `${res1.client.nombre} ${res1.client.apellido}` : 'Sin cliente'
                },
                reservation2: {
                  id: res2._id,
                  checkIn: res2.checkIn,
                  checkOut: res2.checkOut,
                  client: res2.client ? `${res2.client.nombre} ${res2.client.apellido}` : 'Sin cliente'
                }
              });
            }
          }
        }
      }
    }
    
    if (conflicts.length === 0) {
      console.log('✅ No se encontraron conflictos de solapamiento');
    } else {
      console.log(`❌ Se encontraron ${conflicts.length} conflictos:`);
      conflicts.forEach((conflict, index) => {
        console.log(`\n   Conflicto ${index + 1}:`);
        console.log(`   🏠 Habitación: ${conflict.room} (${conflict.roomType})`);
        console.log(`   📅 Reserva 1: ${conflict.reservation1.id}`);
        console.log(`      ${conflict.reservation1.checkIn} - ${conflict.reservation1.checkOut}`);
        console.log(`      Cliente: ${conflict.reservation1.client}`);
        console.log(`   📅 Reserva 2: ${conflict.reservation2.id}`);
        console.log(`      ${conflict.reservation2.checkIn} - ${conflict.reservation2.checkOut}`);
        console.log(`      Cliente: ${conflict.reservation2.client}`);
      });
    }
    
    return conflicts;
    
  } catch (error) {
    console.error('❌ Error buscando conflictos:', error);
  }
}

async function inspectRoomAvailability(roomNumber, startDate, endDate) {
  console.log(`\n🔍 DISPONIBILIDAD HABITACIÓN ${roomNumber} (${startDate} - ${endDate})`);
  console.log('='.repeat(60));
  
  try {
    const room = await Room.findOne({ number: roomNumber });
    
    if (!room) {
      console.log('❌ Habitación no encontrada');
      return;
    }
    
    console.log(`📋 HABITACIÓN ${room.number}:`);
    console.log(`   Tipo: ${room.type}`);
    console.log(`   Estado: ${room.status}`);
    console.log(`   Precio: $${room.price}`);
    
    // Buscar reservas que afecten este período
    const reservations = await Reservation.find({
      room: room._id,
      $or: [
        { 
          checkIn: { $lt: new Date(endDate) }, 
          checkOut: { $gt: new Date(startDate) } 
        }
      ]
    }).populate('client');
    
    console.log(`\n📅 RESERVAS EN EL PERÍODO:`);
    if (reservations.length === 0) {
      console.log('   ✅ No hay reservas en este período');
    } else {
      reservations.forEach(res => {
        console.log(`   - ${res._id} (${res.checkIn} - ${res.checkOut})`);
        console.log(`     Cliente: ${res.client ? `${res.client.nombre} ${res.client.apellido}` : 'Sin cliente'}`);
        console.log(`     Status: ${res.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error inspeccionando disponibilidad:', error);
  }
}

async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'reservation':
        if (args[1]) {
          await inspectReservation(args[1]);
        } else {
          console.log('❌ Proporciona un ID de reserva: node inspect-conflicts.js reservation <id>');
        }
        break;
        
      case 'conflicts':
        await findAllConflicts();
        break;
        
      case 'room':
        if (args[1] && args[2] && args[3]) {
          await inspectRoomAvailability(args[1], args[2], args[3]);
        } else {
          console.log('❌ Proporciona habitación y fechas: node inspect-conflicts.js room <number> <start> <end>');
        }
        break;
        
      default:
        console.log('🔧 COMANDOS DISPONIBLES:');
        console.log('   node inspect-conflicts.js reservation <id>     - Inspeccionar reserva específica');
        console.log('   node inspect-conflicts.js conflicts            - Buscar todos los conflictos');
        console.log('   node inspect-conflicts.js room <num> <start> <end> - Disponibilidad de habitación');
        break;
    }
  } catch (error) {
    console.error('❌ Error ejecutando comando:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  }
}

main();