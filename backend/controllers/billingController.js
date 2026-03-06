// controllers/billingController.js
// Controlador para gestión de facturación y pagos

const Reservation = require('../models/Reservation');
const RoomType = require('../models/RoomType');
const BillingService = require('../services/billingService');
const auditService = require('../services/auditService');

/**
 * Obtener tipos de habitación con precios
 */
const getRoomTypes = async (req, res) => {
  try {
    const roomTypes = await RoomType.find({ isActive: true }).sort({ basePrice: 1 });
    
    res.json({
      success: true,
      data: roomTypes.map(rt => ({
        id: rt._id,
        name: rt.name,
        basePrice: rt.basePrice,
        formattedPrice: rt.formattedPrice,
        currency: rt.currency,
        capacity: rt.capacity,
        description: rt.description,
        amenities: rt.amenities
      }))
    });
    
  } catch (error) {
    console.error('Error obteniendo tipos de habitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tipos de habitación',
      error: error.message
    });
  }
};

/**
 * Actualizar precio de tipo de habitación
 */
const updateRoomTypePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { basePrice, description, amenities } = req.body;
    
    // Validar precio
    if (basePrice && (basePrice <= 0 || isNaN(basePrice))) {
      return res.status(400).json({
        success: false,
        message: 'El precio debe ser un número mayor a 0'
      });
    }
    
    const updateData = {};
    if (basePrice !== undefined) updateData.basePrice = basePrice;
    if (description !== undefined) updateData.description = description;
    if (amenities !== undefined) updateData.amenities = amenities;
    
    const roomType = await RoomType.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de habitación no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Precio actualizado correctamente',
      data: {
        id: roomType._id,
        name: roomType.name,
        basePrice: roomType.basePrice,
        formattedPrice: roomType.formattedPrice,
        description: roomType.description,
        amenities: roomType.amenities
      }
    });
    
  } catch (error) {
    console.error('Error actualizando precio:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando precio',
      error: error.message
    });
  }
};

/**
 * Calcular precio de reserva
 */
const calculateReservationPrice = async (req, res) => {
  try {
    const { tipo, cantidad, checkIn, checkOut } = req.body;
    
    // Validar campos requeridos
    if (!tipo || !cantidad || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: tipo, cantidad, checkIn, checkOut'
      });
    }
    
    const pricing = await BillingService.calculateReservationPricing({
      tipo, cantidad, checkIn, checkOut
    });
    
    res.json({
      success: true,
      data: pricing
    });
    
  } catch (error) {
    console.error('Error calculando precio:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculando precio de reserva',
      error: error.message
    });
  }
};

/**
 * Procesar pago
 */
const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, transactionId, notes } = req.body;
    
    // Validar campos requeridos
    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: amount, method'
      });
    }
    
    // Validar método de pago
    const validMethods = ['efectivo', 'tarjeta', 'transferencia', 'cheque'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `Método de pago inválido. Métodos válidos: ${validMethods.join(', ')}`
      });
    }
    
    const result = await BillingService.processPayment(id, {
      amount: parseFloat(amount),
      method,
      transactionId,
      notes
    });
    
    // Emitir evento WebSocket
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'payment_processed',
            reservationId: id,
            payment: result.payment
          }));
        }
      });
    }
    
    // Registrar en auditoría
    auditService.log({
      action: 'PAGO_PROCESADO',
      entity: 'Reservation',
      entityId: id,
      userId: req.user?._id || req.user?.id,
      userEmail: req.user?.email || 'sistema',
      userRole: req.user?.role || 'sistema',
      description: `Pago $_{ parseFloat(amount)} por ${method} registrado en reserva ${String(id).slice(-6).toUpperCase()}`,
      details: { amount: parseFloat(amount), method, transactionId, notes },
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Pago procesado correctamente',
      data: result
    });
    
  } catch (error) {
    console.error('Error procesando pago:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error procesando pago',
      error: error.message
    });
  }
};

