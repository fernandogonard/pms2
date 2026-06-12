// Debug script para buscar reserva de ana casin
const mongoose = require('mongoose');
const Reservation = require('./models/Reservation');
const Room = require('./models/Room');

async function debug() {
  try {
    // Conectar a MongoDB
    await mongoose.connect('mongodb://localhost:27017/pms');
    console.log('✅ Conectado a MongoDB\n');

    // Buscar reserva de ana casin para 12-13 junio
    const reservations = await Reservation.find({
      $or: [
        { 'user.name': /ana/i },
        { 'client.nombre': /ana/i }
      ],
      checkIn: { $gte: new Date('2026-06-11'), $lte: new Date('2026-06-13') }
    }).populate('user', 'name').populate('client', 'nombre').populate('room', 'number');

    console.log(`📋 Encontradas ${reservations.length} reservas:\n`);
    
    reservations.forEach(r => {
      console.log('─'.repeat(60));
      console.log(`Reserva ID: ${r._id}`);
      console.log(`Huésped: ${r.user?.name || r.client?.nombre}`);
      console.log(`Rooms: ${Array.isArray(r.room) ? r.room.map(rm => rm.number).join(', ') : r.room?.number}`);
      console.log(`Check-in: ${new Date(r.checkIn).toISOString().split('T')[0]}`);
      console.log(`Check-out: ${new Date(r.checkOut).toISOString().split('T')[0]}`);
      console.log(`Status: ${r.status}`);
    });

    // Ahora revisar estado de habitación 102
    console.log('\n' + '═'.repeat(60));
    console.log('🔍 Estado de Habitación #102:\n');
    
    const room102 = await Room.findOne({ number: 102 });
    if (room102) {
      console.log(`Room ID: ${room102._id}`);
      console.log(`Status: ${room102.status}`);
      console.log(`Checkout Today: ${room102.checkoutToday}`);
      console.log(`Housekeeping Status: ${room102.housekeepingAssignment?.status}`);
    }

    // Ver todas las reservas para hoy que incluyan #102
    console.log('\n' + '═'.repeat(60));
    console.log('🏠 Todas las reservas para 12 junio:\n');
    
    const allReservations = await Reservation.find({
      checkIn: { $lte: new Date('2026-06-13') },
      checkOut: { $gt: new Date('2026-06-12') },
      status: { $ne: 'cancelada' }
    }).populate('user', 'name').populate('client', 'nombre').populate('room', 'number');

    allReservations.forEach(r => {
      console.log(`${r.user?.name || r.client?.nombre}: Rooms [${Array.isArray(r.room) ? r.room.map(rm => rm.number).join(', ') : r.room?.number}]`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
