const RoomEvent = require('../models/RoomEvent');
const { EVENT_TYPES } = require('../models/eventTypes');

function toRoomIds(reservation) {
  if (!reservation || !Array.isArray(reservation.room)) return [];
  return reservation.room
    .map((room) => (room && room._id ? String(room._id) : String(room)))
    .filter(Boolean);
}

function toReservationId(reservation) {
  if (!reservation || !reservation._id) return null;
  return String(reservation._id);
}

function buildMetadata(reservation, requestId) {
  return {
    status: reservation?.status,
    checkIn: reservation?.checkIn,
    checkOut: reservation?.checkOut,
    requestId: requestId || null
  };
}

async function emitEvents(events) {
  if (!events || events.length === 0) return { inserted: 0 };

  try {
    await RoomEvent.insertMany(events, { ordered: false });
    return { inserted: events.length };
  } catch (error) {
    // RoomEvent debe ser observabilidad, nunca bloquear operación principal
    // eslint-disable-next-line no-console
    console.warn('[RoomEventService] Error al persistir eventos:', error.message);
    return { inserted: 0, error: error.message };
  }
}

function buildEventsForReservation(reservation, type, requestId, timestamp) {
  const roomIds = toRoomIds(reservation);
  const reservationId = toReservationId(reservation);
  const at = timestamp || new Date();
  const metadata = buildMetadata(reservation, requestId);

  return roomIds.map((roomId) => ({
    roomId,
    reservationId,
    type,
    timestamp: at,
    metadata
  }));
}

async function emitReservationCreated(reservation, { requestId } = {}) {
  const events = buildEventsForReservation(
    reservation,
    EVENT_TYPES.RESERVATION_CREATED,
    requestId,
    reservation?.createdAt || new Date()
  );
  return emitEvents(events);
}

async function emitReservationCancelled(reservation, { requestId } = {}) {
  const events = buildEventsForReservation(
    reservation,
    EVENT_TYPES.RESERVATION_CANCELLED,
    requestId,
    new Date()
  );
  return emitEvents(events);
}

async function emitCheckin(reservation, { requestId } = {}) {
  const events = buildEventsForReservation(
    reservation,
    EVENT_TYPES.CHECKIN,
    requestId,
    new Date()
  );
  return emitEvents(events);
}

async function emitCheckout(reservation, { requestId } = {}) {
  const events = buildEventsForReservation(
    reservation,
    EVENT_TYPES.CHECKOUT,
    requestId,
    new Date()
  );
  return emitEvents(events);
}

async function emitRoomChange(
  reservation,
  {
    previousRoomIds = [],
    currentRoomIds = [],
    requestId,
    timestamp = new Date()
  } = {}
) {
  const reservationId = toReservationId(reservation);
  if (!reservationId) return { inserted: 0 };

  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const metadata = buildMetadata(reservation, requestId);

  const previous = Array.from(new Set((previousRoomIds || []).map(String))).filter(Boolean);
  const current = Array.from(new Set((currentRoomIds || []).map(String))).filter(Boolean);

  const removedRooms = previous.filter((roomId) => !current.includes(roomId));
  const addedRooms = current.filter((roomId) => !previous.includes(roomId));

  const events = [];

  removedRooms.forEach((roomId) => {
    events.push({
      roomId,
      reservationId,
      type: EVENT_TYPES.RESERVATION_CANCELLED,
      timestamp: at,
      metadata
    });
  });

  addedRooms.forEach((roomId) => {
    events.push({
      roomId,
      reservationId,
      type: EVENT_TYPES.RESERVATION_MODIFIED,
      timestamp: at,
      metadata
    });

    if (reservation?.status === 'checkin') {
      events.push({
        roomId,
        reservationId,
        type: EVENT_TYPES.CHECKIN,
        timestamp: at,
        metadata
      });
    }
  });

  return emitEvents(events);
}

module.exports = {
  emitReservationCreated,
  emitReservationCancelled,
  emitCheckin,
  emitCheckout,
  emitRoomChange,
  // export internos para tests
  _private: {
    toRoomIds,
    buildEventsForReservation,
    emitEvents
  }
};