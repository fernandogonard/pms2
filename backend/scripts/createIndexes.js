const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Client = require('../models/Client');

dotenv.config({ path: './config/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function createIndexes() {
  try {
    // Verificar si ya hay una conexión activa de mongoose
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      console.log('🏨 Conectando a la base de datos...');
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Conectado a MongoDB');
    } else {
      console.log('✅ Usando conexión MongoDB existente');
    }
    
    // Comprobar si hay índices existentes
    const roomIndexes = await Room.collection.listIndexes().toArray();
    const reservationIndexes = await Reservation.collection.listIndexes().toArray();
    const userIndexes = await User.collection.listIndexes().toArray();
    const clientIndexes = await Client.collection.listIndexes().toArray();
    
    console.log(`Índices existentes: Room (${roomIndexes.length}), Reservation (${reservationIndexes.length}), User (${userIndexes.length}), Client (${clientIndexes.length})`);
    

    try {
      // Índices para habitaciones
      console.log('Creando índices para Room...');
      await Room.collection.createIndexes([
        { key: { number: 1 }, unique: true, background: true },
        { key: { type: 1 }, background: true },
        { key: { status: 1 }, background: true }
      ]);
      console.log('✅ Índices de Room creados o ya existían');
    } catch (error) {
      console.log(`⚠️ Algunos índices de Room ya existen: ${error.message}`);
    }
    
    try {
      // Índices para reservas
      console.log('Creando índices para Reservation...');
      await Reservation.collection.createIndexes([
        { key: { status: 1 }, background: true },
        { key: { checkIn: 1, checkOut: 1 }, background: true },
        { key: { 'room': 1 }, background: true },
        { key: { 'client': 1 }, background: true },
        // Índice compuesto para búsquedas de disponibilidad (crítico)
        { key: { status: 1, checkIn: 1, checkOut: 1 }, background: true }
      ]);
      console.log('✅ Índices de Reservation creados o ya existían');
    } catch (error) {
      console.log(`⚠️ Algunos índices de Reservation ya existen: ${error.message}`);
    }
    
    try {
      // Índices para usuarios
      console.log('Creando índices para User...');
      await User.collection.createIndexes([
        { key: { email: 1 }, unique: true, background: true },
        { key: { role: 1 }, background: true }
      ]);
      console.log('✅ Índices de User creados o ya existían');
    } catch (error) {
      console.log(`⚠️ Algunos índices de User ya existen: ${error.message}`);
    }
    
    try {
      // Índices para clientes
      console.log('Creando índices para Client...');
      await Client.collection.createIndexes([
        { key: { dni: 1 }, unique: true, background: true },
        { key: { email: 1 }, background: true },
        { 
          key: { lastName: 'text', firstName: 'text' },
          weights: { lastName: 2, firstName: 1 },
          background: true
        }
      ]);
      console.log('✅ Índices de Client creados o ya existían');
    } catch (error) {
      console.log(`⚠️ Algunos índices de Client ya existen: ${error.message}`);
    }

    console.log('✅ Índices creados exitosamente');
  } catch (error) {
    console.error('❌ Error creando índices:', error);
  } finally {
    // Solo desconectar si la conexión se creó en esta función
    if (require.main === module && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Desconectado de MongoDB');
    } else {
      console.log('✓ Manteniendo conexión a la base de datos');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };