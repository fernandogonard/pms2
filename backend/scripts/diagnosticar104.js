// Diagnóstico específico de habitación 104
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

async function diagnosticarHabitacion104() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm-hotelero');
    
    console.log('🔍 DIAGNÓSTICO: Habitación #104 para 8/10/2025\n');
    
    const targetDate = '2025-10-08';
    const checkIn = new Date(targetDate + 'T00:00:00.000Z');  
    const checkOut = new Date('2025-10-09T00:00:00.000Z');
    
    // 1. Estado de habitación 104
    const room104 = await Room.findOne({ number: 104 });
    console.log('🏨 HABITACIÓN #104:');
    console.log('   Número:', room104?.number);
    console.log('   Tipo:', room104?.type);
    console.log('   Estado:', room104?.status);
    console.log('   ID:', room104?._id);
    
    // 2. Buscar reservas que incluyen habitación 104
    const reservas104 = await Reservation.find({
      room: room104._id
    }).populate('room');
    
    console.log('\n📅 TODAS LAS RESERVAS QUE INCLUYEN #104:');
    if (reservas104.length === 0) {
      console.log('   ❌ NO HAY RESERVAS para habitación #104');
    } else {
      reservas104.forEach(res => {
        console.log(`   Reserva ${res._id}`);
        console.log(`   Fechas: ${res.checkIn.toISOString().split('T')[0]} → ${res.checkOut.toISOString().split('T')[0]}`);
        console.log(`   Estado: ${res.status}`);
        console.log(`   Tipo: ${res.tipo}`);
        
        // ¿Afecta al 8/10?
        if (res.checkIn < checkOut && res.checkOut > checkIn) {
          console.log('   🔴 SÍ afecta al 8/10/2025');
        } else {
          console.log('   🟢 NO afecta al 8/10/2025');
        }
        console.log('');
      });
    }
    
    // 3. Buscar reservas activas que podrían estar bloqueando
    const reservasActivas = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn }
    }).populate('room');
    
    console.log('🎯 RESERVAS ACTIVAS PARA 8/10/2025:');
    const conflictos = reservasActivas.filter(r => 
      r.room?.some(room => room.number === 104)
    );
    
    if (conflictos.length === 0) {
      console.log('   ✅ NO HAY CONFLICTOS para habitación #104 el 8/10');
      if (room104.status === 'ocupada') {
        console.log('   🚨 PROBLEMA: Habitación marcada ocupada sin reserva activa');
      }
    } else {
      console.log('   🔴 CONFLICTOS ENCONTRADOS:');
      conflictos.forEach(res => {
        console.log(`   Reserva: ${res._id}`);
        console.log(`   Fechas: ${res.checkIn.toISOString().split('T')[0]} → ${res.checkOut.toISOString().split('T')[0]}`);
        console.log(`   Estado: ${res.status}`);
      });
    }
    
    // 4. Verificar disponibilidad real usando la API
    console.log('\n🔍 DISPONIBILIDAD ACTUAL SEGÚN EL SISTEMA:');
    
    // Simular consulta de disponibilidad
    const allDobleRooms = await Room.find({ type: 'doble' });
    const ocupadasPorReservas = reservasActivas.filter(r => 
      r.tipo === 'doble' &&
      r.checkIn < checkOut &&
      r.checkOut > checkIn
    );
    
    let habitacionesOcupadas = 0;
    ocupadasPorReservas.forEach(res => {
      if (res.room && res.room.length > 0) {
        habitacionesOcupadas += res.room.length;
      } else {
        habitacionesOcupadas += res.cantidad || 1;
      }
    });
    
    const disponibles = allDobleRooms.filter(r => r.status === 'disponible').length;
    const realmenteDisponibles = Math.max(0, disponibles - habitacionesOcupadas);
    
    console.log(`   Total habitaciones dobles: ${allDobleRooms.length}`);
    console.log(`   Físicamente disponibles: ${disponibles}`);
    console.log(`   Ocupadas por reservas: ${habitacionesOcupadas}`);
    console.log(`   REALMENTE DISPONIBLES: ${realmenteDisponibles}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

diagnosticarHabitacion104();