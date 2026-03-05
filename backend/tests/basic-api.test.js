// tests/basic-api.test.js
// Suite básica de tests para prevenir regresiones en CRM Hotelero

const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';

const app = require('../app');
const User = require('../models/User');
const Room = require('../models/Room');

// Helpers para seed rápido
async function seedAdmin() {
  const hashed = await bcrypt.hash('admin123', 8);
  return User.create({ name: 'Admin Test', email: 'admin@hotel.com', password: hashed, role: 'admin' });
}
async function seedRoom() {
  return Room.create({ number: 101, floor: 1, type: 'doble', price: 8500, status: 'disponible' });
}

describe('🔍 CRM HOTELERO - Tests Básicos', () => {

  describe('✅ Conectividad', () => {
    test('Health check responde con JSON', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'online');
      expect(res.body).toHaveProperty('docs', '/api/docs');
    });

    test('Swagger docs disponible en /api/docs', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
    });
  });

  describe('🔐 Autenticación', () => {
    beforeEach(async () => { await seedAdmin(); });

    test('Login con credenciales válidas retorna token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hotel.com', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('admin');
    });

    test('Login con contraseña incorrecta devuelve 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hotel.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    test('Login con email inválido devuelve 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'no-es-email', password: 'admin123' });
      expect(res.status).toBe(400);
    });
  });

  describe('🔒 Seguridad JWT', () => {
    test('GET /api/rooms sin token devuelve 401', async () => {
      const res = await request(app).get('/api/rooms');
      expect(res.status).toBe(401);
    });

    test('GET /api/users sin token devuelve 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    test('Token con firma inválida devuelve 401', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', 'Bearer token.invalido.xxx');
      expect(res.status).toBe(401);
    });
  });

  describe('🏨 Habitaciones y Usuarios (con auth)', () => {
    let token;

    beforeEach(async () => {
      await seedAdmin();
      await seedRoom();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hotel.com', password: 'admin123' });
      token = loginRes.body.token;
    });

    test('GET /api/rooms con token válido devuelve 200', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    test('Listado de habitaciones incluye la habitación seed', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${token}`);
      const rooms = res.body.rooms || res.body;
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBeGreaterThan(0);
    });

    test('Crear habitación duplicada devuelve error', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${token}`)
        .send({ number: 101, floor: 1, type: 'doble', price: 8500 });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('GET /api/users devuelve array', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const users = res.body.users || res.body;
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('📋 Reservas', () => {
    test('GET /api/reservations requiere autenticación', async () => {
      const res = await request(app).get('/api/reservations');
      expect(res.status).toBe(401);
    });

    test('POST /api/reservations sin datos devuelve 400', async () => {
      const res = await request(app).post('/api/reservations').send({});
      expect(res.status).toBe(400);
    });
  });
});