// services/ReservationService.js
// Servicio para manejar la lógica de reservas

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const { logger } = require('../config/logger');

class ReservationService {
  static async createReservation(data) {
    try {
      const reservation = new Reservation(data);
      await reservation.save();
      logger.info(`Reserva creada: ${reservation._id}`);
      return reservation;
    } catch (error) {
      logger.error('Error al crear reserva:', error);
      throw error;
    }
  }

  static async updateReservation(id, data) {
    try {
      const reservation = await Reservation.findByIdAndUpdate(id, data, { new: true });
      if (!reservation) {
        throw new Error('Reserva no encontrada');
      }
      logger.info(`Reserva actualizada: ${reservation._id}`);
      return reservation;
    } catch (error) {
      logger.error('Error al actualizar reserva:', error);
      throw error;
    }
  }

  static async deleteReservation(id) {
    try {
      const reservation = await Reservation.findByIdAndDelete(id);
      if (!reservation) {
        throw new Error('Reserva no encontrada');
      }
      logger.info(`Reserva eliminada: ${reservation._id}`);
      return reservation;
    } catch (error) {
      logger.error('Error al eliminar reserva:', error);
      throw error;
    }
  }

  static async findReservationsByDateRange(startDate, endDate) {
    try {
      const reservations = await Reservation.find({
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate },
      });
      return reservations;
    } catch (error) {
      logger.error('Error al buscar reservas por rango de fechas:', error);
      throw error;
    }
  }
}

module.exports = ReservationService;