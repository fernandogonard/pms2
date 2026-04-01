const mongoose = require('mongoose');
const Reservation = require('../backend/models/Reservation');
const Room = require('../backend/models/Room');
const AvailabilityEngine = require('../backend/services/availabilityEngine');

describe('Concurrency & Double Booking Prevention', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm-test');
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Reservation.deleteMany({});
    await Room.deleteMany({});

    // Crear habitación de prueba
    await Room.create({
      _id: new mongoose.Types.ObjectId(),
      number: '101',
      type: 'doble',
      capacity: 2
    });
  });

  test('No double booking on simultaneous creates', async () => {
    const roomId = (await Room.findOne())._id;
    const checkIn = new Date('2024-06-15T00:00:00Z');
    const checkOut = new Date('2024-06-17T00:00:00Z');

    // Simular 2 usuarios intentando reservar simultáneamente
    const promises = [
      createReservationWithTransaction(roomId, checkIn, checkOut, 'user1'),
      createReservationWithTransaction(roomId, checkIn, checkOut, 'user2')
    ];

    const results = await Promise.allSettled(promises);

    // Uno debe fallar
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBe(1);

    // Verificar que solo 1 reserva existe
    const count = await Reservation.countDocuments();
    expect(count).toBe(1);
  });

  test('Availability check prevents overlapping reservations', async () => {
    const room = await Room.findOne();
    const checkIn = new Date('2024-06-10T00:00:00Z');
    const checkOut = new Date('2024-06-12T00:00:00Z');

    // Crear primera reserva
    await Reservation.create({
      roomId: room._id,
      checkIn,
      checkOut,
      userId: 'user1',
      guestName: 'John Doe',
      status: 'reservada'
    });

    // Intentar sobrelapante
    const overlapping = await AvailabilityEngine.checkAvailabilityInTransaction(
      room._id,
      checkIn,
      checkOut
    );
    expect(overlapping).toBe(false);

    // No sobrelapante debe ser available
    const afterCheckout = await AvailabilityEngine.checkAvailabilityInTransaction(
      room._id,
      checkOut,
      new Date('2024-06-14T00:00:00Z')
    );
    expect(afterCheckout).toBe(true);
  });

  test('Availability engine returns correct calendar state', async () => {
    const room = await Room.findOne();
    const checkIn = new Date('2024-06-10T00:00:00Z');
    const checkOut = new Date('2024-06-12T00:00:00Z');

    await Reservation.create({
      roomId: room._id,
      checkIn,
      checkOut,
      userId: 'user1',
      guestName: 'Jane Doe',
      status: 'reservada'
    });

    const startDate = new Date('2024-06-09T00:00:00Z');
    const endDate = new Date('2024-06-14T00:00:00Z');

    const result = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);

    expect(result.rooms).toHaveLength(1);
    const availability = result.rooms[0].availability;

    // 9 y 13 deben ser available
    expect(availability.find((a) => a.date === '2024-06-09').available).toBe(true);
    expect(availability.find((a) => a.date === '2024-06-13').available).toBe(true);

    // 10, 11 deben ser occupied
    expect(availability.find((a) => a.date === '2024-06-10').available).toBe(false);
    expect(availability.find((a) => a.date === '2024-06-11').available).toBe(false);

    // 12 debe ser available (checkout)
    expect(availability.find((a) => a.date === '2024-06-12').available).toBe(true);
  });

  it('should prevent double booking', async () => {
    const roomId = mongoose.Types.ObjectId();
    const checkIn = new Date('2023-12-01');
    const checkOut = new Date('2023-12-02');

    // Simular 2 usuarios intentando reservar simultáneamente
    const promises = [
      Reservation.create({ room: roomId, checkIn, checkOut, email: 'test1@example.com' }),
      Reservation.create({ room: roomId, checkIn, checkOut, email: 'test2@example.com' })
    ];

    try {
      await Promise.all(promises);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toContain('Double booking');
    }
  });
});

async function createReservationWithTransaction(roomId, checkIn, checkOut, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const reservation = new Reservation({
      roomId,
      checkIn,
      checkOut,
      userId,
      guestName: `User ${userId}`,
      status: 'reservada'
    });

    await reservation.save({ session });
    await session.commitTransaction();
    return reservation;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
