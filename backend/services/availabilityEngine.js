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
    this.statusPriority = {
      fuera_de_servicio: 100,
      mantenimiento: 90,
      conflicto: 85,
      checkout_hoy: 80,
      limpieza: 70,
      checkin: 60,
      ocupada: 50,
      reservada: 40,
      available: 10
    };
  }

  resolveStatus(candidates = []) {
    if (!Array.isArray(candidates) || candidates.length === 0) return 'available';
    return candidates.sort((a, b) => {
      const pa = this.statusPriority[a] || 0;
      const pb = this.statusPriority[b] || 0;
      return pb - pa;
    })[0];
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

    const rooms = await Room.find().sort({ number: 1 }).lean();
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
  async getRoomStatus(startDate, days = 14, options = {}) {
    const debugRoomNumber = Number.isInteger(options.debugRoomNumber) ? options.debugRoomNumber : null;
    const cacheKey = `status-${startDate}-${days}-${debugRoomNumber || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const startUTC = new Date(startDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    const endUTC = new Date(startUTC);
    endUTC.setUTCDate(endUTC.getUTCDate() + days);

    const rooms = await Room.find().sort({ number: 1 }).lean();
    const reservations = await Reservation.find({
      status: { $ne: 'cancelada' },
      checkIn: { $lt: endUTC },
      checkOut: { $gt: startUTC }
    }).populate('user', 'name email').populate('client', 'nombre apellido email').lean();

    const status = rooms.map(room => {
      const roomReservations = reservations.filter(r => {
        if (!r.room) return false;
        const roomIds = Array.isArray(r.room) ? r.room : [r.room];
        return roomIds.some(rid => rid && rid.toString() === room._id.toString());
      });

      const maintenanceStart = room.currentMaintenance?.startDate ? new Date(room.currentMaintenance.startDate) : null;
      const maintenanceEnd = room.currentMaintenance?.estimatedEndDate ? new Date(room.currentMaintenance.estimatedEndDate) : null;
      if (maintenanceStart) maintenanceStart.setUTCHours(0, 0, 0, 0);
      if (maintenanceEnd) maintenanceEnd.setUTCHours(23, 59, 59, 999);

      const dates = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startUTC);
        date.setUTCDate(startUTC.getUTCDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const candidates = [];

        if (room.status === 'fuera_de_servicio') {
          candidates.push('fuera_de_servicio');
        }

        const isWithinMaintenanceWindow =
          maintenanceStart &&
          maintenanceEnd &&
          date >= maintenanceStart &&
          date <= maintenanceEnd;

        if (isWithinMaintenanceWindow) {
          candidates.push('mantenimiento');
        }

        const reservationsToday = roomReservations.filter(r => {
          const resCheckInStr = new Date(r.checkIn).toISOString().split('T')[0];
          const resCheckOutStr = new Date(r.checkOut).toISOString().split('T')[0];
          return resCheckInStr <= dateStr && resCheckOutStr > dateStr;
        });

        const checkinsToday = roomReservations.filter(r =>
          new Date(r.checkIn).toISOString().split('T')[0] === dateStr
        );

        const checkoutsToday = roomReservations.filter(r =>
          new Date(r.checkOut).toISOString().split('T')[0] === dateStr
        );

        const hasConflict = reservationsToday.length > 1;
        if (hasConflict) {
          candidates.push('conflicto');
        }

        const resOnDate = reservationsToday[0] || null;

        // Verificar si la limpieza está en este día específico
        // La limpieza solo se muestra si está dentro de startTime y endTime
        const cleaningStart = room.housekeepingAssignment?.startTime ? new Date(room.housekeepingAssignment.startTime) : null;
        const cleaningEnd = room.housekeepingAssignment?.endTime ? new Date(room.housekeepingAssignment.endTime) : null;
        
        // Para limpieza: solo mostrar si está en este día y dentro de horario
        const cleaningStartStr = cleaningStart ? cleaningStart.toISOString().split('T')[0] : null;
        const cleaningEndStr = cleaningEnd ? cleaningEnd.toISOString().split('T')[0] : null;
        const isCleaningToday = cleaningStartStr && cleaningEndStr && 
          dateStr >= cleaningStartStr && dateStr < cleaningEndStr ||
          (cleaningStartStr && cleaningEndStr && dateStr === cleaningStartStr);

        if (isCleaningToday && room.housekeepingAssignment?.status === 'en_progreso') {
          candidates.push('limpieza');
        }

        if (checkoutsToday.length > 0) {
          candidates.push('checkout_hoy');
        }

        if (checkinsToday.length > 0) {
          candidates.push('checkin');
        }

        const hasCheckedInGuest = reservationsToday.some(r => r.status === 'checkin');
        if (hasCheckedInGuest) {
          candidates.push('ocupada');
        }

        const hasReservedWindow = reservationsToday.some(r => r.status === 'reservada' || r.status === 'confirmada');
        if (hasReservedWindow) {
          candidates.push('reservada');
        }

        const resolvedStatus = this.resolveStatus(candidates);
        const reservationStatus = resOnDate ? resOnDate.status : null;

        const dayEntry = {
          date: dateStr,
          status: resolvedStatus,
          reservationStatus: reservationStatus,
          reservation: resOnDate ? {
            id: resOnDate._id,
            guestName: resOnDate.user ? resOnDate.user.name : (resOnDate.client?.nombre || 'Huésped'),
            email: resOnDate.client?.email || '',
            checkIn: resOnDate.checkIn,
            checkOut: resOnDate.checkOut,
            status: resOnDate.status
          } : null,
          conflicts: hasConflict
            ? reservationsToday.map(r => ({
                id: r._id,
                status: r.status,
                checkIn: r.checkIn,
                checkOut: r.checkOut
              }))
            : [],
          // Agregar checkout info si existe
          checkoutToday: room.checkoutToday && dateStr === new Date().toISOString().split('T')[0],
          checkoutInfo: room.checkoutInfo,
          maintenanceInfo: isWithinMaintenanceWindow ? {
            reason: room.currentMaintenance?.reason || 'Mantenimiento programado',
            startDate: room.currentMaintenance?.startDate,
            endDate: room.currentMaintenance?.estimatedEndDate
          } : null,
          housekeepingAssignment: room.housekeepingAssignment
        };

        if (debugRoomNumber && room.number === debugRoomNumber) {
          dayEntry.debugReason =
            resolvedStatus === 'conflicto' ? 'overbooking_conflict' :
            resolvedStatus === 'mantenimiento' ? 'maintenance_window_active' :
            resolvedStatus === 'checkout_hoy' ? 'checkout_today' :
            resolvedStatus === 'checkin' ? 'checkin_today' :
            resolvedStatus === 'limpieza' ? 'housekeeping_in_progress' :
            resOnDate ? `reservation_${resOnDate.status || 'unknown'}` :
            'available_default';
        }

        dates.push(dayEntry);
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