/**
 * Obtener información de facturación de una reserva
 */
const getReservationBilling = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservation = await Reservation.findById(id)
      .populate('client', 'nombre apellido email telefono dni')
      .populate('room', 'number type');
    
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }
    
    if (!reservation.pricing || !reservation.pricing.total) {
      const pricing = await BillingService.calculateReservationPricing({
        tipo: reservation.tipo,
        cantidad: reservation.cantidad,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut
      });
      reservation.pricing = pricing;
      await reservation.save();
    }
    
    const total = reservation.pricing.total || 0;
    const paid = reservation.payment.amountPaid || 0;
    
    res.json({
      success: true,
      data: {
        id: reservation._id,
        client: reservation.client ? {
          name: `${reservation.client.nombre} ${reservation.client.apellido}`,
          email: reservation.client.email,
          phone: reservation.client.telefono,
          dni: reservation.client.dni
        } : null,
        reservation: {
          tipo: reservation.tipo,
          cantidad: reservation.cantidad,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          status: reservation.status,
          rooms: reservation.room
        },
        pricing: reservation.pricing,
        extras: reservation.extras || [],
        payment: reservation.payment,
        paymentHistory: reservation.paymentHistory || [],
        invoice: reservation.invoice,
        balance: { total, paid, pending: Math.max(0, total - paid) }
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo información de facturación:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo información de facturación', error: error.message });
  }
};

/**
 * Agregar cargo extra a una reserva activa
 */
const addCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, category } = req.body;
    if (!description || !amount) {
      return res.status(400).json({ success: false, message: 'Faltan campos: description, amount' });
    }
    const result = await BillingService.addCharge(id, {
      description,
      amount: parseFloat(amount),
      category
    });
    const wss = req.app.get('wss');
    if (wss) {
      wss.clients.forEach(c => {
        if (c.readyState === 1) c.send(JSON.stringify({ type: 'charge_added', reservationId: id, extras: result.extras }));
      });
    }
    auditService.log({
      action: 'CARGO_AGREGADO',
      entity: 'Reservation',
      entityId: id,
      userId: req.user?._id || req.user?.id,
      userEmail: req.user?.email || 'sistema',
      userRole: req.user?.role || 'sistema',
      description: `Cargo extra "${description}" $${parseFloat(amount)} en reserva ${String(id).slice(-6).toUpperCase()}`,
      details: { description, amount: parseFloat(amount), category },
      ip: req.ip
    });

    res.json({ success: true, message: 'Cargo agregado correctamente', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Error agregando cargo' });
  }
};

/**
 * Obtener resumen financiero
 */
const getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Fechas por defecto: último mes
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
    
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : defaultEndDate;
    
    const summary = await BillingService.getFinancialSummary(start, end);
    
    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end
        },
        summary
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo resumen financiero:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo resumen financiero',
      error: error.message
    });
  }
};

/**
 * Obtener facturas pendientes
 */
const getPendingInvoices = async (req, res) => {
  try {
    const pendingInvoices = await BillingService.getPendingInvoices();
    
    res.json({
      success: true,
      data: pendingInvoices
    });
    
  } catch (error) {
    console.error('Error obteniendo facturas pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo facturas pendientes',
      error: error.message
    });
  }
};

/**
 * Generar factura para una reserva
 */
const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservation = await Reservation.findById(id)
      .populate('client', 'nombre apellido email telefono')
      .populate('room', 'number type');
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada'
      });
    }
    
    // Generar número de factura si no existe
    if (!reservation.invoice.number) {
      reservation.invoice.number = BillingService.generateInvoiceNumber();
      reservation.invoice.issueDate = new Date();
      reservation.invoice.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
      await reservation.save();
    }
    
    res.json({
      success: true,
      message: 'Factura generada correctamente',
      data: {
        invoiceNumber: reservation.invoice.number,
        issueDate: reservation.invoice.issueDate,
        dueDate: reservation.invoice.dueDate,
        reservation: {
          id: reservation._id,
          client: reservation.client,
          pricing: reservation.pricing,
          payment: reservation.payment
        }
      }
    });
    
  } catch (error) {
    console.error('Error generando factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando factura',
      error: error.message
    });
  }
};

