jest.mock('../../models/Room', () => ({
  find: jest.fn()
}));

jest.mock('../../models/Reservation', () => ({
  find: jest.fn()
}));

const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const availabilityEngine = require('../../services/availabilityEngine');
const { EventMatrixService } = require('../../services/eventMatrixService');
const { EVENT_TYPES } = require('../../models/eventTypes');
const { detectConflicts } = require('../../services/conflictDetectorService');

function mockRoomFindResult(rooms) {
  const lean = jest.fn().mockResolvedValue(rooms);
  const sort = jest.fn().mockReturnValue({ lean });
  Room.find.mockReturnValue({ sort });
}

function mockReservationFindResult(reservations) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(reservations)
  };
  Reservation.find.mockReturnValue(chain);
}

function summarizeDayState(timeline) {
  if (timeline.some((slot) => slot.state === 'CHECKOUT')) return 'CHECKOUT';
  if (timeline.some((slot) => slot.state === 'CHECKIN')) return 'CHECKIN';
  if (timeline.some((slot) => slot.state === 'OCCUPIED')) return 'OCCUPIED';
  return 'FREE';
}

describe('pilot consistency - EventMatrix vs ConflictDetector vs AvailabilityEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    availabilityEngine.invalidateCache();
  });

  test('Fase 1: multi-day occupancy mantiene misma realidad en los 3 motores', async () => {
    const roomId = 'room-101';
    const checkInUtc = '2026-07-10T18:00:00.000Z'; // 15:00 ART
    const checkOutUtc = '2026-07-15T13:00:00.000Z'; // 10:00 ART

    const eventMatrix = new EventMatrixService({ timeZone: 'America/Argentina/Buenos_Aires' });
    eventMatrix.setEvents([
      {
        roomId,
        reservationId: 'res-1',
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: '2026-07-01T12:00:00.000Z',
        metadata: {
          checkIn: checkInUtc,
          checkOut: checkOutUtc,
          requestId: 'req-phase1'
        }
      },
      {
        roomId,
        reservationId: 'res-1',
        type: EVENT_TYPES.CHECKIN,
        timestamp: checkInUtc,
        metadata: { requestId: 'req-phase1' }
      },
      {
        roomId,
        reservationId: 'res-1',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: checkOutUtc,
        metadata: { requestId: 'req-phase1' }
      }
    ]);

    const expectedByDay = {
      '2026-07-10': 'CHECKIN',
      '2026-07-11': 'OCCUPIED',
      '2026-07-12': 'OCCUPIED',
      '2026-07-13': 'OCCUPIED',
      '2026-07-14': 'OCCUPIED',
      '2026-07-15': 'CHECKOUT'
    };

    Object.entries(expectedByDay).forEach(([date, expected]) => {
      const timeline = eventMatrix.buildDayTimeline(roomId, date);
      expect(summarizeDayState(timeline)).toBe(expected);
    });

    const roomDoc = {
      _id: roomId,
      number: 101,
      type: 'doble',
      status: 'disponible',
      mode: 'production'
    };
    const reservationDoc = {
      _id: 'res-1',
      room: [roomId],
      status: 'checkin',
      checkIn: checkInUtc,
      checkOut: checkOutUtc,
      mode: 'production',
      client: { nombre: 'Test', apellido: 'Guest' }
    };

    mockRoomFindResult([roomDoc]);
    mockReservationFindResult([reservationDoc]);

    const availability = await availabilityEngine.getRoomStatus('2026-07-10', 6, { mode: 'production' });
    const room101 = availability.find((r) => String(r.roomId) === roomId);
    const availByDay = Object.fromEntries(room101.dates.map((d) => [d.date, d.status]));

    expect(availByDay['2026-07-10']).toBe('checkin');
    expect(availByDay['2026-07-11']).toBe('ocupada');
    expect(availByDay['2026-07-12']).toBe('ocupada');
    expect(availByDay['2026-07-13']).toBe('ocupada');
    expect(availByDay['2026-07-14']).toBe('ocupada');
    expect(availByDay['2026-07-15']).toBe('checkout_hoy');

    const conflicts = detectConflicts({
      rooms: [roomDoc],
      reservations: [reservationDoc],
      now: new Date('2026-07-12T12:00:00.000Z')
    });

    expect(conflicts.total).toBe(0);
  });

  test('Fase 2: room change 101 -> 205 queda consistente en los 3 motores', async () => {
    const checkInUtc = '2026-07-10T18:00:00.000Z';
    const checkOutUtc = '2026-07-15T13:00:00.000Z';
    const roomChangeAtUtc = '2026-07-12T16:00:00.000Z';

    const eventMatrix = new EventMatrixService({ timeZone: 'America/Argentina/Buenos_Aires' });
    eventMatrix.setEvents([
      {
        roomId: 'room-101',
        reservationId: 'res-2',
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: '2026-07-01T12:00:00.000Z',
        metadata: {
          checkIn: checkInUtc,
          checkOut: checkOutUtc,
          requestId: 'req-room-change'
        }
      },
      {
        roomId: 'room-101',
        reservationId: 'res-2',
        type: EVENT_TYPES.CHECKIN,
        timestamp: checkInUtc,
        metadata: { requestId: 'req-room-change' }
      },
      {
        roomId: 'room-101',
        reservationId: 'res-2',
        type: EVENT_TYPES.RESERVATION_CANCELLED,
        timestamp: roomChangeAtUtc,
        metadata: {
          checkIn: checkInUtc,
          checkOut: checkOutUtc,
          requestId: 'req-room-change'
        }
      },
      {
        roomId: 'room-205',
        reservationId: 'res-2',
        type: EVENT_TYPES.RESERVATION_MODIFIED,
        timestamp: roomChangeAtUtc,
        metadata: {
          checkIn: checkInUtc,
          checkOut: checkOutUtc,
          requestId: 'req-room-change'
        }
      },
      {
        roomId: 'room-205',
        reservationId: 'res-2',
        type: EVENT_TYPES.CHECKIN,
        timestamp: roomChangeAtUtc,
        metadata: { requestId: 'req-room-change' }
      }
    ]);

    const day101 = eventMatrix.buildDayTimeline('room-101', '2026-07-12');
    const day205 = eventMatrix.buildDayTimeline('room-205', '2026-07-12');

    expect(summarizeDayState(day101)).toBe('FREE');
    expect(['CHECKIN', 'OCCUPIED']).toContain(summarizeDayState(day205));

    const room101 = {
      _id: 'room-101',
      number: 101,
      type: 'doble',
      status: 'disponible',
      mode: 'production'
    };
    const room205 = {
      _id: 'room-205',
      number: 205,
      type: 'doble',
      status: 'disponible',
      mode: 'production'
    };
    const reservationDoc = {
      _id: 'res-2',
      room: ['room-205'],
      status: 'checkin',
      checkIn: checkInUtc,
      checkOut: checkOutUtc,
      mode: 'production',
      client: { nombre: 'Room', apellido: 'Change' }
    };

    mockRoomFindResult([room101, room205]);
    mockReservationFindResult([reservationDoc]);

    const availability = await availabilityEngine.getRoomStatus('2026-07-12', 1, { mode: 'production' });
    const byRoom = Object.fromEntries(
      availability.map((item) => [item.roomNumber, item.dates[0].status])
    );

    expect(byRoom[101]).toBe('disponible');
    expect(byRoom[205]).toBe('ocupada');

    const conflicts = detectConflicts({
      rooms: [room101, room205],
      reservations: [reservationDoc],
      now: new Date('2026-07-12T17:00:00.000Z')
    });

    expect(conflicts.total).toBe(0);
  });
});
