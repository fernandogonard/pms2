// scripts/debug-room107.js
// Script para diagnosticar el estado de la habitación 107

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');

const debugRoom107 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero');
    console.log('✅ Conectado a MongoDB');

    // Buscar habitación 107
    const room107 = await Room.findOne({ number: 107 });
    
    if (!room107) {
      console.log('❌ La habitación 107 NO EXISTE en la base de datos');
      
      // Mostrar todas las habitaciones existentes
      const allRooms = await Room.find().sort({ number: 1 });
      console.log('\n📋 Habitaciones existentes:');
      allRooms.forEach(room => {
        console.log(`   #${room.number} - ${room.type} - Estado: ${room.status}`);
      });
      
      // Crear habitación 107 para testing
      console.log('\n🔧 Creando habitación 107 para testing...');
      const newRoom = new Room({
        number: 107,
        floor: 1,
        type: 'doble',
        price: 150,
        status: 'limpieza'
      });
      await newRoom.save();
      console.log('✅ Habitación 107 creada con estado: limpieza');
      
    } else {
      console.log('✅ Habitación 107 encontrada:');
      console.log(`   Número: ${room107.number}`);
      console.log(`   Piso: ${room107.floor}`);
      console.log(`   Tipo: ${room107.type}`);
      console.log(`   Precio: $${room107.price}`);
      console.log(`   Estado: ${room107.status}`);
      console.log(`   ID: ${room107._id}`);
      
      if (room107.status !== 'limpieza') {
        console.log(`\n🔧 Cambiando estado a 'limpieza'...`);
        room107.status = 'limpieza';
        await room107.save();
        console.log('✅ Estado actualizado a limpieza');
      } else {
        console.log('✅ La habitación ya está en estado limpieza');
      }
    }

    // Verificar el endpoint de status
    console.log('\n🔍 Probando endpoint de status...');
    const startDate = new Date().toISOString().slice(0, 10);
    
    // Simular la llamada al controller
    const rooms = await Room.find().sort({ number: 1 }).lean();
    const room107Data = rooms.find(r => r.number === 107);
    
    if (room107Data) {
      console.log('✅ Datos de habitación 107 en endpoint:');
      console.log(`   Estado: ${room107Data.status}`);
      console.log(`   Debería aparecer en cyan (limpieza) en el calendario`);
    } else {
      console.log('❌ Habitación 107 no encontrada en el endpoint');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Desconectado de MongoDB');
  }
};

// Ejecutar diagnóstico
debugRoom107();