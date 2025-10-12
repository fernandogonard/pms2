// controllers/billingController.js
// Controlador para gestión de facturación y pagos

const Reservation = require('../models/Reservation');
const RoomType = require('../models/RoomType');
const BillingService = require('../services/billingService');

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
      .populate('client', 'nombre apellido email telefono')
      .populate('room', 'number type');
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada'
      });
    }
    
    // Si no tiene información de precios, calcularla
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
    
    res.json({
      success: true,
      data: {
        id: reservation._id,
        client: {
          name: `${reservation.client.nombre} ${reservation.client.apellido}`,
          email: reservation.client.email,
          phone: reservation.client.telefono
        },
        reservation: {
          tipo: reservation.tipo,
          cantidad: reservation.cantidad,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          status: reservation.status,
          rooms: reservation.room
        },
        pricing: reservation.pricing,
        payment: reservation.payment,
        invoice: reservation.invoice,
        balance: {
          total: reservation.pricing.total,
          paid: reservation.payment.amountPaid,
          pending: reservation.pricing.total - reservation.payment.amountPaid
        }
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo información de facturación:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información de facturación',
      error: error.message
    });
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

module.exports = {
  getRoomTypes,
  updateRoomTypePrice,
  calculateReservationPrice,
  processPayment,
  getReservationBilling,
  getFinancialSummary,
  getPendingInvoices,
  generateInvoice
};