/**
 * Generar y descargar factura en PDF para una reserva
 * GET /api/billing/reservations/:id/invoice/pdf
 */
const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id)
      .populate('client', 'nombre apellido email telefono dni')
      .populate('room', 'number type');

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    const PDFDocument = require('pdfkit');

    // Calcular precios si no existen
    if (!reservation.pricing || !reservation.pricing.total) {
      const pricing = await BillingService.calculateReservationPricing({
        tipo: reservation.tipo, cantidad: reservation.cantidad,
        checkIn: reservation.checkIn, checkOut: reservation.checkOut
      });
      reservation.pricing = pricing;
      await reservation.save();
    }

    // Asignar número de factura si no existe
    if (!reservation.invoice || !reservation.invoice.number) {
      if (!reservation.invoice) reservation.invoice = {};
      reservation.invoice.number = BillingService.generateInvoiceNumber();
      reservation.invoice.issueDate = new Date();
      await reservation.save();
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura_${reservation.invoice.number}.pdf`);
    doc.pipe(res);

    const client = reservation.client;
    const pricing = reservation.pricing;
    const payment = reservation.payment || {};
    const extras = reservation.extras || [];
    const paymentHistory = reservation.paymentHistory || [];
    const total = pricing.total || 0;
    const paid = payment.amountPaid || 0;
    const balance = Math.max(0, total - paid);
    const W = 495;

    const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 100).fill('#0f172a');
    doc.fillColor('#0099ff').font('Helvetica-Bold').fontSize(26).text('FACTURA', 50, 28);
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
       .text('Sistema de Gestión Hotelera', 50, 62)
       .text('contacto@mihotel.com.ar', 50, 76);
    doc.fillColor('#60a5fa').font('Helvetica-Bold').fontSize(11)
       .text(`N° ${reservation.invoice.number}`, 380, 28, { width: 165, align: 'right' });
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
       .text(`Fecha: ${fmtDate(reservation.invoice.issueDate)}`, 380, 48, { width: 165, align: 'right' })
       .text(`ID: ${String(id).slice(-8).toUpperCase()}`, 380, 62, { width: 165, align: 'right' });

    let y = 120;

    // ── Info de huésped y estadía ────────────────────────────────────────────
    doc.rect(50, y, 235, 85).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#0099ff').font('Helvetica-Bold').fontSize(9).text('HUÉSPED', 62, y + 10);
    if (client) {
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10).text(`${client.nombre || ''} ${client.apellido || ''}`, 62, y + 24);
      doc.fillColor('#6b7280').font('Helvetica').fontSize(9)
         .text(`DNI: ${client.dni || '—'}`, 62, y + 40)
         .text(client.email || '—', 62, y + 54)
         .text(`Tel: ${client.telefono || '—'}`, 62, y + 68);
    } else {
      doc.fillColor('#374151').font('Helvetica').fontSize(9).text('Sin datos de cliente', 62, y + 24);
    }
    doc.rect(305, y, 235, 85).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#0099ff').font('Helvetica-Bold').fontSize(9).text('ESTADÍA', 317, y + 10);
    doc.fillColor('#374151').font('Helvetica').fontSize(9)
       .text(`Check-in:   ${fmtDate(reservation.checkIn)}`, 317, y + 24)
       .text(`Check-out:  ${fmtDate(reservation.checkOut)}`, 317, y + 38)
       .text(`Tipo:       ${reservation.tipo || '—'}`, 317, y + 52)
       .text(`Huéspedes:  ${reservation.cantidad || '—'}`, 317, y + 66);

    y += 100;

    // ── Tabla de conceptos ──────────────────────────────────────────────────
    doc.rect(50, y, W, 20).fill('#0f172a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
       .text('CONCEPTO', 62, y + 6)
       .text('IMPORTE', 490, y + 6, { width: 50, align: 'right' });
    y += 20;

    const lineItems = [
      { label: `Alojamiento — ${reservation.tipo}, ${reservation.cantidad} pers.`, amount: pricing.subtotal || 0 },
      ...(pricing.taxes > 0 ? [{ label: 'Impuestos y cargos', amount: pricing.taxes }] : []),
      ...extras.map(e => ({ label: `Extra: ${e.description}${e.category ? ' (' + e.category + ')' : ''}`, amount: e.amount }))
    ];

    lineItems.forEach((item, i) => {
      doc.rect(50, y, W, 18).fill(i % 2 === 0 ? '#ffffff' : '#f8fafc');
      doc.fillColor('#374151').font('Helvetica').fontSize(9)
         .text(item.label, 62, y + 4, { width: 380 })
         .text(fmt(item.amount), 490, y + 4, { width: 50, align: 'right' });
      y += 18;
    });

    y += 8;
    doc.moveTo(350, y).lineTo(545, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    y += 8;

    // Subtotales
    const subtotalRows = [
      { label: 'Subtotal alojamiento', val: pricing.subtotal || 0 },
      { label: 'Cargos extra', val: extras.reduce((s, e) => s + (e.amount || 0), 0) },
      { label: 'TOTAL FACTURADO', val: total, bold: true },
      { label: 'Total pagado', val: paid },
      { label: balance > 0 ? 'SALDO PENDIENTE' : '✓ SALDADO', val: balance, highlight: true, isDebt: balance > 0 }
    ];

    subtotalRows.forEach(row => {
      let color = '#374151';
      if (row.bold) color = '#0099ff';
      else if (row.highlight) color = row.isDebt ? '#dc2626' : '#16a34a';
      const bold = row.bold || row.highlight;
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
         .text(row.label, 340, y, { width: 150, align: 'right' })
         .text(fmt(row.val), 490, y, { width: 50, align: 'right' });
      y += bold ? 16 : 14;
    });

    // ── Historial de pagos ──────────────────────────────────────────────────
    if (paymentHistory.length > 0) {
      y += 14;
      doc.rect(50, y, W, 18).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('HISTORIAL DE PAGOS', 62, y + 4);
      y += 18;
      paymentHistory.forEach((p, i) => {
        doc.rect(50, y, W, 16).fill(i % 2 === 0 ? '#ffffff' : '#f8fafc');
        const methodLabel = p.method === 'efectivo' ? 'Efectivo' : p.method === 'tarjeta' ? 'Tarjeta' : p.method === 'transferencia' ? 'Transferencia' : (p.method || '—');
        doc.fillColor('#374151').font('Helvetica').fontSize(9)
           .text(`${fmtDate(p.date)} — ${methodLabel}${p.notes ? ' — ' + p.notes : ''}`, 62, y + 3, { width: 360 })
           .text(fmt(p.amount), 490, y + 3, { width: 50, align: 'right' });
        y += 16;
      });
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.moveTo(50, 800).lineTo(545, 800).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
       .text('Gracias por elegir nuestro hotel. Este documento es válido como comprobante de pago.', 50, 808, { align: 'center', width: W })
       .text(`Generado: ${new Date().toLocaleString('es-AR')} — Sistema CRM Hotelero`, 50, 820, { align: 'center', width: W });

    doc.end();

  } catch (error) {
    console.error('Error generando PDF de factura:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error generando PDF de factura', error: error.message });
    }
  }
};

module.exports = {
  getRoomTypes,
  updateRoomTypePrice,
  calculateReservationPrice,
  processPayment,
  getReservationBilling,
  getFinancialSummary,
  getPendingInvoices,
  generateInvoice,
  generateInvoicePDF,
  addCharge
};