jest.setTimeout(60000); // Incrementar el tiempo de espera global a 60 segundos

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const AvailabilityEngine = require('../backend/services/availabilityEngine');
const Reservation = require('../backend/models/Reservation');
const Room = require('../backend/models/Room');
const User = require('../backend/models/User');

let mongoServer;

describe('Availability Engine', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-db',
      },
      binary: {
        downloadDir: './mongodb-binaries',
      },
      autoStart: true,
    });

    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 60000, // Incrementar tiempo de espera
      socketTimeoutMS: 60000,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Reservation.deleteMany({});
    await Room.deleteMany({});
    await User.deleteMany({});

    // Crear datos de prueba
    await User.create({ _id: new mongoose.Types.ObjectId(), name: 'Test User' });
    await Room.create({ _id: new mongoose.Types.ObjectId(), number: '101', type: 'doble' });
    await Room.create({ _id: new mongoose.Types.ObjectId(), number: '102', type: 'simple' });
  });

  test('getRoomsAvailability returns all rooms', async () => {
    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-08T00:00:00Z');

    const result = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);

    expect(result.rooms).toHaveLength(2);
    expect(result.startDate).toBe('2024-06-01');
    expect(result.endDate).toBe('2024-06-08');
  });

  test('Calendar spans correct number of days', async () => {
    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-15T00:00:00Z');

    const result = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);

    const room = result.rooms[0];
    expect(room.availability).toHaveLength(14); // 14 días
  });

  test('Reservation appears in correct dates', async () => {
    const room = await Room.findOne();
    const user = await User.findOne();

    const checkIn = new Date('2024-06-05T00:00:00Z');
    const checkOut = new Date('2024-06-08T00:00:00Z');

    await Reservation.create({
      roomId: room._id,
      userId: user._id,
      checkIn,
      checkOut,
      guestName: 'Test Guest',
      status: 'reservada'
    });

    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-15T00:00:00Z');

    const result = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);
    const roomResult = result.rooms.find((r) => r._id === room._id.toString());
    const availability = roomResult.availability;

    // Antes: available
    expect(availability.find((a) => a.date === '2024-06-04').available).toBe(true);

    // Durante: occupied
    expect(availability.find((a) => a.date === '2024-06-05').available).toBe(false);
    expect(availability.find((a) => a.date === '2024-06-06').available).toBe(false);
    expect(availability.find((a) => a.date === '2024-06-07').available).toBe(false);

    // Checkout: available
    expect(availability.find((a) => a.date === '2024-06-08').available).toBe(true);

    // Después: available
    expect(availability.find((a) => a.date === '2024-06-09').available).toBe(true);
  });

  it('should return correct status', async () => {
    const startDate = '2023-12-01';
    const status = await AvailabilityEngine.getRoomStatus(startDate, 7);
    expect(status).toBeDefined();
    expect(Array.isArray(status)).toBe(true);
  });

  it('should cache results', async () => {
    const startDate = '2023-12-01';
    await AvailabilityEngine.getRoomStatus(startDate, 7);
    const cached = AvailabilityEngine.cache.get(`${startDate}-7`);
    expect(cached).toBeDefined();
  });

  test('Concurrent reservations should not cause double booking', async () => {
    const room = await Room.findOne();
    const user = await User.findOne();

    const checkIn = new Date('2024-06-05T00:00:00Z');
    const checkOut = new Date('2024-06-08T00:00:00Z');

    const reservationPromises = Array(10)
      .fill(null)
      .map(() =>
        Reservation.create({
          roomId: room._id,
          userId: user._id,
          checkIn,
          checkOut,
          guestName: 'Concurrent Guest',
          status: 'reservada'
        })
      );

    await Promise.allSettled(reservationPromises);

    const reservations = await Reservation.find({ roomId: room._id });
    expect(reservations).toHaveLength(1);
  });

  test('Should handle database errors gracefully', async () => {
    jest.spyOn(Reservation, 'find').mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    await expect(AvailabilityEngine.getRoomStatus('2024-06-01', 7)).rejects.toThrow('Database error');
  });

  test('Handles overlapping reservations correctly', async () => {
    const room = await Room.findOne();
    const user = await User.findOne();

    const checkIn1 = new Date('2024-06-05T00:00:00Z');
    const checkOut1 = new Date('2024-06-08T00:00:00Z');
    const checkIn2 = new Date('2024-06-07T00:00:00Z');
    const checkOut2 = new Date('2024-06-10T00:00:00Z');

    await Reservation.create([
      {
        roomId: room._id,
        userId: user._id,
        checkIn: checkIn1,
        checkOut: checkOut1,
        guestName: 'Guest 1',
        status: 'reservada'
      },
      {
        roomId: room._id,
        userId: user._id,
        checkIn: checkIn2,
        checkOut: checkOut2,
        guestName: 'Guest 2',
        status: 'reservada'
      }
    ]);

    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-15T00:00:00Z');

    const result = await AvailabilityEngine.getRoomsAvailability(startDate, endDate);
    const roomResult = result.rooms.find((r) => r.roomId === room._id.toString());

    const overlappingDates = roomResult.dates.filter((d) => d.status === 'reservada');
    expect(overlappingDates).toHaveLength(5); // 5 días de solapamiento
  });

  test('Cache invalidation works correctly', async () => {
    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-08T00:00:00Z');

    await AvailabilityEngine.getRoomsAvailability(startDate, endDate);
    expect(AvailabilityEngine.cache.size).toBe(1);

    AvailabilityEngine.invalidateCache();
    expect(AvailabilityEngine.cache.size).toBe(0);
  });

  test('Handles transaction errors gracefully', async () => {
    jest.spyOn(Reservation, 'find').mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const startDate = new Date('2024-06-01T00:00:00Z');
    const endDate = new Date('2024-06-08T00:00:00Z');

    await expect(AvailabilityEngine.getRoomsAvailability(startDate, endDate)).rejects.toThrow('Database error');
  });
});
