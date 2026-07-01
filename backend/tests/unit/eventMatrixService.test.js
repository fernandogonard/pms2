const {
  EventMatrixService,
  resolveDominantStatus,
  normalizeDateKey
} = require('../../services/eventMatrixService');
const { EVENT_TYPES } = require('../../models/eventTypes');

describe('eventMatrixService', () => {
  test('timeline simple checkin-checkout', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-1',
        reservationId: 'res-1',
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: '2026-07-01T09:00:00.000Z',
        metadata: {
          checkIn: '2026-07-01T15:00:00.000Z',
          checkOut: '2026-07-02T11:00:00.000Z'
        }
      },
      {
        roomId: 'room-1',
        reservationId: 'res-1',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-01T15:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-1',
        reservationId: 'res-1',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-02T11:00:00.000Z',
        metadata: {}
      }
    ]);

    const day1 = service.buildDayTimeline('room-1', '2026-07-01');
    const day2 = service.buildDayTimeline('room-1', '2026-07-02');

    expect(day1[14].state).toBe('FREE');
    expect(day1[15].state).toBe('CHECKIN');
    expect(day1[16].state).toBe('OCCUPIED');

    expect(day2[10].state).toBe('OCCUPIED');
    expect(day2[11].state).toBe('CHECKOUT');
  });

  test('limpieza entre huéspedes', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-1',
        reservationId: 'res-1',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-03T11:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-1',
        type: EVENT_TYPES.CLEANING_START,
        timestamp: '2026-07-03T12:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-1',
        type: EVENT_TYPES.CLEANING_END,
        timestamp: '2026-07-03T14:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-1',
        reservationId: 'res-2',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-03T15:00:00.000Z',
        metadata: {}
      }
    ]);

    const timeline = service.buildDayTimeline('room-1', '2026-07-03');
    expect(timeline[11].state).toBe('CHECKOUT');
    expect(timeline[12].state).toBe('CLEANING');
    expect(timeline[13].state).toBe('CLEANING');
    expect(timeline[15].state).toBe('CHECKIN');
  });

  test('mantenimiento domina sobre estados inferiores', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-2',
        type: EVENT_TYPES.MAINTENANCE_START,
        timestamp: '2026-07-04T00:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-2',
        reservationId: 'res-x',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-04T10:00:00.000Z',
        metadata: {}
      }
    ]);

    const timeline = service.buildDayTimeline('room-2', '2026-07-04');
    expect(timeline[10].state).toBe('MAINTENANCE');
    expect(timeline[20].state).toBe('MAINTENANCE');
  });

  test('out of order domina toda la línea cuando aplica', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-3',
        type: EVENT_TYPES.OUT_OF_ORDER_START,
        timestamp: '2026-07-05T08:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-3',
        reservationId: 'res-y',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-05T09:00:00.000Z',
        metadata: {}
      }
    ]);

    const timeline = service.buildDayTimeline('room-3', '2026-07-05');
    expect(timeline[8].state).toBe('OUT_OF_ORDER');
    expect(timeline[9].state).toBe('OUT_OF_ORDER');
  });

  test('resuelve prioridades correctamente', () => {
    expect(resolveDominantStatus(['FREE', 'CLEANING', 'RESERVED'])).toBe('RESERVED');
    expect(resolveDominantStatus(['CHECKIN', 'CHECKOUT'])).toBe('CHECKOUT');
    expect(resolveDominantStatus(['OCCUPIED', 'MAINTENANCE'])).toBe('MAINTENANCE');
    expect(resolveDominantStatus([])).toBe('FREE');
  });

  test('cache hit reutiliza timeline existente', () => {
    const service = new EventMatrixService();
    service.setEvents([
      {
        roomId: 'room-4',
        reservationId: 'res-z',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-06T10:00:00.000Z',
        metadata: {}
      }
    ]);

    const t1 = service.buildDayTimeline('room-4', '2026-07-06');
    const t2 = service.buildDayTimeline('room-4', '2026-07-06');

    expect(t1).toBe(t2);
    expect(service.getCacheStats().hits).toBeGreaterThanOrEqual(1);
  });

  test('cache invalidation recalcula timeline al recibir eventos', () => {
    const service = new EventMatrixService();
    service.setEvents([
      {
        roomId: 'room-5',
        reservationId: 'res-a',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-07T10:00:00.000Z',
        metadata: {}
      }
    ]);

    const before = service.buildDayTimeline('room-5', '2026-07-07');

    service.receiveEvents([
      {
        roomId: 'room-5',
        type: EVENT_TYPES.OUT_OF_ORDER_START,
        timestamp: '2026-07-07T11:00:00.000Z',
        metadata: {}
      }
    ]);

    const after = service.buildDayTimeline('room-5', '2026-07-07');

    expect(after).not.toBe(before);
    expect(after[11].state).toBe('OUT_OF_ORDER');
    expect(service.getCacheStats().invalidations).toBeGreaterThanOrEqual(1);
  });

  test('genera indices por room, date y room+date', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-a',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-08T10:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-b',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-08T11:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-a',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-09T10:00:00.000Z',
        metadata: {}
      }
    ]);

    const snapshot = service.getIndexSnapshot();
    expect(snapshot.eventsByRoomSize).toBe(2);
    expect(snapshot.eventsByDateSize).toBe(2);
    expect(snapshot.eventsByRoomAndDateSize).toBe(3);
    expect(normalizeDateKey('2026-07-08T12:00:00.000Z')).toBe('2026-07-08');
  });

  test('timezone: respeta cambio de día en America/Argentina/Buenos_Aires', () => {
    const service = new EventMatrixService({
      timeZone: 'America/Argentina/Buenos_Aires'
    });

    // 2026-07-02 02:30 UTC -> 2026-07-01 23:30 local
    // 2026-07-02 03:30 UTC -> 2026-07-02 00:30 local
    service.setEvents([
      {
        roomId: 'room-tz',
        reservationId: 'res-tz',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-02T02:30:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-tz',
        reservationId: 'res-tz',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-02T03:30:00.000Z',
        metadata: {}
      }
    ]);

    const day1 = service.buildDayTimeline('room-tz', '2026-07-01');
    const day2 = service.buildDayTimeline('room-tz', '2026-07-02');

    expect(day1[23].state).toBe('CHECKIN');
    expect(day2[0].state).toBe('CHECKOUT');
  });

  test('multi-día: mantiene OCCUPIED en días intermedios', () => {
    const service = new EventMatrixService();

    service.setEvents([
      {
        roomId: 'room-md',
        reservationId: 'res-md',
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: '2026-07-15T10:00:00.000Z',
        metadata: {
          checkIn: '2026-07-15T15:00:00.000Z',
          checkOut: '2026-07-20T10:00:00.000Z'
        }
      },
      {
        roomId: 'room-md',
        reservationId: 'res-md',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-15T15:00:00.000Z',
        metadata: {}
      },
      {
        roomId: 'room-md',
        reservationId: 'res-md',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-20T10:00:00.000Z',
        metadata: {}
      }
    ]);

    const d16 = service.buildDayTimeline('room-md', '2026-07-16');
    const d17 = service.buildDayTimeline('room-md', '2026-07-17');
    const d18 = service.buildDayTimeline('room-md', '2026-07-18');
    const d19 = service.buildDayTimeline('room-md', '2026-07-19');

    expect(d16[12].state).toBe('OCCUPIED');
    expect(d17[12].state).toBe('OCCUPIED');
    expect(d18[12].state).toBe('OCCUPIED');
    expect(d19[12].state).toBe('OCCUPIED');
  });

  test('invalidación de cache para create/modify/cancel/checkin/checkout', () => {
    const service = new EventMatrixService();
    service.setEvents([]);

    const date = '2026-07-10';
    const roomId = 'room-inv';

    const initial = service.buildDayTimeline(roomId, date);

    service.receiveEvents([
      {
        roomId,
        reservationId: 'res-inv',
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: '2026-07-10T09:00:00.000Z',
        metadata: {
          checkIn: '2026-07-10T15:00:00.000Z',
          checkOut: '2026-07-11T10:00:00.000Z'
        }
      }
    ]);
    const afterCreate = service.buildDayTimeline(roomId, date);
    expect(afterCreate).not.toBe(initial);

    service.receiveEvents([
      {
        roomId,
        reservationId: 'res-inv',
        type: EVENT_TYPES.RESERVATION_MODIFIED,
        timestamp: '2026-07-10T10:00:00.000Z',
        metadata: {
          checkIn: '2026-07-10T16:00:00.000Z',
          checkOut: '2026-07-11T11:00:00.000Z'
        }
      }
    ]);
    const afterModify = service.buildDayTimeline(roomId, date);
    expect(afterModify).not.toBe(afterCreate);

    service.receiveEvents([
      {
        roomId,
        reservationId: 'res-inv',
        type: EVENT_TYPES.CHECKIN,
        timestamp: '2026-07-10T16:00:00.000Z',
        metadata: {}
      }
    ]);
    const afterCheckin = service.buildDayTimeline(roomId, date);
    expect(afterCheckin).not.toBe(afterModify);

    service.receiveEvents([
      {
        roomId,
        reservationId: 'res-inv',
        type: EVENT_TYPES.CHECKOUT,
        timestamp: '2026-07-10T20:00:00.000Z',
        metadata: {}
      }
    ]);
    const afterCheckout = service.buildDayTimeline(roomId, date);
    expect(afterCheckout).not.toBe(afterCheckin);

    service.receiveEvents([
      {
        roomId,
        reservationId: 'res-inv',
        type: EVENT_TYPES.RESERVATION_CANCELLED,
        timestamp: '2026-07-10T21:00:00.000Z',
        metadata: {}
      }
    ]);
    const afterCancel = service.buildDayTimeline(roomId, date);
    expect(afterCancel).not.toBe(afterCheckout);

    expect(service.getCacheStats().invalidations).toBeGreaterThanOrEqual(5);
  });
});