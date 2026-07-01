// services/roomStatusResolutionService.js
// Resolucion diaria por horas para una habitacion sin cambiar la UI diaria.

const STATUS_PRIORITY = {
  fuera_de_servicio: 100,
  mantenimiento: 90,
  conflicto: 85,
  checkout_hoy: 80,
  checkin: 70,
  ocupada: 60,
  dnd: 58,
  in_progress: 56,
  dirty: 54,
  inspected: 52,
  clean: 50,
  reservada: 48,
  limpieza: 40,
  disponible: 10
};

const STATUS_COLOR = {
  fuera_de_servicio: '#6b7280',
  mantenimiento: '#eab308',
  conflicto: '#ef4444',
  checkout_hoy: '#f97316',
  checkin: '#06b6d4',
  ocupada: '#dc2626',
  dnd: '#475569',
  in_progress: '#7c3aed',
  dirty: '#d97706',
  inspected: '#2563eb',
  clean: '#16a34a',
  reservada: '#3b82f6',
  limpieza: '#8b5cf6',
  disponible: '#10b981'
};

const HOUSEKEEPING_TO_STATUS = {
  DIRTY: 'dirty',
  CLEAN: 'clean',
  INSPECTED: 'inspected',
  IN_PROGRESS: 'in_progress',
  DND: 'dnd'
};

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function atStartOfDay(dateValue) {
  const d = toDate(dateValue);
  if (!d) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function atEndOfDay(dateValue) {
  const d = toDate(dateValue);
  if (!d) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Acepta Date o timestamps numéricos
function overlapsRange(startA, endA, startB, endB) {
  const sA = typeof startA === 'number' ? startA : startA.getTime();
  const eA = typeof endA === 'number' ? endA : endA.getTime();
  const sB = typeof startB === 'number' ? startB : startB.getTime();
  const eB = typeof endB === 'number' ? endB : endB.getTime();
  return sA < eB && eA > sB;
}

function roomIncludesReservation(reservation, roomId) {
  if (!reservation || !reservation.room) return false;
  const rooms = Array.isArray(reservation.room) ? reservation.room : [reservation.room];
  return rooms.some((rid) => rid && rid.toString() === roomId.toString());
}

function normalizeReservationStatus(status) {
  if (status === 'checkin') return 'ocupada';
  if (status === 'reservada' || status === 'confirmada') return 'reservada';
  return 'reservada';
}

// Timestamps enteros — evita 24 objetos Date por celda del calendario
const HOUR_MS = 3_600_000;
function buildHourSlots(dayStart) {
  const base = typeof dayStart === 'number' ? dayStart : dayStart.getTime();
  const slots = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const slotStart = base + hour * HOUR_MS;
    slots.push({ hour, slotStart, slotEnd: slotStart + HOUR_MS });
  }
  return slots;
}

function buildTimelineEvents(room, roomReservations, dayStart, dayEnd) {
  const events = [];

  if (room.status === 'fuera_de_servicio') {
    events.push({
      type: 'OUT_OF_ORDER',
      status: 'fuera_de_servicio',
      start: dayStart,
      end: dayEnd,
      source: 'room.status'
    });
  }

  if (room.currentMaintenance && room.currentMaintenance.startDate && room.currentMaintenance.estimatedEndDate) {
    const maintenanceStart = toDate(room.currentMaintenance.startDate);
    const maintenanceEnd = toDate(room.currentMaintenance.estimatedEndDate);
    if (maintenanceStart && maintenanceEnd && overlapsRange(maintenanceStart, maintenanceEnd, dayStart, dayEnd)) {
      events.push({
        type: 'MAINTENANCE',
        status: 'mantenimiento',
        start: maintenanceStart,
        end: maintenanceEnd,
        source: 'room.currentMaintenance',
        detail: room.currentMaintenance.reason || 'Mantenimiento'
      });
    }
  }

  if (room.housekeepingAssignment && room.housekeepingAssignment.startTime && room.housekeepingAssignment.endTime) {
    const hkStart = toDate(room.housekeepingAssignment.startTime);
    const hkEnd = toDate(room.housekeepingAssignment.endTime);
    if (hkStart && hkEnd && overlapsRange(hkStart, hkEnd, dayStart, dayEnd)) {
      events.push({
        type: 'CLEANING_WINDOW',
        status: 'limpieza',
        start: hkStart,
        end: hkEnd,
        source: 'room.housekeepingAssignment',
        detail: room.housekeepingAssignment.status || 'asignada'
      });
    }
  } else if (room.pendingHousekeeping) {
    events.push({
      type: 'CLEANING_PENDING',
      status: 'limpieza',
      start: dayStart,
      end: dayEnd,
      source: 'room.pendingHousekeeping',
      detail: room.pendingHousekeeping
    });
  }

  if (room.housekeepingState && HOUSEKEEPING_TO_STATUS[room.housekeepingState]) {
    events.push({
      type: `HK_${room.housekeepingState}`,
      status: HOUSEKEEPING_TO_STATUS[room.housekeepingState],
      start: dayStart,
      end: dayEnd,
      source: 'room.housekeepingState',
      detail: room.housekeepingState
    });
  }

  roomReservations.forEach((reservation) => {
    const checkIn = toDate(reservation.checkIn);
    const checkOut = toDate(reservation.checkOut);
    if (!checkIn || !checkOut) return;
    if (!overlapsRange(checkIn, checkOut, dayStart, dayEnd)) return;

    events.push({
      type: 'RESERVATION_WINDOW',
      status: normalizeReservationStatus(reservation.status),
      start: checkIn,
      end: checkOut,
      source: 'reservation.window',
      reservationId: reservation._id,
      reservation
    });

    if (checkIn >= dayStart && checkIn < dayEnd) {
      events.push({
        type: 'CHECKIN',
        status: 'checkin',
        start: checkIn,
        end: checkIn,
        source: 'reservation.checkin',
        reservationId: reservation._id,
        reservation
      });
    }

    if (checkOut >= dayStart && checkOut < dayEnd) {
      events.push({
        type: 'CHECKOUT',
        status: 'checkout_hoy',
        start: checkOut,
        end: checkOut,
        source: 'reservation.checkout',
        reservationId: reservation._id,
        reservation
      });
    }
  });

  return events.sort((a, b) => a.start - b.start);
}

function detectConflicts(room, roomReservations, timelineEvents, dayStart, dayEnd) {
  const conflicts = [];

  const activeReservations = roomReservations.filter((reservation) => {
    const checkIn = toDate(reservation.checkIn);
    const checkOut = toDate(reservation.checkOut);
    if (!checkIn || !checkOut) return false;
    return overlapsRange(checkIn, checkOut, dayStart, dayEnd);
  });

  if (activeReservations.length > 1) {
    conflicts.push({
      code: 'OVERBOOKING_SAME_ROOM',
      severity: 'high',
      message: 'Mas de una reserva activa para la misma habitacion en el dia.'
    });
  }

  const maintenanceEvent = timelineEvents.find((event) => event.type === 'MAINTENANCE');
  if (maintenanceEvent && activeReservations.length > 0) {
    conflicts.push({
      code: 'MAINTENANCE_DURING_STAY',
      severity: 'high',
      message: 'Mantenimiento activo durante una estadia.'
    });
  }

  const cleaningEvent = timelineEvents.find((event) => event.type === 'CLEANING_WINDOW');
  const checkinEvent = timelineEvents.find((event) => event.type === 'CHECKIN');
  if (cleaningEvent && checkinEvent && checkinEvent.start < cleaningEvent.end) {
    conflicts.push({
      code: 'CHECKIN_BEFORE_CLEANING_END',
      severity: 'high',
      message: 'Check-in planificado antes de finalizar la limpieza.'
    });
  }

  const dndEvent = timelineEvents.find((event) => event.type === 'HK_DND');
  if (dndEvent && cleaningEvent) {
    conflicts.push({
      code: 'DND_WITH_CLEANING',
      severity: 'medium',
      message: 'DND activo con limpieza planificada en el mismo dia.'
    });
  }

  const sortedByCheckIn = [...activeReservations].sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  if (sortedByCheckIn.length > 1) {
    const first = sortedByCheckIn[0];
    const second = sortedByCheckIn[1];
    const firstCheckOut = toDate(first.checkOut);
    const secondCheckIn = toDate(second.checkIn);
    if (firstCheckOut && secondCheckIn && firstCheckOut > secondCheckIn) {
      conflicts.push({
        code: 'CHECKOUT_AFTER_NEXT_ARRIVAL',
        severity: 'high',
        message: 'Checkout posterior al inicio de la siguiente llegada.'
      });
    }
  }

  if (room.status === 'fuera_de_servicio' && activeReservations.length > 0) {
    conflicts.push({
      code: 'OUT_OF_ORDER_WITH_ACTIVE_RESERVATION',
      severity: 'critical',
      message: 'Habitacion fuera de servicio con reserva activa.'
    });
  }

  return conflicts;
}

function pickVisibleStatus(hourlyStatuses, conflicts) {
  const statusCandidates = [...hourlyStatuses];
  if (conflicts.length > 0) statusCandidates.push('conflicto');

  if (statusCandidates.length === 0) return 'disponible';

  return statusCandidates.sort((a, b) => (STATUS_PRIORITY[b] || 0) - (STATUS_PRIORITY[a] || 0))[0];
}

function buildTooltip(room, dayDate, visibleStatus, conflicts, primaryReservation, timelineEvents) {
  const roomLabel = `Habitacion #${room.number}`;
  const dateLabel = dayDate.toISOString().split('T')[0];
  const reservationLabel = primaryReservation
    ? `${primaryReservation.client?.nombre || primaryReservation.user?.name || 'Huesped'} (${primaryReservation.status})`
    : 'Sin huesped asignado';

  return {
    room: roomLabel,
    date: dateLabel,
    status: visibleStatus,
    housekeepingStatus: room.housekeepingState || 'UNKNOWN',
    guest: reservationLabel,
    conflicts: conflicts.map((conflict) => conflict.message),
    events: timelineEvents.map((event) => ({
      type: event.type,
      at: event.start ? event.start.toISOString() : null,
      detail: event.detail || null
    }))
  };
}

function resolveRoomStatus(room, reservations, dayDate) {
  const dayStart = atStartOfDay(dayDate);
  const dayEnd = atEndOfDay(dayDate);

  // Las reservaciones ya vienen pre-filtradas por room desde el Map en AvailabilityEngine.
  const roomReservations = reservations;
  const timelineEvents = buildTimelineEvents(room, roomReservations, dayStart, dayEnd);
  const conflicts = detectConflicts(room, roomReservations, timelineEvents, dayStart, dayEnd);

  const hourSlots = buildHourSlots(dayStart);
  const hourly = hourSlots.map(({ hour, slotStart, slotEnd }) => {
    const activeStatuses = [];

    timelineEvents.forEach((event) => {
      const evStart = event.start instanceof Date ? event.start.getTime() : event.start;
      const evEnd   = event.end   instanceof Date ? event.end.getTime()   : event.end;
      if (evStart !== evEnd) {
        if (overlapsRange(evStart, evEnd, slotStart, slotEnd)) activeStatuses.push(event.status);
      } else {
        if (evStart >= slotStart && evStart < slotEnd) activeStatuses.push(event.status);
      }
    });

    const resolved = pickVisibleStatus(activeStatuses, []);
    return {
      hour,
      status: resolved,
      activeStatuses
    };
  });

  const hourlyStatuses = hourly.map((item) => item.status);
  const visibleStatus = pickVisibleStatus(hourlyStatuses, conflicts);

  const primaryReservation = roomReservations
    .filter((reservation) => {
      const checkIn = toDate(reservation.checkIn);
      const checkOut = toDate(reservation.checkOut);
      return checkIn && checkOut && overlapsRange(checkIn, checkOut, dayStart, dayEnd);
    })
    .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0] || null;

  const tooltip = buildTooltip(room, dayStart, visibleStatus, conflicts, primaryReservation, timelineEvents);

  return {
    status: visibleStatus,
    color: STATUS_COLOR[visibleStatus] || STATUS_COLOR.disponible,
    priority: STATUS_PRIORITY[visibleStatus] || 0,
    tooltip,
    conflicts,
    events: timelineEvents.map((event) => ({
      type: event.type,
      status: event.status,
      start: event.start ? event.start.toISOString() : null,
      end: event.end ? event.end.toISOString() : null,
      reservationId: event.reservationId || null,
      detail: event.detail || null
    })),
    hourly,
    reservation: primaryReservation
      ? {
          id: primaryReservation._id,
          guestName: primaryReservation.user
            ? primaryReservation.user.name
            : `${primaryReservation.client?.nombre || ''} ${primaryReservation.client?.apellido || ''}`.trim(),
          email: primaryReservation.client?.email || primaryReservation.user?.email || '',
          checkIn: primaryReservation.checkIn,
          checkOut: primaryReservation.checkOut,
          status: primaryReservation.status
        }
      : null
  };
}

module.exports = {
  STATUS_PRIORITY,
  resolveRoomStatus
};
