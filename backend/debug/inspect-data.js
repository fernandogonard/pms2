// debug/inspect-data.js
// Script para inspeccionar todos los datos del sistema

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-crm');
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function showAllReservations() {
  console.log('\n📋 TODAS LAS RESERVAS:');
  console.log('='.repeat(60));
  
  const reservations = await Reservation.find().populate('room client').sort({ checkIn: 1 });
  
  if (reservations.length === 0) {
    console.log('No hay reservas en el sistema');
    return;
  }
  
  reservations.forEach((res, index) => {
    console.log(`\n${index + 1}. RESERVA ${res._id}`);
    console.log(`   Tipo: ${res.tipo}`);
    console.log(`   Cantidad: ${res.cantidad || 1}`);
    console.log(`   Check-in: ${res.checkIn}`);
    console.log(`   Check-out: ${res.checkOut}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Cliente: ${res.client ? `${res.client.nombre} ${res.client.apellido}` : 'Sin cliente'}`);
    
    if (res.room && res.room.length > 0) {
      console.log(`   🏠 Habitaciones asignadas (${res.room.length}):`);
      res.room.forEach(room => {
        console.log(`     - ${room.number} (${room.type}) - Estado: ${room.status}`);
      });
    } else {
      console.log('   🟡 RESERVA VIRTUAL (sin habitaciones asignadas)');
    }
  });
}

async function showAllRooms() {
  console.log('\n🏠 TODAS LAS HABITACIONES:');
  console.log('='.repeat(60));
  
  const rooms = await Room.find().sort({ number: 1 });
  
  const byType = {};
  rooms.forEach(room => {
    if (!byType[room.type]) byType[room.type] = [];
    byType[room.type].push(room);
  });
  
  Object.keys(byType).forEach(type => {
    console.log(`\n📋 ${type.toUpperCase()} (${byType[type].length} habitaciones):`);
    byType[type].forEach(room => {
      console.log(`   ${room.number} - ${room.status} - $${room.price}`);
    });
  });
}

async function testRoomStatus() {
  console.log('\n🔍 SIMULANDO getRoomsStatus():');
  console.log('='.repeat(60));
  
  try {
    // Simular la petición HTTP
    const response = await fetch('http://127.0.0.1:5000/api/rooms/status');
    const data = await response.json();
    
    console.log(`✅ Respuesta recibida: ${data.rooms ? data.rooms.length : 0} habitaciones`);
    
    if (data.overbooked && Object.keys(data.overbooked).length > 0) {
      console.log('\n⚠️ SOBREVENTAS DETECTADAS:');
      Object.keys(data.overbooked).forEach(tipo => {
        console.log(`   ${tipo}:`);
        Object.keys(data.overbooked[tipo]).forEach(fecha => {
          console.log(`     ${fecha}: +${data.overbooked[tipo][fecha]} habitaciones`);
        });
      });
    }
    
    if (data.summary) {
      console.log('\n📊 RESUMEN:');
      console.log(`   Reservas reales: ${data.summary.realReservations}`);
      console.log(`   Reservas virtuales:`, JSON.stringify(data.summary.virtualReservations, null, 2));
    }
    
    // Mostrar habitaciones con problemas
    const problematicRooms = data.rooms?.filter(room => {
      return Object.values(room.calendar || {}).some(status => 
        status === 'ocupada' || status === 'ocupada_virtual'
      );
    });
    
    if (problematicRooms && problematicRooms.length > 0) {
      console.log('\n🚨 HABITACIONES CON OCUPACIÓN:');
      problematicRooms.forEach(room => {
        console.log(`\n   ${room.number} (${room.type}):`);
        Object.keys(room.calendar).forEach(date => {
          if (room.calendar[date] !== 'disponible') {
            console.log(`     ${date}: ${room.calendar[date]}`);
          }
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error consultando API:', error.message);
  }
}

async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'reservations':
        await showAllReservations();
        break;
        
      case 'rooms':
        await showAllRooms();
        break;
        
      case 'status':
        await testRoomStatus();
        break;
        
      case 'all':
        await showAllReservations();
        await showAllRooms();
        await testRoomStatus();
        break;
        
      default:
        console.log('🔧 COMANDOS DISPONIBLES:');
        console.log('   node inspect-data.js reservations  - Ver todas las reservas');
        console.log('   node inspect-data.js rooms         - Ver todas las habitaciones');
        console.log('   node inspect-data.js status        - Probar API getRoomsStatus');
        console.log('   node inspect-data.js all           - Mostrar todo');
        break;
    }
  } catch (error) {
    console.error('❌ Error ejecutando comando:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  }
}

main();