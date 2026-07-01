const { EVENT_TYPES } = require('../models/eventTypes');
const { formatInTimeZone, fromZonedTime } = require('date-fns-tz');

const STATE_PRIORITY = {
  OUT_OF_ORDER: 100,
  MAINTENANCE: 90,
  CHECKOUT: 70,
  CHECKIN: 60,
  OCCUPIED: 50,
  RESERVED: 40,
  CLEANING: 30,
  FREE: 10
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = process.env.HOTEL_TIMEZONE || 'UTC';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map((v) => Number(v));
  return { year, month, day };
}

function toDateKeyFromParts(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDaysToDateKey(dateKey, days) {
  const { year, month, day } = parseDateKey(dateKey);
  const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const moved = new Date(base.getTime() + days * DAY_MS);
  return toDateKeyFromParts(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate()
  );
}

function iterateDateKeys(startDateKey, endDateKey) {
  const keys = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return keys;
}

function normalizeDateKey(value, timeZone = DEFAULT_TIMEZONE) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const d = value instanceof Date ? value : new Date(value);
  return formatInTimeZone(d, timeZone, 'yyyy-MM-dd');
}

function toRoomId(event) {
  if (!event || !event.roomId) return '';
  if (typeof event.roomId === 'string') return event.roomId;
  if (event.roomId._id) return String(event.roomId._id);
  return String(event.roomId);
}

function toReservationId(event) {
  if (!event || !event.reservationId) return null;
  if (typeof event.reservationId === 'string') return event.reservationId;
  if (event.reservationId._id) return String(event.reservationId._id);
  return String(event.reservationId);
}

function normalizeEvent(event) {
  return {
    id: event.id || event._id || `${toRoomId(event)}-${event.type}-${new Date(event.timestamp).getTime()}`,
    roomId: toRoomId(event),
    reservationId: toReservationId(event),
    type: event.type,
    timestamp: new Date(event.timestamp),
    metadata: event.metadata || {}
  };
}

