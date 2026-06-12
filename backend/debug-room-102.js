// Debug script para ver datos exactos de #102
const mongoose = require('mongoose');
const Room = require('./models/Room');

async function debug() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pms');
    console.log('✅ Conectado a MongoDB\n');

    const room = await Room.findOne({ number: 102 });
    console.log('📍 Habitación #102:');
    console.log('='.repeat(60));
    console.log(`Status: ${room.status}`);
    console.log(`CheckoutToday: ${room.checkoutToday}`);
    console.log(`CheckoutInfo:`, room.checkoutInfo);
    console.log(`\nFull Room Object (filtered):`, {
      _id: room._id,
      number: room.number,
      status: room.status,
      checkoutToday: room.checkoutToday,
      checkoutInfo: room.checkoutInfo,
      housekeepingAssignment: room.housekeepingAssignment
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
