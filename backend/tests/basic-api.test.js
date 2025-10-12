// tests/basic-api.test.js
// Suite básica de tests para prevenir regresiones en CRM Hotelero
// Creado después de auditoría del 08/10/2025

const request = require('supertest');
const mongoose = require('mongoose');

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero-test';

const app = require('../app');
let server;
let authToken;

describe('🔍 CRM HOTELERO - Tests Básicos Post-Auditoría', () => {
  
  beforeAll(async () => {
    // Iniciar servidor para tests
    server = app.listen(5002);
    
    // Conectar a base de datos de test
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  afterAll(async () => {
    // Cerrar conexiones
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('✅ Tests de Conectividad', () => {
    test('Health check debe responder', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('CRM Hotelero API funcionando');
    });
  });

  describe('🔐 Tests de Autenticación', () => {
    test('Login con credenciales válidas debe funcionar', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@hotel.com',
          password: 'admin123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('admin');
      
      // Guardar token para tests posteriores
      authToken = response.body.token;
    });

    test('Login con credenciales inválidas debe fallar', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@hotel.com',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
    });
  });

  describe('🔒 Tests de Seguridad JWT (Corrección #1)', () => {
    test('Acceso a /api/rooms sin token debe ser denegado', async () => {
      const response = await request(app).get('/api/rooms');
      expect(response.status).toBe(401);
    });

    test('Acceso a /api/rooms con token válido debe funcionar', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(Array.isArray(response.body.rooms)).toBe(true);
    });

    test('Acceso a /api/rooms/available sin token debe ser denegado', async () => {
      const response = await request(app).get('/api/rooms/available');
      expect(response.status).toBe(401);
    });

    test('Acceso a /api/rooms/status sin token debe ser denegado', async () => {
      const response = await request(app).get('/api/rooms/status');
      expect(response.status).toBe(401);
    });
  });

  describe('🏨 Tests de Habitaciones', () => {
    test('Listado de habitaciones debe funcionar con token', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.rooms.length).toBeGreaterThan(0);
    });

    test('Tipos de habitación para facturación debe funcionar', async () => {
      const response = await request(app)
        .get('/api/billing/room-types')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('💰 Tests de Facturación', () => {
    test('Cálculo de facturación debe funcionar', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 3);

      const response = await request(app)
        .post('/api/billing/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipo: 'doble',
          cantidad: 1,
          checkIn: tomorrow.toISOString().split('T')[0],
          checkOut: dayAfter.toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('currency');
      expect(response.body.data.total).toBeGreaterThan(0);
    });
  });

  describe('📋 Tests de Reservaciones (Corrección #2)', () => {
    test('Creación de reserva con datos correctos debe funcionar', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7);
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + 9);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipo: 'doble',
          cantidad: 1,
          checkIn: checkIn.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          nombre: 'Test',
          apellido: 'Usuario',
          dni: '12345678',
          email: 'test@example.com',
          whatsapp: '555-0123'
        });
      
      // Debe funcionar ahora que corregimos el error
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('reservation');
      expect(response.body.reservation).toHaveProperty('_id');
    });

    test('Creación de reserva sin datos obligatorios debe fallar', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Falta tipo, fechas, etc.
          nombre: 'Test'
        });
      
      expect(response.status).toBe(400);
    });
  });

  describe('👥 Tests de Usuarios', () => {
    test('Listado de usuarios debe funcionar para admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });
  });
});

// Exportar para uso en otros tests
module.exports = { app, authToken };