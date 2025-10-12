// controllers/reportController.js
// Controlador para generación de reportes en Excel
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ExcelJS = require('exceljs');

// Reporte de ocupación por rango de fechas, tipo y piso
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
