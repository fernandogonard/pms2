// Debug: revisar TODAS las reservas y su relación con #102
const mongoose = require('mongoose');
const Room = require('./models/Room');
const Reservation = require('./models/Reservation');

async function debug() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pms');
    console.log('✅ Conectado a MongoDB\n');

    const room = await Room.findOne({ number: 102 });
    
    // Ver TODAS las reservas activas de hoy
    const today = new Date('2026-06-12');
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    const allReservations = await Reservation.find({
      status: { $ne: 'cancelada' },
      checkIn: { $lte: tomorrow },
      checkOut: { $gt: today }
    }).populate('room', 'number').lean();
    
    console.log('='.repeat(60));
    console.log('📋 TODAS LAS RESERVAS ACTIVAS PARA 12 JUNIO:');
    console.log('='.repeat(60));
    console.log(`Total: ${allReservations.length}\n`);
    
    allReservations.forEach((r, i) => {
      const roomNumbers = Array.isArray(r.room) 
        ? r.room.map(rm => rm.number).join(', ')
        : r.room?.number || '?';
      
      console.log(`${i+1}. ${r._id}`);
      console.log(`   Rooms: [${roomNumbers}]`);
      console.log(`   Guest: ${r.guestName || 'N/A'}`);
      console.log(`   Dates: ${new Date(r.checkIn).toISOString().split('T')[0]} → ${new Date(r.checkOut).toISOString().split('T')[0]}`);
      
      // Verificar si esta reserva incluye #102
      const includesRoom102 = Array.isArray(r.room) 
        ? r.room.some(rm => rm.number === 102)
        : r.room?.number === 102;
      
      if (includesRoom102) {
        console.log(`   ⚠️ INCLUYE HABITACIÓN #102`);
      }
      console.log('');
    });
    
    // Análisis final
    const reservasIncluyendo102 = allReservations.filter(r => {
      const roomNumbers = Array.isArray(r.room) 
        ? r.room.map(rm => rm.number)
        : [r.room?.number];
      return roomNumbers.includes(102);
    });
    
    console.log('='.repeat(60));
    console.log('📊 ANÁLISIS FINAL:');
    console.log('='.repeat(60));
    console.log(`Room #102 Status en BD: ${room.status}`);
    console.log(`Reservas que incluyen #102: ${reservasIncluyendo102.length}`);
    
    if (reservasIncluyendo102.length === 0 && room.status === 'disponible') {
      console.log('\n✅ CORRECTO: #102 está disponible y sin reservas');
    } else if (reservasIncluyendo102.length > 0 && room.status === 'ocupada') {
      console.log('\n✅ CORRECTO: #102 está ocupada con reservas');
    } else {
      console.log('\n🐛 INCONSISTENCIA DETECTADA!');
      console.log(`   Status: ${room.status}`);
      console.log(`   Reservas: ${reservasIncluyendo102.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
