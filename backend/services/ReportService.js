// services/ReportService.js
// Servicio para generar reportes avanzados

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const { logger } = require('../config/logger');

class ReportService {
  /**
   * Generar reporte de ocupación por rango de fechas
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Object} - Datos del reporte
   */
  static async generateOccupancyReport(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            checkIn: { $lt: endDate },
            checkOut: { $gt: startDate },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalReservations: { $sum: 1 },
            totalRooms: { $sum: { $size: '$room' } },
          },
        },
      ];

      const [result] = await Reservation.aggregate(pipeline);
      return result || { totalReservations: 0, totalRooms: 0 };
    } catch (error) {
      logger.error('Error al generar reporte de ocupación:', error);
      throw error;
    }
  }

  static async generateRevenueReport(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            checkIn: { $lt: endDate },
            checkOut: { $gt: startDate },
            status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' },
            totalReservations: { $sum: 1 },
            avgRevenuePerReservation: { $avg: '$price' },
          },
        },
      ];

      const [result] = await Reservation.aggregate(pipeline);
      return result || { totalRevenue: 0, totalReservations: 0, avgRevenuePerReservation: 0 };
    } catch (error) {
      logger.error('Error al generar reporte de ingresos:', error);
      throw error;
    }
  }

  static async generateCancellationReport(startDate, endDate) {
    try {
      const cancelledReservations = await Reservation.find({
        status: 'cancelled',
        updatedAt: { $gte: startDate, $lte: endDate },
      });

      return { totalCancellations: cancelledReservations.length };
    } catch (error) {
      logger.error('Error al generar reporte de cancelaciones:', error);
      throw error;
    }
  }
}

module.exports = ReportService;