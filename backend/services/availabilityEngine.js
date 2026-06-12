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
        
        // Mantenimiento: SOLO si está dentro de la ventana con fechas válidas
        // NO marcar indefinidamente si solo tiene status='mantenimiento' sin fechas
        const isWithinMaintenanceWindow =
          maintenanceStart &&
          maintenanceEnd &&
          date >= maintenanceStart &&
          date <= maintenanceEnd;

        // Si existe una ventana de mantenimiento VÁLIDA (con fechas), usa ese status
        if (isWithinMaintenanceWindow) {
          const dayEntry = {
            date: dateStr,
            status: 'mantenimiento',
            reservation: null,
            maintenanceInfo: {
              reason: room.currentMaintenance?.reason || 'Mantenimiento programado',
              startDate: room.currentMaintenance?.startDate,
              endDate: room.currentMaintenance?.estimatedEndDate
            }
          };
          if (debugRoomNumber && room.number === debugRoomNumber) {
            dayEntry.debugReason = 'maintenance_window_active';
          }
          dates.push(dayEntry);
          continue;
        }

        const resOnDate = roomReservations.find(r =>
          new Date(r.checkIn) <= date && new Date(r.checkOut) > date
        );

        // Resolver estado con lógica clara:
        // Prioridad: limpieza > checkout_hoy > ocupada > reservada (próxima) > disponible > fuera_de_servicio
        let resolvedStatus = 'available';
        let reservationStatus = null;
        
        if (room.status === 'limpieza') {
          resolvedStatus = 'limpieza';
        } else if (room.status === 'fuera_de_servicio') {
          resolvedStatus = 'fuera_de_servicio';
        } else if (room.checkoutToday && dateStr === new Date().toISOString().split('T')[0]) {
          resolvedStatus = 'checkout_hoy';
        } else if (resOnDate) {
          // Si hay reserva, mostrar su estado (checkin, checkout, confirmada, etc)
          reservationStatus = resOnDate.status;
          resolvedStatus = resOnDate.status === 'checkin' ? 'ocupada' : resOnDate.status;
        } else if (roomReservations.some(r => new Date(r.checkIn) > date && new Date(r.checkIn) <= date.getTime() + 86400000)) {
          // Si hay una reserva que comienza mañana o próximamente, marcar como "reservada"
          resolvedStatus = 'reservada';
        } else if (room.status === 'disponible') {
          resolvedStatus = 'available';
        }

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
          // Agregar checkout info si existe
          checkoutToday: room.checkoutToday && dateStr === new Date().toISOString().split('T')[0],
          checkoutInfo: room.checkoutInfo,
          housekeepingAssignment: room.housekeepingAssignment
        };

        if (debugRoomNumber && room.number === debugRoomNumber) {
          dayEntry.debugReason = resOnDate
            ? `reservation_${resOnDate.status || 'unknown'}`
            : 'available_default';
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
