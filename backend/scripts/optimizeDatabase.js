// scripts/optimizeDatabase.js
// Script para optimizar la base de datos del CRM hotelero

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Client = require('../models/Client');

const DB_URL = 'mongodb://localhost:27017/crm-hotelero';

async function optimizeDatabase() {
  try {
    console.log('🔧 Conectando a la base de datos...');
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📊 Optimizando base de datos del CRM hotelero...\n');

    // === ÍNDICES PARA ROOMS ===
    console.log('🏨 Optimizando colección Rooms...');
    
    // Índice compuesto para consultas de disponibilidad
    await Room.collection.createIndex(
      { type: 1, status: 1 },
      { name: 'idx_room_type_status' }
    );
    console.log('✅ Índice creado: room type + status');

    // Índice para consultas por piso
    await Room.collection.createIndex(
      { floor: 1, number: 1 },
      { name: 'idx_room_floor_number' }
    );
    console.log('✅ Índice creado: room floor + number');

    // Índice para búsquedas por precio
    await Room.collection.createIndex(
      { type: 1, price: 1 },
      { name: 'idx_room_type_price' }
    );
    console.log('✅ Índice creado: room type + price');

    // === ÍNDICES PARA RESERVATIONS ===
    console.log('\n📅 Optimizando colección Reservations...');
    
    // Índice compuesto para consultas de solapamiento de fechas
    await Reservation.collection.createIndex(
      { checkIn: 1, checkOut: 1, status: 1 },
      { name: 'idx_reservation_dates_status' }
    );
    console.log('✅ Índice creado: reservation dates + status');

    // Índice para consultas por estado y tipo
    await Reservation.collection.createIndex(
      { status: 1, tipo: 1 },
      { name: 'idx_reservation_status_type' }
    );
    console.log('✅ Índice creado: reservation status + tipo');

    // Índice para consultas por usuario
    await Reservation.collection.createIndex(
      { user: 1, status: 1 },
      { name: 'idx_reservation_user_status' }
    );
    console.log('✅ Índice creado: reservation user + status');

    // Índice para consultas por cliente
    await Reservation.collection.createIndex(
      { client: 1, checkIn: 1 },
      { name: 'idx_reservation_client_checkin' }
    );
    console.log('✅ Índice creado: reservation client + checkIn');

    // Índice para consultas por habitación asignada
    await Reservation.collection.createIndex(
      { room: 1, status: 1 },
      { name: 'idx_reservation_room_status' }
    );
    console.log('✅ Índice creado: reservation room + status');

    // Índice para consultas por fecha de creación
    await Reservation.collection.createIndex(
      { createdAt: 1 },
      { name: 'idx_reservation_created_at' }
    );
    console.log('✅ Índice creado: reservation createdAt');

    // === ÍNDICES PARA USERS ===
    console.log('\n👤 Optimizando colección Users...');
    
    // Índice para login (email único ya existe por defecto)
    await User.collection.createIndex(
      { email: 1, role: 1 },
      { name: 'idx_user_email_role' }
    );
    console.log('✅ Índice creado: user email + role');

    // Índice para consultas por rol
    await User.collection.createIndex(
      { role: 1, createdAt: 1 },
      { name: 'idx_user_role_created' }
    );
    console.log('✅ Índice creado: user role + createdAt');

    // === ÍNDICES PARA CLIENTS ===
    console.log('\n👥 Optimizando colección Clients...');
    
    // Índice para búsquedas por nombre
    await Client.collection.createIndex(
      { nombre: 1, apellido: 1 },
      { name: 'idx_client_name' }
    );
    console.log('✅ Índice creado: client nombre + apellido');

    // Índice para búsquedas por email
    await Client.collection.createIndex(
      { email: 1 },
      { name: 'idx_client_email' }
    );
    console.log('✅ Índice creado: client email');

    // Índice para búsquedas por teléfono
    await Client.collection.createIndex(
      { telefono: 1 },
      { name: 'idx_client_phone' }
    );
    console.log('✅ Índice creado: client telefono');

    // === ESTADÍSTICAS DE LA BASE DE DATOS ===
    console.log('\n📈 Generando estadísticas de la base de datos...\n');

    const stats = {
      rooms: await Room.countDocuments(),
      reservations: await Reservation.countDocuments(),
      users: await User.countDocuments(),
      clients: await Client.countDocuments()
    };

    console.log('📊 Estadísticas actuales:');
    console.log(`   Habitaciones: ${stats.rooms}`);
    console.log(`   Reservaciones: ${stats.reservations}`);
    console.log(`   Usuarios: ${stats.users}`);
    console.log(`   Clientes: ${stats.clients}`);

    // Estadísticas detalladas por estado
    const roomStats = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const reservationStats = await Reservation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\n🏨 Habitaciones por estado:');
    roomStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    console.log('\n📅 Reservaciones por estado:');
    reservationStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    // === VERIFICAR ÍNDICES CREADOS ===
    console.log('\n🔍 Verificando índices creados...\n');

    const collections = ['rooms', 'reservations', 'users', 'clients'];
    
    for (const collectionName of collections) {
      const indexes = await mongoose.connection.db.collection(collectionName).indexes();
      console.log(`📋 Índices en ${collectionName}:`);
      indexes.forEach(index => {
        const keyNames = Object.keys(index.key).join(', ');
        console.log(`   - ${index.name}: {${keyNames}}`);
      });
      console.log('');
    }

    // === RECOMENDACIONES ===
    console.log('💡 Recomendaciones de optimización aplicadas:\n');
    console.log('✅ Índices compuestos para consultas frecuentes');
    console.log('✅ Índices optimizados para rangos de fechas');
    console.log('✅ Índices para búsquedas de texto en clientes');
    console.log('✅ Índices para consultas de disponibilidad');
    console.log('✅ Índices para consultas administrativas');
    
    console.log('\n🎯 Para mejores resultados:');
    console.log('   • Usar .lean() en consultas de solo lectura');
    console.log('   • Paginar resultados largos con skip/limit');
    console.log('   • Usar projection para limitar campos devueltos');
    console.log('   • Considerar agregaciones para reportes complejos');

    console.log('\n✅ Optimización de base de datos completada');

  } catch (error) {
    console.error('❌ Error optimizando base de datos:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Función para mostrar plan de consulta
async function explainQuery(model, query) {
  try {
    const explained = await model.find(query).explain('executionStats');
    console.log(`📊 Plan de consulta para ${model.modelName}:`);
    console.log(`   Documentos examinados: ${explained.executionStats.totalDocsExamined}`);
    console.log(`   Documentos devueltos: ${explained.executionStats.totalDocsReturned}`);
    console.log(`   Tiempo de ejecución: ${explained.executionStats.executionTimeMillis}ms`);
    console.log(`   Índice usado: ${explained.executionStats.winningPlan.inputStage?.indexName || 'Ninguno'}`);
  } catch (error) {
    console.error('Error explicando consulta:', error.message);
  }
}

// Función para analizar rendimiento de consultas críticas
async function analyzePerformance() {
  try {
    await mongoose.connect(DB_URL);
    console.log('🔍 Analizando rendimiento de consultas críticas...\n');

    // Consulta de disponibilidad de habitaciones
    console.log('1. Consulta de disponibilidad de habitaciones:');
    await explainQuery(Room, { type: 'doble', status: 'disponible' });
    console.log('');

    // Consulta de reservaciones activas
    console.log('2. Consulta de reservaciones activas:');
    await explainQuery(Reservation, { 
      status: { $in: ['reservada', 'checkin'] },
      checkOut: { $gte: new Date() }
    });
    console.log('');

    // Consulta de clientes por nombre
    console.log('3. Búsqueda de clientes por nombre:');
    await explainQuery(Client, { nombre: /juan/i });
    console.log('');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error analizando rendimiento:', error);
  }
}

// Ejecutar según argumentos
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'analyze') {
    analyzePerformance();
  } else {
    optimizeDatabase();
  }
}

module.exports = {
  optimizeDatabase,
  analyzePerformance,
  explainQuery
};