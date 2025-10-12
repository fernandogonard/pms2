// Diagnóstico de habitación 102
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

async function diagnosticarHabitacion102() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm-hotelero');
    
    console.log('🔍 DIAGNÓSTICO: Habitación #102 para 7/10/2025\n');
    
    const targetDate = '2025-10-07';
    const checkIn = new Date(targetDate + 'T00:00:00.000Z');  
    const checkOut = new Date('2025-10-08T00:00:00.000Z');
    
    // 1. Estado de habitación 102
    const room102 = await Room.findOne({ number: 102 });
    console.log('🏨 HABITACIÓN #102:');
    console.log('   Número:', room102?.number);
    console.log('   Tipo:', room102?.type);
    console.log('   Estado:', room102?.status);
    console.log('   ID:', room102?._id);
    
    // 2. Buscar TODAS las reservas dobles activas
    const reservasDobles = await Reservation.find({
      tipo: 'doble',
      status: { $in: ['reservada', 'checkin'] }
    }).populate('room');
    
    console.log('\n📅 TODAS LAS RESERVAS DOBLES ACTIVAS:');
    reservasDobles.forEach(res => {
      const roomNumbers = res.room?.map(r => `#${r.number}`).join(', ') || 'Sin asignar';
      console.log(`   Reserva ${res._id}`);
      console.log(`   Cliente: ${res.client || 'N/A'}`);
      console.log(`   Fechas: ${res.checkIn.toISOString().split('T')[0]} → ${res.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Estado: ${res.status}`);
      console.log(`   Habitaciones: ${roomNumbers}`);
      console.log('');
    });
    
    // 3. Reservas que incluyen habitación 102
    const reservas102 = reservasDobles.filter(r => 
      r.room?.some(room => room.number === 102)
    );
    
    console.log('🎯 RESERVAS QUE INCLUYEN #102:');
    if (reservas102.length === 0) {
      console.log('   ❌ NO HAY RESERVAS para habitación #102');
      console.log('   🚨 PROBLEMA: Habitación marcada como ocupada sin reserva');
    } else {
      reservas102.forEach(res => {
        console.log(`   ✅ Reserva activa: ${res._id}`);
        console.log(`   Fechas: ${res.checkIn.toISOString().split('T')[0]} → ${res.checkOut.toISOString().split('T')[0]}`);
        console.log(`   Estado: ${res.status}`);
        
        // ¿Afecta al 7/10?
        if (res.checkIn < checkOut && res.checkOut > checkIn) {
          console.log('   🔴 SÍ afecta al 7/10/2025');
        } else {
          console.log('   🟢 NO afecta al 7/10/2025');
        }
      });
    }
    
    // 4. Habitaciones dobles disponibles físicamente
    const habitacionesDobles = await Room.find({ type: 'doble' });
    const disponibles = habitacionesDobles.filter(h => h.status === 'disponible');
    
    console.log('\n📊 RESUMEN HABITACIONES DOBLES:');
    console.log(`   Total: ${habitacionesDobles.length}`);
    console.log(`   Disponibles: ${disponibles.length}`);
    console.log(`   Ocupadas: ${habitacionesDobles.length - disponibles.length}`);
    
    disponibles.forEach(h => {
      console.log(`   ✅ #${h.number} disponible`);
    });
    
    habitacionesDobles.filter(h => h.status !== 'disponible').forEach(h => {
      console.log(`   🔴 #${h.number} ${h.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

diagnosticarHabitacion102();