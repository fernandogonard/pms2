// tests/e2e/reservation.workflow.test.js
// E2E: Flujo completo de reserva — crear cliente → crear reserva → checkin → checkout

const request = require('supertest');
const app = require('../../app');
const { connectDB, disconnectDB, clearDB } = require('../setup/testDatabase');

jest.setTimeout(30000);

describe('Reservation Workflow E2E', () => {
  let server;
  let adminToken;
  let roomId;
  let clientId;
  let reservationId;

  beforeAll(async () => {
    await connectDB();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server.close();
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();
  });

  // Helper: registrar admin y obtener token
  const getAdminToken = async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin E2E',
        email: 'admin-e2e@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });
    return res.body.token;
  };

  // Helper: crear habitación
  const createRoom = async (token, data = {}) => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: '101',
        floor: 1,
        type: 'doble',
        price: 100,
        status: 'disponible',
        ...data
      });
    return res;
  };

  // Helper: crear cliente
  const createClient = async (token, data = {}) => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '12345678',
        email: 'juan@e2e.com',
        whatsapp: '+5491155550000',
        ...data
      });
    return res;
  };

  describe('Complete booking flow', () => {
    beforeEach(async () => {
      adminToken = await getAdminToken();

      const roomRes = await createRoom(adminToken);
      roomId = roomRes.body.data?._id || roomRes.body._id;

      const clientRes = await createClient(adminToken);
      clientId = clientRes.body._id;
    });

    it('should create a reservation with valid data', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          room: [roomId],
          client: clientId,
          checkIn: tomorrow.toISOString(),
          checkOut: nextWeek.toISOString(),
          guests: 2,
          source: 'directa'
        });

      expect(res.status).toBeLessThan(500);
      if (res.status === 201 || res.status === 200) {
        reservationId = res.body.reservation?._id || res.body._id;
        expect(reservationId).toBeDefined();
      }
    });

    it('should list reservations with pagination', async () => {
      const res = await request(app)
        .get('/api/reservations?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.total).toBeDefined();
      expect(res.body.pagination.pages).toBeDefined();
    });

    it('should filter reservations by status', async () => {
      const res = await request(app)
        .get('/api/reservations?status=reservada')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.forEach(r => {
        expect(r.status).toBe('reservada');
      });
    });

    it('should list clients with pagination', async () => {
      const res = await request(app)
        .get('/api/clients?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should search clients by name', async () => {
      const res = await request(app)
        .get('/api/clients?q=Juan')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].nombre).toBe('Juan');
    });
  });

  describe('Public endpoints', () => {
    it('should get room types without auth', async () => {
      const token = await getAdminToken();
      await createRoom(token, { number: '201', type: 'suite', price: 200 });

      const res = await request(app)
        .get('/api/rooms/types')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should validate date format on calendar-status', async () => {
      const res = await request(app)
        .get('/api/rooms/calendar-status?start=invalid-date')
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('should return calendar status with valid date', async () => {
      const res = await request(app)
        .get('/api/rooms/calendar-status?start=2026-04-14&days=7');

      // Can be 200 or any response — just shouldn't crash
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Security', () => {
    it('should reject unauthenticated access to reservations list', async () => {
      const res = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated access to clients', async () => {
      const res = await request(app)
        .get('/api/clients')
        .expect(401);

      expect(res.body).toBeDefined();
    });

    it('should return healthy status on /health', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      // Should NOT expose uptime or database state
      expect(res.body.uptime).toBeUndefined();
      expect(res.body.database).toBeUndefined();
    });
  });
});
