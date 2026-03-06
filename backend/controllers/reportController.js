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

// Reporte financiero: ingresos, pagos por método y cargos extra
exports.financialReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'Debe indicar rango de fechas (start, end)' });

    const startDate = new Date(start);
    const endDate   = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const reservations = await Reservation.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelada' }
    }).populate('client', 'nombre apellido dni').lean();

    const workbook  = new ExcelJS.Workbook();
    workbook.creator = 'PMS2';

    // ── Hoja 1: Resumen general ──────────────────────────────────────────────
    const sheetResumen = workbook.addWorksheet('Resumen');
    sheetResumen.columns = [
      { header: 'Métrica', key: 'metrica', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 }
    ];
    sheetResumen.getRow(1).font = { bold: true };

    const totalAloj    = reservations.reduce((s, r) => s + (r.pricing?.subtotal || 0), 0);
    const totalExtras  = reservations.reduce((s, r) => s + (r.pricing?.extrasTotal || 0), 0);
    const totalFact    = reservations.reduce((s, r) => s + (r.pricing?.total || 0), 0);
    const totalCobrado = reservations.reduce((s, r) => s + (r.payment?.amountPaid || 0), 0);
    const totalPend    = Math.max(0, totalFact - totalCobrado);

    const byMethod = {};
    reservations.forEach(r => {
      (r.paymentHistory || []).forEach(p => {
        byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0);
      });
    });

    sheetResumen.addRow({ metrica: 'Período',            valor: `${start} al ${end}` });
    sheetResumen.addRow({ metrica: 'Reservas',           valor: reservations.length });
    sheetResumen.addRow({ metrica: 'Ingresos Alojamiento', valor: totalAloj.toFixed(2) });
    sheetResumen.addRow({ metrica: 'Ingresos Extras',    valor: totalExtras.toFixed(2) });
    sheetResumen.addRow({ metrica: 'Total Facturado',    valor: totalFact.toFixed(2) });
    sheetResumen.addRow({ metrica: 'Total Cobrado',      valor: totalCobrado.toFixed(2) });
    sheetResumen.addRow({ metrica: 'Saldo Pendiente',    valor: totalPend.toFixed(2) });
    sheetResumen.addRow({});
    sheetResumen.addRow({ metrica: '— Por método de pago —', valor: '' });
    Object.entries(byMethod).forEach(([m, v]) => {
      sheetResumen.addRow({ metrica: m.charAt(0).toUpperCase() + m.slice(1), valor: v.toFixed(2) });
    });

    // ── Hoja 2: Detalle de reservas ─────────────────────────────────────────
    const sheetDet = workbook.addWorksheet('Detalle');
    sheetDet.columns = [
      { header: 'Huésped',        key: 'huesped',   width: 28 },
      { header: 'DNI',            key: 'dni',        width: 14 },
      { header: 'Check-in',       key: 'checkin',    width: 14 },
      { header: 'Check-out',      key: 'checkout',   width: 14 },
      { header: 'Estado',         key: 'estado',     width: 14 },
      { header: 'Alojamiento',    key: 'aloj',       width: 16 },
      { header: 'Extras',         key: 'extras',     width: 14 },
      { header: 'Total',          key: 'total',      width: 14 },
      { header: 'Cobrado',        key: 'cobrado',    width: 14 },
      { header: 'Saldo',          key: 'saldo',      width: 14 },
      { header: 'Método(s)',      key: 'metodos',    width: 22 }
    ];
    sheetDet.getRow(1).font = { bold: true };
    sheetDet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };

    reservations.forEach(r => {
      const nombre   = r.client ? `${r.client.nombre} ${r.client.apellido}` : (r.nombre ? `${r.nombre} ${r.apellido}` : 'N/A');
      const methods  = [...new Set((r.paymentHistory || []).map(p => p.method))].join(', ');
      const aloj     = r.pricing?.subtotal    || 0;
      const ext      = r.pricing?.extrasTotal || 0;
      const tot      = r.pricing?.total       || 0;
      const paid     = r.payment?.amountPaid  || 0;
      const saldo    = Math.max(0, tot - paid);
      sheetDet.addRow({
        huesped:  nombre,
        dni:      r.client?.dni || '',
        checkin:  r.checkIn  ? new Date(r.checkIn).toLocaleDateString('es-AR')  : '',
        checkout: r.checkOut ? new Date(r.checkOut).toLocaleDateString('es-AR') : '',
        estado:   r.status,
        aloj:     aloj.toFixed(2),
        extras:   ext.toFixed(2),
        total:    tot.toFixed(2),
        cobrado:  paid.toFixed(2),
        saldo:    saldo.toFixed(2),
        metodos:  methods || 'N/A'
      });
    });

    // ── Hoja 3: Cargos extra detallados ─────────────────────────────────────
    const sheetExtras = workbook.addWorksheet('Cargos Extra');
    sheetExtras.columns = [
      { header: 'Huésped',     key: 'huesped',   width: 28 },
      { header: 'Fecha',       key: 'fecha',      width: 14 },
      { header: 'Descripción', key: 'desc',       width: 30 },
      { header: 'Categoría',   key: 'cat',        width: 16 },
      { header: 'Monto',       key: 'monto',      width: 14 }
    ];
    sheetExtras.getRow(1).font = { bold: true };
    reservations.forEach(r => {
      const nombre = r.client ? `${r.client.nombre} ${r.client.apellido}` : (r.nombre ? `${r.nombre} ${r.apellido}` : 'N/A');
      (r.extras || []).forEach(x => {
        sheetExtras.addRow({
          huesped: nombre,
          fecha:   x.date ? new Date(x.date).toLocaleDateString('es-AR') : '',
          desc:    x.description,
          cat:     x.category || 'otro',
          monto:   (x.amount || 0).toFixed(2)
        });
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_financiero_${start}_${end}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Error generando reporte financiero', error: err.message });
  }
};
