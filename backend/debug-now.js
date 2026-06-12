// Debug en tiempo real - ver qué retorna la API
const mongoose = require('mongoose');
const Room = require('./models/Room');
const Reservation = require('./models/Reservation');

async function debug() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pms');
    console.log('✅ Conectado a MongoDB\n');

    // Ver Room #102 directamente de la BD
    const room = await Room.findOne({ number: 102 });
    console.log('='.repeat(60));
    console.log('🔍 ROOM #102 - BD ACTUAL:');
    console.log('='.repeat(60));
    console.log(`Status: ${room.status}`);
    console.log(`CheckoutToday: ${room.checkoutToday}`);
    console.log(`CheckoutInfo:`, room.checkoutInfo);
    console.log(`HousekeepingAssignment:`, room.housekeepingAssignment);
    
    // Ver si hay reserva asignada a #102
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESERVAS ACTIVAS PARA HOY (12 junio):');
    console.log('='.repeat(60));
    
    const today = new Date('2026-06-12');
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    const reservations = await Reservation.find({
      $or: [
        { room: room._id },
        { room: { $in: [room._id] } }
      ],
      status: { $ne: 'cancelada' },
      checkIn: { $lte: tomorrow },
      checkOut: { $gt: today }
    }).lean();
    
    console.log(`Encontradas ${reservations.length} reservas para #102`);
    reservations.forEach((r, i) => {
      console.log(`\n${i+1}. Reserva ${r._id}:`);
      console.log(`   - Huésped: ${r.guestName || 'N/A'}`);
      console.log(`   - CheckIn: ${new Date(r.checkIn).toISOString().split('T')[0]}`);
      console.log(`   - CheckOut: ${new Date(r.checkOut).toISOString().split('T')[0]}`);
      console.log(`   - Status: ${r.status}`);
    });
    
    // Si no hay reserva pero status es 'ocupada', eso es el BUG
    if (reservations.length === 0 && room.status === 'ocupada') {
      console.log('\n' + '⚠️ '.repeat(30));
      console.log('🐛 BUG ENCONTRADO:');
      console.log('   - Room status es "ocupada" pero NO hay reserva asignada');
      console.log('   - Debe ser actualizado a "disponible"');
      console.log('⚠️ '.repeat(30));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
