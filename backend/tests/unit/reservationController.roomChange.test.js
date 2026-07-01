jest.mock('../../models/Reservation', () => ({
  findById: jest.fn(),
  findOne: jest.fn()
}));

jest.mock('../../models/Room', () => ({
  findById: jest.fn()
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn()
  };
});

jest.mock('../../services/roomAssignmentService', () => ({
  assignRoomsToReservation: jest.fn(),
  processCheckin: jest.fn(),
  processCheckout: jest.fn()
}));

jest.mock('../../services/billingService', () => ({}));
jest.mock('../../services/ReservationService', () => ({}));
jest.mock('../../services/availabilityEngine', () => ({}));
jest.mock('../../utils/wsManager', () => ({}));
jest.mock('../../services/notificationService', () => ({}));

jest.mock('../../services/loggerService', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    audit: { userAction: jest.fn() },
    performance: { requestTime: jest.fn(), slowOperation: jest.fn() }
  }
}));

jest.mock('../../services/lockService', () => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn()
}));

jest.mock('../../services/auditService', () => ({
  log: jest.fn()
}));

jest.mock('../../services/roomEventService', () => ({
  emitRoomChange: jest.fn().mockResolvedValue({ inserted: 3 }),
  emitReservationCreated: jest.fn(),
  emitReservationCancelled: jest.fn(),
  emitCheckin: jest.fn(),
  emitCheckout: jest.fn()
}));

jest.mock('../../services/appModeService', () => ({
  resolveAppMode: jest.fn(() => 'production')
}));

const mongoose = require('mongoose');
const Reservation = require('../../models/Reservation');
const Room = require('../../models/Room');
const lockService = require('../../services/lockService');
const auditService = require('../../services/auditService');
const roomEventService = require('../../services/roomEventService');
const reservationController = require('../../controllers/reservationController');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    }
  };
}

describe('reservationController.assignRoomToReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mongoose.startSession.mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn()
    });

    lockService.acquireLock.mockResolvedValue(true);
    lockService.releaseLock.mockResolvedValue(true);

    Reservation.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(null)
    });
  });

  test('registra ROOM_CHANGE con requestId y emite room events consistentes', async () => {
    const reservationEntity = {
      _id: 'res-rc-1',
      cantidad: 1,
      room: ['room-101'],
      status: 'checkin',
      checkIn: '2026-07-10T18:00:00.000Z',
      checkOut: '2026-07-15T13:00:00.000Z',
      save: jest.fn().mockResolvedValue(undefined)
    };

    const room205 = {
      _id: 'room-205',
      number: 205,
      status: 'disponible',
      save: jest.fn().mockResolvedValue(undefined)
    };

    const room101 = {
      _id: 'room-101',
      number: 101,
      status: 'ocupada',
      save: jest.fn().mockResolvedValue(undefined)
    };

    Reservation.findById
      .mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(reservationEntity)
      })
      .mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue({
          _id: 'res-rc-1',
          room: [{ _id: 'room-205' }],
          status: 'checkin',
          checkIn: '2026-07-10T18:00:00.000Z',
          checkOut: '2026-07-15T13:00:00.000Z'
        })
      });

    Room.findById
      .mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(room205)
      })
      .mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(room101)
      });

    const req = {
      params: { id: 'res-rc-1' },
      body: {
        room: ['room-205'],
        replace: true,
        replaceRoomIds: ['room-101']
      },
      app: {
        get: jest.fn((key) => {
          if (key === 'txSupported') return false;
          if (key === 'wss') return null;
          return null;
        })
      },
      user: {
        userId: '507f1f77bcf86cd799439011',
        id: '507f1f77bcf86cd799439011',
        email: 'qa@test.com',
        role: 'admin'
      },
      ip: '127.0.0.1',
      requestId: 'req-room-change-01'
    };

    const res = createRes();

    await reservationController.assignRoomToReservation(req, res);

    expect(res.statusCode).toBe(200);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ROOM_CHANGE',
        requestId: 'req-room-change-01'
      })
    );

    expect(roomEventService.emitRoomChange).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'res-rc-1' }),
      expect.objectContaining({
        previousRoomIds: ['room-101'],
        currentRoomIds: ['room-205'],
        requestId: 'req-room-change-01'
      })
    );
  });
});