function getHourBounds(dateKey, hour, timeZone) {
  const start = fromZonedTime(`${dateKey} ${pad2(hour)}:00:00`, timeZone);

  let endDateKey = dateKey;
  let endHour = hour + 1;
  if (endHour >= 24) {
    endHour = 0;
    endDateKey = addDaysToDateKey(dateKey, 1);
  }

  const end = fromZonedTime(`${endDateKey} ${pad2(endHour)}:00:00`, timeZone);
  return { start, end };
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function resolveDominantStatus(states) {
  if (!states || states.length === 0) return 'FREE';

  let dominant = 'FREE';
  let maxPriority = STATE_PRIORITY.FREE;

  for (let i = 0; i < states.length; i += 1) {
    const state = states[i];
    const p = STATE_PRIORITY[state] || 0;
    if (p > maxPriority) {
      maxPriority = p;
      dominant = state;
    }
  }

  return dominant;
}

class EventMatrixService {
  constructor({ timeZone = DEFAULT_TIMEZONE } = {}) {
    this.timeZone = timeZone;
    this.events = [];
    this.cache = new Map();
    this.eventsByRoom = new Map();
    this.eventsByDate = new Map();
    this.eventsByRoomAndDate = new Map();
    this.cacheStats = { hits: 0, misses: 0, invalidations: 0 };
  }

  setEvents(events = []) {
    this.events = events.map(normalizeEvent);
    this.events.sort((a, b) => a.timestamp - b.timestamp);
    this._rebuildIndexes();
    this.cache.clear();
  }

  receiveEvents(events = []) {
    if (!events.length) return;

    const normalized = events.map(normalizeEvent);
    const affectedKeys = this._collectAffectedCacheKeys(normalized);

    for (let i = 0; i < normalized.length; i += 1) {
      this.events.push(normalized[i]);
    }

    this.events.sort((a, b) => a.timestamp - b.timestamp);
    this._rebuildIndexes();
    this._invalidateCacheKeys(affectedKeys);
  }

  _rebuildIndexes() {
    this.eventsByRoom = new Map();
    this.eventsByDate = new Map();
    this.eventsByRoomAndDate = new Map();

    for (let i = 0; i < this.events.length; i += 1) {
      const event = this.events[i];
      const roomId = event.roomId;
      const dateKey = normalizeDateKey(event.timestamp, this.timeZone);
      const roomDateKey = `${roomId}|${dateKey}`;

      if (!this.eventsByRoom.has(roomId)) this.eventsByRoom.set(roomId, []);
      this.eventsByRoom.get(roomId).push(event);

      if (!this.eventsByDate.has(dateKey)) this.eventsByDate.set(dateKey, []);
      this.eventsByDate.get(dateKey).push(event);

      if (!this.eventsByRoomAndDate.has(roomDateKey)) this.eventsByRoomAndDate.set(roomDateKey, []);
      this.eventsByRoomAndDate.get(roomDateKey).push(event);
    }
  }

  _collectAffectedCacheKeys(events) {
    const keys = new Set();

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      const roomId = event.roomId;
      const dateKey = normalizeDateKey(event.timestamp, this.timeZone);
      keys.add(`${roomId}|${dateKey}`);

      const checkIn = event.metadata && event.metadata.checkIn ? new Date(event.metadata.checkIn) : null;
      const checkOut = event.metadata && event.metadata.checkOut ? new Date(event.metadata.checkOut) : null;

      if (checkIn && checkOut && !Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime())) {
        const startDateKey = normalizeDateKey(checkIn, this.timeZone);
        const endDateKey = normalizeDateKey(checkOut, this.timeZone);
        const impactedDateKeys = iterateDateKeys(startDateKey, endDateKey);
        for (let j = 0; j < impactedDateKeys.length; j += 1) {
          keys.add(`${roomId}|${impactedDateKeys[j]}`);
        }
      }
    }

    return keys;
  }

  _invalidateCacheKeys(keys) {
    if (!keys || keys.size === 0) return;

    keys.forEach((key) => {
      if (this.cache.delete(key)) this.cacheStats.invalidations += 1;
    });
  }

  getIndexSnapshot() {
    return {
      eventsByRoomSize: this.eventsByRoom.size,
      eventsByDateSize: this.eventsByDate.size,
      eventsByRoomAndDateSize: this.eventsByRoomAndDate.size
    };
  }

  getCacheStats() {
    return { ...this.cacheStats, size: this.cache.size };
  }

  _buildRoomContext(roomId) {
    const roomEvents = this.eventsByRoom.get(roomId) || [];

    const reservationWindows = new Map();
    const checkinStarts = new Map();
    const checkoutAt = new Map();

    let maintenanceRanges = [];
    let cleaningRanges = [];
    let outOfOrderRanges = [];

    const activeRangeByType = {
      [EVENT_TYPES.MAINTENANCE_START]: null,
      [EVENT_TYPES.CLEANING_START]: null,
      [EVENT_TYPES.OUT_OF_ORDER_START]: null,
      [EVENT_TYPES.ROOM_BLOCK_START]: null
    };

    for (let i = 0; i < roomEvents.length; i += 1) {
      const event = roomEvents[i];
      const reservationId = event.reservationId;

      if (
        (event.type === EVENT_TYPES.RESERVATION_CREATED || event.type === EVENT_TYPES.RESERVATION_MODIFIED) &&
        reservationId &&
        event.metadata &&
        event.metadata.checkIn &&
        event.metadata.checkOut
      ) {
        reservationWindows.set(reservationId, {
          start: new Date(event.metadata.checkIn),
          end: new Date(event.metadata.checkOut)
        });
      }

      if (event.type === EVENT_TYPES.RESERVATION_CANCELLED && reservationId) {
        reservationWindows.delete(reservationId);
        checkinStarts.delete(reservationId);
        checkoutAt.delete(reservationId);
      }

      if (event.type === EVENT_TYPES.CHECKIN && reservationId) {
        checkinStarts.set(reservationId, new Date(event.timestamp));
      }

      if (event.type === EVENT_TYPES.CHECKOUT && reservationId) {
        checkoutAt.set(reservationId, new Date(event.timestamp));
      }

      if (event.type === EVENT_TYPES.MAINTENANCE_START) activeRangeByType[EVENT_TYPES.MAINTENANCE_START] = new Date(event.timestamp);
      if (event.type === EVENT_TYPES.MAINTENANCE_END && activeRangeByType[EVENT_TYPES.MAINTENANCE_START]) {
        maintenanceRanges.push({ start: activeRangeByType[EVENT_TYPES.MAINTENANCE_START], end: new Date(event.timestamp) });
        activeRangeByType[EVENT_TYPES.MAINTENANCE_START] = null;
      }

      if (event.type === EVENT_TYPES.CLEANING_START) activeRangeByType[EVENT_TYPES.CLEANING_START] = new Date(event.timestamp);
      if (event.type === EVENT_TYPES.CLEANING_END && activeRangeByType[EVENT_TYPES.CLEANING_START]) {
        cleaningRanges.push({ start: activeRangeByType[EVENT_TYPES.CLEANING_START], end: new Date(event.timestamp) });
        activeRangeByType[EVENT_TYPES.CLEANING_START] = null;
      }

      if (event.type === EVENT_TYPES.OUT_OF_ORDER_START || event.type === EVENT_TYPES.ROOM_BLOCK_START) {
        activeRangeByType[event.type] = new Date(event.timestamp);
      }
      if (event.type === EVENT_TYPES.OUT_OF_ORDER_END && activeRangeByType[EVENT_TYPES.OUT_OF_ORDER_START]) {
        outOfOrderRanges.push({ start: activeRangeByType[EVENT_TYPES.OUT_OF_ORDER_START], end: new Date(event.timestamp) });
        activeRangeByType[EVENT_TYPES.OUT_OF_ORDER_START] = null;
      }
      if (event.type === EVENT_TYPES.ROOM_BLOCK_END && activeRangeByType[EVENT_TYPES.ROOM_BLOCK_START]) {
        outOfOrderRanges.push({ start: activeRangeByType[EVENT_TYPES.ROOM_BLOCK_START], end: new Date(event.timestamp) });
        activeRangeByType[EVENT_TYPES.ROOM_BLOCK_START] = null;
      }
    }

    if (activeRangeByType[EVENT_TYPES.MAINTENANCE_START]) {
      maintenanceRanges.push({ start: activeRangeByType[EVENT_TYPES.MAINTENANCE_START], end: new Date('2999-12-31T23:59:59.999Z') });
    }
    if (activeRangeByType[EVENT_TYPES.CLEANING_START]) {
      cleaningRanges.push({ start: activeRangeByType[EVENT_TYPES.CLEANING_START], end: new Date('2999-12-31T23:59:59.999Z') });
    }
    if (activeRangeByType[EVENT_TYPES.OUT_OF_ORDER_START]) {
      outOfOrderRanges.push({ start: activeRangeByType[EVENT_TYPES.OUT_OF_ORDER_START], end: new Date('2999-12-31T23:59:59.999Z') });
    }
    if (activeRangeByType[EVENT_TYPES.ROOM_BLOCK_START]) {
      outOfOrderRanges.push({ start: activeRangeByType[EVENT_TYPES.ROOM_BLOCK_START], end: new Date('2999-12-31T23:59:59.999Z') });
    }

    return {
      roomEvents,
      reservationWindows,
      checkinStarts,
      checkoutAt,
      maintenanceRanges,
      cleaningRanges,
      outOfOrderRanges
    };
  }

  buildDayTimeline(roomId, date) {
    const dateKey = normalizeDateKey(date, this.timeZone);
    const cacheKey = `${roomId}|${dateKey}`;

    if (this.cache.has(cacheKey)) {
      this.cacheStats.hits += 1;
      return this.cache.get(cacheKey);
    }

    this.cacheStats.misses += 1;

    const context = this._buildRoomContext(roomId);
    const timeline = [];

    for (let hour = 0; hour < 24; hour += 1) {
      const { start, end } = getHourBounds(dateKey, hour, this.timeZone);
      const states = ['FREE'];

      for (let i = 0; i < context.outOfOrderRanges.length; i += 1) {
        const range = context.outOfOrderRanges[i];
        if (rangesOverlap(start, end, range.start, range.end)) states.push('OUT_OF_ORDER');
      }

      for (let i = 0; i < context.maintenanceRanges.length; i += 1) {
        const range = context.maintenanceRanges[i];
        if (rangesOverlap(start, end, range.start, range.end)) states.push('MAINTENANCE');
      }

      for (let i = 0; i < context.cleaningRanges.length; i += 1) {
        const range = context.cleaningRanges[i];
        if (rangesOverlap(start, end, range.start, range.end)) states.push('CLEANING');
      }

      context.reservationWindows.forEach((window) => {
        if (window && rangesOverlap(start, end, window.start, window.end)) states.push('RESERVED');
      });

      context.checkinStarts.forEach((checkinAt, reservationId) => {
        if (checkinAt >= start && checkinAt < end) states.push('CHECKIN');

        const checkoutAt = context.checkoutAt.get(reservationId);
        const occupancyEnd = checkoutAt || new Date('2999-12-31T23:59:59.999Z');
        if (rangesOverlap(start, end, checkinAt, occupancyEnd)) states.push('OCCUPIED');
      });

      context.checkoutAt.forEach((checkoutAt) => {
        if (checkoutAt >= start && checkoutAt < end) states.push('CHECKOUT');
      });

      timeline.push({
        hour,
        state: resolveDominantStatus(states)
      });
    }

    this.cache.set(cacheKey, timeline);
    return timeline;
  }
}

module.exports = {
  EventMatrixService,
  STATE_PRIORITY,
  resolveDominantStatus,
  normalizeDateKey,
  DEFAULT_TIMEZONE
};