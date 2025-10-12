// Script para agregar habitaciones faltantes en pisos 2, 3 y 4
// Para el CRM hotelero

const mongoose = require('mongoose');
const Room = require('../models/Room');

// Configuración de la base de datos
const DB_URL = 'mongodb://localhost:27017/hotelcrm';

// Definir las habitaciones que necesitamos agregar
const roomsToAdd = [
  // Piso 2 - Habitaciones 201-210
  { number: 201, floor: 2, type: 'doble', price: 150 },
  { number: 202, floor: 2, type: 'doble', price: 150 },
  { number: 203, floor: 2, type: 'triple', price: 200 },
  { number: 204, floor: 2, type: 'triple', price: 200 },
  { number: 205, floor: 2, type: 'cuadruple', price: 250 },
  { number: 206, floor: 2, type: 'doble', price: 150 },
  { number: 207, floor: 2, type: 'doble', price: 150 },
  { number: 208, floor: 2, type: 'triple', price: 200 },
  { number: 209, floor: 2, type: 'triple', price: 200 },
  { number: 210, floor: 2, type: 'cuadruple', price: 250 },

  // Piso 3 - Habitaciones 301-310
  { number: 301, floor: 3, type: 'doble', price: 150 },
  { number: 302, floor: 3, type: 'doble', price: 150 },
  { number: 303, floor: 3, type: 'triple', price: 200 },
  { number: 304, floor: 3, type: 'triple', price: 200 },
  { number: 305, floor: 3, type: 'cuadruple', price: 250 },
  { number: 306, floor: 3, type: 'doble', price: 150 },
  { number: 307, floor: 3, type: 'doble', price: 150 },
  { number: 308, floor: 3, type: 'triple', price: 200 },
  { number: 309, floor: 3, type: 'triple', price: 200 },
  { number: 310, floor: 3, type: 'cuadruple', price: 250 },

  // Piso 4 - Habitaciones 401-410
  { number: 401, floor: 4, type: 'doble', price: 150 },
  { number: 402, floor: 4, type: 'doble', price: 150 },
  { number: 403, floor: 4, type: 'triple', price: 200 },
  { number: 404, floor: 4, type: 'triple', price: 200 },
  { number: 405, floor: 4, type: 'cuadruple', price: 250 },
  { number: 406, floor: 4, type: 'doble', price: 150 },
  { number: 407, floor: 4, type: 'doble', price: 150 },
  { number: 408, floor: 4, type: 'triple', price: 200 },
  { number: 409, floor: 4, type: 'triple', price: 200 },
  { number: 410, floor: 4, type: 'cuadruple', price: 250 }
];

async function addMissingRooms() {
  try {
    console.log('🏨 Conectando a la base de datos...');
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📋 Verificando habitaciones existentes...');
    const existingRooms = await Room.find().sort({ number: 1 });
    console.log(`📊 Total de habitaciones existentes: ${existingRooms.length}`);

    // Mostrar habitaciones existentes por piso
    const roomsByFloor = {};
    existingRooms.forEach(room => {
      if (!roomsByFloor[room.floor]) {
        roomsByFloor[room.floor] = [];
      }
      roomsByFloor[room.floor].push(room);
    });

    console.log('\n🏢 Habitaciones por piso:');
    Object.keys(roomsByFloor).sort().forEach(floor => {
      const floorRooms = roomsByFloor[floor];
      const typeCount = floorRooms.reduce((acc, room) => {
        acc[room.type] = (acc[room.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Piso ${floor}: ${floorRooms.length} habitaciones (${Object.entries(typeCount).map(([type, count]) => `${count} ${type}`).join(', ')})`);
    });

    console.log('\n🔍 Identificando habitaciones a agregar...');
    const existingNumbers = new Set(existingRooms.map(room => room.number));
    const roomsToCreate = roomsToAdd.filter(room => !existingNumbers.has(room.number));

    console.log(`📝 Habitaciones a crear: ${roomsToCreate.length}`);

    if (roomsToCreate.length === 0) {
      console.log('✨ Todas las habitaciones ya existen. No hay nada que agregar.');
      await mongoose.disconnect();
      return;
    }

    // Mostrar resumen de lo que se va a crear
    const newRoomsByFloor = {};
    roomsToCreate.forEach(room => {
      if (!newRoomsByFloor[room.floor]) {
        newRoomsByFloor[room.floor] = [];
      }
      newRoomsByFloor[room.floor].push(room);
    });

    console.log('\n🆕 Nuevas habitaciones por piso:');
    Object.keys(newRoomsByFloor).sort().forEach(floor => {
      const floorRooms = newRoomsByFloor[floor];
      const typeCount = floorRooms.reduce((acc, room) => {
        acc[room.type] = (acc[room.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Piso ${floor}: ${floorRooms.length} habitaciones (${Object.entries(typeCount).map(([type, count]) => `${count} ${type}`).join(', ')})`);
    });

    console.log('\n⏳ Creando habitaciones...');
    let createdCount = 0;
    
    for (const roomData of roomsToCreate) {
      try {
        const room = new Room(roomData);
        await room.save();
        createdCount++;
        console.log(`✅ Habitación ${roomData.number} (Piso ${roomData.floor}, ${roomData.type}) creada exitosamente`);
      } catch (error) {
        console.error(`❌ Error creando habitación ${roomData.number}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Proceso completado!`);
    console.log(`✅ ${createdCount} habitaciones creadas exitosamente`);

    // Mostrar estadísticas finales
    const finalRooms = await Room.find().sort({ number: 1 });
    const finalRoomsByFloor = {};
    finalRooms.forEach(room => {
      if (!finalRoomsByFloor[room.floor]) {
        finalRoomsByFloor[room.floor] = [];
      }
      finalRoomsByFloor[room.floor].push(room);
    });

    console.log('\n📊 Estadísticas finales:');
    console.log(`   Total de habitaciones: ${finalRooms.length}`);
    Object.keys(finalRoomsByFloor).sort().forEach(floor => {
      const floorRooms = finalRoomsByFloor[floor];
      const typeCount = floorRooms.reduce((acc, room) => {
        acc[room.type] = (acc[room.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Piso ${floor}: ${floorRooms.length} habitaciones (${Object.entries(typeCount).map(([type, count]) => `${count} ${type}`).join(', ')})`);
    });

    // Calcular totales por tipo
    const totalByType = finalRooms.reduce((acc, room) => {
      acc[room.type] = (acc[room.type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n🏷️ Total por tipo de habitación:');
    Object.entries(totalByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} habitaciones`);
    });

  } catch (error) {
    console.error('❌ Error en el proceso:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar el script
if (require.main === module) {
  console.log('🚀 Iniciando script para agregar habitaciones faltantes...\n');
  addMissingRooms();
}

module.exports = { addMissingRooms, roomsToAdd };