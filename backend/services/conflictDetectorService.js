const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { buildModeQuery } = require('./appModeService');

const ACTIVE_RESERVATION_STATUS = new Set(['reservada', 'checkin']);

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const startA = toDate(aStart).getTime();
  const endA = toDate(aEnd).getTime();
  const startB = toDate(bStart).getTime();
  const endB = toDate(bEnd).getTime();
  return startA < endB && endA > startB;
}

function normalizeRoomMap(rooms) {
  const map = new Map();
  for (const room of rooms || []) {
    if (!room || !room._id) continue;
    map.set(String(room._id), room);
  }
  return map;
}

function normalizeReservationRooms(reservation) {
  if (!reservation || !reservation.room) return [];
  return reservation.room.map((r) => (r && r._id ? String(r._id) : String(r))).filter(Boolean);
}

function detectOverbooking(reservations) {
  const conflicts = [];
  const byRoom = new Map();

  for (const reservation of reservations) {
    if (!ACTIVE_RESERVATION_STATUS.has(reservation.status)) continue;
    const roomIds = normalizeReservationRooms(reservation);
    for (const roomId of roomIds) {
      if (!byRoom.has(roomId)) byRoom.set(roomId, []);
      byRoom.get(roomId).push(reservation);
    }
  }

  for (const [roomId, roomReservations] of byRoom.entries()) {
    for (let i = 0; i < roomReservations.length; i += 1) {
      for (let j = i + 1; j < roomReservations.length; j += 1) {
        const a = roomReservations[i];
        const b = roomReservations[j];
        if (rangesOverlap(a.checkIn, a.checkOut, b.checkIn, b.checkOut)) {
          conflicts.push({
            type: 'OVERBOOKING',
            severity: 'critical',
            roomId,
            reservationIds: [String(a._id), String(b._id)],
            message: `Overbooking detectado en habitación ${roomId}`
          });
        }
      }
    }
  }

  return conflicts;
}

function detectRoomBlockedWithReservation(rooms, reservations) {
  const conflicts = [];
  const roomMap = normalizeRoomMap(rooms);

  for (const reservation of reservations) {
    if (!ACTIVE_RESERVATION_STATUS.has(reservation.status)) continue;

    for (const roomId of normalizeReservationRooms(reservation)) {
      const room = roomMap.get(roomId);
      if (!room) continue;

      if (room.status === 'mantenimiento') {
        conflicts.push({
          type: 'ROOM_BLOCKED_WITH_RESERVATION',
          severity: 'high',
          roomId,
          reservationIds: [String(reservation._id)],
          message: `Habitación ${room.number || roomId} en mantenimiento con reserva activa`
        });
      }
    }
  }

  return conflicts;
}

function detectMaintenanceDuringStay(rooms, reservations) {
  const conflicts = [];
  const roomMap = normalizeRoomMap(rooms);

  for (const reservation of reservations) {
    if (!ACTIVE_RESERVATION_STATUS.has(reservation.status)) continue;

    for (const roomId of normalizeReservationRooms(reservation)) {
      const room = roomMap.get(roomId);
      if (!room || !room.currentMaintenance) continue;

      const mStart = room.currentMaintenance.startDate;
      const mEnd = room.currentMaintenance.estimatedEndDate || room.currentMaintenance.endDate;
      if (!mStart || !mEnd) continue;

      if (rangesOverlap(reservation.checkIn, reservation.checkOut, mStart, mEnd)) {
        conflicts.push({
          type: 'MAINTENANCE_DURING_STAY',
          severity: 'high',
          roomId,
          reservationIds: [String(reservation._id)],
          message: `Mantenimiento superpuesto con estadía en habitación ${room.number || roomId}`
        });
      }
    }
  }

  return conflicts;
}

function detectCheckinBeforeCleaning(rooms, reservations) {
  const conflicts = [];
  const roomMap = normalizeRoomMap(rooms);

  for (const reservation of reservations) {
    if (reservation.status !== 'checkin') continue;

    for (const roomId of normalizeReservationRooms(reservation)) {
      const room = roomMap.get(roomId);
      if (!room) continue;

      const roomNeedsCleaning =
        room.status === 'limpieza' ||
        room.pendingHousekeeping === 'limpieza_checkout' ||
        room.housekeepingState === 'DIRTY' ||
        room.housekeepingAssignment?.status === 'en_progreso';

      if (roomNeedsCleaning) {
        conflicts.push({
          type: 'CHECKIN_BEFORE_CLEANING',
          severity: 'high',
          roomId,
          reservationIds: [String(reservation._id)],
          message: `Check-in en habitación pendiente de limpieza (${room.number || roomId})`
        });
      }
    }
  }

  return conflicts;
}

function detectLateCheckoutConflict(reservations, now = new Date()) {
  const conflicts = [];
  const byRoom = new Map();

  for (const reservation of reservations) {
    const roomIds = normalizeReservationRooms(reservation);
    for (const roomId of roomIds) {
      if (!byRoom.has(roomId)) byRoom.set(roomId, []);
      byRoom.get(roomId).push(reservation);
    }
  }

  for (const [roomId, roomReservations] of byRoom.entries()) {
    const lateCheckouts = roomReservations.filter(
      (r) => r.status === 'checkin' && toDate(r.checkOut) < now
    );

    for (const late of lateCheckouts) {
      const nextReservations = roomReservations.filter(
        (r) =>
          String(r._id) !== String(late._id) &&
          ACTIVE_RESERVATION_STATUS.has(r.status) &&
          toDate(r.checkIn) <= now
      );

      if (nextReservations.length > 0) {
        conflicts.push({
          type: 'LATE_CHECKOUT_CONFLICT',
          severity: 'critical',
          roomId,
          reservationIds: [String(late._id), ...nextReservations.map((r) => String(r._id))],
          message: `Late checkout con nueva reserva en habitación ${roomId}`
        });
      }
    }
  }

  return conflicts;
}

function dedupeConflicts(conflicts) {
  const unique = new Map();
  for (const conflict of conflicts) {
    const reservationsKey = (conflict.reservationIds || []).slice().sort().join(',');
    const key = `${conflict.type}|${conflict.roomId || ''}|${reservationsKey}`;
    if (!unique.has(key)) unique.set(key, conflict);
  }
  return Array.from(unique.values());
}

function detectConflicts({ rooms = [], reservations = [], now = new Date() }) {
  const all = [
    ...detectOverbooking(reservations),
    ...detectRoomBlockedWithReservation(rooms, reservations),
    ...detectMaintenanceDuringStay(rooms, reservations),
    ...detectCheckinBeforeCleaning(rooms, reservations),
    ...detectLateCheckoutConflict(reservations, now)
  ];

  const conflicts = dedupeConflicts(all);
  return {
    total: conflicts.length,
    byType: conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {}),
    conflicts
  };
}

async function detectConflictsFromDatabase({ mode = 'production', now = new Date() } = {}) {
  const rooms = await Room.find(buildModeQuery(mode)).lean();
  const reservations = await Reservation.find({
    ...buildModeQuery(mode),
    status: { $in: ['reservada', 'checkin'] }
  }).lean();

  return detectConflicts({ rooms, reservations, now });
}

module.exports = {
  detectConflicts,
  detectConflictsFromDatabase,
  rangesOverlap
};