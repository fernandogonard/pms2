// Script para consultar el inventario actual de habitaciones
const mongoose = require('mongoose');
const Room = require('../models/Room');

async function checkRoomInventory() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hotelcrm');
    console.log('=== INVENTARIO COMPLETO DE HABITACIONES ===\n');
    
    const rooms = await Room.find().sort({number: 1});
    console.log(`Total de habitaciones: ${rooms.length}\n`);
    
    // Agrupar por tipo
    const byType = {};
    rooms.forEach(room => {
      if (!byType[room.type]) byType[room.type] = [];
      byType[room.type].push(room);
    });
    
    Object.keys(byType).forEach(type => {
      console.log(`${type.toUpperCase()}: ${byType[type].length} habitaciones`);
      byType[type].forEach(room => {
        console.log(`  - Habitacion ${room.number} (Piso ${room.floor}) - Estado: ${room.status}`);
      });
      console.log('');
    });
    
    // Verificar disponibilidad específica
    const availableRooms = await Room.find({ status: 'disponible' });
    console.log('=== HABITACIONES DISPONIBLES ===');
    const availableByType = {};
    availableRooms.forEach(room => {
      if (!availableByType[room.type]) availableByType[room.type] = 0;
      availableByType[room.type]++;
    });
    
    Object.keys(availableByType).forEach(type => {
      console.log(`${type}: ${availableByType[type]} disponibles`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRoomInventory();