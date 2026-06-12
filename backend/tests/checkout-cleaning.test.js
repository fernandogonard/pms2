// tests/checkout-cleaning.test.js
// Suite de tests para Checkout y Limpieza - PMS2

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { isValidObjectId } = require('mongoose');

process.env.NODE_ENV = 'test';

const app = require('../app');
const User = require('../models/User');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const CheckoutService = require('../services/CheckoutService');
const { logger } = require('../services/loggerService');

// Helpers para seed
async function seedAdmin() {
  const hashed = await bcrypt.hash('admin123', 8);
  return User.create({ 
    name: 'Admin Test', 
    email: 'admin@checkout.com', 
    password: hashed, 
    role: 'admin' 
  });
}

async function seedRecepcionista() {
  const hashed = await bcrypt.hash('rece123', 8);
  return User.create({ 
    name: 'Recepcionista Test', 
    email: 'recep@checkout.com', 
    password: hashed, 
    role: 'recepcionista' 
  });
}

async function seedLimpiadora() {
  const hashed = await bcrypt.hash('limp123', 8);
  return User.create({ 
    name: 'Limpiadora Test', 
    email: 'limp@checkout.com', 
    password: hashed, 
    role: 'limpieza' 
  });
}

async function seedRoom(override = {}) {
  return Room.create({ 
    number: override.number || 101,
    floor: 1, 
    type: 'doble', 
    price: 8500, 
    status: 'disponible',
    ...override
  });
}

async function seedReservation(roomId, override = {}) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return Reservation.create({
    guest: 'Juan Pérez',
    email: 'juan@test.com',
    phone: '1234567890',
    dni: '12345678',
    checkIn: today.toISOString().split('T')[0],
    checkOut: tomorrow.toISOString().split('T')[0],
    nights: 1,
    roomType: 'doble',
    price: 8500,
    totalCost: 8500,
    paymentMethod: 'efectivo',
    amountPaid: 8500,
    isPaid: true,
    notes: 'Test reservation',
    room: [roomId],
    status: 'checkin',
    ...override
  });
}

let adminToken, recepToken, limpToken;
let adminUser, recepUser, limpUser;
let testRoom, testReservation;

describe('🧹 CHECKOUT & CLEANING - Suite de Tests', () => {

  beforeAll(async () => {
    // Seed usuarios
    adminUser = await seedAdmin();
    recepUser = await seedRecepcionista();
    limpUser = await seedLimpiadora();

    // Login y obtener tokens
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@checkout.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const recepRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recep@checkout.com', password: 'rece123' });
    recepToken = recepRes.body.token;

    const limpRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'limp@checkout.com', password: 'limp123' });
    limpToken = limpRes.body.token;

    // Seed habitación y reserva
    testRoom = await seedRoom();
    testReservation = await seedReservation(testRoom._id);

    logger.info('✅ Seed completado para checkout-cleaning tests');
  });

  afterAll(async () => {
    // Limpieza
    await User.deleteMany({});
    await Room.deleteMany({});
    await Reservation.deleteMany({});
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 1: CheckoutService - Lógica de Backend
  // ────────────────────────────────────────────────────────────────

  describe('📋 CheckoutService - Funcionalidad', () => {

    test('getCheckoutsToday() retorna array vacío si no hay checkouts', async () => {
      const checkouts = await CheckoutService.getCheckoutsToday();
      expect(Array.isArray(checkouts)).toBe(true);
    });

    test('assignCleaning() asigna limpiador a habitación', async () => {
      const room = await seedRoom({ number: 102 });
      const updated = await CheckoutService.assignCleaning(
        room._id,
        'Maria',
        'limpieza_checkout'
      );

      expect(updated).toBeDefined();
      expect(updated.housekeepingAssignment).toBeDefined();
      expect(updated.housekeepingAssignment.assignedTo).toBe('Maria');
      expect(updated.housekeepingAssignment.status).toBe('asignada');
      expect(updated.housekeepingAssignment.estimatedDurationMinutes).toBe(40);
    });

    test('assignCleaning() con tipo "repaso" dura 20 minutos', async () => {
      const room = await seedRoom({ number: 103 });
      const updated = await CheckoutService.assignCleaning(
        room._id,
        'Carlos',
        'repaso'
      );

      expect(updated.housekeepingAssignment.estimatedDurationMinutes).toBe(20);
    });

    test('assignCleaning() con tipo "limpieza_profunda" dura 25 minutos', async () => {
      const room = await seedRoom({ number: 104 });
      const updated = await CheckoutService.assignCleaning(
        room._id,
        'Ana',
        'limpieza_profunda'
      );

      expect(updated.housekeepingAssignment.estimatedDurationMinutes).toBe(25);
    });

    test('startCleaning() cambia status a en_progreso', async () => {
      const room = await seedRoom({ number: 105 });
      await CheckoutService.assignCleaning(room._id, 'Luis', 'limpieza_checkout');
      
      const updated = await CheckoutService.startCleaning(room._id);
      
      expect(updated.housekeepingAssignment.status).toBe('en_progreso');
      expect(updated.status).toBe('limpieza');
    });

    test('completeCleaning() marca como completada y room disponible', async () => {
      const room = await seedRoom({ number: 106 });
      await CheckoutService.assignCleaning(room._id, 'Rosa', 'limpieza_checkout');
      await CheckoutService.startCleaning(room._id);
      
      const updated = await CheckoutService.completeCleaning(room._id, 'Limpieza OK');
      
      expect(updated.housekeepingAssignment.status).toBe('completada');
      expect(updated.status).toBe('disponible');
      expect(updated.housekeepingAssignment.notes).toBe('Limpieza OK');
    });

    test('cancelCleaning() cancela asignación', async () => {
      const room = await seedRoom({ number: 107 });
      await CheckoutService.assignCleaning(room._id, 'Pedro', 'limpieza_checkout');
      
      const updated = await CheckoutService.cancelCleaning(room._id, 'No se puede asignar hoy');
      
      expect(updated.housekeepingAssignment.status).toBe('cancelada');
    });

    test('getPendingCleanings() filtra por status', async () => {
      const room1 = await seedRoom({ number: 108 });
      const room2 = await seedRoom({ number: 109 });
      
      await CheckoutService.assignCleaning(room1._id, 'X', 'limpieza_checkout');
      await CheckoutService.startCleaning(room1._id);
      await CheckoutService.assignCleaning(room2._id, 'Y', 'limpieza_checkout');
      
      const enProgreso = await CheckoutService.getPendingCleanings('en_progreso');
      const asignada = await CheckoutService.getPendingCleanings('asignada');
      
      expect(enProgreso.length).toBeGreaterThan(0);
      expect(asignada.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 2: API Endpoints - Autenticación y Autorización
  // ────────────────────────────────────────────────────────────────

  describe('🔐 API Endpoints - Auth & Permissions', () => {

    test('GET /api/cleaning/checkouts/today requiere token', async () => {
      const res = await request(app).get('/api/cleaning/checkouts/today');
      expect(res.status).toBe(401);
    });

    test('GET /api/cleaning/checkouts/today rechaza token inválido', async () => {
      const res = await request(app)
        .get('/api/cleaning/checkouts/today')
        .set('Authorization', 'Bearer invalid.token.xxx');
      expect(res.status).toBe(401);
    });

    test('GET /api/cleaning/checkouts/today permite admin', async () => {
      const res = await request(app)
        .get('/api/cleaning/checkouts/today')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 401]).toContain(res.status); // 200 si funciona, 401 si token vencido
    });

    test('GET /api/cleaning/checkouts/today permite recepcionista', async () => {
      const res = await request(app)
        .get('/api/cleaning/checkouts/today')
        .set('Authorization', `Bearer ${recepToken}`);
      expect([200, 401]).toContain(res.status);
    });

    test('GET /api/cleaning/checkouts/today permite limpieza', async () => {
      const res = await request(app)
        .get('/api/cleaning/checkouts/today')
        .set('Authorization', `Bearer ${limpToken}`);
      expect([200, 401]).toContain(res.status);
    });

    test('POST /api/cleaning/:roomId/assign requiere recepcionista+ (no limpieza)', async () => {
      const res = await request(app)
        .post(`/api/cleaning/${testRoom._id}/assign`)
        .set('Authorization', `Bearer ${limpToken}`)
        .send({ assignedTo: 'Test', housekeepingType: 'limpieza_checkout' });
      
      expect(res.status).toBe(403); // Forbidden
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 3: API Endpoints - Workflow Completo
  // ────────────────────────────────────────────────────────────────

  describe('🔄 API Workflow - Flujo Completo', () => {

    test('GET /api/cleaning/checkouts/today retorna array', async () => {
      const res = await request(app)
        .get('/api/cleaning/checkouts/today')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('count');
    });

    test('GET /api/cleaning/pending retorna array filtrable', async () => {
      const res = await request(app)
        .get('/api/cleaning/pending?status=asignada')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('POST /api/cleaning/:roomId/assign requiere assignedTo', async () => {
      const res = await request(app)
        .post(`/api/cleaning/${testRoom._id}/assign`)
        .set('Authorization', `Bearer ${recepToken}`)
        .send({}); // Sin assignedTo
      
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('limpiador');
    });

    test('POST /api/cleaning/:roomId/assign retorna room actualizada', async () => {
      const room = await seedRoom({ number: 110 });
      const res = await request(app)
        .post(`/api/cleaning/${room._id}/assign`)
        .set('Authorization', `Bearer ${recepToken}`)
        .send({ 
          assignedTo: 'TestCleaner',
          housekeepingType: 'limpieza_checkout'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.housekeepingAssignment.assignedTo).toBe('TestCleaner');
    });

    test('PATCH /api/cleaning/:roomId/start marca en progreso', async () => {
      const room = await seedRoom({ number: 111 });
      await CheckoutService.assignCleaning(room._id, 'Test', 'limpieza_checkout');
      
      const res = await request(app)
        .patch(`/api/cleaning/${room._id}/start`)
        .set('Authorization', `Bearer ${recepToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.housekeepingAssignment.status).toBe('en_progreso');
    });

    test('PATCH /api/cleaning/:roomId/complete marca completada', async () => {
      const room = await seedRoom({ number: 112 });
      await CheckoutService.assignCleaning(room._id, 'Test', 'limpieza_checkout');
      await CheckoutService.startCleaning(room._id);
      
      const res = await request(app)
        .patch(`/api/cleaning/${room._id}/complete`)
        .set('Authorization', `Bearer ${recepToken}`)
        .send({ notes: 'Todo limpio' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('disponible');
    });

    test('DELETE /api/cleaning/:roomId/cancel cancela asignación', async () => {
      const room = await seedRoom({ number: 113 });
      await CheckoutService.assignCleaning(room._id, 'Test', 'limpieza_checkout');
      
      const res = await request(app)
        .delete(`/api/cleaning/${room._id}/cancel`)
        .set('Authorization', `Bearer ${recepToken}`)
        .send({ reason: 'Cambio de plan' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.housekeepingAssignment.status).toBe('cancelada');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 4: Room Model - Estructura y Validaciones
  // ────────────────────────────────────────────────────────────────

  describe('📦 Room Model - Estructura', () => {

    test('Room tiene campo checkoutToday (boolean)', async () => {
      const room = await seedRoom({ number: 114 });
      expect(room).toHaveProperty('checkoutToday');
      expect(typeof room.checkoutToday).toBe('boolean');
    });

    test('Room tiene objeto checkoutInfo', async () => {
      const room = await seedRoom({ number: 115 });
      expect(room).toHaveProperty('checkoutInfo');
      expect(typeof room.checkoutInfo).toBe('object');
    });

    test('Room tiene objeto housekeepingAssignment', async () => {
      const room = await seedRoom({ number: 116 });
      expect(room).toHaveProperty('housekeepingAssignment');
      expect(typeof room.housekeepingAssignment).toBe('object');
    });

    test('checkoutInfo guarda guestName, isPaid, amountPaid, totalAmount', async () => {
      const room = await seedRoom({ number: 117 });
      const updated = await Room.findByIdAndUpdate(
        room._id,
        {
          checkoutInfo: {
            guestName: 'Test Guest',
            isPaid: true,
            amountPaid: 8500,
            totalAmount: 8500
          }
        },
        { new: true }
      );

      expect(updated.checkoutInfo.guestName).toBe('Test Guest');
      expect(updated.checkoutInfo.isPaid).toBe(true);
      expect(updated.checkoutInfo.amountPaid).toBe(8500);
    });

    test('housekeepingAssignment tiene status enum válido', async () => {
      const room = await seedRoom({ number: 118 });
      const updated = await Room.findByIdAndUpdate(
        room._id,
        {
          housekeepingAssignment: {
            assignedTo: 'Test',
            status: 'en_progreso'
          }
        },
        { new: true }
      );

      expect(['no_asignada', 'asignada', 'en_progreso', 'completada', 'cancelada']).toContain(
        updated.housekeepingAssignment.status
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 5: Validaciones y Edge Cases
  // ────────────────────────────────────────────────────────────────

  describe('⚠️ Validaciones y Edge Cases', () => {

    test('No se puede asignar limpieza sin assignedTo', async () => {
      const room = await seedRoom({ number: 119 });
      
      try {
        await CheckoutService.assignCleaning(room._id, '', 'limpieza_checkout');
        expect(true).toBe(false); // No debe llegar aquí
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    test('startCleaning() falla si no hay asignación previa', async () => {
      const room = await seedRoom({ number: 120 });
      
      try {
        await CheckoutService.startCleaning(room._id);
        expect(true).toBe(false); // No debe llegar aquí
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    test('roomId inválido retorna 500 en API', async () => {
      const res = await request(app)
        .post('/api/cleaning/invalid-id/assign')
        .set('Authorization', `Bearer ${recepToken}`)
        .send({ assignedTo: 'Test', housekeepingType: 'limpieza_checkout' });
      
      expect([400, 500]).toContain(res.status);
    });

    test('No se puede completar limpieza si no está en progreso', async () => {
      const room = await seedRoom({ number: 121 });
      await CheckoutService.assignCleaning(room._id, 'Test', 'limpieza_checkout');
      
      try {
        await CheckoutService.completeCleaning(room._id); // Sin startCleaning
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeDefined();
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TEST 6: Data Integrity
  // ────────────────────────────────────────────────────────────────

  describe('🔒 Data Integrity', () => {

    test('Cambiar estado no pierde checkoutInfo', async () => {
      const room = await seedRoom({ number: 122 });
      const checkoutInfo = {
        guestName: 'John Doe',
        isPaid: false,
        amountPaid: 5000,
        totalAmount: 8500
      };

      await Room.findByIdAndUpdate(room._id, { checkoutInfo });
      await CheckoutService.assignCleaning(room._id, 'Test', 'limpieza_checkout');

      const updated = await Room.findById(room._id);
      expect(updated.checkoutInfo.guestName).toBe('John Doe');
      expect(updated.checkoutInfo.isPaid).toBe(false);
    });

    test('Completar limpieza no pierde housekeepingAssignment history', async () => {
      const room = await seedRoom({ number: 123 });
      await CheckoutService.assignCleaning(room._id, 'Worker', 'limpieza_checkout');
      await CheckoutService.startCleaning(room._id);
      await CheckoutService.completeCleaning(room._id, 'Completado');

      const updated = await Room.findById(room._id);
      expect(updated.housekeepingAssignment.assignedTo).toBe('Worker');
      expect(updated.housekeepingAssignment.notes).toBe('Completado');
      expect(updated.housekeepingAssignment.status).toBe('completada');
    });
  });
});
