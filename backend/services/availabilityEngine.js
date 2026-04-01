// services/availabilityEngine.js
// Motor de disponibilidad — delega cálculo de estados a AvailabilityService (fuente de verdad)

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const { calculateRoomStates } = require('./AvailabilityService');
const { logger } = require('./loggerService');

class AvailabilityEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10s
  }

  /**
   * Obtiene disponibilidad de habitaciones para un rango de fechas.
   * Usado por: roomController.getRoomsStatus (endpoint principal del calendario)
   */
  async getRoomsAvailability(startDate, endDate) {
    const cacheKey = `avail-${startDate}-${endDate}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const rooms = await Room.find({ active: true }).sort({ number: 1 }).lean();
    const reservations = await Reservation.find({
      status: { $ne: 'cancelada' },
      checkIn: { $lt: endDate },
      checkOut: { $gt: startDate }
    }).lean();

    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 14;

    const data = calculateRoomStates(rooms, reservations, startDate, days);

    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Obtiene estado día-a-día de habitaciones (formato legacy).
   * Usado por: roomController.getRoomStatus
   */
  async getRoomStatus(startDate, days = 14) {
    const cacheKey = `status-${startDate}-${days}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const startUTC = new Date(startDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    const endUTC = new Date(startUTC);
    endUTC.setUTCDate(endUTC.getUTCDate() + days);

    const rooms = await Room.find({ active: true }).sort({ number: 1 }).lean();
    const reservations = await Reservation.find({
      status: { $ne: 'cancelada' },
      checkIn: { $lt: endUTC },
      checkOut: { $gt: startUTC }
    }).populate('user', 'name email').lean();

    const status = rooms.map(room => {
      const roomReservations = reservations.filter(r => {
        if (!r.room) return false;
        const roomIds = Array.isArray(r.room) ? r.room : [r.room];
        return roomIds.some(rid => rid && rid.toString() === room._id.toString());
      });

      const dates = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startUTC);
        date.setUTCDate(startUTC.getUTCDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const resOnDate = roomReservations.find(r =>
          new Date(r.checkIn) <= date && new Date(r.checkOut) > date
        );
        dates.push({
          date: dateStr,
          status: resOnDate ? resOnDate.status : 'available',
          reservation: resOnDate ? {
            id: resOnDate._id,
            user: resOnDate.user ? resOnDate.user.name : resOnDate.name,
            email: resOnDate.email
          } : null
        });
      }
      return {
        roomId: room._id,
        roomNumber: room.number,
        roomType: room.type,
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
