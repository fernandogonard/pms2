const { detectConflicts } = require('../../services/conflictDetectorService');

function baseRoom(overrides = {}) {
  return {
    _id: overrides._id || 'room-1',
    number: overrides.number || 101,
    status: overrides.status || 'disponible',
    housekeepingState: overrides.housekeepingState || 'CLEAN',
    pendingHousekeeping: overrides.pendingHousekeeping || null,
    housekeepingAssignment: overrides.housekeepingAssignment || { status: 'no_asignada' },
    ...overrides
  };
}

function baseReservation(overrides = {}) {
  return {
    _id: overrides._id || 'res-1',
    room: overrides.room || ['room-1'],
    status: overrides.status || 'reservada',
    checkIn: overrides.checkIn || new Date('2026-06-20T00:00:00.000Z'),
    checkOut: overrides.checkOut || new Date('2026-06-22T00:00:00.000Z'),
    ...overrides
  };
}

describe('conflictDetectorService', () => {
  test('detecta overbooking', () => {
    const rooms = [baseRoom()];
    const reservations = [
      baseReservation({ _id: 'res-a' }),
      baseReservation({ _id: 'res-b', checkIn: new Date('2026-06-21T00:00:00.000Z'), checkOut: new Date('2026-06-23T00:00:00.000Z') })
    ];

    const result = detectConflicts({ rooms, reservations, now: new Date('2026-06-21T12:00:00.000Z') });
    expect(result.byType.OVERBOOKING).toBe(1);
  });

  test('detecta room blocked with reservation', () => {
    const rooms = [baseRoom({ status: 'mantenimiento' })];
    const reservations = [baseReservation({ _id: 'res-a' })];

    const result = detectConflicts({ rooms, reservations, now: new Date('2026-06-21T12:00:00.000Z') });
    expect(result.byType.ROOM_BLOCKED_WITH_RESERVATION).toBe(1);
  });

  test('detecta maintenance during stay', () => {
    const rooms = [
      baseRoom({
        currentMaintenance: {
          startDate: new Date('2026-06-21T00:00:00.000Z'),
          estimatedEndDate: new Date('2026-06-23T00:00:00.000Z')
        }
      })
    ];
    const reservations = [baseReservation({ _id: 'res-a' })];

    const result = detectConflicts({ rooms, reservations, now: new Date('2026-06-21T12:00:00.000Z') });
    expect(result.byType.MAINTENANCE_DURING_STAY).toBe(1);
  });

  test('detecta checkin before cleaning', () => {
    const rooms = [baseRoom({ status: 'limpieza', housekeepingState: 'DIRTY' })];
    const reservations = [baseReservation({ _id: 'res-a', status: 'checkin' })];

    const result = detectConflicts({ rooms, reservations, now: new Date('2026-06-21T12:00:00.000Z') });
    expect(result.byType.CHECKIN_BEFORE_CLEANING).toBe(1);
  });

  test('detecta late checkout conflict', () => {
    const rooms = [baseRoom()];
    const reservations = [
      baseReservation({
        _id: 'res-late',
        status: 'checkin',
        checkIn: new Date('2026-06-18T00:00:00.000Z'),
        checkOut: new Date('2026-06-20T00:00:00.000Z')
      }),
      baseReservation({
        _id: 'res-next',
        status: 'reservada',
        checkIn: new Date('2026-06-21T00:00:00.000Z'),
        checkOut: new Date('2026-06-23T00:00:00.000Z')
      })
    ];

    const result = detectConflicts({ rooms, reservations, now: new Date('2026-06-21T12:00:00.000Z') });
    expect(result.byType.LATE_CHECKOUT_CONFLICT).toBe(1);
  });
});