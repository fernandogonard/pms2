// Liberar habitación 102 que ya terminó su reserva
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

async function liberarHabitacion102() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm-hotelero');
    
    console.log('🔧 LIBERANDO HABITACIÓN #102\n');
    
    // 1. Buscar la reserva que termina el 7/10
    const reserva = await Reservation.findById('68e127e9200d851912e635a7');
    
    if (reserva) {
      console.log('📅 Reserva encontrada:');
      console.log(`   ID: ${reserva._id}`);
      console.log(`   Fechas: ${reserva.checkIn.toISOString().split('T')[0]} → ${reserva.checkOut.toISOString().split('T')[0]}`);
      console.log(`   Estado actual: ${reserva.status}`);
      
      // 2. Procesar checkout (el 7/10 debe estar disponible para reservar)
      const today = new Date('2025-10-06'); // Fecha actual del sistema
      const checkoutDate = new Date(reserva.checkOut);
      
      console.log(`   Hoy: ${today.toISOString().split('T')[0]}`);
      console.log(`   Checkout: ${checkoutDate.toISOString().split('T')[0]}`);
      
      // Si checkout es mañana (7/10), liberar hoy para que esté disponible
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (tomorrow >= checkoutDate) {
        console.log('   ✅ Fecha de checkout ya pasó, procesando...');
        
        // Marcar reserva como checkout
        reserva.status = 'checkout';
        await reserva.save();
        console.log('   ✅ Reserva marcada como checkout');
        
        // Liberar habitación #102
        const room102 = await Room.findOne({ number: 102 });
        if (room102) {
          room102.status = 'disponible';
          await room102.save();
          console.log('   ✅ Habitación #102 liberada');
        }
      } else {
        console.log('   ⚠️ La fecha de checkout aún no ha llegado');
      }
    }
    
    // 3. Verificar estado final
    const room102Final = await Room.findOne({ number: 102 });
    console.log(`\n🏨 Estado final de habitación #102: ${room102Final.status}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

liberarHabitacion102();