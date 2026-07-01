// services/availabilityEngine.js
// Motor de disponibilidad — fuente de verdad única basada en resolución horaria.

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const { buildModeQuery } = require('./appModeService');
const { resolveRoomStatus } = require('./roomStatusResolutionService');

class AvailabilityEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10s
  }

  /**
   * Obtiene disponibilidad de habitaciones para un rango de fechas.
   * Usado por: roomController.getRoomsStatus (endpoint principal del calendario)
   */
  async getRoomsAvailability(startDate, endDate, mode = 'production') {
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 14;
    return this.getRoomStatus(startDate, days, { mode });
  }

  /**
   * Obtiene estado día-a-día de habitaciones (formato legacy).
   * Usado por: roomController.getRoomStatus
   */
  async getRoomStatus(startDate, days = 14, options = {}) {
    const debugRoomNumber = Number.isInteger(options.debugRoomNumber) ? options.debugRoomNumber : null;
    const mode = options.mode || 'production';
    const cacheKey = `status-${startDate}-${days}-${debugRoomNumber || 'all'}-${mode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const startUTC = new Date(startDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    const endUTC = new Date(startUTC);
    endUTC.setUTCDate(endUTC.getUTCDate() + days);

    const modeQuery = buildModeQuery(mode);

    const [rooms, reservations] = await Promise.all([
      Room.find(modeQuery).sort({ number: 1 }).lean(),
      Reservation.find({
        ...modeQuery,
        status: { $ne: 'cancelada' },
        checkIn: { $lt: endUTC },
        checkOut: { $gt: startUTC }
      }).populate('client', 'nombre apellido email').lean()
    ]);

    // Índice O(1): roomId → reservaciones (evita O(n²) filter por habitación)
    const reservationsByRoom = new Map();
    for (const r of reservations) {
      if (!r.room) continue;
      const roomIds = Array.isArray(r.room) ? r.room : [r.room];
      for (const rid of roomIds) {
        const key = rid.toString();
        if (!reservationsByRoom.has(key)) reservationsByRoom.set(key, []);
        reservationsByRoom.get(key).push(r);
      }
    }

    const status = rooms.map(room => {
      const roomReservations = reservationsByRoom.get(room._id.toString()) || [];

      const dates = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startUTC);
        date.setUTCDate(startUTC.getUTCDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const resolved = resolveRoomStatus(room, roomReservations, date);

        const dayEntry = {
          date: dateStr,
          status: resolved.status,
          color: resolved.color,
          priority: resolved.priority,
          tooltip: resolved.tooltip,
          reservationStatus: resolved.reservation ? resolved.reservation.status : null,
          reservation: resolved.reservation,
          conflicts: resolved.conflicts,
          events: resolved.events,
          hourly: resolved.hourly,
          checkoutToday: room.checkoutToday && dateStr === new Date().toISOString().split('T')[0],
          checkoutInfo: room.checkoutInfo,
          maintenanceInfo: room.currentMaintenance ? {
            reason: room.currentMaintenance.reason || 'Mantenimiento programado',
            startDate: room.currentMaintenance.startDate,
            endDate: room.currentMaintenance.estimatedEndDate
          } : null,
          housekeepingAssignment: room.housekeepingAssignment
        };

        if (debugRoomNumber && room.number === debugRoomNumber) {
          dayEntry.debugReason = resolved.conflicts.length > 0
            ? 'conflict_detected'
            : `resolved_${resolved.status}`;
        }

        dates.push(dayEntry);
      }

      return {
        roomId: room._id,
        roomNumber: room.number,
        roomType: room.type,
        roomStatus: room.status,
        housekeepingState: room.housekeepingState,
        dates
      };
    });

    this.cache.set(cacheKey, { data: status, timestamp: Date.now() });
    return status;
  }

  invalidateCache() {
    this.cache.clear();
  }
}

module.exports = new AvailabilityEngine();
