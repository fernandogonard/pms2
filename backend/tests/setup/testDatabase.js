// tests/setup/testDatabase.js
// Configuración de base de datos para tests

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  try {
    // Usar MongoDB en memoria para tests
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '5.0.6',
        downloadDir: process.cwd() + '/tmp'
      }
    });
    
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('📦 Conectado a MongoDB en memoria para tests');
    
  } catch (error) {
    console.error('❌ Error conectando a la base de datos de test:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    console.log('📦 Desconectado de MongoDB de test');
  } catch (error) {
    console.error('❌ Error desconectando de la base de datos de test:', error.message);
  }
};

const clearDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('🧹 Base de datos de test limpiada');
  } catch (error) {
    console.error('❌ Error limpiando la base de datos de test:', error.message);
  }
};

// Función para crear datos de prueba
const createTestData = async () => {
  const User = require('../../models/User');
  const Room = require('../../models/Room');
  const Client = require('../../models/Client');
  const Reservation = require('../../models/Reservation');
  const bcrypt = require('bcryptjs');

  try {
    // Crear usuarios de prueba
    const adminUser = new User({
      name: 'Admin Test',
      email: 'admin@test.com',
      password: await bcrypt.hash('AdminPass123!', 12),
      role: 'admin'
    });
    await adminUser.save();

    const receptionUser = new User({
      name: 'Reception Test',
      email: 'reception@test.com',
      password: await bcrypt.hash('ReceptionPass123!', 12),
      role: 'recepcion'
    });
    await receptionUser.save();

    const clientUser = new User({
      name: 'Client Test',
      email: 'client@test.com',
      password: await bcrypt.hash('ClientPass123!', 12),
      role: 'cliente'
    });
    await clientUser.save();

    // Crear habitaciones de prueba
    const rooms = [
      { number: '101', type: 'individual', price: 50, status: 'disponible' },
      { number: '102', type: 'doble', price: 80, status: 'ocupada' },
      { number: '201', type: 'suite', price: 150, status: 'mantenimiento' },
      { number: '202', type: 'familiar', price: 120, status: 'disponible' }
    ];

    const savedRooms = await Room.insertMany(rooms);

    // Crear clientes de prueba
    const clients = [
      {
        name: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+34123456789',
        dni: '12345678A',
        address: 'Calle Test 123, Madrid'
      },
      {
        name: 'María García',
        email: 'maria@example.com',
        phone: '+34987654321',
        dni: '87654321B',
        address: 'Avenida Prueba 456, Barcelona'
      }
    ];

    const savedClients = await Client.insertMany(clients);

    // Crear reservas de prueba
    const reservations = [
      {
        client: savedClients[0]._id,
        room: savedRooms[0]._id,
        checkIn: new Date('2024-02-01'),
        checkOut: new Date('2024-02-05'),
        totalAmount: 200,
        status: 'confirmada',
        services: ['desayuno', 'wifi']
      },
      {
        client: savedClients[1]._id,
        room: savedRooms[1]._id,
        checkIn: new Date('2024-02-10'),
        checkOut: new Date('2024-02-15'),
        totalAmount: 400,
        status: 'pendiente',
        services: ['desayuno', 'spa']
      }
    ];

    await Reservation.insertMany(reservations);

    console.log('🌱 Datos de prueba creados exitosamente');
    
    return {
      users: { admin: adminUser, reception: receptionUser, client: clientUser },
      rooms: savedRooms,
      clients: savedClients,
      reservations
    };

  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error.message);
    throw error;
  }
};

// Función para obtener JWT tokens para tests
const getAuthTokens = async () => {
  const jwt = require('jsonwebtoken');
  const User = require('../../models/User');

  try {
    const adminUser = await User.findOne({ email: 'admin@test.com' });
    const receptionUser = await User.findOne({ email: 'reception@test.com' });
    const clientUser = await User.findOne({ email: 'client@test.com' });

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const receptionToken = jwt.sign(
      { userId: receptionUser._id, role: receptionUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const clientToken = jwt.sign(
      { userId: clientUser._id, role: clientUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    return {
      admin: adminToken,
      reception: receptionToken,
      client: clientToken
    };

  } catch (error) {
    console.error('❌ Error generando tokens de prueba:', error.message);
    throw error;
  }
};

// Función para validar estado de test
const validateTestEnvironment = () => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  NODE_ENV no está configurado como "test"');
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  }

  // Deshabilitar logs durante tests
  if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
};

// Configuración global para todos los tests
beforeAll(() => {
  validateTestEnvironment();
});

module.exports = {
  connectDB,
  disconnectDB,
  clearDB,
  createTestData,
  getAuthTokens,
  validateTestEnvironment
};