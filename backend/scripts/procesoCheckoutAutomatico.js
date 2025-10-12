// Proceso automático de checkout diario
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

async function procesoCheckoutAutomatico() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm-hotelero');
    
    console.log('🔄 PROCESO AUTOMÁTICO DE CHECKOUT DIARIO\n');
    console.log('Fecha del sistema: 6 de octubre de 2025');
    
    const hoy = new Date('2025-10-06T12:00:00.000Z'); // 6 de octubre al mediodía
    
    // 1. Buscar reservas que deberían haber hecho checkout
    const reservasVencidas = await Reservation.find({
      status: { $in: ['checkin', 'reservada'] },
      checkOut: { $lte: hoy }
    }).populate('room');
    
    console.log(`📅 Reservas que deberían haber hecho checkout: ${reservasVencidas.length}\n`);
    
    let habitacionesLiberadas = 0;
    let reservasProcesadas = 0;
    
    for (const reserva of reservasVencidas) {
      console.log(`🔄 Procesando reserva ${reserva._id}:`);
      console.log(`   Fechas: ${reserva.checkIn.toISOString().split('T')[0]} → ${reserva.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Estado: ${reserva.status}`);
      console.log(`   Tipo: ${reserva.tipo}`);
      
      // Marcar como checkout
      reserva.status = 'checkout';
      await reserva.save();
      reservasProcesadas++;
      console.log('   ✅ Reserva marcada como checkout');
      
      // Liberar habitaciones asignadas
      if (reserva.room && reserva.room.length > 0) {
        for (const room of reserva.room) {
          if (room.status === 'ocupada') {
            room.status = 'disponible';
            await room.save();
            habitacionesLiberadas++;
            console.log(`   🔓 Habitación #${room.number} liberada`);
          }
        }
      }
      console.log('');
    }
    
    // 2. Buscar reservas que terminan mañana (7/10) para pre-liberar
    const mañana = new Date('2025-10-07T00:00:00.000Z');
    const pasadoMañana = new Date('2025-10-08T00:00:00.000Z');
    
    const reservasMañana = await Reservation.find({
      status: { $in: ['checkin'] },
      checkOut: { $gte: mañana, $lt: pasadoMañana }
    }).populate('room');
    
    console.log(`📅 Reservas que terminan mañana (7/10): ${reservasMañana.length}\n`);
    
    for (const reserva of reservasMañana) {
      console.log(`📋 Reserva que termina mañana ${reserva._id}:`);
      console.log(`   Fechas: ${reserva.checkIn.toISOString().split('T')[0]} → ${reserva.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Habitaciones: ${reserva.room?.map(r => `#${r.number}`).join(', ') || 'Sin asignar'}`);
      console.log('   ℹ️ Se liberará automáticamente mañana');
      console.log('');
    }
    
    // 3. Resumen final
    console.log('📊 RESUMEN DEL PROCESO:');
    console.log(`   Reservas procesadas: ${reservasProcesadas}`);
    console.log(`   Habitaciones liberadas: ${habitacionesLiberadas}`);
    
    // 4. Estado actual de habitaciones dobles
    const habitacionesDobles = await Room.find({ type: 'doble' }).sort({ number: 1 });
    console.log('\n🏨 ESTADO ACTUAL HABITACIONES DOBLES:');
    habitacionesDobles.forEach(room => {
      const emoji = room.status === 'disponible' ? '✅' : '🔴';
      console.log(`   ${emoji} #${room.number}: ${room.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

procesoCheckoutAutomatico();