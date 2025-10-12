// debug/init-data.js
// Script para inicializar datos básicos del hotel

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
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

async function createRooms() {
  console.log('\n🏠 CREANDO HABITACIONES DE EJEMPLO:');
  console.log('='.repeat(60));
  
  const rooms = [
    // Habitaciones dobles
    { number: 101, floor: 1, type: 'doble', price: 150, status: 'disponible' },
    { number: 102, floor: 1, type: 'doble', price: 150, status: 'disponible' },
    { number: 103, floor: 1, type: 'doble', price: 150, status: 'disponible' },
    { number: 201, floor: 2, type: 'doble', price: 160, status: 'disponible' },
    { number: 202, floor: 2, type: 'doble', price: 160, status: 'disponible' },
    
    // Habitaciones triples
    { number: 104, floor: 1, type: 'triple', price: 200, status: 'disponible' },
    { number: 105, floor: 1, type: 'triple', price: 200, status: 'disponible' },
    { number: 203, floor: 2, type: 'triple', price: 210, status: 'disponible' },
    
    // Habitaciones cuádruples
    { number: 106, floor: 1, type: 'cuadruple', price: 250, status: 'disponible' },
    { number: 204, floor: 2, type: 'cuadruple', price: 260, status: 'disponible' },
    
    // Una habitación en mantenimiento para probar
    { number: 107, floor: 1, type: 'doble', price: 150, status: 'mantenimiento' }
  ];
  
  for (const roomData of rooms) {
    try {
      const existing = await Room.findOne({ number: roomData.number });
      if (existing) {
        console.log(`   ⚠️ Habitación ${roomData.number} ya existe - omitiendo`);
        continue;
      }
      
      const room = await Room.create(roomData);
      console.log(`   ✅ Creada habitación ${room.number} (${room.type}) - $${room.price}`);
    } catch (error) {
      console.error(`   ❌ Error creando habitación ${roomData.number}:`, error.message);
    }
  }
}

async function createClients() {
  console.log('\n👥 CREANDO CLIENTES DE EJEMPLO:');
  console.log('='.repeat(60));
  
  const clients = [
    {
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '12345678',
      email: 'juan@example.com',
      whatsapp: '+1234567890'
    },
    {
      nombre: 'María',
      apellido: 'García',
      dni: '87654321',
      email: 'maria@example.com',
      whatsapp: '+0987654321'
    },
    {
      nombre: 'Carlos',
      apellido: 'López',
      dni: '11223344',
      email: 'carlos@example.com',
      whatsapp: '+1122334455'
    }
  ];
  
  for (const clientData of clients) {
    try {
      const existing = await Client.findOne({ 
        $or: [{ dni: clientData.dni }, { email: clientData.email }] 
      });
      if (existing) {
        console.log(`   ⚠️ Cliente ${clientData.nombre} ${clientData.apellido} ya existe - omitiendo`);
        continue;
      }
      
      const client = await Client.create(clientData);
      console.log(`   ✅ Creado cliente ${client.nombre} ${client.apellido} (${client.email})`);
    } catch (error) {
      console.error(`   ❌ Error creando cliente ${clientData.nombre}:`, error.message);
    }
  }
}

async function createReservations() {
  console.log('\n📅 CREANDO RESERVAS DE EJEMPLO:');
  console.log('='.repeat(60));
  
  const clients = await Client.find();
  const rooms = await Room.find({ status: 'disponible' });
  
  if (clients.length === 0) {
    console.log('   ⚠️ No hay clientes - creando clientes primero');
    await createClients();
    return await createReservations();
  }
  
  if (rooms.length === 0) {
    console.log('   ⚠️ No hay habitaciones disponibles');
    return;
  }
  
  const reservations = [
    {
      tipo: 'doble',
      cantidad: 1,
      checkIn: '2025-10-09',
      checkOut: '2025-10-12',
      client: clients[0]._id,
      status: 'reservada'
    },
    {
      tipo: 'triple',
      cantidad: 1,
      checkIn: '2025-10-10',
      checkOut: '2025-10-13',
      client: clients[1]._id,
      status: 'reservada'
    },
    {
      tipo: 'doble',
      cantidad: 2,
      checkIn: '2025-10-11',
      checkOut: '2025-10-14',
      client: clients[2]._id,
      status: 'reservada'
    }
  ];
  
  for (const reservationData of reservations) {
    try {
      const reservation = await Reservation.create(reservationData);
      console.log(`   ✅ Creada reserva ${reservation._id}`);
      console.log(`      Cliente: ${clients.find(c => c._id.toString() === reservation.client.toString()).nombre}`);
      console.log(`      Tipo: ${reservation.tipo} x${reservation.cantidad}`);
      console.log(`      Fechas: ${reservation.checkIn} - ${reservation.checkOut}`);
    } catch (error) {
      console.error(`   ❌ Error creando reserva:`, error.message);
    }
  }
}

async function showStatus() {
  console.log('\n📊 ESTADO ACTUAL DEL SISTEMA:');
  console.log('='.repeat(60));
  
  const roomCount = await Room.countDocuments();
  const clientCount = await Client.countDocuments();
  const reservationCount = await Reservation.countDocuments();
  
  console.log(`   🏠 Habitaciones: ${roomCount}`);
  console.log(`   👥 Clientes: ${clientCount}`);
  console.log(`   📅 Reservas: ${reservationCount}`);
  
  if (roomCount > 0) {
    const byType = await Room.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n   📋 Habitaciones por tipo:');
    byType.forEach(type => {
      console.log(`      ${type._id}: ${type.count}`);
    });
  }
  
  if (reservationCount > 0) {
    const virtualReservations = await Reservation.countDocuments({ 
      $or: [{ room: { $exists: false } }, { room: { $size: 0 } }] 
    });
    const realReservations = reservationCount - virtualReservations;
    
    console.log('\n   📊 Tipos de reservas:');
    console.log(`      Virtuales: ${virtualReservations}`);
    console.log(`      Con habitación asignada: ${realReservations}`);
  }
}

async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'rooms':
        await createRooms();
        break;
        
      case 'clients':
        await createClients();
        break;
        
      case 'reservations':
        await createReservations();
        break;
        
      case 'all':
        await createRooms();
        await createClients();
        await createReservations();
        await showStatus();
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'clean':
        console.log('🧹 LIMPIANDO BASE DE DATOS:');
        await Reservation.deleteMany({});
        await Client.deleteMany({});
        await Room.deleteMany({});
        console.log('   ✅ Base de datos limpia');
        break;
        
      default:
        console.log('🔧 COMANDOS DISPONIBLES:');
        console.log('   node init-data.js rooms        - Crear habitaciones');
        console.log('   node init-data.js clients      - Crear clientes');
        console.log('   node init-data.js reservations - Crear reservas');
        console.log('   node init-data.js all          - Crear todo');
        console.log('   node init-data.js status       - Ver estado');
        console.log('   node init-data.js clean        - Limpiar BD');
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