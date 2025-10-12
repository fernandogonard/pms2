// Liberar habitación 104 que ya completó checkout
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

async function liberarHabitacion104() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm-hotelero');
    
    console.log('🔧 LIBERANDO HABITACIÓN #104\n');
    
    // 1. Buscar la reserva que termina el 8/10
    const reserva = await Reservation.findById('68e3c1a7420aea812a9f67c9');
    
    if (reserva) {
      console.log('📅 Reserva encontrada:');
      console.log(`   ID: ${reserva._id}`);
      console.log(`   Fechas: ${reserva.checkIn.toISOString().split('T')[0]} → ${reserva.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Estado actual: ${reserva.status}`);
      
      // 2. Procesar checkout (el 8/10 debe estar disponible para reservar)
      const today = new Date('2025-10-06'); // Fecha actual del sistema
      const checkoutDate = new Date(reserva.checkOut); // 2025-10-08
      
      console.log(`   Hoy: ${today.toISOString().split('T')[0]}`);
      console.log(`   Checkout: ${checkoutDate.toISOString().split('T')[0]}`);
      
      // Si checkout es en 2 días (8/10), liberar para que esté disponible
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      if (dayAfterTomorrow >= checkoutDate) {
        console.log('   ✅ Fecha de checkout llegó, liberando habitación...');
        
        // Marcar reserva como checkout
        reserva.status = 'checkout';
        await reserva.save();
        console.log('   ✅ Reserva marcada como checkout');
        
        // Liberar habitación #104
        const room104 = await Room.findOne({ number: 104 });
        if (room104) {
          room104.status = 'disponible';
          await room104.save();
          console.log('   ✅ Habitación #104 liberada');
        }
      } else {
        console.log('   ⚠️ La fecha de checkout aún no ha llegado');
      }
    }
    
    // 3. Verificar estado final
    const room104Final = await Room.findOne({ number: 104 });
    console.log(`\n🏨 Estado final de habitación #104: ${room104Final.status}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

liberarHabitacion104();