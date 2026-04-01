// controllers/reportController.js
// Controlador para generaciÃ³n de reportes en Excel
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ExcelJS = require('exceljs');
const ReportService = require('../services/ReportService');
const { logger } = require('../services/loggerService');

// Reporte de ocupaciÃ³n por rango de fechas, tipo y piso
exports.occupancyReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Debe indicar rango de fechas (start, end)' });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    // Traer habitaciones y reservas en el rango
    const rooms = await Room.find();
    const reservations = await Reservation.find({
      $or: [
        { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } },
        { checkIn: { $gte: startDate, $lte: endDate } },
        { checkOut: { $gte: startDate, $lte: endDate } }
      ]
    });
    // Agrupar por tipo y piso
    const summary = {};
    rooms.forEach(room => {
      const key = `${room.type}|${room.floor}`;
      if (!summary[key]) summary[key] = { tipo: room.type, piso: room.floor, total: 0, ocupadas: 0 };
      summary[key].total++;
    });
    reservations.forEach(res => {
      const room = rooms.find(r => r._id.equals(res.room));
      if (room) {
        const key = `${room.type}|${room.floor}`;
        if (summary[key]) summary[key].ocupadas++;
      }
    });
    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ocupacion');
    sheet.columns = [
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Piso', key: 'piso', width: 10 },
      { header: 'Habitaciones Totales', key: 'total', width: 20 },
      { header: 'Habitaciones Ocupadas', key: 'ocupadas', width: 22 }
    ];
    Object.values(summary).forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ocupacion.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Error generando reporte', error: err.message });
  }
};

/**
 * Obtener reporte de ocupaciÃ³n por rango de fechas
 * @route GET /api/reports/occupancy
 */
exports.getOccupancyReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const report = await ReportService.generateOccupancyReport(new Date(startDate), new Date(endDate));
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRevenueReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Debe proporcionar las fechas de inicio y fin.' });
    }

    const report = await ReportService.generateRevenueReport(new Date(startDate), new Date(endDate));
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error al generar el reporte de ingresos.', error: error.message });
  }
};

exports.getCancellationReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const report = await ReportService.generateCancellationReport(new Date(startDate), new Date(endDate));
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reporte de ingresos por rango de fechas
exports.revenueReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validar parÃ¡metros
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Debe proporcionar startDate y endDate en formato YYYY-MM-DD.'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({
        message: 'Las fechas son invÃ¡lidas o startDate es mayor que endDate.'
      });
    }

    // Consultar reservas confirmadas dentro del rango
    const confirmedReservations = await Reservation.find({
      status: 'confirmada',
      checkIn: { $lt: end },
      checkOut: { $gt: start }
    }).lean();

    // Calcular ingresos totales
    const totalRevenue = confirmedReservations.reduce((sum, reservation) => {
      return sum + (reservation.totalPrice || 0);
    }, 0);

    // Responder con el total
    res.json({
      total: totalRevenue,
      currency: 'ARS',
      startDate: startDate,
      endDate: endDate
    });
  } catch (error) {
    logger.error('Error en revenueReport:', error);
    res.status(500).json({
      message: 'Error al generar el reporte de ingresos.',
      error: error.message
    });
  }
};
