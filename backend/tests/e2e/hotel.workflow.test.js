// tests/e2e/hotel.workflow.test.js
// Tests End-to-End del flujo completo del hotel

const request = require('supertest');
const app = require('../../app');
const { connectDB, disconnectDB, clearDB, createTestData, getAuthTokens } = require('../setup/testDatabase');

describe('Hotel Complete Workflow E2E Tests', () => {
  let server;
  let tokens;
  let testData;

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
    testData = await createTestData();
    tokens = await getAuthTokens();
  });

  describe('Complete Hotel Booking Workflow', () => {
    it('should complete a full booking workflow from search to checkout', async () => {
      // 1. Buscar habitaciones disponibles
      const searchResponse = await request(app)
        .get('/api/rooms/available')
        .query({
          checkIn: '2024-03-01',
          checkOut: '2024-03-05',
          guests: 2
        })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.rooms.length).toBeGreaterThan(0);

      const availableRoom = searchResponse.body.rooms[0];

      // 2. Crear un nuevo cliente
      const newClientResponse = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          name: 'Cliente E2E Test',
          email: 'e2e@test.com',
          phone: '+34666777888',
          dni: '11111111A',
          address: 'Calle E2E Test 123'
        })
        .expect(201);

      expect(newClientResponse.body.success).toBe(true);
      const client = newClientResponse.body.client;

      // 3. Crear una reserva
      const reservationResponse = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          clientId: client._id,
          roomId: availableRoom._id,
          checkIn: '2024-03-01',
          checkOut: '2024-03-05',
          guests: 2,
          services: ['desayuno', 'wifi'],
          specialRequests: 'Habitación en planta alta'
        })
        .expect(201);

      expect(reservationResponse.body.success).toBe(true);
      const reservation = reservationResponse.body.reservation;

      // 4. Confirmar la reserva
      const confirmResponse = await request(app)
        .patch(`/api/reservations/${reservation._id}/confirm`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      expect(confirmResponse.body.reservation.status).toBe('confirmada');

      // 5. Realizar check-in
      const checkinResponse = await request(app)
        .patch(`/api/reservations/${reservation._id}/checkin`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          actualCheckIn: new Date().toISOString(),
          notes: 'Check-in realizado correctamente'
        })
        .expect(200);

      expect(checkinResponse.body.success).toBe(true);
      expect(checkinResponse.body.reservation.status).toBe('activa');

      // 6. Verificar que la habitación está ocupada
      const roomResponse = await request(app)
        .get(`/api/rooms/${availableRoom._id}`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(200);

      expect(roomResponse.body.room.status).toBe('ocupada');

      // 7. Agregar servicios adicionales
      const addServiceResponse = await request(app)
        .patch(`/api/reservations/${reservation._id}/services`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          services: ['lavanderia'],
          additionalAmount: 25
        })
        .expect(200);

      expect(addServiceResponse.body.success).toBe(true);

      // 8. Realizar checkout
      const checkoutResponse = await request(app)
        .patch(`/api/reservations/${reservation._id}/checkout`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          actualCheckOut: new Date().toISOString(),
          finalAmount: reservation.totalAmount + 25,
          paymentMethod: 'tarjeta',
          notes: 'Checkout realizado, todo correcto'
        })
        .expect(200);

      expect(checkoutResponse.body.success).toBe(true);
      expect(checkoutResponse.body.reservation.status).toBe('completada');

      // 9. Verificar que la habitación está disponible nuevamente
      const finalRoomResponse = await request(app)
        .get(`/api/rooms/${availableRoom._id}`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(200);

      expect(finalRoomResponse.body.room.status).toBe('disponible');

      // 10. Generar reporte de la reserva
      const reportResponse = await request(app)
        .get('/api/reports/reservation')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .query({
          reservationId: reservation._id
        })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.report).toBeDefined();
    });

    it('should handle booking conflicts gracefully', async () => {
      const room = testData.rooms[0];

      // 1. Crear primera reserva
      const firstReservation = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          clientId: testData.clients[0]._id,
          roomId: room._id,
          checkIn: '2024-03-01',
          checkOut: '2024-03-05',
          guests: 1
        })
        .expect(201);

      // 2. Confirmar primera reserva
      await request(app)
        .patch(`/api/reservations/${firstReservation.body.reservation._id}/confirm`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(200);

      // 3. Intentar crear reserva conflictiva
      const conflictResponse = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          clientId: testData.clients[1]._id,
          roomId: room._id,
          checkIn: '2024-03-03', // Se superpone con la primera reserva
          checkOut: '2024-03-07',
          guests: 1
        })
        .expect(400);

      expect(conflictResponse.body.success).toBe(false);
      expect(conflictResponse.body.message).toContain('no está disponible');
    });
  });

  describe('Admin Management Workflow', () => {
    it('should complete admin dashboard workflow', async () => {
      // 1. Obtener estadísticas del dashboard
      const statsResponse = await request(app)
        .get('/api/reports/dashboard-stats')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.stats).toHaveProperty('totalRooms');
      expect(statsResponse.body.stats).toHaveProperty('totalReservations');
      expect(statsResponse.body.stats).toHaveProperty('totalClients');

      // 2. Crear nueva habitación
      const newRoomResponse = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({
          number: '301',
          type: 'suite',
          price: 200,
          capacity: 4,
          amenities: ['balcón', 'jacuzzi', 'minibar'],
          description: 'Suite presidencial con vistas al mar'
        })
        .expect(201);

      expect(newRoomResponse.body.success).toBe(true);
      const newRoom = newRoomResponse.body.room;

      // 3. Crear nuevo usuario
      const newUserResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({
          name: 'Nuevo Recepcionista',
          email: 'nuevo@recepcion.com',
          password: 'NewUser123!',
          role: 'recepcion'
        })
        .expect(201);

      expect(newUserResponse.body.success).toBe(true);

      // 4. Generar reporte mensual
      const monthlyReportResponse = await request(app)
        .get('/api/reports/monthly')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .query({
          year: 2024,
          month: 2
        })
        .expect(200);

      expect(monthlyReportResponse.body.success).toBe(true);
      expect(monthlyReportResponse.body.report).toBeDefined();

      // 5. Actualizar configuración de la habitación
      const updateRoomResponse = await request(app)
        .patch(`/api/rooms/${newRoom._id}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({
          price: 250,
          amenities: ['balcón', 'jacuzzi', 'minibar', 'servicio 24h']
        })
        .expect(200);

      expect(updateRoomResponse.body.success).toBe(true);
      expect(updateRoomResponse.body.room.price).toBe(250);

      // 6. Verificar logs de actividad
      const logsResponse = await request(app)
        .get('/api/reports/activity-logs')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .query({
          limit: 10
        })
        .expect(200);

      expect(logsResponse.body.success).toBe(true);
      expect(Array.isArray(logsResponse.body.logs)).toBe(true);
    });
  });

  describe('Real-time Communication Workflow', () => {
    it('should handle WebSocket notifications correctly', async () => {
      // Este test requeriría configuración adicional de WebSocket
      // Por ahora, verificamos que los endpoints relacionados funcionen

      // 1. Simular evento de nueva reserva
      const reservation = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          clientId: testData.clients[0]._id,
          roomId: testData.rooms[0]._id,
          checkIn: '2024-03-01',
          checkOut: '2024-03-03',
          guests: 1
        })
        .expect(201);

      // 2. Verificar que se puede obtener el estado actualizado
      const statusResponse = await request(app)
        .get('/api/rooms/status')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(Array.isArray(statusResponse.body.rooms)).toBe(true);

      // 3. Simular cambio de estado de habitación
      await request(app)
        .patch(`/api/rooms/${testData.rooms[0]._id}/status`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ status: 'limpieza' })
        .expect(200);

      // 4. Verificar notificaciones pendientes
      const notificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);

      expect(notificationsResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection issues gracefully', async () => {
      // Simular desconexión temporal (esto requeriría mocking adicional)
      // Por ahora, verificamos que los errores se manejen correctamente

      const invalidDataResponse = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          // Datos inválidos
          clientId: 'invalid-id',
          roomId: testData.rooms[0]._id,
          checkIn: 'invalid-date'
        })
        .expect(400);

      expect(invalidDataResponse.body.success).toBe(false);
      expect(invalidDataResponse.body.message).toBeDefined();
    });

    it('should handle concurrent reservation attempts', async () => {
      const room = testData.rooms[0];
      const client1 = testData.clients[0];
      const client2 = testData.clients[1];

      // Intentar crear dos reservas simultáneas para la misma habitación
      const reservationData1 = {
        clientId: client1._id,
        roomId: room._id,
        checkIn: '2024-03-01',
        checkOut: '2024-03-03',
        guests: 1
      };

      const reservationData2 = {
        clientId: client2._id,
        roomId: room._id,
        checkIn: '2024-03-01',
        checkOut: '2024-03-03',
        guests: 1
      };

      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${tokens.reception}`)
          .send(reservationData1),
        request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${tokens.reception}`)
          .send(reservationData2)
      ]);

      // Solo una de las dos debería ser exitosa
      const successfulResponses = [response1, response2].filter(r => r.status === 201);
      const failedResponses = [response1, response2].filter(r => r.status === 400);

      expect(successfulResponses.length).toBe(1);
      expect(failedResponses.length).toBe(1);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple simultaneous requests efficiently', async () => {
      const startTime = Date.now();

      // Realizar múltiples requests simultáneos
      const promises = Array(20).fill().map((_, index) => 
        request(app)
          .get('/api/rooms')
          .set('Authorization', `Bearer ${tokens.reception}`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Todas las respuestas deben ser exitosas
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // El tiempo total no debe exceder un umbral razonable (ej: 5 segundos)
      expect(totalTime).toBeLessThan(5000);
    });

    it('should handle large data sets efficiently', async () => {
      // Crear múltiples clientes para probar paginación
      const clients = Array(50).fill().map((_, index) => ({
        name: `Cliente ${index}`,
        email: `cliente${index}@test.com`,
        phone: `+3466677788${index}`,
        dni: `${String(index).padStart(8, '0')}A`,
        address: `Calle Test ${index}`
      }));

      // Crear clientes en lotes
      for (let i = 0; i < clients.length; i += 10) {
        const batch = clients.slice(i, i + 10);
        await Promise.all(
          batch.map(client => 
            request(app)
              .post('/api/clients')
              .set('Authorization', `Bearer ${tokens.admin}`)
              .send(client)
          )
        );
      }

      // Probar paginación
      const paginatedResponse = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .query({
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(paginatedResponse.body.success).toBe(true);
      expect(paginatedResponse.body.clients.length).toBe(10);
      expect(paginatedResponse.body.pagination).toBeDefined();
      expect(paginatedResponse.body.pagination.totalPages).toBeGreaterThan(1);
    });
  });
});