// Fix: Forzar actualización de #102 a disponible y limpiar estado
const mongoose = require('mongoose');
const Room = require('./models/Room');

async function fix() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pms');
    console.log('✅ Conectado a MongoDB\n');

    const room = await Room.findOne({ number: 102 });
    
    console.log('='.repeat(60));
    console.log('🔧 FIX: Actualizar #102 a estado consistente');
    console.log('='.repeat(60));
    console.log(`Status ANTES: ${room.status}`);
    console.log(`CheckoutToday ANTES: ${room.checkoutToday}`);
    
    // Actualizar explícitamente
    const updated = await Room.findByIdAndUpdate(
      room._id,
      {
        status: 'disponible',
        checkoutToday: false,
        checkoutInfo: {},
        housekeepingAssignment: {
          assignedTo: null,
          assignedAt: null,
          estimatedDurationMinutes: null,
          startTime: null,
          endTime: null,
          status: 'no_asignada',
          notes: ''
        }
      },
      { new: true }
    );
    
    console.log(`\nStatus DESPUÉS: ${updated.status}`);
    console.log(`CheckoutToday DESPUÉS: ${updated.checkoutToday}`);
    console.log('\n✅ Room #102 actualizada correctamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fix();
