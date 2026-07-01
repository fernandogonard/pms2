jest.mock('../../models/RoomEvent', () => ({
  insertMany: jest.fn()
}));

const RoomEvent = require('../../models/RoomEvent');
const roomEventService = require('../../services/roomEventService');
const { EVENT_TYPES } = require('../../models/eventTypes');

describe('roomEventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RoomEvent.insertMany.mockResolvedValue([]);
  });

  const reservation = {
    _id: 'res-1',
    room: ['room-1', 'room-2'],
    status: 'reservada',
    checkIn: new Date('2026-07-01T15:00:00.000Z'),
    checkOut: new Date('2026-07-02T10:00:00.000Z'),
    createdAt: new Date('2026-06-30T12:00:00.000Z')
  };

  test('emite RESERVATION_CREATED por habitación', async () => {
    await roomEventService.emitReservationCreated(reservation, { requestId: 'rid-1' });

    expect(RoomEvent.insertMany).toHaveBeenCalledTimes(1);
    const payload = RoomEvent.insertMany.mock.calls[0][0];
    expect(payload).toHaveLength(2);
    expect(payload[0].type).toBe(EVENT_TYPES.RESERVATION_CREATED);
    expect(payload[0].metadata.requestId).toBe('rid-1');
  });

  test('emite RESERVATION_CANCELLED', async () => {
    await roomEventService.emitReservationCancelled(reservation, { requestId: 'rid-2' });

    const payload = RoomEvent.insertMany.mock.calls[0][0];
    expect(payload[0].type).toBe(EVENT_TYPES.RESERVATION_CANCELLED);
  });

  test('emite CHECKIN', async () => {
    await roomEventService.emitCheckin(reservation, { requestId: 'rid-3' });

    const payload = RoomEvent.insertMany.mock.calls[0][0];
    expect(payload[0].type).toBe(EVENT_TYPES.CHECKIN);
  });

  test('emite CHECKOUT', async () => {
    await roomEventService.emitCheckout(reservation, { requestId: 'rid-4' });

    const payload = RoomEvent.insertMany.mock.calls[0][0];
    expect(payload[0].type).toBe(EVENT_TYPES.CHECKOUT);
  });

  test('no falla si no hay room ids', async () => {
    const emptyReservation = { _id: 'res-empty', room: [] };
    const result = await roomEventService.emitReservationCreated(emptyReservation, { requestId: 'rid-5' });

    expect(result.inserted).toBe(0);
    expect(RoomEvent.insertMany).not.toHaveBeenCalled();
  });

  test('emite RESERVATION_CANCELLED en habitación saliente y RESERVATION_MODIFIED+CHECKIN en habitación entrante', async () => {
    const inCheckinReservation = {
      ...reservation,
      status: 'checkin'
    };

    await roomEventService.emitRoomChange(inCheckinReservation, {
      previousRoomIds: ['room-101'],
      currentRoomIds: ['room-205'],
      requestId: 'rid-room-change'
    });

    expect(RoomEvent.insertMany).toHaveBeenCalledTimes(1);
    const payload = RoomEvent.insertMany.mock.calls[0][0];
    expect(payload).toHaveLength(3);

    expect(payload[0].roomId).toBe('room-101');
    expect(payload[0].type).toBe(EVENT_TYPES.RESERVATION_CANCELLED);
    expect(payload[0].metadata.requestId).toBe('rid-room-change');

    expect(payload[1].roomId).toBe('room-205');
    expect(payload[1].type).toBe(EVENT_TYPES.RESERVATION_MODIFIED);
    expect(payload[1].metadata.requestId).toBe('rid-room-change');

    expect(payload[2].roomId).toBe('room-205');
    expect(payload[2].type).toBe(EVENT_TYPES.CHECKIN);
    expect(payload[2].metadata.requestId).toBe('rid-room-change');
  });

  test('room change sin cambios de habitación no persiste eventos', async () => {
    const result = await roomEventService.emitRoomChange(reservation, {
      previousRoomIds: ['room-1'],
      currentRoomIds: ['room-1'],
      requestId: 'rid-no-change'
    });

    expect(result.inserted).toBe(0);
    expect(RoomEvent.insertMany).not.toHaveBeenCalled();
  });
});