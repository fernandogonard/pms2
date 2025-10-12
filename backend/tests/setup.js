// Setup file para Jest - Configuración de entorno de pruebas
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// MongoDB en memoria para tests
let mongod;

// Setup antes de todos los tests
beforeAll(async () => {
  // Configurar variables de entorno para tests
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.LOG_LEVEL = 'error'; // Reducir logs durante tests
  
  // Iniciar MongoDB en memoria
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Conectar a la base de datos de pruebas
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Limpiar base de datos después de cada test
afterEach(async () => {
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Cleanup después de todos los tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongod) {
    await mongod.stop();
  }
});

// Mocks globales para servicios externos (solo si existen)
try {
  jest.mock('../services/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
    sendReservationConfirmation: jest.fn().mockResolvedValue({ success: true })
  }));
} catch (e) {
  // Servicio no existe aún
}

// Mock para WebSocket
try {
  jest.mock('../services/websocketService', () => ({
    broadcast: jest.fn(),
    sendToUser: jest.fn(),
    sendToRoom: jest.fn()
  }));
} catch (e) {
  // Servicio no existe aún
}

// Mock para servicios de pago
try {
  jest.mock('../services/paymentService', () => ({
    processPayment: jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'test-transaction-123'
    }),
    refundPayment: jest.fn().mockResolvedValue({
      success: true,
      refundId: 'test-refund-123'
    })
  }));
} catch (e) {
  // Servicio no existe aún
}

// Utilidades de testing
global.testUtils = {
  // Crear usuario de prueba
  createTestUser: async (userData = {}) => {
    const User = require('../models/User');
    const defaultUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'cliente',
      ...userData
    };
    return await User.create(defaultUser);
  },

  // Crear habitación de prueba
  createTestRoom: async (roomData = {}) => {
    const Room = require('../models/Room');
    const defaultRoom = {
      number: 101,
      type: 'Individual',
      price: 100,
      floor: 1,
      status: 'disponible',
      capacity: 2,
      ...roomData
    };
    return await Room.create(defaultRoom);
  },

  // Crear cliente de prueba
  createTestClient: async (clientData = {}) => {
    const Client = require('../models/Client');
    const defaultClient = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      idType: 'dni',
      idNumber: '12345678',
      ...clientData
    };
    return await Client.create(defaultClient);
  },

  // Crear reserva de prueba
  createTestReservation: async (reservationData = {}) => {
    const Reservation = require('../models/Reservation');
    
    // Crear client y room si no se proporcionan
    let clientId = reservationData.clientId;
    let roomId = reservationData.roomId;
    
    if (!clientId) {
      const client = await global.testUtils.createTestClient();
      clientId = client._id;
    }
    
    if (!roomId) {
      const room = await global.testUtils.createTestRoom();
      roomId = room._id;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 3);

    const defaultReservation = {
      clientId,
      roomId,
      checkIn: tomorrow,
      checkOut: dayAfter,
      guests: 2,
      totalPrice: 300,
      status: 'confirmada',
      ...reservationData
    };
    
    return await Reservation.create(defaultReservation);
  },

  // Generar JWT token de prueba
  generateTestToken: (userId, role = 'cliente') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  // Limpiar todas las colecciones
  clearDatabase: async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  },

  // Esperar un tiempo determinado (útil para tests de timing)
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock de request object para middleware tests
  createMockRequest: (data = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      const headers = {
        'user-agent': 'Mozilla/5.0 Test Browser',
        'authorization': 'Bearer test-token',
        ...data.headers
      };
      return headers[header.toLowerCase()];
    }),
    ...data
  }),

  // Mock de response object para middleware tests
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.header = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },

  // Mock de next function para middleware tests
  createMockNext: () => jest.fn()
};

// Configurar timeout por defecto para todos los tests
jest.setTimeout(10000);

// Suprimir warnings de MongoDB durante tests
mongoose.set('strictQuery', false);

// Console personalizado para tests (opcional - reduce noise)
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    // Comentar estas líneas si necesitas ver logs durante tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error // Mantener errores visibles
  };
}